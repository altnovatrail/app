// The mockup in the three engines: every state of the first slice of its table «Screens and
// states», on the iPad and on the phone, opens in Chromium, WebKit and Firefox at once, reaches
// data-ready="true" with no error in the console, and draws the same shapes in each — the same
// count, boxes within 2 CSS px, the same styles. Each engine leaves a snapshot of the frame in
// mockup/out/. A state that fails, or engines that part, is a row «В реестр spec» of
// run/QUESTIONS.md naming the run, not an edit of app's screen.
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { type Browser, chromium, firefox, webkit } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  deviceContext,
  disagreements,
  FONTS,
  openState,
  outName,
  readShapes,
  type Shape,
  serveMockup,
  stateUrl,
  writeOut,
} from "../scripts/mockup.ts";
import { SPEC } from "./compare.ts";
import { DEVICES } from "./regions.ts";

const ENGINES = { chromium, webkit, firefox };

const { STATES } = (await import(
  pathToFileURL(join(resolve(SPEC), "tools/mockup/states.mjs")).href
)) as {
  STATES: { name: string; slice?: string }[];
};
/** The states of the first slice: those not under "Later". */
const FIRST = STATES.filter((state) => state.slice !== "later").map((state) => state.name);

const browsers: Record<string, Browser> = {};
let origin = "";

beforeAll(async () => {
  ({ origin } = await serveMockup(SPEC));
  for (const [name, type] of Object.entries(ENGINES))
    browsers[name] = await type.launch({ env: { ...process.env, FONTCONFIG_FILE: FONTS } });
});

afterAll(async () => {
  for (const browser of Object.values(browsers)) await browser.close();
});

describe.each(DEVICES)("the mockup on %s", (device) => {
  it.each(FIRST)("%s in the three engines", async (state) => {
    const shapes: Record<string, Shape[]> = {};
    const problems: string[] = [];
    // Each engine to its end, so that one that fails leaves the others' snapshots and the report.
    const ends = await Promise.allSettled(
      Object.entries(browsers).map(async ([engine, browser]) => {
        const context = await deviceContext(browser, device);
        try {
          const opened = await openState(context, stateUrl(origin, state, device));
          problems.push(...opened.problems.map((problem) => `${engine}: ${problem}`));
          await opened.page.locator("#frame").screenshot({
            path: outName(state, device, engine, "mockup.png"),
            animations: "disabled",
          });
          shapes[engine] = await opened.page.evaluate(readShapes);
        } finally {
          await context.close();
        }
      }),
    );
    ends.forEach((end, i) => {
      if (end.status === "rejected")
        problems.push(`${Object.keys(browsers)[i]}: ${String(end.reason)}`);
    });
    const ordered = Object.fromEntries(
      Object.keys(ENGINES).map((engine) => [engine, shapes[engine] ?? []]),
    );
    const parted = disagreements(ordered);
    writeOut(
      outName(state, device, "engines", "json"),
      `${JSON.stringify({ problems, parted }, null, 2)}\n`,
    );
    expect(problems).toEqual([]);
    expect(parted).toEqual([]);
  });
});
