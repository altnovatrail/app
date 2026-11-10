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
