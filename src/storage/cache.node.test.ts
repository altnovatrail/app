import { describe, expect, it } from "vitest";
import { DAY, memoryDevice } from "../test/device.ts";
import { openCache, openCacheDatabase } from "./cache.ts";
import { eraseDatabases, readRegistry, setAccount } from "./registry.ts";
import { CACHE } from "./schema.ts";

const bytes = (text: string) => new TextEncoder().encode(text);

async function setUp() {
  const setup = memoryDevice();
  await setAccount(setup.device, "account-1");
  const found = await openCache(setup.device);
  if (found === undefined) throw new Error("no cache");
  return { ...setup, cache: found };
}

describe("the shared cache", () => {
  it("is the signed-in account's: none before, and named in the registry before it opens", async () => {
    const { device, backend } = memoryDevice();
    expect(await openCache(device)).toBeUndefined();
    expect(backend.databases.has(CACHE)).toBe(false);
    expect(await openCacheDatabase(device)).toBeUndefined();
    await setAccount(device, "account-1");
    expect(await openCache(device)).toBeDefined();
    expect((await readRegistry(device))?.databases.get(CACHE)).toEqual({
      kind: "cache",
      erase: false,
    });
  });

  it("is not opened again while it is to be erased", async () => {
    const { device, backend } = await setUp();
    backend.failing.add(CACHE);
    expect(await eraseDatabases(device, [CACHE])).toBe(false);
    expect(await openCache(device)).toBeUndefined();
  });

  it("gives a view back by digest and kind, and marks it used at most once a day", async () => {
    const { cache, state, backend } = await setUp();
    const start = state.time;
    await cache.put("d1", "manifest", bytes("{}"));
    expect(await cache.get("d1", "manifest")).toEqual(bytes("{}"));
    expect(await cache.get("d1", "techniques")).toBeUndefined();
    const usedAt = () =>
      (backend.records(CACHE, "views")[0]?.value as { usedAt: number } | undefined)?.usedAt;
    state.time = start + DAY - 1;
    await cache.get("d1", "manifest");
    expect(usedAt()).toBe(start);
    state.time = start + DAY;
    await cache.get("d1", "manifest");
    expect(usedAt()).toBe(start + DAY);
  });

  it("goes on without keeping a view the browser refuses", async () => {
    const { cache, state, backend } = await setUp();
    await cache.put("d1", "manifest", bytes("{}"));
    backend.refuseWrites = true;
    await cache.put("d2", "manifest", bytes("{}"));
    state.time += DAY;
    expect(await cache.get("d1", "manifest")).toEqual(bytes("{}"));
    expect(await cache.get("d2", "manifest")).toBeUndefined();
  });

  it("drops every view of a withdrawn version, and views unused for the term", async () => {
    const { cache, state } = await setUp();
    await cache.put("d1", "manifest", bytes("1"));
    await cache.put("d1", "skill-graph", bytes("2"));
    await cache.put("d2", "solving-steps", bytes("3"));
    await cache.withdraw(["d1"]);
    expect(await cache.get("d1", "manifest")).toBeUndefined();
    expect(await cache.get("d1", "skill-graph")).toBeUndefined();
    const old = state.time;
    state.time += DAY;
    await cache.put("d3", "manifest", bytes("4"));
    await cache.expire(old);
    expect(await cache.get("d2", "solving-steps")).toBeUndefined();
    expect(await cache.get("d3", "manifest")).toEqual(bytes("4"));
  });
});
