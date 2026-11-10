import { describe, expect, it, vi } from "vitest";
import { eraseAccount } from "../storage/erase.ts";
import { addProfile } from "../storage/profile.ts";
import { eraseDatabases, setAccount } from "../storage/registry.ts";
import { profileDatabase, REGISTRY, SETTINGS } from "../storage/schema.ts";
import { memoryDevice } from "../test/device.ts";
import { troubleOf } from "./storage.ts";

const lost = (database: string, reason: "versionchange" | "closed" = "closed") =>
  ({ kind: "lost", database, reason }) as const;

describe("troubleOf", () => {
  it("takes a newer database as a newer build's", async () => {
    const { device } = memoryDevice();
    expect(await troubleOf(device, { kind: "newer", database: REGISTRY })).toBe("newer");
  });

  it("takes a registry gone, where the tab had one, as data erased, and as nothing where it had none", async () => {
    const { device, backend } = memoryDevice();
    expect(await troubleOf(device, lost(REGISTRY))).toBeUndefined();
    await setAccount(device, "account-1");
    backend.eraseAll();
    expect(await troubleOf(device, lost(REGISTRY))).toBe("erased");
  });

  it("takes a connection the browser closed, with the registry there, as data it could not read", async () => {
    const { device } = memoryDevice();
    await setAccount(device, "account-1");
    expect(await troubleOf(device, lost(profileDatabase("p1")))).toBe("unreadable");
  });

  it("takes a registry that cannot be read as data it could not read, and a newer one as the device's", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    const open = vi.spyOn(backend, "open");
    open.mockRejectedValueOnce(new DOMException("io", "UnknownError"));
    backend.closeAll(REGISTRY);
    expect(await troubleOf(device, lost(REGISTRY))).toBe("unreadable");
    await backend.open(REGISTRY, { version: 2, stores: {} }, { create: true, onLost: () => {} });
    expect(await troubleOf(device, lost(REGISTRY))).toBeUndefined();
  });

  it("leaves a database another tab opened anew to the device's own news of it, and opens it again", async () => {
    const { device, backend } = memoryDevice();
    const events: unknown[] = [];
    device.listen((event) => events.push(event));
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    await backend.open(SETTINGS, { version: 2, stores: {} }, { create: true, onLost: () => {} });
    expect(await troubleOf(device, lost(SETTINGS, "versionchange"))).toBeUndefined();
    expect(events).toContainEqual({ kind: "newer", database: SETTINGS });
    expect(await troubleOf(device, lost(profileDatabase("p1"), "versionchange"))).toBeUndefined();
    expect(await troubleOf(device, lost("someone-else", "versionchange"))).toBeUndefined();
  });

  it("takes a database another tab erased on purpose, a sign-out too, as nothing, and makes none", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-1");
    await addProfile(device, "p2");
    const other = memoryDevice(backend).device;
    await eraseDatabases(other, [profileDatabase("p2")]);
    expect(await troubleOf(device, lost(profileDatabase("p2"), "versionchange"))).toBeUndefined();
    await eraseAccount(other);
    expect(await troubleOf(device, lost(REGISTRY, "versionchange"))).toBeUndefined();
    expect(backend.databases.size).toBe(0);
  });
});
