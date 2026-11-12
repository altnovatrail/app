// The device's storage as the browser has it: IndexedDB, the origin's web storage and its clock.
import { Device } from "./device.ts";
import { indexedDbBackend } from "./idb.ts";

/** Clears one web storage; a browser that bars it has nothing of app's in it. */
function clear(storage: () => Storage): void {
  try {
    storage().clear();
  } catch {
    // Storage barred by the browser's settings: there is nothing to clear.
  }
}

export function browserDevice(): Device {
  return new Device({
    backend: indexedDbBackend(indexedDB),
    webStorage: {
      clear() {
        clear(() => localStorage);
        clear(() => sessionStorage);
      },
    },
    now: Date.now,
  });
}

/** What the browser tells of keeping the site's data (section 3.2): the Storage Standard's API. */
export interface SiteStorage {
  /** The browser's estimate of the whole site, in bytes; none when it gives none. */
  estimate(): Promise<{ readonly usage: number; readonly quota: number } | undefined>;
  /** Whether the browser keeps the site's data until the user erases it; none when it can't say. */
  persisted(): Promise<boolean | undefined>;
  /** Asks the browser to keep it, on an adult's press: whether it said yes. */
  persist(): Promise<boolean>;
}

/** The browser's: a browser without the API, or one that bars it, has nothing to tell. */
export const siteStorage: SiteStorage = {
  async estimate() {
    try {
      const { usage, quota } = (await navigator.storage?.estimate?.()) ?? {};
      return usage === undefined || quota === undefined ? undefined : { usage, quota };
    } catch {
      return undefined;
    }
  },
  async persisted() {
    try {
      return await navigator.storage?.persisted?.();
    } catch {
      return undefined;
    }
  },
  async persist() {
    try {
      return (await navigator.storage?.persist?.()) === true;
    } catch {
      return false;
    }
  },
};
