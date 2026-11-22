// The layout from the width (R59): below 600 CSS px one column of the whole width; from 600 a
// column of reading, the mockup's frame of 1194 at most, centred, for the home screen and the
// sign-in, with the cards two in a row at any width (R79), and the whole window for a screen with a
// canvas; the bar above a screen at the screen's own width.
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "@altnovatrail/canvas";
import "./theme.css";
import { Screen, type ScreenLayout } from "../app/Screen.tsx";
import { inLanguage } from "../test/language.tsx";

function Shown({ layout }: { readonly layout: ScreenLayout }) {
  return (
    <>
      <header className="nt-bar">
        <p>Learning now</p>
      </header>
      <div data-screen="home">
        <Screen title="My subjects" layout={layout}>
          <ul className="nt-cards">
            {["One", "Two", "Three", "Four"].map((name) => (
              <li key={name} className="nt-card">
                <h3>{name}</h3>
              </li>
            ))}
          </ul>
        </Screen>
      </div>
    </>
  );
}

const box = (selector: string) => {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`no ${selector}`);
  return found.getBoundingClientRect();
};

/** How many cards stand in the first row. */
const inRow = () => {
  const tops = [...document.querySelectorAll(".nt-card")].map((card) =>
    Math.round(card.getBoundingClientRect().top),
  );
  return tops.filter((top) => top === tops[0]).length;
};

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe("the layout from the width", () => {
  // Each width: the column of reading, the mockup's frame and its padding, and its cards in a row.
  it.each([
    [320, 320, 320, 16, 1],
    [390, 390, 390, 16, 1],
    [599, 599, 599, 16, 1],
    [600, 640, 600, 40, 2],
    [834, 640, 834, 40, 2],
    [1087, 640, 1087, 40, 2],
    [1088, 640, 1088, 40, 2],
    [1194, 640, 1194, 40, 2],
    [1600, 640, 1194, 40, 2],
  ])(
    "at %i px: a column %i, the frame %i padded %i, %i cards in a row",
    async (width, column, frame, padding, cards) => {
      await page.viewport(width, 834);
      const { rerender } = render(inLanguage(<Shown layout="column" />));
      const view = document.documentElement.clientWidth;
      expect(Math.round(box("main").width)).toBe(Math.min(column, view));
      expect(Math.round(box(".nt-bar").width)).toBe(Math.round(box("main").width));
      rerender(inLanguage(<Shown layout="reference" />));
      const main = box("main");
      expect(Math.round(main.width)).toBe(Math.min(frame, view));
      expect(Math.round(main.left)).toBe(Math.round((view - main.width) / 2));
      expect(getComputedStyle(document.querySelector("main") as Element).paddingLeft).toBe(
        `${padding}px`,
      );
      expect(Math.round(box(".nt-bar").width)).toBe(Math.round(main.width));
      expect(Math.round(box(".nt-bar").left)).toBe(Math.round(main.left));
      expect(inRow()).toBe(cards);
      rerender(inLanguage(<Shown layout="canvas" />));
      expect(Math.round(box("main").width)).toBe(view);
      expect(Math.round(box(".nt-bar").width)).toBe(view);
      expect(document.documentElement.scrollWidth).toBe(view);
    },
  );

  it("keeps a bar just before its screen at the screen's width", async () => {
    await page.viewport(1194, 834);
    render(
      inLanguage(
        <>
          <header className="nt-bar">
            <p>For adults</p>
          </header>
          <Screen title="For adults" layout="reference" />
        </>,
      ),
    );
    expect(Math.round(box(".nt-bar").width)).toBe(1194);
  });

  it("keeps the cards one below another outside the mockup's frame", async () => {
    await page.viewport(1194, 834);
    render(inLanguage(<Shown layout="column" />));
    expect(inRow()).toBe(1);
  });

  it.each([
    [1194, 834],
    [390, 844],
  ])(
    "keeps the canvas 20rem high at %i × %i, however long the list under it (R66)",
    async (width, height) => {
      await page.viewport(width, height);
      render(
        inLanguage(
          <Screen title="Task" layout="task">
            <div className="nt-task">
              <div className="nt-task-work">
                <novatrail-canvas lang="en" />
                <ul className="nt-lines">
                  {Array.from({ length: 40 }, (_, n) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: the lines never move.
                    <li key={n}>Line {n + 1}</li>
                  ))}
                </ul>
              </div>
            </div>
          </Screen>,
        ),
      );
      expect(box("novatrail-canvas").height).toBeGreaterThanOrEqual(320);
    },
  );
});
