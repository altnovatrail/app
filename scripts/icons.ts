// The icons of the app's buttons (R03 and R15 in docs/decisions.md; R78 in spec): Material
// Symbols, in the style Rounded, from the npm package of the set at the version package-lock.json
// pins, and of it only the icons the app shows. It writes the module src/app/Icon.tsx draws them
// from, as canvas's script writes the module of its row:
//
//   node scripts/icons.ts           write src/app/icons.ts
//   node scripts/icons.ts --check   write nothing, and fail unless the module is what it would write
//
// ci-lint runs the check: a module edited by hand, or a new version of the set without the icons
// written again, fails it. Nothing goes to the network, now or when the app runs: the paths are in
// the build. The module comes out as Biome formats it, by the Biome package-lock.json pins, so
// ci-lint's format check passes it as it is. Run from the repository's root, as the recipes run it.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { getIconData, iconToSVG } from "@iconify/utils";

/** The npm package of the set. */
const SET = "@iconify-json/material-symbols";
/** What the script writes, from the repository's root. */
export const MODULE = "src/app/icons.ts";

/** A value of the app: the base of its icon's name, and how its button shows it. */
export interface Value {
  /** The base of the name: the outline is `<base>-outline-rounded`, the fill `<base>-rounded`. */
  readonly base: string;
  /** Whether the button shows the fill while it is chosen. */
  readonly filled: boolean;
  /** Whether the icon is mirrored in a line that runs right to left. */
  readonly mirrored: boolean;
}

/**
 * The values of the app, each by the key its buttons name it with. The icons of a value that the
 * table of architecture 6 of spec names are that table's; a value of the app's own has an icon the
 * table does not hold, written down in section 3.1 of docs/architecture.md (R78 in spec).
 */
export const TABLE: Readonly<Record<string, Value>> = {
  // "Continue" of the lesson player, to the next link (the 2026-11-10 amendment to R06).
  continue: { base: "arrow-circle-right", filled: false, mirrored: true },
  // "Read aloud" by the voice of the device beside a text (R36 in docs/decisions.md): a
  // speaker, no fill, as it is in a line that runs right to left — a speaker is no direction.
  "read-aloud": { base: "volume-up", filled: false, mirrored: false },
};

/** An icon as the app draws it: its view box, and the paths it fills in the text's colour. */
export interface Drawn {
  readonly viewBox: string;
  readonly paths: readonly string[];
}

/** The set as the script reads it: its icons and aliases, as Iconify's utilities take them. */
export type IconSet = Parameters<typeof getIconData>[0];

/** A path of the set, as Material Symbols draws every icon: filled with the colour of the text. */
const PATH = /<path fill="currentColor" d="([^"]+)"\/>/y;

/**
 * An icon of the set, by its name, an alias too, as the app draws it. A name the set does not have
 * stops the script, and so does an icon made of anything but filled paths: the app would draw it
 * otherwise than the set does.
 */
export function drawn(set: IconSet, name: string): Drawn {
  const data = getIconData(set, name);
  if (data === null) throw new Error(`icons: ${SET} has no icon ${name}`);
  const { attributes, body } = iconToSVG(data);
  const paths: string[] = [];
  PATH.lastIndex = 0;
  for (let match = PATH.exec(body); match !== null; match = PATH.exec(body)) {
    const path = match[1] as string;
    // Icon.tsx keys each path by itself, so a path drawn twice is refused here.
    if (paths.includes(path)) throw new Error(`icons: ${name} draws a path twice`);
    paths.push(path);
    if (PATH.lastIndex === body.length) return { viewBox: attributes.viewBox, paths };
  }
  throw new Error(`icons: ${name} is not filled paths alone: ${body.slice(0, 80)}`);
}

/** The names a value needs: its outline, and its fill when its button shows one. */
function names({ base, filled }: Value): { outline: string; filled: string } {
  const outline = `${base}-outline-rounded`;
  return { outline, filled: filled ? `${base}-rounded` : outline };
}

/** The module the app draws the icons from, as the script writes it before Biome formats it. */
export function module(set: IconSet, version: string, table = TABLE): string {
  const used = new Map<string, Drawn>();
  const values: string[] = [];
  for (const [key, value] of Object.entries(table)) {
    const { outline, filled } = names(value);
    for (const name of [outline, filled]) {
      if (!used.has(name)) used.set(name, drawn(set, name));
    }
    values.push(
      `${JSON.stringify(key)}: ${JSON.stringify({ outline, filled, mirrored: value.mirrored })},`,
    );
  }
  const drawing = [...used].map(
    ([name, icon]) => `${JSON.stringify(name)}: ${JSON.stringify(icon)},`,
  );
  return `// Written by scripts/icons.ts — \`just icons\` — from ${SET} ${version}:
// Material Symbols by Google, under the Apache License 2.0 (R15 in docs/decisions.md; R78 spec).
// ci-lint fails unless it is what the script writes, so it is never edited by hand.

/** The icons of the app's buttons, by their names in the set, as the app draws them. */
export const ICONS = {
${drawing.join("\n")}
} as const;

/** The name of an icon of the app. */
export type IconName = keyof typeof ICONS;

/**
 * Each value of the app, by its key: the icon in outline, the one its button shows while chosen —
 * the same for a value without a fill — and whether the icon is mirrored in a line that runs right
 * to left (architecture 6 spec).
 */
export const VALUES = {
${values.join("\n")}
} as const satisfies Record<string, { outline: IconName; filled: IconName; mirrored: boolean }>;

/** A value of the app. */
export type IconValue = keyof typeof VALUES;
`;
}

/** What differs between the file the script would write and the file there is. */
export function differences(wanted: string, read: string | undefined): string[] {
  return read === wanted
    ? []
    : [`icons: ${MODULE} is not what scripts/icons.ts writes; run just icons`];
}

/**
 * Biome's script, as package-lock.json pins it, by its path in node_modules and run by this Node:
 * no program is looked up in PATH.
 */
const BIOME = fileURLToPath(new URL("../node_modules/@biomejs/biome/bin/biome", import.meta.url));

/** Biome's format of a module, read from standard input. */
export function formatted(text: string, path: string): string {
  return execFileSync(process.execPath, [BIOME, "format", `--stdin-file-path=${path}`], {
    input: text,
    encoding: "utf8",
  });
}

/** Writes the module, or with `check` only compares it; the problems found, empty when none. */
export async function run(check: boolean, root = "."): Promise<string[]> {
  const { version } = createRequire(import.meta.url)(`${SET}/package.json`) as { version: string };
  // The set's thousands of icons are read only here, not by whoever imports the helpers above.
  const { icons, info } = await import("@iconify-json/material-symbols");
  // The set the table was read from: its name and its license, as the package of the set says them.
  if (info.name !== "Material Symbols" || info.license.spdx !== "Apache-2.0") {
    return [`icons: ${SET} ${version} is ${info.name} under ${info.license.spdx}`];
  }
  const wanted = formatted(module(icons, version), MODULE);
  const path = `${root}/${MODULE}`;
  if (check) {
    let read: string | undefined;
    try {
      read = readFileSync(path, "utf8");
    } catch (error) {
      // A module that is not there is one to write; any other failure is not the module's.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      read = undefined;
    }
    return differences(wanted, read);
  }
  writeFileSync(path, wanted);
  return [];
}

/** Prints the problems run found, and gives the exit code: 0 when there are none, else 1. */
export function report(problems: readonly string[]): number {
  for (const problem of problems) console.error(problem);
  console.log(problems.length === 0 ? "icons: ok" : `icons: ${problems.length} problems`);
  return problems.length === 0 ? 0 : 1;
}

if (import.meta.main) process.exitCode = report(await run(process.argv.includes("--check")));
