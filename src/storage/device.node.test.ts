import { describe, expect, it, vi } from "vitest";
import { memoryDevice } from "../test/device.ts";
import { NewerSchemaError } from "./backend.ts";
import type { DeviceEvent } from "./device.ts";
import { readRegistry, setAccount } from "./registry.ts";
import { PROFILE_SCHEMA, REGISTRY } from "./schema.ts";

describe("Device", () => {
  it("keeps one connection to each database, and opens again what is gone", async () => {
    const { device, backend } = memoryDevice();
    const open = vi.spyOn(backend, "open");
    const [one, two] = await Promise.all([
      device.connect("db", PROFILE_SCHEMA, true),
      device.connect("db", PROFILE_SCHEMA, true),
    ]);
    expect(one).toBe(two);
    expect(open).toHaveBeenCalledTimes(1);
    backend.closeAll("db");
    expect(await device.connect("db", PROFILE_SCHEMA, true)).not.toBe(one);
    expect(await device.connect("none", PROFILE_SCHEMA, false)).toBeUndefined();
    expect(await device.connect("none", PROFILE_SCHEMA, true)).toBeDefined();
  });

  it("tells its listeners of a connection taken away and of a newer database", async () => {
    const { device, backend } = memoryDevice();
    const events: DeviceEvent[] = [];
    const stop = device.listen((event) => events.push(event));
    await device.connect("db", PROFILE_SCHEMA, true);
    await backend.open("db", { version: 2, stores: {} }, { create: true, onLost: () => {} });
    await expect(device.connect("db", PROFILE_SCHEMA, true)).rejects.toBeInstanceOf(
      NewerSchemaError,
    );
    stop();
    await device.connect("other", PROFILE_SCHEMA, true);
    backend.closeAll("other");
    expect(events).toEqual([
      { kind: "lost", database: "db", reason: "versionchange" },
      { kind: "newer", database: "db" },
    ]);
  });

  it("lets another error of opening through, and opens again after it", async () => {
    const { device, backend } = memoryDevice();
    vi.spyOn(backend, "open").mockRejectedValueOnce(new DOMException("io", "UnknownError"));
    await expect(device.connect("db", PROFILE_SCHEMA, true)).rejects.toThrow("io");
    expect(await device.connect("db", PROFILE_SCHEMA, true)).toBeDefined();
  });

  it("closes its own connection before it removes a database, so that it tells nobody", async () => {
    const { device, backend } = memoryDevice();
    const listener = vi.fn();
    device.listen(listener);
    await device.connect("db", PROFILE_SCHEMA, true);
    expect(await device.remove("db")).toBe("deleted");
    expect(await device.remove("db")).toBe("deleted");
    expect(listener).not.toHaveBeenCalled();
    expect(backend.databases.has("db")).toBe(false);
  });

  it("remembers that it saw the registry", async () => {
    const { device } = memoryDevice();
    await readRegistry(device);
    expect(device.registrySeen).toBe(false);
    await setAccount(device, "account-1");
    expect(device.registrySeen).toBe(true);
    expect(await device.remove(REGISTRY)).toBe("deleted");
    expect(device.registrySeen).toBe(false);
  });
});
