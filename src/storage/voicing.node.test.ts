import { describe, expect, it } from "vitest";
import { memoryDevice } from "../test/device.ts";
import { accountSeen, eraseAccount, noAccess } from "./erase.ts";
import { REGISTRY, REGISTRY_SCHEMA } from "./schema.ts";
import { allowVoicing, chooseVoice, NO_VOICING, readVoicing } from "./voicing.ts";

describe("the voicing of this device", () => {
  it("is nothing chosen and no leave until an adult decides, and reading makes no database", async () => {
    const { device, backend } = memoryDevice();
    expect(await readVoicing(device)).toEqual(NO_VOICING);
    expect(backend.databases.has(REGISTRY)).toBe(false);
  });

  it("keeps the leave and the voice chosen for each language", async () => {
    const { device } = memoryDevice();
    expect(await allowVoicing(device, true)).toEqual({ allowed: true, voices: new Map() });
    await chooseVoice(device, "en", "uri:Samantha");
    expect(await chooseVoice(device, "ru", "uri:Milena")).toEqual({
      allowed: true,
      voices: new Map([
        ["en", "uri:Samantha"],
        ["ru", "uri:Milena"],
      ]),
    });
    await chooseVoice(device, "en", "uri:Daniel");
    expect(await allowVoicing(device, false)).toEqual({
      allowed: false,
      voices: new Map([
        ["en", "uri:Daniel"],
        ["ru", "uri:Milena"],
      ]),
    });
    expect(await readVoicing(device)).toEqual({
      allowed: false,
      voices: new Map([
        ["en", "uri:Daniel"],
        ["ru", "uri:Milena"],
      ]),
    });
  });

  it("goes with the registry when the owner signs out", async () => {
    const { device } = memoryDevice();
    await allowVoicing(device, true);
    await chooseVoice(device, "en", "uri:Samantha");
    await eraseAccount(device);
    expect(await readVoicing(device)).toEqual(NO_VOICING);
  });

  it("reads only what it knows of a record, and nothing of a registry it cannot read", async () => {
    const { device } = memoryDevice();
    await allowVoicing(device, true);
    const connection = await device.connect(REGISTRY, REGISTRY_SCHEMA, false);
    await connection?.write(["registry"], (tx) =>
      tx.put("registry", "voicing", { allowed: "yes", voices: { en: 7, ru: "uri:Milena" } }),
    );
    expect(await readVoicing(device)).toEqual({
      allowed: false,
      voices: new Map([["ru", "uri:Milena"]]),
    });
    const broken = memoryDevice();
    await broken.backend.open(
      REGISTRY,
      { version: 99, stores: {} },
      { create: true, onLost: () => {} },
    );
    expect(await readVoicing(broken.device)).toEqual(NO_VOICING);
    expect(await allowVoicing(broken.device, true)).toBeUndefined();
    expect(await chooseVoice(broken.device, "en", "uri:Samantha")).toBeUndefined();
  });
});

describe("the voicing of this device, when another account signs in", () => {
  it("goes, with what was left of the account before", async () => {
    const { device } = memoryDevice();
    await accountSeen(device, "account-1");
    await allowVoicing(device, true);
    // The same account again keeps it.
    await accountSeen(device, "account-1");
    expect((await readVoicing(device)).allowed).toBe(true);
    await accountSeen(device, "account-2");
    expect(await readVoicing(device)).toEqual(NO_VOICING);
    await allowVoicing(device, true);
    await noAccess(device);
    expect(await readVoicing(device)).toEqual(NO_VOICING);
  });
});
