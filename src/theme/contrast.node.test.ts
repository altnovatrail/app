// The contrast of the theme's colours as theme.css has them (WCAG 1.4.3 and 1.4.11; section 3.9 of
// docs/architecture.md): the pairs of the interface mockup's README, «Contrast», in app's tokens,
// with its replacements — text 4.5:1 on what it stands on, an edge, the focus ring and a mark 3:1, a
// translucent colour laid over what it stands on. A colour changed in theme.css that misses its
// ratio fails this test, and so does a colour token no pair names.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance, over, tokens } from "./contrast.ts";

const THEME = tokens(readFileSync("src/theme/theme.css", "utf8"));

const TEXT = 4.5;
const EDGE = 3;

/**
 * Each pair the screens put together: the foreground, the layers it stands on, the top first and
 * the last opaque, and the least ratio.
 */
const PAIRS: readonly [string, readonly string[], number][] = [
  ["text", ["card"], TEXT],
  ["text", ["page"], TEXT],
  ["text", ["page-owner"], TEXT],
  ["text", ["glass", "page"], TEXT],
  ["text", ["glass-panel", "page"], TEXT],
  ["text-muted", ["card"], TEXT],
  ["text-muted", ["page"], TEXT],
  ["text-muted", ["page-owner"], TEXT],
  ["text-muted", ["glass", "page"], TEXT],
  ["text-muted", ["glass-panel", "page"], TEXT],
  // Secondary text on a chip, where #6e6e73 misses: #636366, on each grey fill; on the page the
  // fill of 0.16, a disabled button's, gives it 4.47 alone.
  ["text-muted-on-grey", ["grey-08", "page"], TEXT],
  ["text-muted-on-grey", ["grey-10", "page"], TEXT],
  ["text-muted-on-grey", ["grey-12", "page"], TEXT],
  ["text-muted-on-grey", ["grey-16", "card"], TEXT],
  ["text-muted-on-grey", ["grey-12", "card"], TEXT],
  ["segmented", ["card"], TEXT],
  // The accent as text, #0066cc, where #0071e3 misses on the page and on its own tint.
  ["accent-text", ["card"], TEXT],
  ["accent-text", ["page"], TEXT],
  ["accent-text", ["page-owner"], TEXT],
  ["accent-text", ["accent-tint", "card"], TEXT],
  ["accent-text", ["glass", "page"], TEXT],
  ["on-fill", ["accent"], TEXT],
  ["on-fill", ["correct"], TEXT],
  ["on-fill", ["not-yet"], TEXT],
  ["on-fill", ["tooltip"], TEXT],
  ["correct", ["card"], TEXT],
  ["correct", ["page"], TEXT],
  ["not-yet", ["card"], TEXT],
  ["not-yet", ["page"], TEXT],
  ["error", ["card"], TEXT],
  ["error", ["page"], TEXT],
  ["hint-text", ["hint", "card"], TEXT],
  ["next", ["card"], TEXT],
  // The tutor's words and marks on the sheet.
  ["tutor-words", ["card"], TEXT],
  // The accent on the skill map's paper, as text too; the focus ring, a primary button's fill and
  // what is selected, against what they stand on.
  ["accent", ["card"], TEXT],
  ["accent", ["page"], EDGE],
  ["accent", ["page-owner"], EDGE],
  ["accent", ["glass", "page"], EDGE],
  // The edge of a field against its own fill, white, on the page or on a card.
  ["edge", ["card"], EDGE],
  // The segments of a module's bar and the legend's swatches, on a card.
  ["state-mastered", ["card"], EDGE],
  ["state-review", ["card"], EDGE],
  ["state-progress", ["card"], EDGE],
  ["state-ready", ["card"], EDGE],
  ["state-locked", ["card"], EDGE],
];

/**
 * The tokens no pair has to hold, and why: grey on a grey fill is a disabled button, which 1.4.3
 * exempts as an inactive control.
 */
const EXEMPT = ["disabled"];

/** The pair as its test names it: the foreground on its layers. */
function ratio(foreground: string, layers: readonly string[]): number {
  const colour = (name: string) => {
    const value = THEME.get(name);
    if (value === undefined) throw new Error(`no token --nt-${name}`);
    return value;
  };
  return contrast(colour(foreground), over(...layers.map(colour)));
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
