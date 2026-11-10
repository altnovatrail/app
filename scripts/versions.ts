// Every version in package.json is exact: no range, tag or link (RULES.md, Hard rules).
import { readFileSync } from "node:fs";

const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/** The dependencies of a package.json whose version is not exact, as `name@version`. */
export function inexactVersions(manifest: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ]) {
    const deps = (manifest[field] ?? {}) as Record<string, string>;
    for (const [name, version] of Object.entries(deps)) {
      if (!EXACT.test(version)) found.push(`${name}@${version}`);
    }
  }
  return found;
}

/** The check of this repository's package.json: 0 when every version is exact, else 1. */
export function run(root = "."): number {
  const inexact = inexactVersions(JSON.parse(readFileSync(`${root}/package.json`, "utf8")));
  if (inexact.length > 0) {
    console.error(`package.json has versions that are not exact: ${inexact.join(", ")}`);
    return 1;
  }
  console.log("versions: ok");
  return 0;
}

if (import.meta.main) process.exit(run());
