// The device's registry (section 3.2 of docs/architecture.md; R16 in docs/decisions.md): which
// account signed in, with which project of the sign-in service, and app's databases of the
// account. A database is named here before it is first opened, and its erasure is written here
// before it is asked for, so that one the browser did not delete is deleted again at the next start.
import type { Transaction } from "./backend.ts";
import type { Device } from "./device.ts";
import { REGISTRY, REGISTRY_SCHEMA } from "./schema.ts";

/** The project of the sign-in service the session was made with (section 3.7). */
export interface SignIn {
  readonly projectId: string;
  readonly apiKey: string;
}

export interface DatabaseEntry {
  readonly kind: "profile" | "cache";
  readonly profileId?: string;
  /** Whether the database is to be erased: a removal not done yet. */
  readonly erase: boolean;
}

export interface Registry {
  readonly account?: string;
  readonly signIn?: SignIn;
  /** A sign-out under way: the registry goes too once its databases are erased. */
  readonly ending: boolean;
  readonly databases: ReadonlyMap<string, DatabaseEntry>;
}

/** The registry, or `undefined` when there is none: nobody signed in on this device. */
export async function readRegistry(device: Device): Promise<Registry | undefined> {
  const connection = await device.connect(REGISTRY, REGISTRY_SCHEMA, false);
  if (connection === undefined) return undefined;
  return connection.read(["registry", "databases"], async (tx) => {
    const account = (await tx.get("registry", "account")) as { id: string } | undefined;
    const signIn = (await tx.get("registry", "signIn")) as SignIn | undefined;
    const ending = (await tx.get("registry", "ending")) === true;
    const databases = new Map<string, DatabaseEntry>();
    for (const entry of await tx.entries("databases")) {
      databases.set(entry.key as string, entry.value as DatabaseEntry);
    }
    return {
      ...(account === undefined ? {} : { account: account.id }),
      ...(signIn === undefined ? {} : { signIn }),
      ending,
      databases,
    };
  });
}

/** Writes to the registry, making it if it is not there. */
export async function changeRegistry(
  device: Device,
  change: (tx: Transaction) => Promise<void>,
): Promise<void> {
  const connection = await device.connect(REGISTRY, REGISTRY_SCHEMA, true);
  await connection?.write(["registry", "databases"], change);
}

/** The account that signed in; a sign-out it ends is over. */
export function setAccount(device: Device, id: string): Promise<void> {
  return changeRegistry(device, async (tx) => {
    await tx.put("registry", "account", { id });
    await tx.delete("registry", "ending");
  });
}

/** The project of the sign-in service the session is made with. */
export function setSignIn(device: Device, signIn: SignIn): Promise<void> {
  return changeRegistry(device, (tx) =>
    tx.put("registry", "signIn", { projectId: signIn.projectId, apiKey: signIn.apiKey }),
  );
}

/** Names a database of the account, before it is opened; one to be erased stays so. */
export function addDatabase(
  device: Device,
  name: string,
  entry: Omit<DatabaseEntry, "erase">,
): Promise<void> {
  return changeRegistry(device, async (tx) => {
    const held = (await tx.get("databases", name)) as DatabaseEntry | undefined;
    if (held === undefined) await tx.put("databases", name, { ...entry, erase: false });
  });
}

/**
 * Erases databases the registry names: each marked first, then deleted, and its line gone only
 * once the browser said so. Gives whether every one of them is gone.
 */
export async function eraseDatabases(device: Device, names: readonly string[]): Promise<boolean> {
  if (names.length === 0) return true;
  const marked: string[] = [];
  await changeRegistry(device, async (tx) => {
    for (const name of names) {
      const entry = (await tx.get("databases", name)) as DatabaseEntry | undefined;
      if (entry === undefined) continue;
      marked.push(name);
      if (!entry.erase) await tx.put("databases", name, { ...entry, erase: true });
    }
  });
  let all = true;
  for (const name of marked) {
    if ((await device.remove(name)) === "deleted") {
      await changeRegistry(device, (tx) => tx.delete("databases", name));
    } else {
      all = false;
    }
  }
  return all;
}

/** The names of the databases the registry still keeps, not to be erased. */
export function liveDatabases(registry: Registry, kind: DatabaseEntry["kind"]): string[] {
  return [...registry.databases]
    .filter(([, entry]) => entry.kind === kind && !entry.erase)
    .map(([name]) => name);
}
