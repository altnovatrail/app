import { describe, expect, it, vi } from "vitest";
import { DAY, memoryDevice } from "../test/device.ts";
import { openCache } from "./cache.ts";
import { eraseAccount } from "./erase.ts";
import { addProfile, openProfile } from "./profile.ts";
import { readRegistry, setAccount, setSignIn } from "./registry.ts";
import { FIREBASE_AUTH, KEEP_MS, profileDatabase, REGISTRY } from "./schema.ts";
import { startStorage } from "./start.ts";

const SIGN_IN = { projectId: "example-project", apiKey: "synthetic-web-api-key" };
const TASK = {
  id: "probe",
  statement: [{ text: "Write the answer." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
} as const;
const work = { cells: [], submission: { boxes: [], digest: "0123456789abcdef" } };

describe("startStorage", () => {
  it("with no registry makes nothing: nobody signed in on this device", async () => {
    const { device, backend } = memoryDevice();
    expect(await startStorage(device, SIGN_IN)).toBe("same");
    expect(backend.databases.size).toBe(0);
  });

  it("first finishes a sign-out cut short, the registry last", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    backend.failing.add(profileDatabase("p1"));
    expect(await eraseAccount(device)).toBe(false);
    backend.failing.clear();
    expect(await startStorage(device, SIGN_IN)).toBe("same");
    expect(backend.databases.size).toBe(0);
  });

  it("keeps the registry when the sign-out still cannot finish, and erases the rest again", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    await addProfile(device, "p2");
    backend.failing.add(profileDatabase("p1"));
    backend.failing.add(profileDatabase("p2"));
    await eraseAccount(device);
    backend.failing.delete(profileDatabase("p2"));
    await startStorage(device, SIGN_IN);
    expect([...backend.databases.keys()].sort()).toEqual([profileDatabase("p1"), REGISTRY]);
  });

  it("erases again a database the browser did not delete, before anything else", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    await addProfile(device, "p2");
    backend.blocked.add(profileDatabase("p1"));
    const { profilesListed } = await import("./erase.ts");
    await profilesListed(device, "account-1", ["p2"]);
    expect(backend.databases.has(profileDatabase("p1"))).toBe(true);
    backend.blocked.clear();
    await startStorage(device, SIGN_IN);
    expect(backend.databases.has(profileDatabase("p1"))).toBe(false);
    expect((await readRegistry(device))?.databases.has(profileDatabase("p1"))).toBe(false);
    expect(await openProfile(device, "p2")).toBeDefined();
  });

  it("compares the sign-in project while a sign-out cut short still waits", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await setSignIn(device, SIGN_IN);
    await addProfile(device, "p1");
    backend.failing.add(profileDatabase("p1"));
    await eraseAccount(device);
    await backend.open(
      FIREBASE_AUTH,
      { version: 1, stores: {} },
      { create: true, onLost: () => {} },
    );
    expect(await startStorage(device, { ...SIGN_IN, apiKey: "another-key" })).toBe("erased");
    expect(backend.databases.has(FIREBASE_AUTH)).toBe(false);
  });

  it("compares the sign-in project, and tells what came of it", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await setSignIn(device, SIGN_IN);
    await backend.open(
      FIREBASE_AUTH,
      { version: 1, stores: {} },
      { create: true, onLost: () => {} },
    );
    backend.blocked.add(FIREBASE_AUTH);
    const other = { ...SIGN_IN, projectId: "another-project" };
    expect(await startStorage(device, other)).toBe("blocked");
    backend.blocked.clear();
    expect(await startStorage(device, other)).toBe("erased");
    expect(backend.databases.has(FIREBASE_AUTH)).toBe(false);
  });

  it("clears the work of correct submissions whose words never came, and keeps the term of 30 days", async () => {
    const { device, state } = memoryDevice();
    await setAccount(device, "account-1");
    const profile = await addProfile(device, "p1");
    const cache = await openCache(device);
    await cache?.put("d-old", "manifest", { json: new Uint8Array([1]), version: "0.4" });
    await profile?.beginAttempt({ attemptId: "old", digest: "d1", task: TASK });
    await profile?.beginAttempt({ attemptId: "done", digest: "d1", task: TASK });
    await profile?.addSubmission("done", work, 0);
    await profile?.attemptEnded("done", 0);
    state.time += KEEP_MS - DAY;
    await cache?.put("d-new", "manifest", { json: new Uint8Array([2]), version: "0.4" });
    await profile?.beginAttempt({ attemptId: "new", digest: "d1", task: TASK });
    state.time += DAY;
    await startStorage(device, SIGN_IN);
    expect(await profile?.correctWork("done")).toBeUndefined();
    expect(await profile?.readAttempt("old")).toBeUndefined();
    expect(await profile?.readAttempt("new")).toBeDefined();
    expect(await cache?.get("d-old", "manifest")).toBeUndefined();
    expect(await cache?.get("d-new", "manifest")).toEqual({
      json: new Uint8Array([2]),
      version: "0.4",
    });
  });

  it("goes on past a step that fails, and past a registry it cannot read", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    const profile = await addProfile(device, "p2");
    await profile?.beginAttempt({ attemptId: "old", digest: "d1", task: TASK });
    const open = backend.open.bind(backend);
    vi.spyOn(backend, "open").mockImplementation((name, schema, options) =>
      name === profileDatabase("p1")
        ? Promise.reject(new DOMException("io", "UnknownError"))
        : open(name, schema, options),
    );
    backend.closeAll(profileDatabase("p1"));
    vi.spyOn(device, "now").mockReturnValue(Number.MAX_SAFE_INTEGER);
    expect(await startStorage(device, SIGN_IN)).toBe("same");
    expect(await profile?.readAttempt("old")).toBeUndefined();
    const broken = memoryDevice();
    await setAccount(broken.device, "account-1");
    broken.backend.closeAll(REGISTRY);
    vi.spyOn(broken.backend, "open").mockRejectedValue(new DOMException("io", "UnknownError"));
    // Not compared: what the session's project is, nobody knows.
    expect(await startStorage(broken.device, SIGN_IN)).toBe("failed");
  });
});
