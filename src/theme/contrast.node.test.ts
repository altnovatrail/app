// The contrast of the theme's colours as theme.css has them (WCAG 1.4.3 and 1.4.11; section 3.9 of
// docs/architecture.md): text 4.5:1 on what it stands on, and the boundaries of a component, the
// focus ring and marks 3:1. A colour changed in theme.css that misses its ratio fails this test.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, luminance, tokens } from "./contrast.ts";

const THEME = tokens(readFileSync("src/theme/theme.css", "utf8"));

/** Each pair the screens put together: the foreground, what it stands on, and the least ratio. */
const PAIRS: readonly [string, string, number][] = [
  ["text", "background", 4.5],
  ["text", "surface", 4.5],
  ["text-muted", "background", 4.5],
  ["text-muted", "surface", 4.5],
  ["on-primary", "primary", 4.5],
  ["primary", "background", 4.5],
  ["primary", "surface", 4.5],
  ["correct", "background", 4.5],
  ["correct", "surface", 4.5],
  ["not-yet", "background", 4.5],
  ["not-yet", "surface", 4.5],
  ["error", "background", 4.5],
  ["error", "surface", 4.5],
  ["border", "background", 3],
  ["border", "surface", 3],
  ["focus", "background", 3],
  ["focus", "surface", 3],
  ["mark", "background", 3],
];

describe("the theme", () => {
  it("has every colour the pairs name, and no other", () => {
    const named = new Set(PAIRS.flatMap(([foreground, ground]) => [foreground, ground]));
    expect([...THEME.keys()].sort()).toEqual([...named].sort());
  });

  it.each(PAIRS)("puts %s on %s at %d:1 or more", (foreground, ground, least) => {
    expect(
      contrast(THEME.get(foreground) as string, THEME.get(ground) as string),
    ).toBeGreaterThanOrEqual(least);
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

  it("takes only #rrggbb", () => {
    expect(() => luminance("#fff")).toThrow("not a colour");
    expect(tokens("--nt-text: #ABCDEF; --nt-x: red;").get("text")).toBe("#abcdef");
  });
});
