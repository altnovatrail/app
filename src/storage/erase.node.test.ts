// Every erasure of section 3.2 of docs/architecture.md that the first app has, on the store in
// memory: what goes, what stays, and what a database the browser did not delete leaves named.
import { describe, expect, it, vi } from "vitest";
import { memoryDevice } from "../test/device.ts";
import { openCache } from "./cache.ts";
import type { Device } from "./device.ts";
import {
  accountSeen,
  eraseAccount,
  noAccess,
  profilesListed,
  signInProject,
  versionsWithdrawn,
} from "./erase.ts";
import { addProfile, openProfile } from "./profile.ts";
import { readRegistry, setAccount, setSignIn } from "./registry.ts";
import { CACHE, FIREBASE_AUTH, profileDatabase, REGISTRY, SETTINGS } from "./schema.ts";
import { readLanguage, writeLanguage } from "./settings.ts";

const SIGN_IN = { projectId: "example-project", apiKey: "synthetic-web-api-key" };
const TASK = {
  id: "probe",
  statement: [{ text: "Write the answer." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
} as const;

/** A device with an account, two profiles, the cache, a chosen language and a session. */
async function signedIn() {
  const setup = memoryDevice();
  const { device, backend } = setup;
  await writeLanguage(device, "ru");
  await setAccount(device, "account-1");
  await setSignIn(device, SIGN_IN);
  await addProfile(device, "p1");
  await addProfile(device, "p2");
  await openCache(device);
  await backend.open(
    FIREBASE_AUTH,
    { version: 1, stores: { firebaseLocalStorage: {} } },
    {
      create: true,
      onLost: () => {},
    },
  );
  return setup;
}

const names = (setup: { backend: { databases: Map<string, unknown> } }) =>
  [...setup.backend.databases.keys()].sort();

const PROFILES = [profileDatabase("p1"), profileDatabase("p2")];

describe("sign-out of the account's owner, and an account that is no more", () => {
  it("erases every database of the account, the web storage and last the registry, and leaves the settings", async () => {
    const setup = await signedIn();
    expect(await eraseAccount(setup.device)).toBe(true);
    expect(names(setup)).toEqual([FIREBASE_AUTH, SETTINGS].sort());
    expect(setup.state.cleared).toBe(1);
    expect(await readLanguage(setup.device)).toBe("ru");
  });

  it("keeps the registry, ending, while a database is not erased, and names only what is left", async () => {
    const setup = await signedIn();
    setup.backend.failing.add(profileDatabase("p2"));
    expect(await eraseAccount(setup.device)).toBe(false);
    const registry = await readRegistry(setup.device);
    expect(registry?.account).toBeUndefined();
    expect(registry?.ending).toBe(true);
    expect([...(registry?.databases.keys() ?? [])]).toEqual([profileDatabase("p2")]);
    expect(registry?.databases.get(profileDatabase("p2"))?.erase).toBe(true);
    expect(setup.backend.databases.has(profileDatabase("p1"))).toBe(false);
  });

  it("clears the web storage even with no registry", async () => {
    const setup = memoryDevice();
    expect(await eraseAccount(setup.device)).toBe(true);
    expect(setup.state.cleared).toBe(1);
  });

  it("says so when the registry itself could not go", async () => {
    const setup = await signedIn();
    setup.backend.failing.add(REGISTRY);
    expect(await eraseAccount(setup.device)).toBe(false);
  });
});

describe("another account signed in", () => {
  it("is nothing to erase for the account the registry names, or with no registry", async () => {
    const setup = await signedIn();
    expect(await accountSeen(setup.device, "account-1")).toBe(true);
    expect(names(setup)).toContain(profileDatabase("p1"));
    const fresh = memoryDevice();
    expect(await accountSeen(fresh.device, "account-1")).toBe(true);
    expect((await readRegistry(fresh.device))?.account).toBe("account-1");
  });

  it("erases what is left of the account before, keeps the session and the settings, and names the new one", async () => {
    const setup = await signedIn();
    expect(await accountSeen(setup.device, "account-2")).toBe(true);
    expect(names(setup)).toEqual([FIREBASE_AUTH, REGISTRY, SETTINGS].sort());
    const registry = await readRegistry(setup.device);
    expect(registry?.account).toBe("account-2");
    expect(registry?.signIn).toEqual(SIGN_IN);
    expect(registry?.databases.size).toBe(0);
    expect(setup.state.cleared).toBe(0);
  });

  it("after a sign-out cut short, ends it and leaves the rest to the start", async () => {
    const setup = await signedIn();
    setup.backend.failing.add(profileDatabase("p1"));
    await eraseAccount(setup.device);
    expect(await accountSeen(setup.device, "account-2")).toBe(true);
    const registry = await readRegistry(setup.device);
    expect(registry?.ending).toBe(false);
    expect(registry?.databases.get(profileDatabase("p1"))?.erase).toBe(true);
  });

  it("with no account of NovaTrail — no access — erases the account the registry names", async () => {
    const setup = await signedIn();
    expect(await noAccess(setup.device)).toBe(true);
    expect(names(setup)).toEqual([FIREBASE_AUTH, REGISTRY, SETTINGS].sort());
    const registry = await readRegistry(setup.device);
    expect(registry?.account).toBeUndefined();
    expect(registry?.signIn).toEqual(SIGN_IN);
    const fresh = memoryDevice();
    expect(await noAccess(fresh.device)).toBe(true);
    expect(names(fresh)).toEqual([]);
  });
});

describe("profiles deleted on another device", () => {
  it("go by the list of the account the registry names, and the others stay", async () => {
    const setup = await signedIn();
    expect(await profilesListed(setup.device, "account-1", ["p2"])).toBe(true);
    expect(names(setup)).not.toContain(profileDatabase("p1"));
    expect(names(setup)).toContain(profileDatabase("p2"));
    expect(names(setup)).toContain(CACHE);
  });

  it("stay for the list of another account, and with no registry", async () => {
    const setup = await signedIn();
    expect(await profilesListed(setup.device, "account-2", [])).toBe(true);
    expect(names(setup)).toEqual(expect.arrayContaining(PROFILES));
    expect(await profilesListed(memoryDevice().device, "account-1", [])).toBe(true);
  });
});

describe("another project of the sign-in service", () => {
  it("is nothing to erase with no registry, no project in it, or the same project", async () => {
    expect(await signInProject(memoryDevice().device, SIGN_IN)).toBe("same");
    const setup = await signedIn();
    expect(await signInProject(setup.device, SIGN_IN)).toBe("same");
    const bare = memoryDevice();
    await setAccount(bare.device, "account-1");
    expect(await signInProject(bare.device, SIGN_IN)).toBe("same");
  });

  it("erases Firebase Auth's database and the web storage, keeps the learners' data, and forgets the project", async () => {
    for (const other of [
      { ...SIGN_IN, projectId: "another-project" },
      { ...SIGN_IN, apiKey: "another-key" },
    ]) {
      const setup = await signedIn();
      expect(await signInProject(setup.device, other)).toBe("erased");
      expect(names(setup)).not.toContain(FIREBASE_AUTH);
      expect(names(setup)).toEqual(expect.arrayContaining([...PROFILES, CACHE, SETTINGS]));
      expect(setup.state.cleared).toBe(1);
      const registry = await readRegistry(setup.device);
      expect(registry?.signIn).toBeUndefined();
      expect(registry?.account).toBe("account-1");
    }
  });

  it("erases nothing while another tab's Firebase Auth holds its database, and keeps the project to try again", async () => {
    const setup = await signedIn();
    const other = { ...SIGN_IN, projectId: "another-project" };
    setup.backend.blocked.add(FIREBASE_AUTH);
    expect(await signInProject(setup.device, other)).toBe("blocked");
    setup.backend.blocked.clear();
    setup.backend.failing.add(FIREBASE_AUTH);
    expect(await signInProject(setup.device, other)).toBe("failed");
    expect(setup.state.cleared).toBe(0);
    expect((await readRegistry(setup.device))?.signIn).toEqual(SIGN_IN);
  });
});

describe("versions withdrawn", () => {
  it("take their open views from the cache and from every profile", async () => {
    const setup = await signedIn();
    const cache = await openCache(setup.device);
    await cache?.put("d1", "manifest", { json: new Uint8Array([1]), version: "0.4" });
    await cache?.put("d2", "manifest", { json: new Uint8Array([2]), version: "0.4" });
    for (const id of ["p1", "p2"]) {
      const profile = await addProfile(setup.device, id);
      await profile?.beginAttempt({ attemptId: `a-${id}`, digest: "d1", task: TASK });
    }
    await versionsWithdrawn(setup.device, ["d1"]);
    expect(await cache?.get("d1", "manifest")).toBeUndefined();
    expect(await cache?.get("d2", "manifest")).toEqual({
      json: new Uint8Array([2]),
      version: "0.4",
    });
    for (const id of ["p1", "p2"]) {
      const profile = await addProfile(setup.device, id);
      expect((await profile?.readAttempt(`a-${id}`))?.attempt.task).toBeUndefined();
    }
  });

  it("are nothing to do with no digest, no registry, or no cache yet", async () => {
    const setup = memoryDevice();
    await versionsWithdrawn(setup.device, ["d1"]);
    await versionsWithdrawn(setup.device, []);
    await setAccount(setup.device, "account-1");
    await versionsWithdrawn(setup.device, ["d1"]);
    expect(names(setup)).toEqual([REGISTRY]);
  });
});

describe("an erasure in another tab", () => {
  it("takes this tab's connection away, and the profile does not open again", async () => {
    const setup = await signedIn();
    const other: Device = memoryDevice(setup.backend).device;
    const listener = vi.fn();
    other.listen(listener);
    const profile = await addProfile(other, "p1");
    expect(profile).toBeDefined();
    await profilesListed(setup.device, "account-1", ["p2"]);
    expect(listener).toHaveBeenCalledWith({
      kind: "lost",
      database: profileDatabase("p1"),
      reason: "versionchange",
    });
    await expect(profile?.readAttempt("a")).rejects.toThrow("closed");
    expect(await openProfile(other, "p1")).toBeUndefined();
    expect(setup.backend.databases.has(profileDatabase("p1"))).toBe(false);
  });
});
