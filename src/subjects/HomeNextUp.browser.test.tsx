// Home's "Next up" beside the sheet drawn at its right: from 600, where the sheet shows, the way to
// what comes next stays clear of the sheet and inside the card, on the iPad in portrait, where the
// card has the whole width, as in landscape, where it stands beside "Tasks from my paper".
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "@altnovatrail/canvas";
import "../theme/theme.css";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import { HomeScreen, type HomeScreenProps } from "./MySubjects.tsx";

/** The way to what comes next as the home screen has it: NextStep's frame and its button. */
const next = (
  <div className="nt-next">
    <div className="nt-buttons">
      <button type="button">What's next</button>
    </div>
  </div>
);

const runs = [
  { lessonRunId: "r1", title: "Number patterns", module: "m" },
  { lessonRunId: "r2", title: "Shapes that repeat", module: "m" },
  { lessonRunId: "r3", title: "Counting by twos", module: "m" },
];

/** What "Next up" can hold under the button: the engine's choice, the subjects read, lessons begun. */
const STATES: readonly [string, Partial<HomeScreenProps>][] = [
  ["the engine picks", { connected: [] }],
  ["the subjects read", { connected: undefined }],
  ["lessons begun", { connected: [], runs }],
];

const box = (selector: string) => {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`no ${selector}`);
  return found.getBoundingClientRect();
};

const meet = (a: DOMRect, b: DOMRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

function show(props: Partial<HomeScreenProps>, language: Language) {
  return render(
    inLanguage(
      <div data-screen="home">
        <HomeScreen connected={[]} next={next} {...props} />
      </div>,
      language,
    ),
  );
}

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe("Home's way to what comes next beside the sheet", () => {
  // The iPad in portrait, the three sizes, and in landscape.
  const sizes = [
    [744, 1133],
    [820, 1180],
    [1024, 1366],
    [1180, 820],
  ] as const;
  const cases = sizes.flatMap(([width, height]) =>
    STATES.flatMap(([state, props]) =>
      (["en", "ru"] as const).map((language) => ({ width, height, state, props, language })),
    ),
  );

  it.each(cases)(
    "at $width × $height, with $state, in $language: the button clear of the sheet and in the card",
    async ({ width, height, props, language }) => {
      await page.viewport(width, height);
      show(props, language);
      const button = box(".nt-next-step button");
      const sheet = box(".nt-grid-sheet");
      const card = box(".nt-next-up");
      expect(sheet.width).toBeGreaterThan(0);
      expect(meet(button, sheet)).toBe(false);
      expect(button.right).toBeLessThanOrEqual(card.right);
      if (props.runs !== undefined) {
        expect(document.querySelector(".nt-next-more")).not.toBeNull();
      }
      // Nothing wider than the page (1.4.10).
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    },
  );

  it("stands at the start of a card of the whole width, under the words, and at its end beside the other half", async () => {
    await page.viewport(820, 1180);
    const { unmount } = show({}, "en");
    expect(box(".nt-next-step").left).toBeCloseTo(box(".nt-next-foot").left, 0);
    unmount();
    await page.viewport(1180, 820);
    show({}, "en");
    expect(box(".nt-next-step").right).toBeCloseTo(box(".nt-next-foot").right, 0);
  });

  it("under 600, with no sheet, lets the foot wrap and keeps the button at its end", async () => {
    await page.viewport(390, 844);
    show({}, "en");
    expect(box(".nt-grid-sheet").width).toBe(0);
    const foot = document.querySelector(".nt-next-foot");
    expect(foot === null ? "" : getComputedStyle(foot).flexWrap).toBe("wrap");
    expect(box(".nt-next-step").right).toBeCloseTo(box(".nt-next-foot").right, 0);
  });
});
