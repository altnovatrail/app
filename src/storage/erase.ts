// The erasures of section 3.2 of docs/architecture.md that reach past one database, as the first
// app has their events (R04 with its amendments; R16 in docs/decisions.md). Those within one
// profile — an attempt ended, a lesson ended — are the profile's own (profile.ts). Each takes the
// registry as it is now; a database the browser did not delete stays named, to be erased again at
// the next start (start.ts). The device's settings stay through all of them.
import { openCacheDatabase } from "./cache.ts";
import type { Device } from "./device.ts";
import { openProfileDatabase } from "./profile.ts";
import {
  changeRegistry,
  eraseDatabases,
  liveDatabases,
  type Registry,
  readRegistry,
  type SignIn,
} from "./registry.ts";
import { CACHE, FIREBASE_AUTH, REGISTRY } from "./schema.ts";

/** Every database of the account the registry names. */
function accountDatabases(registry: Registry): string[] {
  return [...registry.databases.keys()];
}

/**
 * Sign-out of the account's owner, and an account that is no more (architecture 4.5 in spec):
 * every profile's database, the cache, the origin's localStorage and sessionStorage, and last the
 * registry. Firebase Auth's own `signOut()` comes first, from the sign-in (T22). Gives whether
 * all of it is gone; what is not, the next start erases.
 */
export async function eraseAccount(device: Device): Promise<boolean> {
  const registry = await readRegistry(device);
  device.webStorage.clear();
  if (registry === undefined) return true;
  await changeRegistry(device, async (tx) => {
    await tx.delete("registry", "account");
    await tx.put("registry", "ending", true);
  });
  if (!(await eraseDatabases(device, accountDatabases(registry)))) return false;
  return (await device.remove(REGISTRY)) === "deleted";
}

/**
 * An account signed in: if the registry names another, what is left of it goes before anything
 * opens (R04), and the registry names this one. The session is the new account's and stays.
 */
export async function accountSeen(device: Device, accountId: string): Promise<boolean> {
  const registry = await readRegistry(device);
  if (registry?.account === accountId) return true;
  await changeRegistry(device, async (tx) => {
    await tx.put("registry", "account", { id: accountId });
    await tx.delete("registry", "ending");
  });
  if (registry?.account === undefined) return true;
  return eraseDatabases(device, accountDatabases(registry));
}

/**
 * `CAUSE_NO_ACCESS` while the registry names an account: another account signed in, with no
 * account of NovaTrail, and what is left of the one named goes (the 2026-11-10 amendment to R04).
 */
export async function noAccess(device: Device): Promise<boolean> {
  const registry = await readRegistry(device);
  if (registry?.account === undefined) return true;
  await changeRegistry(device, (tx) => tx.delete("registry", "account"));
  return eraseDatabases(device, accountDatabases(registry));
}

/**
 * The profiles of the account as `GetAccount` answered: a profile's database it does not list was
 * deleted on another device, and goes. Only for the account the registry names (R98 in spec).
 */
export async function profilesListed(
  device: Device,
  accountId: string,
  profileIds: readonly string[],
): Promise<boolean> {
  const registry = await readRegistry(device);
  if (registry === undefined || registry.account !== accountId) return true;
  const listed = new Set(profileIds);
  const gone = [...registry.databases]
    .filter(([, entry]) => entry.kind === "profile" && !listed.has(entry.profileId ?? ""))
    .map(([name]) => name);
  return eraseDatabases(device, gone);
}

/** What came of comparing the project of the sign-in service with the registry's. */
export type SignInCheck = "same" | "erased" | "blocked" | "failed";

/**
 * The project of the sign-in service in /deployment.json, before `initializeAuth`. If the registry
 * has another, Firebase Auth's database and the origin's web storage go, the learners' data stays,
 * and the registry forgets the project until the next sign-in (section 3.7). `"blocked"`: another
 * tab's Firebase Auth holds its database, nothing is erased, and the next start tries again.
 */
export async function signInProject(device: Device, signIn: SignIn): Promise<SignInCheck> {
  const held = (await readRegistry(device))?.signIn;
  if (held === undefined) return "same";
  if (held.projectId === signIn.projectId && held.apiKey === signIn.apiKey) return "same";
  const removal = await device.remove(FIREBASE_AUTH);
  if (removal !== "deleted") return removal;
  device.webStorage.clear();
  await changeRegistry(device, (tx) => tx.delete("registry", "signIn"));
  return "erased";
}

/**
 * Versions withdrawn, as `CheckPackages` told (R63 in spec): their open views go from the cache and
 * from every profile's database, and the lessons on them.
 */
export async function versionsWithdrawn(device: Device, digests: readonly string[]): Promise<void> {
  if (digests.length === 0) return;
  const registry = await readRegistry(device);
  if (registry === undefined) return;
  if (liveDatabases(registry, "cache").includes(CACHE)) {
    await (await openCacheDatabase(device))?.withdraw(digests);
  }
  for (const name of liveDatabases(registry, "profile")) {
    await (await openProfileDatabase(device, name))?.withdraw(digests);
  }
}
