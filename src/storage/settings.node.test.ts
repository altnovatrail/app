import { describe, expect, it } from "vitest";
import { memoryDevice } from "../test/device.ts";
import { eraseAccount } from "./erase.ts";
import { SETTINGS } from "./schema.ts";
import { eraseSettings, readLanguage, writeLanguage } from "./settings.ts";

describe("the device's settings", () => {
  it("are none until a language is chosen, and reading makes no database", async () => {
    const { device, backend } = memoryDevice();
    expect(await readLanguage(device)).toBeUndefined();
    expect(backend.databases.has(SETTINGS)).toBe(false);
  });

  it("keep the language chosen through a sign-out, and go only when erased", async () => {
    const { device } = memoryDevice();
    expect(await writeLanguage(device, "ru")).toBe(true);
    await eraseAccount(device);
    expect(await readLanguage(device)).toBe("ru");
    expect(await eraseSettings(device)).toBe(true);
    expect(await readLanguage(device)).toBeUndefined();
  });

  it("read nothing they cannot read, and say what they could not keep", async () => {
    const { device, backend } = memoryDevice();
    await backend.open(SETTINGS, { version: 9, stores: {} }, { create: true, onLost: () => {} });
    expect(await readLanguage(device)).toBeUndefined();
    expect(await writeLanguage(device, "ru")).toBe(false);
  });
});
