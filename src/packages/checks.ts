// What the device asks api about the packages whose open views it keeps (section 15 of the text of
// the contracts; R63 in spec; section 3.2 of docs/architecture.md): CheckPackages when app starts
// and after a sign of a withdrawal — CAUSE_VERSION_NOT_GIVEN, an answer 410, a lesson run ended or an
// attempt closed unchecked. Of a digest no longer given it erases the open views, in the cache and
// in the profiles' databases, and the lessons on it; about a digest not known yet it asks later.
// One check at a time. No DOM.
import { PackageStatus } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { Api } from "../api/client.ts";
import { openCacheDatabase } from "../storage/cache.ts";
import type { Device } from "../storage/device.ts";
import { versionsWithdrawn } from "../storage/erase.ts";
import { openProfileDatabase } from "../storage/profile.ts";
import { liveDatabases, readRegistry } from "../storage/registry.ts";

/** How long before asking again about a digest api did not know: a deployment going on, ms. */
export const LATER_MS = 60_000;

/** The digests of every package whose open views the device keeps. */
export async function keptDigests(device: Device): Promise<string[]> {
  const registry = await readRegistry(device);
  if (registry === undefined) return [];
  const found = new Set<string>();
  if (liveDatabases(registry, "cache").length > 0) {
    for (const digest of (await (await openCacheDatabase(device))?.digests()) ?? []) {
      found.add(digest);
    }
  }
  for (const name of liveDatabases(registry, "profile")) {
    for (const digest of (await (await openProfileDatabase(device, name))?.digests()) ?? []) {
      found.add(digest);
    }
  }
  return [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export interface Checked {
  readonly withdrawn: readonly string[];
  readonly unknown: readonly string[];
}

/** Asks about every digest the device keeps, and erases what is no longer given. */
export async function checkPackages(api: Api, device: Device): Promise<Checked> {
  const digests = await keptDigests(device);
  if (digests.length === 0) return { withdrawn: [], unknown: [] };
  const { packages } = await api.package.checkPackages({ packageDigests: digests });
  const withdrawn = packages
    .filter((check) => check.status === PackageStatus.NOT_GIVEN)
    .map((check) => check.packageDigest);
  const unknown = packages
    .filter((check) => check.status === PackageStatus.UNKNOWN)
    .map((check) => check.packageDigest);
  await versionsWithdrawn(device, withdrawn);
  return { withdrawn, unknown };
}

/** The timer the later check waits on; the tests give their own. */
export interface Timer {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const TIMER: Timer = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** The checks of one tab: one at a time, and another later while api knows a digest not. */
export class PackageChecks {
  private readonly api: Api;
  private readonly device: Device;
  private readonly timer: Timer;
  private going: Promise<void> | undefined;
  private again = false;
  private later: unknown;
  private stopped = false;
  /** The digests this tab has learnt api no longer gives: no view of them is kept again. */
  readonly withdrawn = new Set<string>();

  constructor(api: Api, device: Device, timer: Timer = TIMER) {
    this.api = api;
    this.device = device;
    this.timer = timer;
  }

  /** Checks now, or once more after the check under way; a check that fails asks nothing later. */
  check(): Promise<void> {
    if (this.going !== undefined) {
      this.again = true;
      return this.going;
    }
    this.going = this.run().finally(() => {
      this.going = undefined;
      if (this.again && !this.stopped) {
        this.again = false;
        void this.check();
      }
    });
    return this.going;
  }

  private async run(): Promise<void> {
    if (this.later !== undefined) this.timer.clear(this.later);
    this.later = undefined;
    const checked = await checkPackages(this.api, this.device).catch(() => undefined);
    for (const digest of checked?.withdrawn ?? []) this.withdrawn.add(digest);
    if (checked !== undefined && checked.unknown.length > 0 && !this.stopped) {
      this.later = this.timer.set(() => {
        this.later = undefined;
        void this.check();
      }, LATER_MS);
    }
  }

  /** Checks may come again: the app below Boot is there (StrictMode mounts it twice). */
  start(): void {
    this.stopped = false;
  }

  /** No more later checks from this tab: its app is gone. */
  stop(): void {
    this.stopped = true;
    if (this.later !== undefined) this.timer.clear(this.later);
    this.later = undefined;
  }
}
