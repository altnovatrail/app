// spec's part deployment/, from the file of spec's release that holds it, parts/deployment-1.tar.gz,
// which ci-licenses has release-verify accept (RULES.md, Hard rules; R85 in spec). The code and its
// tests read spec's files from its releases, not from the spec submodule, which CI checks out for
// the licenses job alone (R21 in spec). The archive is git's: a tar, gzipped, under one folder.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** The file of the release, and the folder its part lies in within the archive. */
export const DEPLOYMENT_ARCHIVE = "parts/deployment-1.tar.gz";
export const DEPLOYMENT_ROOT = "deployment-1/deployment/";

const BLOCK = 512;

/** A field of a tar header: text up to its first NUL. */
function field(header: Buffer, at: number, length: number): string {
  const text = header.subarray(at, at + length).toString("utf8");
  const end = text.indexOf("\0");
  return end === -1 ? text : text.slice(0, end);
}

/** The path a pax header of the next entry gives, if it gives one. */
function paxPath(body: Buffer): string | undefined {
  const text = body.toString("utf8");
  let at = 0;
  while (at < text.length) {
    const space = text.indexOf(" ", at);
    const length = Number(text.slice(at, space));
    const record = text.slice(space + 1, at + length - 1);
    if (record.startsWith("path=")) return record.slice("path=".length);
    at += length;
  }
  return undefined;
}

/** The regular files of a tar, by their paths. */
export function tarFiles(tar: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let at = 0;
  let nextPath: string | undefined;
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const size = Number.parseInt(field(header, 124, 12).trim() || "0", 8);
    const type = field(header, 156, 1);
    const prefix = field(header, 345, 155);
    const name = prefix === "" ? field(header, 0, 100) : `${prefix}/${field(header, 0, 100)}`;
    const body = tar.subarray(at + BLOCK, at + BLOCK + size);
    if (type === "x") {
      nextPath = paxPath(body);
    } else if (type === "0" || type === "") {
      files.set(nextPath ?? name, Buffer.from(body));
      nextPath = undefined;
    } else if (type !== "g") {
      nextPath = undefined;
    }
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return files;
}

/** The files of the part deployment/, by their paths within the part: `schemas/…`, `VERSION`. */
export function deploymentPart(path = DEPLOYMENT_ARCHIVE): Map<string, Buffer> {
  const part = new Map<string, Buffer>();
  for (const [name, body] of tarFiles(gunzipSync(readFileSync(path)))) {
    if (name.startsWith(DEPLOYMENT_ROOT)) part.set(name.slice(DEPLOYMENT_ROOT.length), body);
  }
  return part;
}

/** A file of the part, as text; refused for one the part does not hold. */
export function partText(part: Map<string, Buffer>, name: string): string {
  const body = part.get(name);
  if (body === undefined) throw new Error(`${DEPLOYMENT_ARCHIVE} holds no ${name}`);
  return body.toString("utf8");
}
