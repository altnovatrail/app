// The voicing of this device in its registry (R07, R36 and the 2026-11-02 amendment to R04 in
// docs/decisions.md; sections 3.2 and 3.5 of docs/architecture.md): the voice an adult chose for a
// language, and on Android and Linux the adult's leave for voicing on this device. Not a learner's
// data: the sign-out of the account's owner erases it with the registry, and another account that
// signs in erases it, to decide anew (erase.ts). A registry that cannot be read is nothing chosen and no leave. No DOM.
import type { Device } from "./device.ts";
import { changeRegistry } from "./registry.ts";
import { REGISTRY, REGISTRY_SCHEMA } from "./schema.ts";

/** What the registry keeps of the voicing, under `"voicing"`. */
export interface DeviceVoicing {
  /** The adult's leave for voicing on Android and Linux. */
  readonly allowed: boolean;
  /** The `voiceURI` an adult chose, by the language's tag in lower case. */
  readonly voices: ReadonlyMap<string, string>;
}

/** Its key in the store `registry`. */
export const VOICING = "voicing";

export const NO_VOICING: DeviceVoicing = { allowed: false, voices: new Map() };

/** The record as it lies in the registry. */
interface Kept {
  readonly allowed?: unknown;
  readonly voices?: unknown;
}

function voicingOf(kept: Kept | undefined): DeviceVoicing {
  const voices = new Map<string, string>();
  if (typeof kept?.voices === "object" && kept.voices !== null) {
    for (const [tag, uri] of Object.entries(kept.voices)) {
      if (typeof uri === "string") voices.set(tag, uri);
    }
  }
  return { allowed: kept?.allowed === true, voices };
}

/** The voicing of this device; none chosen when the registry is not there or cannot be read. */
export async function readVoicing(device: Device): Promise<DeviceVoicing> {
  try {
    const connection = await device.connect(REGISTRY, REGISTRY_SCHEMA, false);
    const kept = await connection?.read(["registry"], (tx) => tx.get("registry", VOICING));
    return voicingOf(kept as Kept | undefined);
  } catch {
    return NO_VOICING;
  }
}

/** Changes the voicing of this device; gives the voicing as written, or none when it was not. */
async function change(
  device: Device,
  next: (before: DeviceVoicing) => DeviceVoicing,
): Promise<DeviceVoicing | undefined> {
  let written: DeviceVoicing | undefined;
  try {
    await changeRegistry(device, async (tx) => {
      const after = next(voicingOf((await tx.get("registry", VOICING)) as Kept | undefined));
      await tx.put("registry", VOICING, {
        allowed: after.allowed,
        voices: Object.fromEntries(after.voices),
      });
      written = after;
    });
  } catch {
    return undefined;
  }
  return written;
}

/** The adult's leave for voicing on this device, given or taken back. */
export function allowVoicing(device: Device, allowed: boolean): Promise<DeviceVoicing | undefined> {
  return change(device, (before) => ({ ...before, allowed }));
}

/** The voice an adult chose for a language on this device, by its tag in lower case. */
export function chooseVoice(
  device: Device,
  tag: string,
  voiceURI: string,
): Promise<DeviceVoicing | undefined> {
  return change(device, (before) => ({
    ...before,
    voices: new Map([...before.voices, [tag, voiceURI]]),
  }));
}
