// The shared cache of the open views of packages, by package digest (section 3.2 of
// docs/architecture.md; R62 in spec): content of modules, not a learner's data, written with
// relaxed durability. A view untouched for 30 days goes, and a withdrawn version goes at once.
import { type Connection, within } from "./backend.ts";
import type { Device } from "./device.ts";
import { addDatabase, readRegistry } from "./registry.ts";
import { CACHE, CACHE_SCHEMA } from "./schema.ts";

/** The open views of a package app keeps (R99 in spec). */
export type ViewKind = "manifest" | "skill-graph" | "techniques" | "solving-steps";

interface View {
  readonly bytes: Uint8Array;
  readonly usedAt: number;
}

/** How often a read marks a view used: once a day is enough for a term of 30 days. */
const MARK_MS = 24 * 60 * 60 * 1000;

export class Cache {
  private readonly connection: Connection;
  private readonly now: () => number;

  constructor(connection: Connection, now: () => number) {
    this.connection = connection;
    this.now = now;
  }

  /** The bytes of a view, as `api` gave them; marked used, at most once a day. */
  async get(digest: string, kind: ViewKind): Promise<Uint8Array | undefined> {
    const view = (await this.connection.read(["views"], (tx) => tx.get("views", [digest, kind]))) as
      | View
      | undefined;
    if (view === undefined) return undefined;
    const now = this.now();
    if (now - view.usedAt >= MARK_MS) {
      await this.connection
        .write(
          ["views"],
          (tx) => tx.put("views", [digest, kind], { ...view, usedAt: now }),
          "relaxed",
        )
        .catch(() => undefined);
    }
    return view.bytes;
  }

  /** Keeps a view; a cache that cannot keep it asks `api` again next time. */
  async put(digest: string, kind: ViewKind, bytes: Uint8Array): Promise<void> {
    await this.connection
      .write(
        ["views"],
        (tx) => tx.put("views", [digest, kind], { bytes, usedAt: this.now() }),
        "relaxed",
      )
      .catch(() => undefined);
  }

  /** Versions withdrawn: every view of their packages goes. */
  async withdraw(digests: readonly string[]): Promise<void> {
    await this.connection.write(["views"], async (tx) => {
      for (const digest of digests) await tx.delete("views", within(digest));
    });
  }

  /** Views last used at a time or before go. */
  async expire(cutoff: number): Promise<void> {
    await this.connection.write(["views"], async (tx) => {
      const range = { upper: cutoff };
      for (const { key } of await tx.entries("views", { index: "usedAt", range })) {
        await tx.delete("views", key);
      }
    });
  }
}

/**
 * The cache, while an account is signed in: it is the account's, and sign-out erases it. Named in
 * the registry before it is first opened; `undefined` with no registry or while it is being erased.
 */
export async function openCache(device: Device): Promise<Cache | undefined> {
  const registry = await readRegistry(device);
  if (registry?.account === undefined) return undefined;
  if (registry.databases.get(CACHE)?.erase === true) return undefined;
  await addDatabase(device, CACHE, { kind: "cache" });
  const connection = await device.connect(CACHE, CACHE_SCHEMA, true);
  return connection === undefined ? undefined : new Cache(connection, device.now);
}

/** The cache by its name in the registry, without making it, for the start and for erasure. */
export async function openCacheDatabase(device: Device): Promise<Cache | undefined> {
  const connection = await device.connect(CACHE, CACHE_SCHEMA, false);
  return connection === undefined ? undefined : new Cache(connection, device.now);
}
