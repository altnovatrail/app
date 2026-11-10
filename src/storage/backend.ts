// The narrow interface app keeps its data on the device behind (R04 and R16 in docs/decisions.md;
// section 3.2 of docs/architecture.md): the operations of IndexedDB it uses and nothing more, so that
// the rules above it run the same on the browser's IndexedDB (idb.ts) and on the store in memory
// the tests in Node give it (memory.ts). No DOM here.

/** A key, as app's stores have them: a number, a string, or an array of keys. */
export type Key = number | string | readonly Key[];

/** The keys from `lower` to `upper`, both in, either open-ended when left out. */
export interface Range {
  readonly lower?: Key;
  readonly upper?: Key;
}

/** Every key that is an array beginning with `prefix`: arrays sort after numbers and strings. */
export function within(...prefix: readonly Key[]): Range {
  return { lower: prefix, upper: [...prefix, []] };
}

/** What `entries` and `count` look at: a store's keys, or an index's, within a range. */
export interface Query {
  /** The index to read by, by its name; the store's own keys when left out. */
  readonly index?: string;
  readonly range?: Range;
}

/** A record with its key in its store. */
export interface Entry {
  readonly key: Key;
  readonly value: unknown;
}

/**
 * A database's stores and its version. Each store has its keys out of its records, and its indexes
 * by name, each reading one property of a record. Opening at a higher version brings the stores
 * and the indexes to these, and takes off what is no longer here.
 */
export interface Schema {
  readonly version: number;
  readonly stores: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

/** What a transaction does: every call is a request of it, and nothing else awaits in between. */
export interface Transaction {
  get(store: string, key: Key): Promise<unknown>;
  /** The records in the order of the query's keys, and, by an index, of their own keys next. */
  entries(store: string, query?: Query): Promise<readonly Entry[]>;
  count(store: string, query?: Query): Promise<number>;
  /** The keys of the records, in order, without their records. */
  keys(store: string, query?: Query): Promise<readonly Key[]>;
  put(store: string, key: Key, value: unknown): Promise<void>;
  delete(store: string, keys: Key | Range): Promise<void>;
}

/**
 * Durability of a write: the browser's default, or `"relaxed"` for a cache, which IndexedDB itself
 * advises there (section 3.2).
 */
export type Durability = "default" | "relaxed";

/** An open connection to one database. */
export interface Connection {
  read<T>(stores: readonly string[], work: (tx: Transaction) => Promise<T>): Promise<T>;
  write<T>(
    stores: readonly string[],
    work: (tx: Transaction) => Promise<T>,
    durability?: Durability,
  ): Promise<T>;
  close(): void;
}

/**
 * Why a connection is gone without app closing it: another tab deleted the database or opened it
 * at a newer version (`"versionchange"`), or the browser closed it (`"closed"`) — because it
 * erased the origin's data, or because of a corruption or an I/O error.
 */
export type Lost = "versionchange" | "closed";

export interface OpenOptions {
  /** Whether a database that is not there is made; if not, `open` gives `undefined`. */
  readonly create: boolean;
  readonly onLost: (reason: Lost) => void;
}

/** What came of deleting a database: `"blocked"` while a connection of someone else holds it. */
export type Removal = "deleted" | "blocked" | "failed";

/** A database at a version newer than this build's: a newer build of app has opened it. */
export class NewerSchemaError extends Error {
  readonly database: string;

  constructor(database: string) {
    super(`${database} is at a version newer than this build's`);
    this.name = "NewerSchemaError";
    this.database = database;
  }
}

export interface Backend {
  open(name: string, schema: Schema, options: OpenOptions): Promise<Connection | undefined>;
  remove(name: string): Promise<Removal>;
}

/** Whether a query of `delete` is a range and not one key. */
export function isRange(keys: Key | Range): keys is Range {
  return typeof keys === "object" && !Array.isArray(keys);
}
