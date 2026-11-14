import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { describe, expect, it } from "vitest";
import { clockOffsetMinutes } from "../api/keys.ts";
import { deviceKeyStore, type KeyStore, keptKey } from "../storage/ownkey.ts";
import type { KeptKey } from "../storage/profile.ts";
import { memoryDevice } from "../test/device.ts";
import { KeyHolder, noKeyHolder, refusesKey } from "./holder.ts";

// Synthetic keys: no provider issued them.
const KEY = { provider: "anthropic", name: "Anthropic", key: "sk-ant-synthetic-0000-a1b2" };
const NEXT = { provider: "anthropic", name: "Anthropic", key: "sk-ant-synthetic-1111-c3d4" };
const NOW = new Date(Date.UTC(2026, 0, 15));
const OFFSET = { clockOffsetMinutes: clockOffsetMinutes(NOW) };

function setUp() {
  const { device } = memoryDevice();
  const told: string[] = [];
  const holder = new KeyHolder(deviceKeyStore(device), (profileId) => told.push(profileId));
  return { device, holder, told };
}

/** A store whose writes do not reach the device, as a full disk. */
function failingStore(kept?: KeptKey): KeyStore {
  return {
    read: async () => kept,
    keep: async () => "unsaved",
    drop: async () => {},
  };
}

describe("the holder of the own key", () => {
  it("gives no key with no owner profile open, nor for any other profile", async () => {
    const { holder } = setUp();
    expect(holder.aiFields("owner", NOW)).toEqual(OFFSET);
    expect(holder.routeFields("owner")).toEqual({});
    expect(await holder.connect("owner", KEY, false)).toBe("unsaved");
    await holder.open("owner");
    expect(await holder.connect("owner", KEY, false)).toBe("saved");
    expect(holder.aiFields("child", NOW)).toEqual(OFFSET);
    expect(holder.routeFields("child")).toEqual({});
    // Outside the account, as in a screen's own test: nothing.
    const none = noKeyHolder();
    await none.open("owner");
    expect(await none.connect("owner", KEY, true)).toBe("unsaved");
    expect(none.aiFields("owner", NOW)).toEqual(OFFSET);
  });

  it("sends the key without the clock's offset, and the provider alone where a choice is given", async () => {
    const { holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, false);
    const fields = holder.aiFields("owner", NOW);
    expect(fields).not.toHaveProperty("clockOffsetMinutes");
    expect(fields).toMatchObject({ ownKey: { provider: "anthropic", key: KEY.key } });
    expect(holder.routeFields("owner")).toEqual({ ownKeyProvider: "anthropic" });
  });

  it("shows the key by its provider and last four alone, never whole", async () => {
    const { holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, false);
    const state = holder.snapshot();
    expect(state).toEqual({
      status: "open",
      profileId: "owner",
      key: { provider: "anthropic", name: "Anthropic", last4: "a1b2", kept: false },
    });
    expect(JSON.stringify(state)).not.toContain(KEY.key);
  });

  it("writes the key to the device only with the mark, and a mark taken off erases it there", async () => {
    const { device, holder, told } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, false);
    expect(await keptKey(device, "owner")).toBeUndefined();
    expect(await holder.setKeep("owner", true)).toBe("saved");
    expect(await keptKey(device, "owner")).toMatchObject({ key: KEY.key, last4: "a1b2" });
    expect(holder.snapshot()).toMatchObject({ key: { kept: true } });
    expect(await holder.setKeep("owner", false)).toBe("saved");
    expect(await keptKey(device, "owner")).toBeUndefined();
    // Memory keeps it while the profile is open.
    expect(holder.routeFields("owner")).toEqual({ ownKeyProvider: "anthropic" });
    expect(told).toEqual(["owner", "owner", "owner"]);
  });

  it("takes the key kept on this device when the owner profile opens again", async () => {
    const { holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, true);
    holder.close();
    expect(holder.aiFields("owner", NOW)).toEqual(OFFSET);
    expect(holder.snapshot()).toEqual({ status: "closed" });
    await holder.open("owner");
    expect(holder.snapshot()).toMatchObject({ key: { last4: "a1b2", kept: true } });
    expect(holder.routeFields("owner")).toEqual({ ownKeyProvider: "anthropic" });
  });

  it("forgets a key not kept when the owner profile closes: Switch learner, a reload, the sign-out", async () => {
    const { holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, false);
    holder.close();
    await holder.open("owner");
    expect(holder.snapshot()).toEqual({ status: "open", profileId: "owner" });
    expect(holder.aiFields("owner", NOW)).toEqual(OFFSET);
  });

  it("puts a new key in place of the former one, on the device too, or in memory alone", async () => {
    const { device, holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, true);
    await holder.connect("owner", NEXT, false);
    // Not kept: the former one kept is erased.
    expect(await keptKey(device, "owner")).toBeUndefined();
    expect(holder.aiFields("owner")).toMatchObject({ ownKey: { key: NEXT.key } });
    await holder.connect("owner", KEY, true);
    expect(await keptKey(device, "owner")).toMatchObject({ key: KEY.key });
  });

  it("says when the key was to be kept and was not: memory alone, and nothing former kept", async () => {
    const holder = new KeyHolder(failingStore());
    await holder.open("owner");
    expect(await holder.connect("owner", KEY, true)).toBe("unsaved");
    expect(holder.snapshot()).toMatchObject({ key: { kept: false } });
    expect(holder.routeFields("owner")).toEqual({ ownKeyProvider: "anthropic" });
    expect(await holder.setKeep("owner", true)).toBe("unsaved");
    // No key: nothing to keep.
    await holder.remove("owner");
    expect(await holder.setKeep("owner", true)).toBe("unsaved");
  });

  it("removes the key from memory and the device, and from the device alone with no profile open", async () => {
    const { device, holder, told } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, true);
    await holder.remove("owner");
    expect(holder.snapshot()).toEqual({ status: "open", profileId: "owner" });
    expect(holder.aiFields("owner", NOW)).toEqual(OFFSET);
    expect(await keptKey(device, "owner")).toBeUndefined();
    await holder.connect("owner", KEY, true);
    holder.close();
    await holder.remove("owner");
    expect(await keptKey(device, "owner")).toBeUndefined();
    expect(told.at(-1)).toBe("owner");
  });

  it("hears another tab: the key in memory goes, and the one kept on the device comes", async () => {
    const { device } = memoryDevice();
    const store = deviceKeyStore(device);
    const here = new KeyHolder(store);
    const there = new KeyHolder(store);
    await here.open("owner");
    await there.open("owner");
    await here.connect("owner", KEY, false);
    // Another tab replaced it and keeps the new one here.
    await there.connect("owner", NEXT, true);
    await here.heard("owner");
    expect(here.aiFields("owner")).toMatchObject({ ownKey: { key: NEXT.key } });
    // Another tab removed it.
    await there.remove("owner");
    await here.heard("owner");
    expect(here.routeFields("owner")).toEqual({});
    // A profile not open here, or none open, hears nothing.
    await here.heard("child");
    here.close();
    await here.heard("owner");
    expect(here.snapshot()).toEqual({ status: "closed" });
  });

  it("drops a read of the device that a closing outran", async () => {
    let release: (kept: KeptKey | undefined) => void = () => {};
    const store: KeyStore = {
      read: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      keep: async () => "saved",
      drop: async () => {},
    };
    const holder = new KeyHolder(store);
    const opening = holder.open("owner");
    expect(holder.snapshot()).toEqual({ status: "opening", profileId: "owner" });
    // The same profile opening again waits for the same read.
    await holder.open("owner");
    holder.close();
    release({ ...KEY, last4: "a1b2" });
    await opening;
    expect(holder.snapshot()).toEqual({ status: "closed" });
  });

  it("keeps a refusal of the key or its limit beside it, until a call on it gives what it was for", async () => {
    const { holder } = setUp();
    const listened: string[] = [];
    holder.subscribe(() => listened.push(holder.snapshot().status));
    await holder.open("owner");
    // With no key, an outcome is platform AI's, not the owner's to act on.
    holder.noteOutcome("owner", { cause: Cause.KEY_REFUSED }, holder.aiFields("owner"));
    expect(holder.snapshot()).not.toHaveProperty("refusal");
    await holder.connect("owner", KEY, false);
    const sent = holder.aiFields("owner");
    holder.noteOutcome("owner", { cause: Cause.AI_FAILURE }, sent);
    expect(holder.snapshot()).not.toHaveProperty("refusal");
    holder.noteOutcome("owner", { cause: Cause.LIMIT_REACHED }, sent);
    expect(holder.snapshot()).toMatchObject({ refusal: { cause: Cause.LIMIT_REACHED } });
    // A moment's failure leaves it; a call that gave what it was for takes it away.
    holder.noteOutcome("owner", { cause: Cause.AI_FAILURE }, sent);
    expect(holder.snapshot()).toMatchObject({ refusal: { cause: Cause.LIMIT_REACHED } });
    holder.noteOutcome("owner", undefined, sent);
    expect(holder.snapshot()).not.toHaveProperty("refusal");
    holder.noteOutcome("owner", { cause: Cause.KEY_REFUSED }, sent);
    // A new key, accepted, has no refusal of the former, and a call sent with the former says
    // nothing of it.
    await holder.connect("owner", NEXT, false);
    expect(holder.snapshot()).not.toHaveProperty("refusal");
    holder.noteOutcome("owner", { cause: Cause.KEY_REFUSED }, sent);
    expect(holder.snapshot()).not.toHaveProperty("refusal");
    expect(listened.length).toBeGreaterThan(0);
  });

  it("hears another tab in one step: the key in memory stays until the one kept is read", async () => {
    const { device } = memoryDevice();
    const store = deviceKeyStore(device);
    const here = new KeyHolder(store);
    const there = new KeyHolder(store);
    await here.open("owner");
    await there.open("owner");
    await there.connect("owner", KEY, true);
    await here.heard("owner");
    const seen: unknown[] = [];
    here.subscribe(() => seen.push(here.snapshot()));
    // The other tab sets the mark again: the same key, never none in between.
    await there.setKeep("owner", true);
    await here.heard("owner");
    expect(seen.every((state) => (state as { key?: unknown }).key !== undefined)).toBe(true);
    expect(here.routeFields("owner")).toEqual({ ownKeyProvider: "anthropic" });
  });

  it("keeps a change made here while it read what another tab changed", async () => {
    let release: (kept: KeptKey | undefined) => void = () => {};
    let reads = 0;
    const store: KeyStore = {
      read: (): Promise<KeptKey | undefined> => {
        reads += 1;
        if (reads === 1) return Promise.resolve(undefined);
        return new Promise((resolve) => {
          release = resolve;
        });
      },
      keep: async () => "saved",
      drop: async () => {},
    };
    const holder = new KeyHolder(store);
    await holder.open("owner");
    const hearing = holder.heard("owner");
    await holder.connect("owner", NEXT, false);
    release({ ...KEY, last4: "a1b2" });
    await hearing;
    expect(holder.aiFields("owner")).toMatchObject({ ownKey: { key: NEXT.key } });
  });

  it("reads the device again when another tab changed it while the profile was opening", async () => {
    const releases: ((kept: KeptKey | undefined) => void)[] = [];
    const store: KeyStore = {
      read: () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
      keep: async () => "saved",
      drop: async () => {},
    };
    const holder = new KeyHolder(store);
    const opening = holder.open("owner");
    const hearing = holder.heard("owner");
    // The first read holds the key the other tab removed since; the second, none.
    releases[0]?.({ ...KEY, last4: "a1b2" });
    releases[1]?.(undefined);
    await Promise.all([opening, hearing]);
    expect(holder.snapshot()).toEqual({ status: "open", profileId: "owner" });
  });

  it("writes to the device in turn, and says kept only of the key it kept", async () => {
    const { device, holder } = setUp();
    await holder.open("owner");
    await holder.connect("owner", KEY, false);
    // The mark set, then at once a new key not kept: the device ends with none.
    const keeping = holder.setKeep("owner", true);
    const replacing = holder.connect("owner", NEXT, false);
    await Promise.all([keeping, replacing]);
    expect(await keptKey(device, "owner")).toBeUndefined();
    expect(holder.snapshot()).toMatchObject({ key: { last4: "c3d4", kept: false } });
  });

  it("marks a key the device did not take, until a write of it goes through", async () => {
    let full = true;
    const { device } = memoryDevice();
    const store = deviceKeyStore(device);
    const holder = new KeyHolder({
      ...store,
      keep: (profileId, kept) => (full ? Promise.resolve("unsaved") : store.keep(profileId, kept)),
    });
    await holder.open("owner");
    await holder.connect("owner", KEY, true);
    expect(holder.snapshot()).toMatchObject({ key: { kept: false, unsaved: true } });
    full = false;
    await holder.setKeep("owner", true);
    expect(holder.snapshot()).toMatchObject({ key: { kept: true } });
    expect(holder.snapshot()).not.toHaveProperty("key.unsaved");
  });

  it("tells a refusal of the key and its limit from every other outcome", () => {
    expect(refusesKey({ cause: Cause.KEY_REFUSED })).toBe(true);
    expect(refusesKey({ cause: Cause.LIMIT_REACHED })).toBe(true);
    for (const cause of [Cause.QUOTA, Cause.AI_FAILURE, Cause.NOT_ADMITTED]) {
      expect(refusesKey({ cause })).toBe(false);
    }
    expect(refusesKey(undefined)).toBe(false);
  });
});
