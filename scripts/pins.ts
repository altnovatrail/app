// The versions in package.json that another package decides, held to it (R15 in docs/decisions.md;
// section 3.1 of docs/architecture.md):
// - the set of icons is the version that the UI packages of @altnovatrail installed name in their
//   devDependencies, canvas and skill-map: one set of icons in every interface (R78 in spec).
//   A package that names no set is passed over;
// - @bufbuild/protobuf is the version @altnovatrail/contracts names in its dependencies, so that the
//   contracts' code and the app's client share one runtime of protobuf;
// - each package of @firebase is in the lock file once: @firebase/auth registers itself with the
//   component container of @firebase/app, and a second copy of @firebase/component would hold a
//   container of its own;
// - no package is a link to a folder: a working copy of canvas reaches the development server by
//   `just dev-canvas`, never through package.json or the lock file, and release-verify-npm passes
//   a link over unverified (R77 in spec).
// Run as `node scripts/pins.ts` it prints what is wrong; a test in ci-test runs it on this tree.
import { readFileSync } from "node:fs";
import { packageName } from "./notice.ts";

interface Manifest {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
}

interface LockPackage {
  readonly version?: string;
  readonly link?: boolean;
  readonly resolved?: string;
}

/** The lock file, as far as this check reads it. */
export interface Lock {
  readonly packages: Readonly<Record<string, LockPackage>>;
}

/** The npm package of the set of icons. */
export const SET = "@iconify-json/material-symbols";
/** The UI packages of @altnovatrail whose set of icons the app's has to be. */
export const UI_PACKAGES = ["@altnovatrail/canvas", "@altnovatrail/skill-map"] as const;
/** The package of the contracts, and the runtime of protobuf its code is generated for. */
export const CONTRACTS = "@altnovatrail/contracts";
export const PROTOBUF = "@bufbuild/protobuf";

/**
 * What is wrong with the versions of a package.json, against the manifests of the packages it
 * installed, read by name — undefined for a package that is not installed — and its lock file.
 */
export function pinProblems(
  app: Manifest,
  installed: (name: string) => Manifest | undefined,
  lock: Lock,
): string[] {
  const problems: string[] = [];
  const deps = app.dependencies ?? {};
  for (const ui of UI_PACKAGES) {
    const wanted = installed(ui)?.devDependencies?.[SET];
    if (wanted !== undefined && deps[SET] !== wanted) {
      problems.push(`${SET} is ${deps[SET] ?? "missing"}, but ${ui} takes ${wanted}`);
    }
  }
  const runtime = installed(CONTRACTS)?.dependencies?.[PROTOBUF];
  if (runtime !== undefined && deps[PROTOBUF] !== runtime) {
    problems.push(
      `${PROTOBUF} is ${deps[PROTOBUF] ?? "missing"}, but ${CONTRACTS} takes ${runtime}`,
    );
  }
  const copies = new Map<string, string[]>();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (path === "") continue;
    if (entry.link === true) problems.push(`${path} is a link to ${entry.resolved ?? "a folder"}`);
    const name = packageName(path);
    if (name.startsWith("@firebase/")) copies.set(name, [...(copies.get(name) ?? []), path]);
  }
  for (const [name, paths] of copies) {
    if (paths.length > 1) problems.push(`${name} is in the lock file ${paths.length} times`);
  }
  return problems;
}

/** The check of this repository: 0 when every pin holds, else 1, with what is wrong. */
export function run(root = "."): number {
  const read = (path: string) => JSON.parse(readFileSync(`${root}/${path}`, "utf8"));
  const installed = (name: string): Manifest | undefined => {
    try {
      return read(`node_modules/${name}/package.json`);
    } catch {
      return undefined;
    }
  };
  const problems = pinProblems(read("package.json"), installed, read("package-lock.json"));
  if (problems.length > 0) {
    console.error(`pins: ${problems.join("; ")}`);
    return 1;
  }
  console.log("pins: ok");
  return 0;
}

if (import.meta.main) process.exit(run());
