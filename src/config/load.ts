// The fetch of /deployment.json at every start, before any other request (R09 in
// docs/decisions.md; section 3.7 of docs/architecture.md): what the answer has to be, and what
// the learner sees when it is not. No DOM beyond fetch and its Response.
import { type Deployment, readDeployment } from "./deployment.ts";

/** The path of the file: from the root of the origin, wherever the document is. */
export const PATH = "/deployment.json";
/** The most the file may be, read from its body, tens of times what it needs. */
export const MAX_BYTES = 16 * 1024;

/** What the start makes of the file. */
export type Loaded =
  | { readonly kind: "ready"; readonly deployment: Deployment }
  /** The request did not get through, the hosting answered 5xx, 408 or 429: it may come back. */
  | { readonly kind: "offline" }
  /** There is no file, or not the right one: the line for whoever deployed the copy says why. */
  | { readonly kind: "unconfigured"; readonly detail: string };

/** The type of an answer without its parameters: `application/json; charset=utf-8` is JSON. */
function mediaType(response: Response): string {
  return (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** The body, read up to a byte past the most allowed; undefined when it is longer. */
async function bodyOf(response: Response): Promise<Uint8Array | undefined> {
  const reader = response.body?.getReader();
  if (reader === undefined) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let read = await reader.read(); !read.done; read = await reader.read()) {
    size += read.value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(read.value);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return body;
}

/** The line for whoever deployed the copy, in English (the 2026-11-02 amendment to R09). */
function unconfigured(detail: string): Loaded {
  return { kind: "unconfigured", detail };
}

/**
 * Fetches and reads the file for app open at an origin. A network failure, a 5xx or a body cut
 * off is "offline"; any other answer that is not the file is "unconfigured".
 */
export async function loadDeployment(
  appOrigin: string,
  fetcher: typeof fetch = fetch,
): Promise<Loaded> {
  let response: Response;
  try {
    // "no-cache" asks the hosting again each time, so a rolled-out file is seen at the next start.
    response = await fetcher(PATH, { cache: "no-cache" });
  } catch {
    return { kind: "offline" };
  }
  // A hosting that is down, timed out or holds back for a while answers again later.
  const later = response.status === 408 || response.status === 429;
  if (later || (response.status >= 500 && response.status <= 599)) return { kind: "offline" };
  if (response.status !== 200) return unconfigured(`${PATH} answered ${response.status}`);
  if (response.redirected) return unconfigured(`${PATH} was redirected to ${response.url}`);
  const type = mediaType(response);
  if (type !== "application/json") {
    return unconfigured(`${PATH} is ${type === "" ? "of no type" : type}, not application/json`);
  }
  let body: Uint8Array | undefined;
  try {
    body = await bodyOf(response);
  } catch {
    return { kind: "offline" };
  }
  if (body === undefined) return unconfigured(`${PATH} is larger than ${MAX_BYTES} bytes`);
  let file: unknown;
  try {
    file = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return unconfigured(`${PATH} is not JSON`);
  }
  const reading = readDeployment(file, appOrigin);
  if (reading.ok) return { kind: "ready", deployment: reading.deployment };
  const fields = reading.fields.map((field) => (field === "" ? "the file itself" : field));
  return unconfigured(`${PATH} is refused by ${reading.refusedBy}: ${fields.join(", ")}`);
}
