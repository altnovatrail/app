// What the start makes of the storage taken away while app is open (section 3.2 of
// docs/architecture.md; R16 in docs/decisions.md).
// - The browser closed a connection: the registry is opened again, without making it. No registry,
//   where this tab had one, is data erased; a registry there is data that could not be read, and
//   nothing is erased.
// - Another tab deleted a database or opened it at a newer version (versionchange): the database is
//   opened again, without making it. One deleted on purpose — a sign-out, a profile gone — is
//   nobody's trouble here; one at a newer version the device tells of by itself, as "newer".
import { NewerSchemaError } from "../storage/backend.ts";
import type { Device, DeviceEvent } from "../storage/device.ts";
import { readRegistry } from "../storage/registry.ts";
import { schemaOf } from "../storage/schema.ts";

export type Trouble = "erased" | "unreadable" | "newer";

export async function troubleOf(device: Device, event: DeviceEvent): Promise<Trouble | undefined> {
  if (event.kind === "newer") return "newer";
  if (event.reason === "versionchange") {
    const schema = schemaOf(event.database);
    // A newer version comes back as the device's own "newer"; anything else is no trouble here.
    if (schema !== undefined) await device.connect(event.database, schema, false).catch(() => {});
    return undefined;
  }
  let registry: Awaited<ReturnType<typeof readRegistry>>;
  try {
    registry = await readRegistry(device);
  } catch (error) {
    // The device tells of a newer registry by itself.
    return error instanceof NewerSchemaError ? undefined : "unreadable";
  }
  if (registry === undefined) return device.registrySeen ? "erased" : undefined;
  return "unreadable";
}
