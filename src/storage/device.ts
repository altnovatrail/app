// What app's storage on this device stands on: the backend, the origin's web storage, the clock,
// and the connections it holds, one per database (section 3.2 of docs/architecture.md). It tells
// whoever listens of a connection the browser or another tab took away, and of a database a newer
// build has opened. No DOM: the browser's pieces come in from main.tsx.
import {
  type Backend,
  type Connection,
  type Lost,
  NewerSchemaError,
  type Removal,
  type Schema,
} from "./backend.ts";
import { REGISTRY } from "./schema.ts";

/** The origin's localStorage and sessionStorage, which sign-out clears whole (R04). */
export interface WebStorage {
  clear(): void;
}

/** What happened to app's storage without app doing it. */
export type DeviceEvent =
  | { readonly kind: "lost"; readonly database: string; readonly reason: Lost }
  | { readonly kind: "newer"; readonly database: string };

export interface DeviceOptions {
  readonly backend: Backend;
  readonly webStorage: WebStorage;
  /** Milliseconds since the epoch: `Date.now`. */
  readonly now: () => number;
}

export class Device {
  readonly backend: Backend;
  readonly webStorage: WebStorage;
  readonly now: () => number;
  /** Whether this tab has seen the registry: its loss then means the data was erased. */
  registrySeen = false;
  readonly #connections = new Map<string, Promise<Connection | undefined>>();
  readonly #listeners = new Set<(event: DeviceEvent) => void>();

  constructor(options: DeviceOptions) {
    this.backend = options.backend;
    this.webStorage = options.webStorage;
    this.now = options.now;
  }

  /** Listens for what happens to the storage; gives back what stops listening. */
  listen(listener: (event: DeviceEvent) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #tell(event: DeviceEvent): void {
    for (const listener of this.#listeners) listener(event);
  }

  /**
   * The connection to a database, opened once and kept; `undefined` when it is not there and
   * `create` is false. A newer version is told to the listeners and thrown.
   */
  async connect(name: string, schema: Schema, create: boolean): Promise<Connection | undefined> {
    const held = this.#connections.get(name);
    const kept = held === undefined ? undefined : await held.catch(() => undefined);
    if (kept !== undefined) return kept;
    const opening = this.backend.open(name, schema, {
      create,
      onLost: (reason) => {
        if (this.#connections.get(name) === opening) this.#connections.delete(name);
        this.#tell({ kind: "lost", database: name, reason });
      },
    });
    this.#connections.set(name, opening);
    try {
      const connection = await opening;
      if (connection === undefined && this.#connections.get(name) === opening) {
        this.#connections.delete(name);
      }
      if (connection !== undefined && name === REGISTRY) this.registrySeen = true;
      return connection;
    } catch (error) {
      if (this.#connections.get(name) === opening) this.#connections.delete(name);
      if (error instanceof NewerSchemaError) this.#tell({ kind: "newer", database: name });
      throw error;
    }
  }

  /** Deletes a database, closing this tab's own connection first, so that only others wait. */
  async remove(name: string): Promise<Removal> {
    const held = this.#connections.get(name);
    this.#connections.delete(name);
    (await held?.catch(() => undefined))?.close();
    const removal = await this.backend.remove(name);
    // This tab erased the registry itself: its absence is no sign of the browser erasing.
    if (name === REGISTRY && removal === "deleted") this.registrySeen = false;
    return removal;
  }
}
