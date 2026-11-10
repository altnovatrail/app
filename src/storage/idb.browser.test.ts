// The backend on Chromium's own IndexedDB: what the store in memory stands in for in Node.
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Connection, NewerSchemaError, type Schema, within } from "./backend.ts";
import { browserDevice } from "./browser.ts";
import { indexedDbBackend } from "./idb.ts";
import { addProfile } from "./profile.ts";
import { readRegistry, setAccount } from "./registry.ts";
import { profileDatabase } from "./schema.ts";

const backend = indexedDbBackend();
const SCHEMA: Schema = { version: 1, stores: { things: { at: "at" }, other: {} } };
const made: string[] = [];
const held: Connection[] = [];

function name(): string {
  const found = `test-${crypto.randomUUID()}`;
  made.push(found);
  return found;
}

async function open(database: string, schema = SCHEMA, onLost = vi.fn()) {
  const connection = await backend.open(database, schema, { create: true, onLost });
  if (connection === undefined) throw new Error("not opened");
  held.push(connection);
  return connection;
}

async function names(): Promise<string[]> {
  return (await indexedDB.databases()).map((database) => database.name ?? "");
}

afterEach(async () => {
  for (const connection of held.splice(0)) connection.close();
  for (const database of made.splice(0)) await backend.remove(database);
  for (const database of await names()) await backend.remove(database);
  localStorage.clear();
  sessionStorage.clear();
});

describe("the backend on IndexedDB", () => {
  it("keeps records by key and by index, cloned, Blobs and unrounded numbers too", async () => {
    const db = await open(name());
    const blob = new Blob(["png"], { type: "image/png" });
    await db.write(["things"], async (tx) => {
      await tx.put("things", ["a", 0], { at: 3, x: 0.1 + 0.2, blob });
      await tx.put("things", ["a", 1], { at: 1 });
      await tx.put("things", ["b", 0], { at: 2 });
      await tx.put("things", "plain", { none: true });
    });
    const read = await db.read(["things"], async (tx) => ({
      a: (await tx.entries("things", { range: within("a") })).map((entry) => entry.key),
      byIndex: (await tx.entries("things", { index: "at" })).map((entry) => entry.key),
      upTo2: await tx.count("things", { index: "at", range: { upper: 2 } }),
      from: await tx.count("things", { range: { lower: ["b"] } }),
      all: await tx.count("things"),
      first: (await tx.get("things", ["a", 0])) as { x: number; blob: Blob },
    }));
    expect(read.a).toEqual([
      ["a", 0],
      ["a", 1],
    ]);
    expect(read.byIndex).toEqual([
      ["a", 1],
      ["b", 0],
      ["a", 0],
    ]);
    expect([read.upTo2, read.from, read.all]).toEqual([2, 1, 4]);
    expect(read.first.x).toBe(0.1 + 0.2);
    expect(await read.first.blob.text()).toBe("png");
    await db.write(["things"], (tx) => tx.delete("things", within("a")));
    expect(await db.read(["things"], (tx) => tx.count("things"))).toBe(2);
    await db.write(["things"], (tx) => tx.delete("things", {}), "relaxed");
    expect(await db.read(["things"], (tx) => tx.count("things"))).toBe(0);
  });

  it("keeps nothing of a transaction whose work failed, or whose request did", async () => {
    const db = await open(name());
    await expect(
      db.write(["things"], async (tx) => {
        await tx.put("things", 1, { at: 1 });
        throw new Error("halfway");
      }),
    ).rejects.toThrow("halfway");
    await expect(
      db.write(["things"], async (tx) => {
        await tx.put("things", 2, { at: 2 });
        await tx.put("things", Number.NaN, {});
      }),
    ).rejects.toMatchObject({ name: "DataError" });
    expect(await db.read(["things"], (tx) => tx.count("things"))).toBe(0);
    await expect(db.read(["things"], (tx) => tx.put("things", 1, {}))).rejects.toMatchObject({
      name: "ReadOnlyError",
    });
  });

  it("makes no database it is not asked to make", async () => {
    const database = name();
    expect(
      await backend.open(database, SCHEMA, { create: false, onLost: vi.fn() }),
    ).toBeUndefined();
    expect(await names()).not.toContain(database);
  });

  it("closes its connection when another tab opens a newer version, which then is not blocked", async () => {
    const database = name();
    const lost = vi.fn();
    const old = await open(database, SCHEMA, lost);
    await old.write(["other"], (tx) => tx.put("other", 1, "kept"));
    const next = await open(database, { version: 2, stores: { things: { at: "when" }, more: {} } });
    expect(lost).toHaveBeenCalledWith("versionchange");
    await expect(old.read(["things"], async () => 1)).rejects.toMatchObject({
      name: "InvalidStateError",
    });
    const stores = await next.read(["things", "more"], async (tx) => tx.count("things"));
    expect(stores).toBe(0);
    await expect(next.read(["other"], async () => 1)).rejects.toMatchObject({
      name: "NotFoundError",
    });
    await next.write(["things"], (tx) => tx.put("things", 1, { when: 5 }));
    expect(
      await next.read(["things"], (tx) => tx.count("things", { index: "at", range: { lower: 5 } })),
    ).toBe(1);
  });

  it("refuses a database at a version newer than its own", async () => {
    const database = name();
    await open(database, { version: 2, stores: {} });
    await expect(backend.open(database, SCHEMA, { create: true, onLost: vi.fn() })).rejects.toThrow(
      NewerSchemaError,
    );
  });

  it("deletes a database it holds, and is blocked by one that does not let go", async () => {
    const database = name();
    const lost = vi.fn();
    await open(database, SCHEMA, lost);
    expect(await backend.remove(database)).toBe("deleted");
    expect(lost).toHaveBeenCalledWith("versionchange");
    expect(await names()).not.toContain(database);
    // A connection that does not close on versionchange, as Firebase Auth's.
    const other = name();
    const holder = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open(other);
      request.onsuccess = () => resolve(request.result);
    });
    expect(await backend.remove(other)).toBe("blocked");
    holder.close();
  });
});

describe("the storage on IndexedDB", () => {
  it("keeps a profile's history through the registry, and clears the origin's web storage", async () => {
    const device = browserDevice();
    await setAccount(device, "account-1");
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: "d1" });
    const event = { kind: "clear", t: 5, ids: [1, 2] } as const;
    expect(await profile?.appendHistory("a1", { from: 0, events: [event] })).toBe("saved");
    expect((await profile?.readAttempt("a1"))?.history).toEqual([event]);
    expect((await readRegistry(device))?.databases.has(profileDatabase("p1"))).toBe(true);
    localStorage.setItem("x", "1");
    sessionStorage.setItem("y", "2");
    device.webStorage.clear();
    expect([localStorage.length, sessionStorage.length]).toEqual([0, 0]);
  });
});
