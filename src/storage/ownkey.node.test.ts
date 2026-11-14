import { describe, expect, it } from "vitest";
import { memoryDevice } from "../test/device.ts";
import { eraseAccount, eraseDevice, eraseProfile } from "./erase.ts";
import { deviceKeyStore, keptKey } from "./ownkey.ts";
import { addProfile, type KeptKey, openProfile } from "./profile.ts";
import { setAccount } from "./registry.ts";
import { PROFILE_SCHEMA, profileDatabase } from "./schema.ts";

// A synthetic key: no provider issued it.
const KEY: KeptKey = {
  provider: "anthropic",
  name: "Anthropic",
  key: "sk-ant-synthetic-0000-a1b2",
  last4: "a1b2",
};

describe("the own key on the device", () => {
  it("keeps none until it is kept, and keeps one key, the last", async () => {
    const { device } = memoryDevice();
    const store = deviceKeyStore(device);
    expect(await store.read("p1")).toBeUndefined();
    // Keeping it names the profile's database, made for it.
    expect(await store.keep("p1", KEY)).toBe("saved");
    expect(await keptKey(device, "p1")).toEqual(KEY);
    const next = { ...KEY, key: "sk-ant-synthetic-1111-c3d4", last4: "c3d4" };
    expect(await store.keep("p1", next)).toBe("saved");
    expect(await store.read("p1")).toEqual(next);
    await store.drop("p1");
    expect(await store.read("p1")).toBeUndefined();
    // A profile with no database here has nothing to drop.
    await store.drop("p2");
    expect(await openProfile(device, "p2")).toBeUndefined();
  });

  it("reads a record of another form as none, and one without its last four from the key", async () => {
    const { device } = memoryDevice();
    const profile = await addProfile(device, "p1");
    const connection = await device.connect(profileDatabase("p1"), PROFILE_SCHEMA, false);
    await connection?.write(["ownKey"], (tx) => tx.put("ownKey", "key", { provider: 1 }));
    expect(await profile?.ownKey()).toBeUndefined();
    await connection?.write(["ownKey"], (tx) =>
      tx.put("ownKey", "key", { provider: "anthropic", key: "sk-ant-synthetic-wxyz" }),
    );
    expect(await profile?.ownKey()).toEqual({
      provider: "anthropic",
      name: "anthropic",
      key: "sk-ant-synthetic-wxyz",
      last4: "wxyz",
    });
  });

  it("does not count the key in the space the profile's work takes", async () => {
    const { device } = memoryDevice();
    const profile = await addProfile(device, "p1");
    const before = await profile?.usage();
    await profile?.keepOwnKey(KEY);
    expect(await profile?.usage()).toEqual(before);
  });

  it("brings a database of version 1 to version 2, its work kept", async () => {
    const { device, backend } = memoryDevice();
    const name = profileDatabase("p1");
    const { ownKey: _, ...stores } = PROFILE_SCHEMA.stores;
    const old = await backend.open(
      name,
      { version: 1, stores },
      { create: true, onLost: () => {} },
    );
    await old?.write(["lessons"], (tx) => tx.put("lessons", "l1", { digest: "d", changedAt: 1 }));
    old?.close();
    const profile = await addProfile(device, "p1");
    expect(await profile?.digests()).toEqual(["d"]);
    expect(await profile?.keepOwnKey(KEY)).toBe("saved");
    expect(await profile?.ownKey()).toEqual(KEY);
  });

  it("goes with the profile's data, everything on the device, and the sign-out", async () => {
    for (const erase of [
      (device: Parameters<typeof eraseProfile>[0]) => eraseProfile(device, "p1"),
      // Everything on this device is the sign-out's erasure, then the device's own data.
      async (device: Parameters<typeof eraseProfile>[0]) =>
        (await eraseAccount(device)) && (await eraseDevice(device)),
      eraseAccount,
    ]) {
      const { device } = memoryDevice();
      await setAccount(device, "acc");
      await deviceKeyStore(device).keep("p1", KEY);
      await erase(device);
      expect(await keptKey(device, "p1")).toBeUndefined();
    }
  });
});
