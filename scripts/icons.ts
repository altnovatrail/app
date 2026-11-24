// The icons of the app's buttons: Material Symbols, in the style Rounded, from
// the npm package of the set at the version package-lock.json pins, and of it only the icons the
// app shows. It writes the module src/app/Icon.tsx draws them from, as canvas's script writes the
// module of its row:
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
 * The values of the app, each by the key its buttons name it with. A value the platform's table of
 * icons names takes that table's icons; a value of the app's own has an icon the table
 * does not hold.
 */
export const TABLE: Readonly<Record<string, Value>> = {
  // "Continue" of the lesson player, to the next link.
  continue: { base: "arrow-circle-right", filled: false, mirrored: true },
  // The buttons that show an icon alone, a closed list: back, a chevron
  // that points the way back; close; the previous and the next task, ‹ ›, chevrons rather than
  // the arrow of canvas's "next".
  back: { base: "arrow-back-ios-new", filled: false, mirrored: true },
  close: { base: "close", filled: false, mirrored: false },
  "previous-task": { base: "chevron-left", filled: false, mirrored: true },
  "next-task": { base: "chevron-right", filled: false, mirrored: true },
  // "Read aloud" by the voice of the device beside a text: a speaker, no fill, as it is in a
  // line that runs right to left — a speaker is no direction.
  "read-aloud": { base: "volume-up", filled: false, mirrored: false },
  // The switch of voicing: the same speaker, filled while voicing is on.
  voicing: { base: "volume-up", filled: true, mirrored: false },
  // Help, filled while its pop-over is open; the tutor's button, a bubble of words.
  help: { base: "help", filled: true, mirrored: false },
  tutor: { base: "sms", filled: false, mirrored: false },
  // The way into the app: the group of "For grown-ups" in the profile's menu; "Signed in
  // with Google" and the country chosen, a tick; the row that opens the countries, a chevron that
  // points on; "Add a learner", a plus; the pill of the sign-in's language, a globe.
  grown: { base: "group", filled: false, mirrored: false },
  language: { base: "language", filled: false, mirrored: false },
  ticked: { base: "check", filled: false, mirrored: false },
  more: { base: "chevron-right", filled: false, mirrored: true },
  add: { base: "add", filled: false, mirrored: false },
  // The pictures of the set of avatars, each in outline, white on its gradient
  // (src/account/avatars.ts): a mountain, a rocket, a leaf, a star, the moon, waves, the sun
  // and a bolt.
  "avatar-peak": { base: "landscape", filled: false, mirrored: false },
  "avatar-rocket": { base: "rocket-launch", filled: false, mirrored: false },
  "avatar-leaf": { base: "eco", filled: false, mirrored: false },
  "avatar-star": { base: "star", filled: false, mirrored: false },
  "avatar-moon": { base: "dark-mode", filled: false, mirrored: false },
  "avatar-wave": { base: "waves", filled: false, mirrored: false },
  "avatar-sun": { base: "sunny", filled: false, mirrored: false },
  "avatar-bolt": { base: "bolt", filled: false, mirrored: false },
  // The states of a skill and the marks of one with a rubric and of one not assessed, on a module's
  // card and in its legend, the table's, as the skill map shows them.
  "state-mastered": { base: "check-circle", filled: false, mirrored: false },
  "state-time-to-review": { base: "update", filled: false, mirrored: false },
  "state-in-progress": { base: "timelapse", filled: false, mirrored: false },
  "state-ready-to-start": { base: "lock-open-right", filled: false, mirrored: false },
  "state-locked": { base: "lock", filled: false, mirrored: false },
  "state-feedback-by-criteria": { base: "rate-review", filled: false, mirrored: false },
  "state-not-assessed": { base: "remove-done", filled: false, mirrored: false },
  // The home screen's own: the camera of "A task from my paper", shown disabled; the button
  // of the phone that opens what the marks mean, an "i".
  camera: { base: "photo-camera", filled: false, mirrored: false },
  legend: { base: "info", filled: false, mirrored: false },
  // The profile's menu: the chevron down of its pill; "Switch learner", two arrows that swap;
  // "Sign out", a door with an arrow out. "For grown-ups" is the group of the way in.
  "menu-open": { base: "keyboard-arrow-down", filled: false, mirrored: false },
  "switch-learner": { base: "swap-horiz", filled: false, mirrored: false },
  "sign-out": { base: "logout", filled: false, mirrored: true },
  // The end of a lesson: a star, filled, before "Lesson complete". The chevron of the
  // lesson's line under its title is the menu's, and the tick of a segment passed the sign-in's.
  "lesson-complete": { base: "star", filled: true, mirrored: false },
  // The task screen: Hint in the row, a bulb; and the signs of the verdict's card — "Not
  // yet", an exclamation mark; a line that asks for the work, a pencil; the solution shown, a page.
  // "Correct" is the tick of the way in, and the chevron of the mode's pill and of "Choose an
  // answer" the menu's.
  hint: { base: "lightbulb", filled: false, mirrored: false },
  "not-yet": { base: "priority-high", filled: false, mirrored: false },
  write: { base: "edit", filled: false, mirrored: false },
  shown: { base: "description", filled: false, mirrored: false },
  // The card of an essay's feedback: a speech bubble, as the mockup's `essay-feedback`.
  feedback: { base: "chat-bubble", filled: false, mirrored: false },
  // A task from paper: the camera's way to the device's photos, a stack of pictures; the
  // corner that resizes a frame drawn by hand, two arrows apart. The shutter is the camera of the
  // home screen's card, a frame's cross the close.
  photos: { base: "photo-library", filled: false, mirrored: false },
  resize: { base: "open-in-full", filled: false, mirrored: false },
  // The counter of the tasks begun, a bulleted list; in their list each one's state, a filled
  // circle — solved, a tick; not yet, an exclamation mark; none to check or closed, a dash — or a
  // ring while it is still to do.
  tasks: { base: "format-list-bulleted", filled: false, mirrored: true },
  "task-solved": { base: "check-circle", filled: true, mirrored: false },
  "task-not-yet": { base: "error", filled: true, mirrored: false },
  "task-closed": { base: "do-not-disturb-on", filled: true, mirrored: false },
  "task-to-do": { base: "circle", filled: false, mirrored: false },
  // The field of the tutor's panel: Send, an arrow up in a blue circle; the microphone, which
  // dictates into the field; and while it listens, Stop, a square; each without its caption.
  send: { base: "arrow-upward", filled: false, mirrored: false },
  microphone: { base: "mic", filled: false, mirrored: false },
  stop: { base: "stop", filled: false, mirrored: false },
  // The row of places of Home, Subjects and the skill map, and the phone's tab bar: Home,
  // four squares, filled while it is the place; Subjects, a book; the cognitive map, a hub, shut;
  // For grown-ups, a padlock. Help is the bar's. At the top right the notifications, a bell; in
  // For grown-ups This device and the section's other settings; on Subjects a module's skill map,
  // a tree of nodes.
  "nav-home": { base: "grid-view", filled: true, mirrored: false },
  "nav-subjects": { base: "menu-book", filled: true, mirrored: false },
  "nav-cognitive": { base: "hub", filled: false, mirrored: false },
  "nav-grown": { base: "lock", filled: true, mirrored: false },
  notifications: { base: "notifications", filled: true, mirrored: false },
  device: { base: "tablet-android", filled: false, mirrored: false },
  settings: { base: "settings", filled: false, mirrored: false },
  "skill-map": { base: "account-tree", filled: false, mirrored: false },
  // A module's card on Home: Continue, the engine that chooses, and the next skill.
  play: { base: "play-arrow", filled: false, mirrored: true },
  engine: { base: "autorenew", filled: false, mirrored: false },
  "next-skill": { base: "arrow-forward", filled: false, mirrored: true },
  chain: { base: "keyboard-double-arrow-right", filled: false, mirrored: true },
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
// Material Symbols by Google, under the Apache License 2.0.
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
 * to left.
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
