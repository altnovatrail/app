// The tar archives of app (R25 in docs/decisions.md), read and written by its own code, with no
// dependency. Read: spec's part deployment/, from the file of spec's release that holds it,
// parts/deployment-1.tar.gz, which ci-licenses has release-verify accept (RULES.md, Hard rules; R85
// in spec) — the code and its tests read spec's files from its releases, not from the spec
// submodule, which CI checks out for the licenses job alone (R21 in spec); that archive is git's, a
// tar gzipped under one folder — and the archive of a release, which scripts/release.ts checks.
// Written: ustar, every time and owner 0, a file of the mode 0644 and a folder of 0755.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

/** The file of the release, and the folder its part lies in within the archive. */
export const DEPLOYMENT_ARCHIVE = "parts/deployment-1.tar.gz";
export const DEPLOYMENT_ROOT = "deployment-1/deployment/";

/** The size of a block of a tar. */
export const BLOCK = 512;

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

/** An entry of a tar, as its header and pax header give it. */
export interface TarEntry {
  readonly path: string;
  /** The type flag: "0" a file, "5" a folder, "2" a link, and so on; "" an old file. */
  readonly type: string;
  readonly mode: number;
  readonly uid: number;
  readonly gid: number;
  readonly mtime: number;
  readonly body: Buffer;
}

/** A number of a tar header, in octal. */
function octal(header: Buffer, at: number, length: number): number {
  return Number.parseInt(field(header, at, length).trim() || "0", 8);
}

/** The entries of a tar, in their order, but its pax headers, which name the next entry's path. */
export function tarEntries(tar: Buffer): TarEntry[] {
  const entries: TarEntry[] = [];
  let at = 0;
  let nextPath: string | undefined;
  while (at + BLOCK <= tar.length) {
    const header = tar.subarray(at, at + BLOCK);
    if (header.every((byte) => byte === 0)) break;
    const size = octal(header, 124, 12);
    const type = field(header, 156, 1);
    const prefix = field(header, 345, 155);
    const name = prefix === "" ? field(header, 0, 100) : `${prefix}/${field(header, 0, 100)}`;
    const body = tar.subarray(at + BLOCK, at + BLOCK + size);
    if (type === "x") {
      nextPath = paxPath(body);
    } else if (type !== "g") {
      entries.push({
        path: nextPath ?? name,
        type,
        mode: octal(header, 100, 8),
        uid: octal(header, 108, 8),
        gid: octal(header, 116, 8),
        mtime: octal(header, 136, 12),
        body: Buffer.from(body),
      });
      nextPath = undefined;
    }
    at += BLOCK + Math.ceil(size / BLOCK) * BLOCK;
  }
  return entries;
}

/** The regular files of a tar, by their paths. */
export function tarFiles(tar: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const entry of tarEntries(tar)) {
    if (entry.type === "0" || entry.type === "") files.set(entry.path, entry.body);
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

/** A field of a ustar header: text, padded with NUL. */
function put(header: Buffer, at: number, length: number, text: string): void {
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > length) throw new Error(`a field of the archive is too long: ${text}`);
  bytes.copy(header, at);
}

/** A number of a ustar header, in octal, with its NUL. */
function putOctal(header: Buffer, at: number, length: number, value: number): void {
  put(header, at, length, `${value.toString(8).padStart(length - 1, "0")}\0`);
}

/**
 * A path as ustar's two fields hold it: whole in the name when it fits, else split at the first
 * slash that leaves both within their fields; refused when no slash does.
 */
function split(path: string): { readonly prefix: string; readonly name: string } {
  if (Buffer.byteLength(path) <= 100) return { prefix: "", name: path };
  for (
    let at = path.indexOf("/");
    at !== -1 && at < path.length - 1;
    at = path.indexOf("/", at + 1)
  ) {
    const prefix = path.slice(0, at);
    const name = path.slice(at + 1);
    if (Buffer.byteLength(prefix) <= 155 && Buffer.byteLength(name) <= 100) return { prefix, name };
  }
  throw new Error(`a path of the archive is too long for ustar: ${path}`);
}

/** The ustar header of an entry. */
function header(path: string, size: number, folder: boolean): Buffer {
  const block = Buffer.alloc(BLOCK);
  const { prefix, name } = split(path);
  put(block, 0, 100, name);
  putOctal(block, 100, 8, folder ? 0o755 : 0o644);
  putOctal(block, 108, 8, 0);
  putOctal(block, 116, 8, 0);
  putOctal(block, 124, 12, size);
  putOctal(block, 136, 12, 0);
  put(block, 156, 1, folder ? "5" : "0");
  put(block, 257, 6, "ustar\0");
  put(block, 263, 2, "00");
  put(block, 345, 155, prefix);
  // The checksum is of the header with its own field as spaces.
  block.fill(" ", 148, 156);
  let sum = 0;
  for (const byte of block) sum += byte;
  put(block, 148, 8, `${sum.toString(8).padStart(6, "0")}\0 `);
  return block;
}

/** A ustar of entries in their order: a folder has no body, a file its bytes. */
export function tar(entries: readonly { path: string; body?: Buffer | undefined }[]): Buffer {
  const blocks: Buffer[] = [];
  for (const { path, body } of entries) {
    blocks.push(header(path, body?.length ?? 0, body === undefined));
    if (body !== undefined) {
      blocks.push(body, Buffer.alloc((BLOCK - (body.length % BLOCK)) % BLOCK));
    }
  }
  blocks.push(Buffer.alloc(2 * BLOCK));
  return Buffer.concat(blocks);
}
