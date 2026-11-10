// The device's settings (section 3.2 and 3.8 of docs/architecture.md; the 2026-11-02 amendment to
// R04): the language a grown-up chose on this device. Neither a learner's data nor the account's:
// sign-out and another account leave it, and only "Erase everything on this device" and the browser
// erase it. The screens take it with T19.
import type { Device } from "./device.ts";
import { SETTINGS, SETTINGS_SCHEMA } from "./schema.ts";

/** The language chosen on this device, if any; one that cannot be read is none. */
export async function readLanguage(device: Device): Promise<string | undefined> {
  try {
    const connection = await device.connect(SETTINGS, SETTINGS_SCHEMA, false);
    const language = await connection?.read(["settings"], (tx) => tx.get("settings", "language"));
    return typeof language === "string" ? language : undefined;
  } catch {
    return undefined;
  }
}

/** Keeps the language chosen; gives whether it was kept. */
export async function writeLanguage(device: Device, language: string): Promise<boolean> {
  try {
    const connection = await device.connect(SETTINGS, SETTINGS_SCHEMA, true);
    await connection?.write(["settings"], (tx) => tx.put("settings", "language", language));
    return connection !== undefined;
  } catch {
    return false;
  }
}

/** "Erase everything on this device" erases the settings too. */
export async function eraseSettings(device: Device): Promise<boolean> {
  return (await device.remove(SETTINGS)) === "deleted";
}
