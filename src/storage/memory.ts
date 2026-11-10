// The store in memory for the tests in Node (section 3.2 of docs/architecture.md): the backend's
// interface as IndexedDB keeps it — keys in IndexedDB's order, records cloned in and out, one
// transaction at a time per database and nothing of a failed one kept — with what the tests make
// happen: another tab, a removal blocked or failed, a write refused, the browser closing.
import {
  type Backend,
  type Connection,
  type Entry,
  isRange,
  type Key,
  type Lost,
  NewerSchemaError,
  type OpenOptions,
  type Query,
  type Range,
  type Removal,
  type Schema,
  type Transaction,
} from "./backend.ts";

function rank(key: Key): number {
  if (typeof key === "number") return 0;
  return typeof key === "string" ? 1 : 2;
}

/** IndexedDB's order of keys: numbers, then strings by code units, then arrays item by item. */
export function compareKeys(a: Key, b: Key): number {
  const order = rank(a) - rank(b);
  if (order !== 0) return order;
  if (typeof a === "object" && typeof b === "object") {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const item = compareKeys(a[i] as Key, b[i] as Key);
      if (item !== 0) return item;
    }
    return a.length - b.length;
  }
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

function inRange(key: Key, range: Range | undefined): boolean {
  if (range?.lower !== undefined && compareKeys(key, range.lower) < 0) return false;
  return range?.upper === undefined || compareKeys(key, range.upper) <= 0;
}

/** The key an index reads from a record, if the record has one IndexedDB would take. */
function indexKey(value: unknown, property: string): Key | undefined {
  const key = (value as Record<string, unknown> | null)?.[property];
  return typeof key === "number" || typeof key === "string" ? key : undefined;
}

type Stores = Map<string, Map<string, Entry>>;

interface Database {
  version: number;
  stores: Stores;
  indexes: Map<string, Readonly<Record<string, string>>>;
  connections: Set<MemoryConnection>;
  /** The transaction under way: the next one waits for it. */
  queue: Promise<unknown>;
}

/** A key as a string to find its record by: JSON tells numbers, strings and arrays apart. */
const id = (key: Key) => JSON.stringify(key);

function sorted(entries: Iterable<Entry>): Entry[] {
  return [...entries].sort((a, b) => compareKeys(a.key, b.key));
}

class MemoryTransaction implements Transaction {
  private readonly database: Database;
  private readonly stores: Stores;
  private readonly backend: MemoryBackend;
  private readonly writable: boolean;

  constructor(database: Database, stores: Stores, backend: MemoryBackend, writable: boolean) {
    this.database = database;
    this.stores = stores;
    this.backend = backend;
    this.writable = writable;
  }

  private store(name: string): Map<string, Entry> {
    const store = this.stores.get(name);
    if (store === undefined) throw new DOMException(`no store ${name}`, "NotFoundError");
    return store;
  }

  async get(store: string, key: Key): Promise<unknown> {
    return structuredClone(this.store(store).get(id(key))?.value);
  }

  async entries(store: string, query: Query = {}): Promise<readonly Entry[]> {
    const records = [...this.store(store).values()];
    if (query.index === undefined) {
      return sorted(records.filter((entry) => inRange(entry.key, query.range))).map((entry) =>
        structuredClone(entry),
      );
    }
    const property = this.database.indexes.get(store)?.[query.index];
    if (property === undefined) throw new DOMException(`no index ${query.index}`, "NotFoundError");
    return records
      .map((entry) => ({ entry, by: indexKey(entry.value, property) }))
      .filter((row): row is { entry: Entry; by: Key } => row.by !== undefined)
      .filter((row) => inRange(row.by, query.range))
      .sort((a, b) => compareKeys(a.by, b.by) || compareKeys(a.entry.key, b.entry.key))
      .map((row) => structuredClone(row.entry));
  }

  async keys(store: string, query?: Query): Promise<readonly Key[]> {
    return (await this.entries(store, query)).map((entry) => entry.key);
  }

  async count(store: string, query?: Query): Promise<number> {
    return (await this.entries(store, query)).length;
  }

  async put(store: string, key: Key, value: unknown): Promise<void> {
    if (!this.writable) throw new DOMException("read-only transaction", "ReadOnlyError");
    if (this.backend.refuseWrites) {
      throw new DOMException("the quota is exceeded", "QuotaExceededError");
    }
    this.store(store).set(id(key), { key: structuredClone(key), value: structuredClone(value) });
  }

  async delete(store: string, keys: Key | Range): Promise<void> {
    if (!this.writable) throw new DOMException("read-only transaction", "ReadOnlyError");
    const records = this.store(store);
    if (!isRange(keys)) {
      records.delete(id(keys));
      return;
    }
    for (const [at, entry] of records) if (inRange(entry.key, keys)) records.delete(at);
  }
}

class MemoryConnection implements Connection {
  private closed = false;
  private readonly name: string;
  private readonly database: Database;
  private readonly backend: MemoryBackend;
  private readonly onLost: (reason: Lost) => void;

  constructor(
    name: string,
    database: Database,
    backend: MemoryBackend,
    onLost: (reason: Lost) => void,
  ) {
    this.name = name;
    this.database = database;
    this.backend = backend;
    this.onLost = onLost;
  }

  private run<T>(
    stores: readonly string[],
    writable: boolean,
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    if (this.closed || this.backend.databases.get(this.name) !== this.database) {
      return Promise.reject(new DOMException("the connection is closed", "InvalidStateError"));
    }
    const database = this.database;
    const step = database.queue.then(async () => {
      // A copy of the stores the transaction takes, which only its success puts in their place.
      const copy: Stores = new Map();
      for (const store of stores) {
        const records = database.stores.get(store);
        if (records === undefined) throw new DOMException(`no store ${store}`, "NotFoundError");
        copy.set(store, new Map(records));
      }
      const result = await work(new MemoryTransaction(database, copy, this.backend, writable));
      if (writable) for (const [store, records] of copy) database.stores.set(store, records);
      return result;
    });
    database.queue = step.catch(() => undefined);
    return step;
  }

  read<T>(stores: readonly string[], work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.run(stores, false, work);
  }

  write<T>(stores: readonly string[], work: (tx: Transaction) => Promise<T>): Promise<T> {
    return this.run(stores, true, work);
  }

  close(): void {
    this.closed = true;
    this.database.connections.delete(this);
  }

  /** The connection taken away, as app's own code closes it on versionchange, or the browser. */
  lose(reason: Lost): void {
    this.close();
    this.onLost(reason);
  }
}

/** IndexedDB in memory, with the tests' levers. */
export class MemoryBackend implements Backend {
  readonly databases = new Map<string, Database>();
  /** Databases whose removal waits for a connection of someone else, as Firebase Auth's does. */
  readonly blocked = new Set<string>();
  /** Databases whose removal fails. */
  readonly failing = new Set<string>();
  /** Whether every write is refused, as on a full disk. */
  refuseWrites = false;

  async open(name: string, schema: Schema, options: OpenOptions): Promise<Connection | undefined> {
    let database = this.databases.get(name);
    if (database === undefined) {
      if (!options.create) return undefined;
      database = {
        version: 0,
        stores: new Map(),
        indexes: new Map(),
        connections: new Set(),
        queue: Promise.resolve(),
      };
      this.databases.set(name, database);
    }
    if (database.version > schema.version) throw new NewerSchemaError(name);
    if (database.version < schema.version) {
      // Told after the upgrade: an open the old connections ask for then waits for it, as in
      // IndexedDB, where it is queued behind this one.
      const older = [...database.connections];
      for (const store of database.stores.keys()) {
        if (!(store in schema.stores)) database.stores.delete(store);
      }
      for (const [store, indexes] of Object.entries(schema.stores)) {
        if (!database.stores.has(store)) database.stores.set(store, new Map());
        database.indexes.set(store, indexes);
      }
      database.version = schema.version;
      for (const connection of older) connection.lose("versionchange");
    }
    const connection = new MemoryConnection(name, database, this, options.onLost);
    database.connections.add(connection);
    return connection;
  }

  async remove(name: string): Promise<Removal> {
    if (this.failing.has(name)) return "failed";
    if (this.blocked.has(name)) return "blocked";
    const connections = [...(this.databases.get(name)?.connections ?? [])];
    // Told after the deletion: an open they ask for then finds no database, as in IndexedDB.
    this.databases.delete(name);
    for (const connection of connections) connection.lose("versionchange");
    return "deleted";
  }

  /** The browser closes every connection to a database, as on its `close` event. */
  closeAll(name: string): void {
    for (const connection of [...(this.databases.get(name)?.connections ?? [])]) {
      connection.lose("closed");
    }
  }

  /** The browser erases the origin's data: every database goes, then every connection is closed. */
  eraseAll(): void {
    const connections = [...this.databases.values()].flatMap((database) => [
      ...database.connections,
    ]);
    this.databases.clear();
    for (const connection of connections) connection.lose("closed");
  }

  /** Every record of a store, for the tests to look at. */
  records(name: string, store: string): readonly Entry[] {
    return sorted(this.databases.get(name)?.stores.get(store)?.values() ?? []);
  }
}
