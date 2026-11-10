// The backend on the browser's IndexedDB (section 3.2 of docs/architecture.md). Every connection
// closes on versionchange, so that a deletion or a newer build in another tab does not wait for it;
// a database that is not there is made only when asked, so that a tab whose database another tab
// erased does not make it again, empty; and a removal another's connection holds is "blocked" at
// once, not awaited — Firebase Auth's connection closes only on pagehide (R16).
import {
  type Backend,
  type Connection,
  type Durability,
  type Entry,
  isRange,
  type Key,
  NewerSchemaError,
  type OpenOptions,
  type Query,
  type Range,
  type Removal,
  type Schema,
  type Transaction,
} from "./backend.ts";

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function keyRange(range: Range | undefined): IDBKeyRange | undefined {
  const lower = range?.lower as IDBValidKey | undefined;
  const upper = range?.upper as IDBValidKey | undefined;
  if (lower !== undefined && upper !== undefined) return IDBKeyRange.bound(lower, upper);
  if (lower !== undefined) return IDBKeyRange.lowerBound(lower);
  return upper === undefined ? undefined : IDBKeyRange.upperBound(upper);
}

function source(tx: IDBTransaction, store: string, query: Query): IDBObjectStore | IDBIndex {
  const records = tx.objectStore(store);
  return query.index === undefined ? records : records.index(query.index);
}

function transaction(tx: IDBTransaction): Transaction {
  return {
    get: (store, key) => done(tx.objectStore(store).get(key as IDBValidKey)),
    entries: (store, query = {}) =>
      new Promise((resolve, reject) => {
        const request = source(tx, store, query).openCursor(keyRange(query.range));
        const entries: Entry[] = [];
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor === null) {
            resolve(entries);
            return;
          }
          entries.push({ key: cursor.primaryKey as Key, value: cursor.value });
          cursor.continue();
        };
      }),
    count: (store, query = {}) => done(source(tx, store, query).count(keyRange(query.range))),
    put: async (store, key, value) => {
      await done(tx.objectStore(store).put(value, key as IDBValidKey));
    },
    delete: async (store, keys) => {
      const records = tx.objectStore(store);
      const query = isRange(keys) ? keyRange(keys) : (keys as IDBValidKey);
      await done(query === undefined ? records.clear() : records.delete(query));
    },
  };
}

function connection(db: IDBDatabase): Connection {
  const run = <T>(
    stores: readonly string[],
    mode: IDBTransactionMode,
    work: (tx: Transaction) => Promise<T>,
    durability: Durability = "default",
  ): Promise<T> => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction([...stores], mode, { durability });
    } catch (error) {
      // A connection closed or closing, or a store it has not: a refusal, as every other.
      return Promise.reject(error);
    }
    const completed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error ?? new DOMException("aborted", "AbortError"));
    });
    // The work makes its requests now, while the transaction is active.
    const result = (async () => work(transaction(tx)))();
    result.catch(() => {
      try {
        tx.abort();
      } catch {
        // Finished already: its own error stands.
      }
    });
    return Promise.all([result, completed]).then(([value]) => value);
  };
  return {
    read: (stores, work) => run(stores, "readonly", work),
    write: (stores, work, durability) => run(stores, "readwrite", work, durability),
    close: () => db.close(),
  };
}

/** Brings the stores and their indexes to the schema, and takes off what is not in it. */
function upgrade(db: IDBDatabase, tx: IDBTransaction, schema: Schema): void {
  for (const store of [...db.objectStoreNames]) {
    if (!(store in schema.stores)) db.deleteObjectStore(store);
  }
  for (const [name, indexes] of Object.entries(schema.stores)) {
    const store = db.objectStoreNames.contains(name)
      ? tx.objectStore(name)
      : db.createObjectStore(name);
    for (const index of [...store.indexNames]) {
      if (store.index(index).keyPath !== indexes[index]) store.deleteIndex(index);
    }
    for (const [index, property] of Object.entries(indexes)) {
      if (!store.indexNames.contains(index)) store.createIndex(index, property);
    }
  }
}

export function indexedDbBackend(factory: IDBFactory = indexedDB): Backend {
  return {
    open: (name: string, schema: Schema, options: OpenOptions) =>
      new Promise((resolve, reject) => {
        const request = factory.open(name, schema.version);
        let absent = false;
        request.onupgradeneeded = (event) => {
          const tx = request.transaction as IDBTransaction;
          if (event.oldVersion === 0 && !options.create) {
            // Aborting the upgrade of a database just made leaves no database.
            absent = true;
            tx.abort();
            return;
          }
          upgrade(request.result, tx, schema);
        };
        request.onerror = (event) => {
          // Handled here: the error goes no further, to window's onerror.
          event.preventDefault();
          if (absent) resolve(undefined);
          else if (request.error?.name === "VersionError") reject(new NewerSchemaError(name));
          else reject(request.error);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            options.onLost("versionchange");
          };
          db.onclose = () => options.onLost("closed");
          resolve(connection(db));
        };
      }),
    remove: (name: string) =>
      new Promise<Removal>((resolve) => {
        const request = factory.deleteDatabase(name);
        request.onsuccess = () => resolve("deleted");
        request.onerror = () => resolve("failed");
        request.onblocked = () => resolve("blocked");
      }),
  };
}
