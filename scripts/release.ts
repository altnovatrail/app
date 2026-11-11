// The archive of a release of app's build (sections 3.1 and 3.7 of docs/architecture.md; R25 in
// docs/decisions.md): build/ as it is, with NOTICE and LICENSE beside it at the root — the bundle
// keeps no licence comment of the packages it takes, so the notices travel with the code. The
// layout is the one infra's rollout reads (R17 in infra; the third amendment of 2026-11-09 to R85
// in spec): index.html, assets/, deployment.schema.json and csp.json at the root, no
// deployment.json of its own. The archive is packed here, not by a tar of the system: a ustar of
// the files sorted by name (./archive.ts), gzipped with no name, no time and an unknown system, so
// that the same build gives the same bytes on any machine. `just release-files` writes it into
// dist/, which .github's release.yml signs; ci-test packs build/ and a second build of the same
// tree and checks that the two are the same bytes, in the layout.
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { type TarEntry, tar, tarEntries } from "./archive.ts";
import { layerIsFirst } from "./deployment-plugin.ts";

/** The files the repository gives the archive beside the build: the same bytes in both. */
export const NOTICES = ["NOTICE", "LICENSE"] as const;

/** The files at the root of the archive; assets/ is the one folder beside them. */
export const ROOT_FILES = ["index.html", "deployment.schema.json", "csp.json", ...NOTICES];

/** Paths in the order of their code points: the same on every machine, whatever its locale. */
const byCodePoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const VERSION = /^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

/** The byte of a gzip header that names the system it was made on: "unknown", on every one. */
const GZIP_OS = 9;
const UNKNOWN_OS = 0xff;

/** The archive's name for a version, `app_v0.1.0.tar.gz`; refused for a version not vX.Y.Z. */
export function archiveName(version: string): string {
  if (!VERSION.test(version)) {
    throw new Error(
      `release-files: the version is v<major>.<minor>.<patch>, as v0.1.0, not ${version}`,
    );
  }
  return `app_${version}.tar.gz`;
}

/** The files and folders of a folder, by their paths within it, sorted; a link is refused. */
function walk(root: string, within = ""): { path: string; folder: boolean }[] {
  const found: { path: string; folder: boolean }[] = [];
  for (const name of readdirSync(`${root}/${within}`).sort(byCodePoint)) {
    const path = `${within}${name}`;
    const stat = lstatSync(`${root}/${path}`);
    if (stat.isDirectory()) {
      found.push({ path: `${path}/`, folder: true }, ...walk(root, `${path}/`));
    } else if (stat.isFile()) {
      found.push({ path, folder: false });
    } else {
      throw new Error(`${root}/${path} is neither a file nor a folder`);
    }
  }
  return found;
}

/**
 * The archive of a build: the folder's files under `./`, then the repository's NOTICE and LICENSE
 * at the root, all sorted by path.
 */
export function pack(build: string, notices: Readonly<Record<string, Buffer>>): Buffer {
  const bodies = new Map<string, Buffer | undefined>([["./", undefined]]);
  for (const { path, folder } of walk(build)) {
    bodies.set(`./${path}`, folder ? undefined : readFileSync(`${build}/${path}`));
  }
  for (const [name, body] of Object.entries(notices)) {
    if (bodies.has(`./${name}`)) throw new Error(`the build holds a ${name} of its own`);
    bodies.set(`./${name}`, body);
  }
  const sorted = [...bodies.keys()].sort(byCodePoint);
  const archive = gzipSync(tar(sorted.map((path) => ({ path, body: bodies.get(path) }))), {
    level: 9,
  });
  archive[GZIP_OS] = UNKNOWN_OS;
  return archive;
}

/** An entry's path within the build: without its `./`, and without the slash of a folder. */
function within(entry: TarEntry): string {
  return entry.path.replace(/^\.\//, "").replace(/\/$/, "");
}

/** What is wrong with an archive, against the layout infra reads and the notices it is to carry. */
export function archiveProblems(
  archive: Buffer,
  notices: Readonly<Record<string, Buffer>>,
): string[] {
  let entries: TarEntry[];
  try {
    entries = tarEntries(gunzipSync(archive));
  } catch {
    return ["the archive is no gzipped tar"];
  }
  const problems: string[] = [];
  const files = new Map<string, Buffer>();
  const folders = new Set<string>();
  for (const entry of entries) {
    const path = within(entry);
    if (entry.path.startsWith("/") || path.split("/").includes("..")) {
      problems.push(`${entry.path} is a path out of the build`);
      continue;
    }
    if (entry.mtime !== 0 || entry.uid !== 0 || entry.gid !== 0) {
      problems.push(
        `${entry.path} has a time or an owner, and the archive would not be the same twice`,
      );
    }
    if (entry.type === "5") {
      if (entry.mode !== 0o755) problems.push(`${entry.path} is not of the mode 0755`);
      if (path !== "") folders.add(path);
    } else if (entry.type === "0" || entry.type === "") {
      if (entry.mode !== 0o644) problems.push(`${entry.path} is not of the mode 0644`);
      files.set(path, entry.body);
    } else {
      problems.push(`${entry.path} is neither a file nor a folder`);
    }
  }
  for (const name of ROOT_FILES) {
    if (!files.has(name)) problems.push(`the archive holds no ${name} at its root`);
  }
  if (![...files.keys()].some((path) => path.startsWith("assets/"))) {
    problems.push("the archive holds no file under assets/");
  }
  for (const path of [...files.keys(), ...folders]) {
    const top = path.split("/")[0] as string;
    const allowed = top === "assets" || (path === top && ROOT_FILES.includes(top));
    if (path.split("/").at(-1) === "deployment.json") {
      problems.push(`the archive holds ${path}, and that file is the deployment's`);
    } else if (!allowed) {
      problems.push(`the archive holds ${path}, which its layout has not`);
    }
  }
  for (const [name, body] of Object.entries(notices)) {
    const held = files.get(name);
    if (held !== undefined && !held.equals(body)) {
      problems.push(`the archive's ${name} is not the repository's`);
    }
  }
  const page = files.get("index.html");
  if (page !== undefined && !layerIsFirst(page.toString("utf8"))) {
    problems.push("the lower layer of the CSP is not first in <head> after <meta charset>");
  }
  return problems;
}

/** The repository's NOTICE and LICENSE, read from its root. */
export function repositoryNotices(root = "."): Record<string, Buffer> {
  return Object.fromEntries(NOTICES.map((name) => [name, readFileSync(`${root}/${name}`)]));
}

/**
 * `release.ts <version>` writes the archive of build/ into dist/ and prints its sum; `--name
 * <version>` prints the archive's name alone, refused for a version not vX.Y.Z; `--check <build>`
 * packs build/ and that second build of the same tree, and is refused unless the two are the same
 * bytes and the layout holds. Every failure is a line and the code 1.
 */
export function run(argument: string | undefined, other: string | undefined, root = "."): number {
  try {
    if (argument === "--name") {
      console.log(archiveName(other ?? ""));
      return 0;
    }
    const name = argument === "--check" ? undefined : archiveName(argument ?? "");
    const notices = repositoryNotices(root);
    const archive = pack(`${root}/build`, notices);
    const problems = archiveProblems(archive, notices);
    if (argument === "--check") {
      if (other === undefined) throw new Error("--check takes the folder of a second build");
      if (!pack(other, notices).equals(archive)) {
        problems.push("two builds of the same tree are not the same bytes");
      }
    }
    if (problems.length > 0) {
      console.error(`release: ${problems.join("; ")}`);
      return 1;
    }
    if (name === undefined) {
      console.log("release: ok");
      return 0;
    }
    mkdirSync(`${root}/dist`, { recursive: true });
    writeFileSync(`${root}/dist/${name}`, archive);
    console.log(`${createHash("sha256").update(archive).digest("hex")}  ${name}`);
    return 0;
  } catch (error) {
    console.error(`release: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (import.meta.main) process.exit(run(process.argv[2], process.argv[3]));
