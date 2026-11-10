// The files of a package's device part — LICENSE, NOTICE and the media files — which are no method
// of the contract (section 15 of the text of the contracts; section 3.2 of docs/architecture.md):
// HTTP GET at api's address, /packages/sha256-<hex>/device/<path>, with no token and no header, so
// that fetch needs no preflight and goes through the HTTP cache, which keeps them; app stores none
// itself. A media file goes to the canvas as a Blob (R36 in spec). 404 is a path the part has not;
// 410 a version api no longer gives, and CheckPackages is asked; 503 a deployment going on, repeated
// after the time Retry-After names. No DOM beyond fetch and Blob.
import type { Media } from "@altnovatrail/spec/canvas";
import { PAUSES, retryAfter, STILL_GOING_MS } from "../api/interceptors.ts";

/** What a file that did not come came to. */
export type FileFailure = "missing" | "withdrawn" | "offline" | "unknown";

export class FileError extends Error {
  readonly failure: FileFailure;

  constructor(failure: FileFailure, detail: string) {
    super(`device file ${failure}: ${detail}`);
    this.name = "FileError";
    this.failure = failure;
  }
}

const DIGEST = /^sha256:[0-9a-f]{64}$/;

/** The address of a file of a package's device part on api; a path that would leave it is none. */
export function fileUrl(api: string, digest: string, path: string): string {
  if (!DIGEST.test(digest)) throw new FileError("unknown", `not a package digest: ${digest}`);
  const parts = path.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new FileError("missing", `not a path of the device part: ${path}`);
  }
  const segments = parts.map((segment) => encodeURIComponent(segment));
  return `${api.replace(/\/+$/, "")}/packages/${digest.replace(":", "-")}/device/${segments.join("/")}`;
}

export interface FilesOptions {
  /** The origin of api, from /deployment.json. */
  readonly api: string;
  /** api no longer gives the version: CheckPackages is asked. */
  readonly withdrawn: () => void;
  readonly fetch?: typeof globalThis.fetch;
  readonly sleep?: (ms: number) => Promise<void>;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class DeviceFiles {
  private readonly options: FilesOptions;

  constructor(options: FilesOptions) {
    this.options = options;
  }

  /** A file of a package's device part, by its path there: `LICENSE`, `media/…`. */
  async file(digest: string, path: string): Promise<Blob> {
    const url = fileUrl(this.options.api, digest, path);
    const fetcher = this.options.fetch ?? globalThis.fetch.bind(globalThis);
    const sleep = this.options.sleep ?? wait;
    // A network that fails and a 503 that names no time take the growing pauses of the client; a
    // 503 that names one waits for it, as long as api lets a request go at most.
    let failed = 0;
    let waited = 0;
    const pause = async () => {
      const next = PAUSES[failed++];
      if (next === undefined) throw new FileError("offline", url);
      await sleep(next);
    };
    for (;;) {
      let response: Response;
      try {
        response = await fetcher(url);
      } catch {
        await pause();
        continue;
      }
      if (response.ok) return response.blob();
      if (response.status === 404) throw new FileError("missing", url);
      if (response.status === 410) {
        this.options.withdrawn();
        throw new FileError("withdrawn", url);
      }
      if (response.status !== 503) throw new FileError("unknown", `${url}: ${response.status}`);
      const asked = retryAfter(response.headers);
      if (asked === undefined) {
        await pause();
        continue;
      }
      if (waited + asked > STILL_GOING_MS) throw new FileError("offline", url);
      waited += asked;
      await sleep(asked);
    }
  }

  /** What gives the canvas the pictures of a package, by their paths from its media/ folder. */
  media(digest: string): Media {
    return (ref) => this.file(digest, `media/${ref}`);
  }
}
