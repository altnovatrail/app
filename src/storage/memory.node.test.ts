import { describe, expect, it, vi } from "vitest";
import { type Key, NewerSchemaError, type Schema, within } from "./backend.ts";
import { compareKeys, MemoryBackend } from "./memory.ts";

const SCHEMA: Schema = { version: 1, stores: { things: { at: "at" }, other: {} } };
const options = (onLost = vi.fn()) => ({ create: true, onLost });

describe("compareKeys", () => {
  it("orders keys as IndexedDB does: numbers, strings by code units, then arrays item by item", () => {
    const keys: Key[] = [["b"], ["a", []], "b", ["a", 1], 2, [], "a", ["a", "x"], ["a"], 1, "B"];
    expect([...keys].sort(compareKeys)).toEqual([
      1,
      2,
      "B",
      "a",
      "b",
      [],
      ["a"],
      ["a", 1],
      ["a", "x"],
      ["a", []],
      ["b"],
    ]);
    expect(compareKeys(["a", 1], ["a", 1])).toBe(0);
  });

  it("takes within a prefix every array that begins with it, and nothing else", () => {
    const range = within("a");
    const inside = (key: Key) =>
      compareKeys(key, range.lower as Key) >= 0 && compareKeys(key, range.upper as Key) <= 0;
    expect([["a", 0], ["a", 99], ["a", "z"], ["a"]].map(inside)).toEqual([true, true, true, true]);
    expect([["b", 0], "a", ["", 0], ["a0"]].map(inside)).toEqual([false, false, false, false]);
  });
});

describe("MemoryBackend", () => {
  it("makes a database only when asked, and refuses a version older than the one it holds", async () => {
    const backend = new MemoryBackend();
    expect(await backend.open("db", SCHEMA, { create: false, onLost: vi.fn() })).toBeUndefined();
    expect(backend.databases.has("db")).toBe(false);
    await backend.open("db", { version: 2, stores: { things: {} } }, options());
    await expect(backend.open("db", SCHEMA, options())).rejects.toBeInstanceOf(NewerSchemaError);
  });

  it("brings the stores to a newer schema, and takes away the connections of the older", async () => {
    const backend = new MemoryBackend();
    const lost = vi.fn();
    const old = await backend.open("db", SCHEMA, options(lost));
    await old?.write(["other"], (tx) => tx.put("other", 1, "kept"));
    const next = await backend.open(
      "db",
      { version: 2, stores: { other: {}, more: {} } },
      options(),
    );
    expect(lost).toHaveBeenCalledWith("versionchange");
    await expect(old?.read(["other"], (tx) => tx.get("other", 1))).rejects.toThrow("closed");
    expect(await next?.read(["other"], (tx) => tx.get("other", 1))).toBe("kept");
    expect([...(backend.databases.get("db")?.stores.keys() ?? [])]).toEqual(["other", "more"]);
  });

  it("keeps nothing of a transaction that failed, and nothing written in a read", async () => {
    const backend = new MemoryBackend();
    const db = await backend.open("db", SCHEMA, options());
    const failed = db?.write(["things"], async (tx) => {
      await tx.put("things", 1, { at: 1 });
      throw new Error("halfway");
    });
    await expect(failed).rejects.toThrow("halfway");
    expect(backend.records("db", "things")).toEqual([]);
    await expect(db?.read(["things"], (tx) => tx.put("things", 1, {}))).rejects.toThrow(
      "read-only",
    );
    await expect(db?.read(["things"], (tx) => tx.delete("things", 1))).rejects.toThrow("read-only");
    backend.refuseWrites = true;
    await expect(db?.write(["things"], (tx) => tx.put("things", 1, {}))).rejects.toThrow("quota");
  });

  it("refuses a store or an index it does not have", async () => {
    const db = await new MemoryBackend().open("db", SCHEMA, options());
    await expect(db?.read(["nothing"], async () => 1)).rejects.toThrow("no store nothing");
    await expect(db?.read(["things"], (tx) => tx.get("nothing", 1))).rejects.toThrow("no store");
    await expect(
      db?.read(["things"], (tx) => tx.entries("things", { index: "x" })),
    ).rejects.toThrow("no index x");
  });

  it("gives records by key or by index, in order, cloned in and out", async () => {
    const backend = new MemoryBackend();
    const db = await backend.open("db", SCHEMA, options());
    const record = { at: 5, list: [1] };
    await db?.write(["things"], async (tx) => {
      await tx.put("things", "b", record);
      await tx.put("things", "a", { at: 7 });
      await tx.put("things", "c", { at: 5 });
      await tx.put("things", "d", { none: true });
    });
    record.list.push(2);
    const read = await db?.read(["things"], async (tx) => ({
      byKey: (await tx.entries("things")).map((entry) => entry.key),
      byIndex: (await tx.entries("things", { index: "at" })).map((entry) => entry.key),
      upTo6: await tx.count("things", { index: "at", range: { upper: 6 } }),
      from: await tx.count("things", { range: { lower: "c" } }),
      b: await tx.get("things", "b"),
    }));
    expect(read).toEqual({
      byKey: ["a", "b", "c", "d"],
      byIndex: ["b", "c", "a"],
      upTo6: 2,
      from: 2,
      b: { at: 5, list: [1] },
    });
    await db?.write(["things"], async (tx) => {
      await tx.delete("things", { lower: "b", upper: "c" });
      await tx.delete("things", "d");
    });
    expect(backend.records("db", "things").map((entry) => entry.key)).toEqual(["a"]);
  });

  it("runs one transaction at a time, each on what the one before left", async () => {
    const db = await new MemoryBackend().open("db", SCHEMA, options());
    const add = () =>
      db?.write(["other"], async (tx) => {
        const n = ((await tx.get("other", "n")) as number | undefined) ?? 0;
        await tx.put("other", "n", n + 1);
      });
    await Promise.all([add(), add(), add()]);
    expect(await db?.read(["other"], (tx) => tx.get("other", "n"))).toBe(3);
  });

  it("removes a database, takes away its connections, and is blocked or fails when told", async () => {
    const backend = new MemoryBackend();
    const lost = vi.fn();
    await backend.open("db", SCHEMA, options(lost));
    backend.blocked.add("db");
    expect(await backend.remove("db")).toBe("blocked");
    backend.blocked.clear();
    backend.failing.add("db");
    expect(await backend.remove("db")).toBe("failed");
    backend.failing.clear();
    expect(await backend.remove("db")).toBe("deleted");
    expect(lost).toHaveBeenCalledWith("versionchange");
    expect(backend.databases.has("db")).toBe(false);
    expect(await backend.remove("never")).toBe("deleted");
  });

  it("closes connections as the browser does, and erases the origin whole", async () => {
    const backend = new MemoryBackend();
    const lost = vi.fn();
    const db = await backend.open("db", SCHEMA, options(lost));
    await backend.open("other", SCHEMA, options(lost));
    backend.closeAll("db");
    expect(lost).toHaveBeenCalledWith("closed");
    await expect(db?.read(["things"], async () => 1)).rejects.toThrow("closed");
    backend.eraseAll();
    expect(lost).toHaveBeenCalledTimes(2);
    expect(backend.databases.size).toBe(0);
    expect(backend.records("db", "things")).toEqual([]);
  });
});
