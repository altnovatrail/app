// A working copy of canvas on the development server, in place of the package from npm (Д3 in
// RUN.md; R15 in docs/decisions.md): `just dev-canvas <folder>` sets NOVATRAIL_CANVAS to the
// folder, and vite.config.ts, serving and only then, points each entry point the copy's
// package.json exports at the copy's built files and lets the server read the folder. package.json
// and the lock file stay as they are, so nothing of the copy can reach main, and neither the build
// nor the tests read the variable: what ships and what CI checks is the package release-verify-npm
// verified. The copy is built first, by `just build` in it, into its lib/.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** The name the working copy's package.json has to have. */
export const CANVAS = "@altnovatrail/canvas";

/** An alias of Vite: the exact name of an entry point, and the file it stands for. */
export interface Alias {
  readonly find: RegExp;
  readonly replacement: string;
}

/** A target of an entry point: a file, or files by condition, nested too. */
type Target = string | { readonly [condition: string]: Target };
type Exports = Readonly<Record<string, Target>>;

/** The conditions the development server resolves a browser's import by, in Vite's order. */
const CONDITIONS = ["browser", "import", "module", "default"] as const;

/** The file a target gives a browser's import; undefined for one of types alone. */
function fileOf(target: Target): string | undefined {
  if (typeof target === "string") return target;
  for (const condition of CONDITIONS) {
    const inner = target[condition];
    if (inner !== undefined) return fileOf(inner);
  }
  return undefined;
}

/** The regular expression of exactly this text. */
function exactly(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}$`);
}

/**
 * The aliases of a working copy of canvas, from its package.json, and the folder the server may
 * read; refused for a folder that is not canvas. `read` gives a file's text by its path.
 */
export function canvasCopy(
  folder: string,
  read: (path: string) => string = (path) => readFileSync(path, "utf8"),
): { aliases: Alias[]; allow: string } {
  const root = resolve(folder);
  const manifest = JSON.parse(read(`${root}/package.json`)) as { name?: string; exports?: Exports };
  if (manifest.name !== CANVAS) {
    throw new Error(
      `NOVATRAIL_CANVAS: ${root} holds ${manifest.name ?? "no package"}, not ${CANVAS}`,
    );
  }
  const aliases: Alias[] = [];
  for (const [entry, target] of Object.entries(manifest.exports ?? {})) {
    if (!entry.startsWith(".")) continue;
    // A pattern would need an alias of its own kind; canvas has none, and one missed would serve
    // the npm package beside the copy.
    if (entry.includes("*"))
      throw new Error(`NOVATRAIL_CANVAS: ${root} exports a pattern, ${entry}`);
    const file = fileOf(target);
    if (file === undefined) continue;
    aliases.push({ find: exactly(`${CANVAS}${entry.slice(1)}`), replacement: resolve(root, file) });
  }
  if (aliases.length === 0) throw new Error(`NOVATRAIL_CANVAS: ${root} exports nothing`);
  return { aliases, allow: root };
}
