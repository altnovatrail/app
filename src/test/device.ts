// A device on the store in memory, with a clock the test moves and a count of web storage clears.
import { Device } from "../storage/device.ts";
import { MemoryBackend } from "../storage/memory.ts";

export const DAY = 24 * 60 * 60 * 1000;

export function memoryDevice(backend = new MemoryBackend()) {
  const state = { time: 1_000_000_000_000, cleared: 0 };
  const device = new Device({
    backend,
    webStorage: {
      clear() {
        state.cleared += 1;
      },
    },
    now: () => state.time,
  });
  return { backend, device, state };
}
