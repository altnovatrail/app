// The contrast of the theme's colours as theme.css has them (WCAG 1.4.3 and 1.4.11; R17): the pairs
// of the interface mockup's README, «Contrast», in app's tokens, with its replacements — text 4.5:1
// on what it stands on, an edge, the focus ring and a mark 3:1, a translucent colour laid over what
// it stands on. A colour changed in theme.css that misses its ratio fails this test, and so does a
// colour token no pair names.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance, over, tokens } from "./contrast.ts";

const THEME = tokens(readFileSync("src/theme/theme.css", "utf8"));

const TEXT = 4.5;
const EDGE = 3;

/**
 * The pairs the screens put together, by groups: the least ratio, the foregrounds, and the grounds
 * each stands on, a ground's layers joined by "/", the top first and the last opaque.
 */
const GROUPS: readonly [number, string, string][] = [
  [TEXT, "text text-muted", "card page page-owner glass/page glass-panel/page"],
  // Secondary text on a chip, where #6e6e73 misses: #636366, on each grey fill; on the page the
  // fill of 0.16, a disabled button's, gives it 4.47 alone.
  [TEXT, "text-muted-on-grey", "grey-08/page grey-10/page grey-12/page grey-12/card grey-16/card"],
  // The tutor's words and marks on the sheet among them.
  [TEXT, "segmented next tutor-words", "card"],
  // The note of a text's next version on its sheet, in the owner's grey (R69).
  [TEXT, "segmented", "page-owner"],
  // The chip of a text's version on its sheet (R69).
  [TEXT, "correct", "correct-tint/card"],
  // The rubric's purple: the sign of an essay's feedback, its glyph on the card (R66).
  [EDGE, "rubric", "card"],
  // The accent as text, #0066cc, where #0071e3 misses on the page and on its own tint.
  [TEXT, "accent-text", "card page page-owner accent-tint/card glass/page"],
  [TEXT, "on-fill", "accent correct not-yet tooltip"],
  // The card of a task from paper: white on each stop of its gradient.
  [TEXT, "on-fill", "paper-from paper-mid paper-to"],
  [TEXT, "correct not-yet error", "card page"],
  [TEXT, "hint-text", "hint/card"],
  // The accent on the skill map's paper, as text too; the focus ring, a primary button's fill and
  // what is selected, against what they stand on.
  [TEXT, "accent", "card"],
  [EDGE, "accent", "page page-owner glass/page"],
  // The edge of a field against its own fill, white; the segments of a module's bar and the
  // legend's swatches, on a card.
  [EDGE, "edge state-mastered state-review state-progress state-ready state-locked", "card"],
  // A button's icon alone (R60), grey or in the accent, under the pointer's wash; a switch that is
  // on, the accent on its tint, on a card and on the tutor's panel.
  [EDGE, "text-muted accent", "grey-08/card grey-08/page"],
  // The close of a sheet, on the page's grey, under the pointer's wash (R69).
  [EDGE, "text-muted", "grey-16/card"],
  [EDGE, "accent", "accent-tint/card accent-tint/glass-panel/page"],
  // The way in (R61): the card of a step on the sky — its text, a field and the note on it —, the
  // name and the language's pill over the brightest glow, the accent and a field's edge, the tick;
  // Google's button, white on the card, its words and its edge.
  [
    TEXT,
    "on-fill sky-muted sky-note-text sky-caption sky-quiet sky-link sky-error",
    "sky-card sky-fill sky-note",
  ],
  [TEXT, "on-fill", "sky sky-glow sky-pill/sky-glow"],
  [EDGE, "accent sky-edge sky-correct on-fill", "sky-card"],
  [EDGE, "sky-edge sky-ring", "sky-fill"],
  // "Who is learning?" (R61): "Sign out" on its glass and the line under the heading where the sky
  // is brightest under them, a profile's card and "Start", the line of "Add a learner" on its
  // glass, and the white focus ring, each over the brightest sky it meets.
  [TEXT, "on-fill", "who-glass/who-under-bar"],
  [TEXT, "who-lead", "who-under-lead"],
  [TEXT, "who-line", "sky-card"],
  [TEXT, "on-fill", "who-start"],
  [TEXT, "who-why", "who-glass/who-under-glass"],
  [EDGE, "on-fill", "who-under-ring"],
  // The owner's profile (R61): the labels, a value, "Choose" and an error on its rows, the avatar's
  // button and the hint on its card, and the field's edge and the chevron on the rows.
  [TEXT, "on-fill own-value own-link sky-error", "own-rows/sky-card"],
  [TEXT, "own-link own-hint", "sky-card"],
  [EDGE, "own-edge own-more", "own-rows/sky-card"],
  [TEXT, "google-text", "on-fill"],
  [EDGE, "google-edge", "on-fill"],
];

/** Each pair: the foreground, the layers it stands on, and the least ratio. */
const PAIRS: readonly [string, readonly string[], number][] = GROUPS.flatMap(
  ([least, foregrounds, grounds]) =>
    foregrounds
      .split(" ")
      .flatMap((foreground) =>
        grounds.split(" ").map((ground) => [foreground, ground.split("/"), least] as const),
      ),
);

/**
 * The tokens no pair has to hold, and why: grey on a grey fill is a disabled button, which 1.4.3
 * exempts as an inactive control, and so are the way in's on its card and "Add a learner" while
 * it is closed; the ring of the owner's rows is no field's edge, as the field has one of its own.
 */
const EXEMPT = ["disabled", "sky-off", "sky-off-fill", "who-off", "own-ring"];

/** The pair as its test names it: the foreground, translucent too, on its layers. */
function ratio(foreground: string, layers: readonly string[]): number {
  const colour = (name: string) => {
    const value = THEME.get(name);
    if (value === undefined) throw new Error(`no token --nt-${name}`);
    return value;
  };
  const grounds = layers.map(colour);
  return contrast(over(colour(foreground), ...grounds), over(...grounds));
}

describe("the theme", () => {
  it("has every colour the pairs name, and no other but the exempt", () => {
    const named = new Set(PAIRS.flatMap(([foreground, layers]) => [foreground, ...layers]));
    expect([...THEME.keys()].sort()).toEqual([...named, ...EXEMPT].sort());
  });

  it.each(PAIRS)("puts %s on %j at %d:1 or more", (foreground, layers, least) => {
    expect(ratio(foreground, layers)).toBeGreaterThanOrEqual(least);
  });

  it("gives the ratios of the mockup's «Contrast» for its replacements", () => {
    expect(ratio("accent-text", ["page"])).toBeCloseTo(4.99, 2);
    expect(ratio("on-fill", ["correct"])).toBeCloseTo(5.4, 1);
    expect(ratio("text-muted", ["glass", "page"])).toBeCloseTo(4.95, 2);
    expect(ratio("on-fill", ["tooltip"])).toBeCloseTo(16.8, 1);
    expect(ratio("edge", ["card"])).toBeCloseTo(3.26, 2);
  });
});

describe("contrast", () => {
  it("is WCAG's ratio: black on white 21:1, a colour on itself 1:1, either way round", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5);
    expect(contrast("#1d4ed8", "#1d4ed8")).toBe(1);
    expect(contrast("#ffffff", "#1d4ed8")).toBeCloseTo(6.7, 2);
    expect(luminance("#808080")).toBeCloseTo(0.2158605, 6);
  });

  it("lays a translucent colour over the opaque one under it", () => {
    expect(over("#123456")).toBe("#123456");
    expect(over("rgba(0, 0, 0, 0.5)", "#ffffff")).toBe("#808080");
    expect(over("rgba(255, 255, 255, 0.76)", "#f2f2f7")).toBe("#fcfcfd");
    expect(over("rgba(0, 0, 0, 1)", "rgba(255, 255, 255, 0.5)", "#ffffff")).toBe("#000000");
    expect(() => over("#ffffff", "rgba(0, 0, 0, 0.5)")).toThrow("not opaque");
    expect(() => over()).toThrow("not opaque");
  });

  it("takes only #rrggbb and rgba(r, g, b, a)", () => {
    expect(() => luminance("#fff")).toThrow("not a colour");
    expect(() => luminance("rgba(0, 0, 0, 0.5)")).toThrow("not a colour #rrggbb");
    expect(() => over("rgba(256, 0, 0, 0.5)", "#ffffff")).toThrow("not a colour");
    expect(() => over("red", "#ffffff")).toThrow("not a colour");
    const found = tokens(
      "--nt-text: #ABCDEF; --nt-x: red; --nt-tint: rgba(0, 113, 227, 0.1); --nt-shadow: 0 1px rgba(0, 0, 0, 0.1);",
    );
    expect(Object.fromEntries(found)).toEqual({
      text: "#abcdef",
      tint: "rgba(0, 113, 227, 0.1)",
    });
  });
});
