// The owner's own key on this device (R08 and R47 in docs/decisions.md; sections 3.2 and 3.6 of
// docs/architecture.md): in the store `ownKey` of the owner profile's database, and only while the
// adult keeps it there. Every erasure of that database takes it with it — the profile's data
// erased, everything on this device, the sign-out, another account, the profile deleted (erase.ts).
// No DOM.
import type { Device } from "./device.ts";
import { addProfile, type KeptKey, openProfile, type Saved } from "./profile.ts";

/** What the holder of the key asks of the device: the key kept for a profile, and its keeping. */
export interface KeyStore {
  /** The key kept for the profile; none when none is, or the database cannot be read. */
  readonly read: (profileId: string) => Promise<KeptKey | undefined>;
  readonly keep: (profileId: string, kept: KeptKey) => Promise<Saved>;
  readonly drop: (profileId: string) => Promise<void>;
}

/** The key kept for a profile on this device; none when none is, or it cannot be read. */
export async function keptKey(device: Device, profileId: string): Promise<KeptKey | undefined> {
  try {
    return await (await openProfile(device, profileId))?.ownKey();
  } catch {
    return undefined;
  }
}

/** The key store of this device. */
export function deviceKeyStore(device: Device): KeyStore {
  return {
    read: (profileId) => keptKey(device, profileId),
    keep: async (profileId, kept) => {
      try {
        return (await (await addProfile(device, profileId))?.keepOwnKey(kept)) ?? "unsaved";
      } catch {
        return "unsaved";
      }
    },
    drop: async (profileId) => {
      await (await openProfile(device, profileId))?.dropOwnKey();
    },
  };
}
