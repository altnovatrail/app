// The start of app's storage, before anything of it opens (section 3.2 of docs/architecture.md;
// R16 in docs/decisions.md): first the erasures the browser did not finish, then the project of the
// sign-in service against the registry's, then what app closed before it went — the work of a
// correct submission whose words never came — and last the term of 30 days, in every profile's
// database the registry names and in the cache. A step that fails holds up none of the others:
// what it did not do, the next start does.
import { openCacheDatabase } from "./cache.ts";
import type { Device } from "./device.ts";
import { type SignInCheck, signInProject } from "./erase.ts";
import { openProfileDatabase } from "./profile.ts";
import {
  eraseDatabases,
  liveDatabases,
  type Registry,
  readRegistry,
  type SignIn,
} from "./registry.ts";
import { KEEP_MS, REGISTRY } from "./schema.ts";

/** Runs a step, and lets its failure go: the storage says so at its next write. */
async function step<T>(work: () => Promise<T>, otherwise: T): Promise<T> {
  try {
    return await work();
  } catch {
    return otherwise;
  }
}

/** Starts the storage for a deployment's sign-in project; gives what came of comparing it. */
export async function startStorage(device: Device, signIn: SignIn): Promise<SignInCheck> {
  let registry: Registry | undefined;
  try {
    registry = await readRegistry(device);
  } catch {
    // Not compared: the project of the session is not known.
    return "failed";
  }
  if (registry === undefined) return "same";
  await step(async () => {
    const left = [...registry.databases].filter(([, entry]) => entry.erase).map(([name]) => name);
    const erased = await eraseDatabases(device, left);
    // A sign-out cut short: once all of it is gone, its registry goes too.
    if (erased && registry.ending && registry.databases.size === left.length) {
      await device.remove(REGISTRY);
    }
  }, undefined);
  const check = await step(() => signInProject(device, signIn), "failed" as SignInCheck);
  // Unchanged for 30 days: last changed then or before.
  const cutoff = device.now() - KEEP_MS;
  // Each database on its own: none waits for another.
  await Promise.all([
    ...liveDatabases(registry, "profile").map((name) =>
      step(async () => {
        const profile = await openProfileDatabase(device, name);
        await profile?.clearCorrectWork();
        await profile?.expire(cutoff);
      }, undefined),
    ),
    ...liveDatabases(registry, "cache").map(() =>
      step(async () => (await openCacheDatabase(device))?.expire(cutoff), undefined),
    ),
  ]);
  return check;
}
