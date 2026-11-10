// The open views of a package by its digest (section 15 of the text of the contracts; R62, R99 in
// spec; section 3.2 of docs/architecture.md): from the shared cache when it keeps them, otherwise
// from api by Connect GET, and kept then. A view is the JSON of the module format, read by the types
// of @altnovatrail/spec, in a version of the format the build reads — 0.4 —; a view in another
// version is the build's to give up on: a reload is offered (R44 in spec), and the cache keeps none
// of it. A part the module does not have is no view, and the cache keeps that too. A call waits
// 30 s at most, by its own signal: a deadline in a header would make the request one with a
// preflight. No DOM.
import type { OpenView } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { Code, ConnectError } from "@connectrpc/connect";
import { type Api, TIMEOUT_MS } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { type Cache, type CachedView, openCache, type ViewKind } from "../storage/cache.ts";
import type { Device } from "../storage/device.ts";

/** The versions of the module format this build reads: the window of the build. */
export const FORMATS: readonly string[] = ["0.4"];

/** The types of the open views, by their kind. */
export interface Views {
  readonly manifest: open.Manifest;
  readonly "skill-graph": open.SkillGraph;
  readonly techniques: open.Techniques;
  readonly "solving-steps": open.SolvingSteps;
}

/** A view read, and beside a skill graph the tier of each skill, by its local ID. */
export interface Opened<K extends ViewKind> {
  readonly view: Views[K];
  readonly skillTiers: Readonly<Record<string, number>>;
}

export interface OpenViewsOptions {
  readonly api: Api;
  readonly device: Device;
  /** A view in a version the build does not read: a reload is offered (section 3.7). */
  readonly stale: () => void;
  /** Whether this tab has learnt that api no longer gives the package: its views are kept no more. */
  readonly withdrawn?: (digest: string) => boolean;
}

/** What api answers for a kind of view: its open view, and the tiers beside a skill graph. */
async function ask(
  api: Api,
  kind: ViewKind,
  packageDigest: string,
  signal: AbortSignal,
): Promise<CachedView> {
  const kept = (view: OpenView | undefined, skillTiers?: Readonly<Record<string, number>>) =>
    view === undefined
      ? {}
      : {
          json: view.json,
          version: view.moduleFormatVersion,
          ...(skillTiers ? { skillTiers } : {}),
        };
  const options = { signal };
  switch (kind) {
    case "manifest":
      return kept((await api.views.getManifest({ packageDigest }, options)).manifest);
    case "skill-graph": {
      const answer = await api.views.getSkillGraph({ packageDigest }, options);
      return kept(answer.skillGraph, answer.skillTiers);
    }
    case "techniques":
      return kept((await api.views.getTechniques({ packageDigest }, options)).techniques);
    case "solving-steps":
      return kept((await api.views.getSolvingSteps({ packageDigest }, options)).solvingSteps);
  }
}

/** Asks api with a deadline of its own, which no header names. */
async function askInTime(api: Api, kind: ViewKind, digest: string, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new ConnectError("no answer in time", Code.DeadlineExceeded)),
    ms,
  );
  try {
    return await ask(api, kind, digest, controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/** Whether a version X.Y.Z of a module is later than another, by its three numbers. */
function newer(version: string, than: string): boolean {
  const a = version.split(".").map(Number);
  const b = than.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

/** The JSON of a view, read; `undefined` for bytes that are no JSON. */
function parsed(json: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(json));
  } catch {
    return undefined;
  }
}

export class OpenViews {
  private readonly options: OpenViewsOptions;
  /** The cache of the account signed in, opened once: none before sign-in, asked for again. */
  private cache: Promise<Cache | undefined> | undefined;
  /** How long a call waits, ms; the tests make it shorter. */
  timeoutMs = TIMEOUT_MS;
  /** The reads under way: a view asked for twice at once is asked of api once. */
  private readonly going = new Map<string, Promise<unknown>>();

  constructor(options: OpenViewsOptions) {
    this.options = options;
  }

  private async opened(): Promise<Cache | undefined> {
    this.cache ??= openCache(this.options.device).catch(() => undefined);
    const cache = await this.cache;
    if (cache === undefined) this.cache = undefined;
    return cache;
  }

  /** A view of a package, or `undefined` when the module has no such part. */
  get<K extends ViewKind>(digest: string, kind: K): Promise<Opened<K> | undefined> {
    const key = `${digest} ${kind}`;
    let read = this.going.get(key) as Promise<Opened<K> | undefined> | undefined;
    if (read === undefined) {
      read = this.read(digest, kind).finally(() => this.going.delete(key));
      this.going.set(key, read);
    }
    return read;
  }

  private async read<K extends ViewKind>(digest: string, kind: K): Promise<Opened<K> | undefined> {
    const cache = await this.opened();
    let view = await cache?.get(digest, kind).catch(() => undefined);
    // A view kept in a version this build does not read is one api may give anew in another.
    if (view?.json !== undefined && !FORMATS.includes(view.version ?? "")) {
      await cache?.forget(digest, kind);
      view = undefined;
    }
    const kept = view !== undefined;
    if (view === undefined) view = await askInTime(this.options.api, kind, digest, this.timeoutMs);
    if (view.json === undefined) {
      if (!kept) await this.keep(cache, digest, kind, view);
      return undefined;
    }
    const read = this.parseView(view.json, view.version ?? "");
    if (!kept) await this.keep(cache, digest, kind, view);
    return { view: read as Views[K], skillTiers: view.skillTiers ?? {} };
  }

  /**
   * An open view that came in an answer of another service — the task of an attempt, its solution —
   * read by the same window of versions: one in a version the build does not read offers a reload,
   * and bytes that are no JSON are a fault of the answer.
   */
  parseView(json: Uint8Array, version: string): unknown {
    if (!FORMATS.includes(version)) {
      this.options.stale();
      throw new ApiError({ kind: "stale" });
    }
    const read = parsed(json);
    if (read === undefined) throw new ApiError({ kind: "invalid" });
    return read;
  }

  /**
   * The manifests the cache keeps, by module, each of its latest version there, in one pass and with
   * no request: how a module with no current version for the learner is named (ModuleService in the
   * contract). None before sign-in, and none in a version this build does not read or without a
   * module ID and version to go by.
   */
  async keptManifests(): Promise<ReadonlyMap<string, open.Manifest>> {
    const found = new Map<string, open.Manifest>();
    const cache = await this.opened();
    if (cache === undefined) return found;
    for (const digest of await cache.digests().catch((): string[] => [])) {
      const view = await cache.get(digest, "manifest").catch(() => undefined);
      if (view?.json === undefined || !FORMATS.includes(view.version ?? "")) continue;
      const manifest = parsed(view.json) as Partial<open.Manifest> | null | undefined;
      if (typeof manifest?.id !== "string" || typeof manifest.version !== "string") continue;
      const held = found.get(manifest.id);
      if (held === undefined || newer(manifest.version, held.version)) {
        found.set(manifest.id, manifest as open.Manifest);
      }
    }
    return found;
  }

  /** Keeps a view read, unless this tab has learnt meanwhile that its package is withdrawn. */
  private async keep(cache: Cache | undefined, digest: string, kind: ViewKind, view: CachedView) {
    if (this.options.withdrawn?.(digest) === true) return;
    await cache?.put(digest, kind, view);
  }
}
