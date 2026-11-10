// What NOTICE has to say about the packages the build takes from npm — those package-lock.json
// does not mark `dev`, the transitive ones too (R14 and R15 in docs/decisions.md):
// - a line `<name> <version> — <license> — <copyright>` for each, its license as the lock file
//   says it, an SPDX expression too, with a copyright that is not empty, and no such line for a
//   package or a version the lock file does not ship;
// - for each license among them, every identifier of an expression on its own, a line that begins
//   `Text of <license>`, with its text below;
// - for each of them that holds a NOTICE file of its own, a line `Notice of <name> <version>:`, a
//   blank line and that file's text as it is, as the Apache License 2.0, section 4(d), asks of a
//   work that redistributes it; and no such section for a package that holds none.
// Run as `node scripts/notice.ts` it prints what is wrong, and ci-licenses fails on it.
import { existsSync, readdirSync, readFileSync } from "node:fs";

interface LockPackage {
  readonly version?: string;
  readonly license?: string;
  readonly dev?: boolean;
  readonly link?: boolean;
}

/** A package the build ships, by the lock file. */
export interface Shipped {
  /** Where the lock file has it, as `node_modules/<name>`, nested too. */
  readonly path: string;
  readonly name: string;
  readonly version: string;
  readonly license: string;
}

const MODULES = "node_modules/";

/** A package's name by its path in a lock file: the part after the last node_modules/, or the
 * whole path when there is none. */
export function packageName(path: string): string {
  const at = path.lastIndexOf(MODULES);
  return at === -1 ? path : path.slice(at + MODULES.length);
}

/** The packages of a lock file that are not `dev`, the root and links left out, sorted. */
export function shippedPackages(lock: { packages: Record<string, LockPackage> }): Shipped[] {
  const shipped: Shipped[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || entry.dev === true || entry.link === true) continue;
    const name = packageName(path);
    shipped.push({ path, name, version: entry.version ?? "", license: entry.license ?? "" });
  }
  const key = (s: Shipped) => `${s.name} ${s.version}`;
  return shipped.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

/** The license identifiers of an SPDX expression: `(Apache-2.0 AND BSD-3-Clause)` holds two. */
export function licenseIds(expression: string): string[] {
  const ids = expression.match(/[A-Za-z0-9][A-Za-z0-9.+-]*/g) ?? [];
  return ids.filter((id) => id !== "AND" && id !== "OR" && id !== "WITH");
}

const SEPARATOR = " — ";
const NAME_VERSION = /^(\S+) (\S+)$/;
const NOTICE_OF = /^Notice of (\S+) (\S+):$/;
/** A package's own NOTICE file, as packages name it. */
const NOTICE_FILE = /^NOTICE(?:\.txt|\.md)?$/i;

/** A line of the list, as `<name> <version> — <license>` and its copyright; undefined if none. */
function entryOf(line: string): { key: string; copyright: string } | undefined {
  const first = line.indexOf(SEPARATOR);
  const second = line.indexOf(SEPARATOR, first + SEPARATOR.length);
  if (first === -1 || second === -1 || !NAME_VERSION.test(line.slice(0, first))) return undefined;
  return { key: line.slice(0, second), copyright: line.slice(second + SEPARATOR.length) };
}

/**
 * What is wrong with a NOTICE for the packages a lock file ships, given the text of each one's own
 * NOTICE file, undefined for one that holds none; empty when nothing is.
 */
export function noticeProblems(
  notice: string,
  shipped: readonly Shipped[],
  noticeOf: (pkg: Shipped) => string | undefined = () => undefined,
): string[] {
  const lines = notice.split("\n");
  const listed = new Map<string, string>();
  const sections = new Set<string>();
  for (const line of lines) {
    const entry = entryOf(line);
    if (entry !== undefined) listed.set(entry.key, entry.copyright);
    const section = NOTICE_OF.exec(line);
    if (section !== null) sections.add(`${section[1]} ${section[2]}`);
  }
  const problems: string[] = [];
  const wanted = new Set<string>();
  const withNotice = new Set<string>();
  const licenses = new Set<string>();
  for (const pkg of shipped) {
    const { name, version, license } = pkg;
    const own = noticeOf(pkg);
    if (own !== undefined) {
      withNotice.add(`${name} ${version}`);
      const text = own.replaceAll("\r\n", "\n").trim();
      if (!notice.includes(`Notice of ${name} ${version}:\n\n${text}\n`)) {
        problems.push(`no notice of ${name} ${version} as it is`);
      }
    }
    if (license === "") {
      problems.push(`${name} ${version}: the lock file names no license`);
      continue;
    }
    for (const id of licenseIds(license)) licenses.add(id);
    const key = `${name} ${version}${SEPARATOR}${license}`;
    wanted.add(key);
    const copyright = listed.get(key);
    if (copyright === undefined) problems.push(`no line for ${name} ${version} (${license})`);
    else if (copyright.trim() === "") problems.push(`no copyright for ${name} ${version}`);
  }
  for (const key of listed.keys()) {
    if (!wanted.has(key)) problems.push(`a line for what the build does not ship: ${key}`);
  }
  for (const section of sections) {
    if (!withNotice.has(section)) problems.push(`a notice of what holds none: ${section}`);
  }
  for (const license of licenses) {
    if (!lines.some((line) => line.startsWith(`Text of ${license}`))) {
      problems.push(`no text of ${license}`);
    }
  }
  return problems;
}

/** The check of this repository's NOTICE: 0 when it is right, else 1, with what is wrong. */
export function run(root = "."): number {
  const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, "utf8"));
  const shipped = shippedPackages(lock);
  // Their own NOTICE files are read from node_modules, which npm ci fills.
  const missing = shipped.filter(({ path }) => !existsSync(`${root}/${path}`));
  if (missing.length > 0) {
    console.error(`NOTICE: not installed, run npm ci: ${missing.map((p) => p.path).join(", ")}`);
    return 1;
  }
  const noticeOf = ({ path }: Shipped): string | undefined => {
    const file = readdirSync(`${root}/${path}`).find((name) => NOTICE_FILE.test(name));
    return file === undefined ? undefined : readFileSync(`${root}/${path}/${file}`, "utf8");
  };
  const notice = readFileSync(`${root}/NOTICE`, "utf8");
  const problems = noticeProblems(notice, shipped, noticeOf);
  if (problems.length > 0) {
    console.error(`NOTICE: ${problems.join("; ")}`);
    return 1;
  }
  console.log("notice: ok");
  return 0;
}

if (import.meta.main) process.exit(run());
