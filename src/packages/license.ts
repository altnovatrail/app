// What the page of a module's license shows (R32 in docs/decisions.md; R62 in spec; section 3.2 of
// docs/architecture.md): LICENSE and NOTICE of a version's device part, as they are, by the digest
// of its package. A part with no NOTICE has none, which the format allows; a version api no longer
// gives is said so, CheckPackages asked meanwhile (files.ts); a file that did not come is a failure
// of the read, which the page asks again. The module's manifest, which names it above them, the
// page reads apart, so that one that is slow to come holds no text back. No DOM.
import { Code } from "@connectrpc/connect";
import { ApiError } from "../api/failure.ts";
import { type DeviceFiles, FileError } from "./files.ts";

/** A module's license as the page reads it. */
export type LicenseRead =
  /** api no longer gives the version: its files are gone. */
  | { readonly withdrawn: true }
  | {
      readonly withdrawn: false;
      /** LICENSE as it is; none when the part has none, which the format does not allow. */
      readonly license?: string;
      /** NOTICE as it is; none when the module has none. */
      readonly notice?: string;
    };

/**
 * LICENSE and NOTICE of a version, one after the other: a version no longer given answers 410 to
 * the first, and CheckPackages is asked once, not once a file.
 */
export async function readLicense(files: DeviceFiles, digest: string): Promise<LicenseRead> {
  try {
    const license = await files.text(digest, "LICENSE");
    const notice = await files.text(digest, "NOTICE");
    return {
      withdrawn: false,
      ...(license === undefined ? {} : { license }),
      ...(notice === undefined ? {} : { notice }),
    };
  } catch (reason) {
    if (!(reason instanceof FileError)) throw reason;
    if (reason.failure === "withdrawn") return { withdrawn: true };
    throw new ApiError(
      reason.failure === "offline" ? { kind: "offline" } : { kind: "unknown", code: Code.Unknown },
      reason,
    );
  }
}
