// What NOTICE has to say about the packages the build takes from npm — those package-lock.json
// does not mark `dev`, the transitive ones too (R14 in docs/decisions.md):
// - a line `<name> <version> — <license> — <copyright>` for each, with a copyright that is not
//   empty, and no such line for a package or a version the lock file does not ship;
// - for each license among them, a line that begins `Text of <license>`, with its text below.
// Run as `node scripts/notice.ts` it prints what is wrong, and ci-licenses fails on it.
import { readFileSync } from "node:fs";

interface LockPackage {
  readonly version?: string;
  readonly license?: string;
  readonly dev?: boolean;
  readonly link?: boolean;
}

/** A package the build ships, by the lock file. */
export interface Shipped {
  readonly name: string;
  readonly version: string;
  readonly license: string;
}

const MODULES = "node_modules/";

/** The packages of a lock file that are not `dev`, the root and links left out, sorted. */
export function shippedPackages(lock: { packages: Record<string, LockPackage> }): Shipped[] {
  const shipped: Shipped[] = [];
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "" || entry.dev === true || entry.link === true) continue;
    const at = path.lastIndexOf(MODULES);
    const name = at === -1 ? path : path.slice(at + MODULES.length);
    shipped.push({ name, version: entry.version ?? "", license: entry.license ?? "" });
  }
  return shipped.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

// A line of the list: name, version, license and copyright, divided by " — ".
const ENTRY = /^(\S+) (\S+) — (\S+) — (.*)$/;

/** What is wrong with a NOTICE for the packages a lock file ships; empty when nothing is. */
export function noticeProblems(notice: string, shipped: readonly Shipped[]): string[] {
  const lines = notice.split("\n");
  const listed = new Map<string, string>();
  for (const line of lines) {
    const match = ENTRY.exec(line);
    if (match !== null) listed.set(`${match[1]} ${match[2]} — ${match[3]}`, match[4] ?? "");
  }
  const problems: string[] = [];
  const wanted = new Set<string>();
  for (const { name, version, license } of shipped) {
    if (license === "") {
      problems.push(`${name} ${version}: the lock file names no license`);
      continue;
    }
    const key = `${name} ${version} — ${license}`;
    wanted.add(key);
    const copyright = listed.get(key);
    if (copyright === undefined) problems.push(`no line for ${name} ${version} (${license})`);
    else if (copyright.trim() === "") problems.push(`no copyright for ${name} ${version}`);
  }
  for (const key of listed.keys()) {
    if (!wanted.has(key)) problems.push(`a line for what the build does not ship: ${key}`);
  }
  for (const license of new Set(shipped.map((s) => s.license).filter((l) => l !== ""))) {
    if (!lines.some((line) => line.startsWith(`Text of ${license}`))) {
      problems.push(`no text of ${license}`);
    }
  }
  return problems;
}

/** The check of this repository's NOTICE: 0 when it is right, else 1, with what is wrong. */
export function run(root = "."): number {
  const lock = JSON.parse(readFileSync(`${root}/package-lock.json`, "utf8"));
  const problems = noticeProblems(readFileSync(`${root}/NOTICE`, "utf8"), shippedPackages(lock));
  if (problems.length > 0) {
    console.error(`NOTICE: ${problems.join("; ")}`);
    return 1;
  }
  console.log("notice: ok");
  return 0;
}

if (import.meta.main) process.exit(run());
