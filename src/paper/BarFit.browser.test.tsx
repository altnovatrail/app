// The top bar of the page to pick from keeps one row: Back alone in its pill and the title the
// heading unseen at every width; the end's words where they fit, its icons alone where they do not,
// the captions still the names, a tooltip only then, and the buttons below Back only where even the
// icons do not fit; measured again as the window changes. The row of the screen of solving the same
// way: Ask its icon alone first, and only then a wrap.
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import { BarButton, fitBar, fitRow, inOneRow } from "./BarFit.tsx";
import { Pick } from "./Pick.tsx";
import type { PageTask } from "./page.ts";

/** A photo of one white pixel: the bar does not look at it. */
const PHOTO = {
  bytes: new Uint8Array(),
  width: 600,
  height: 800,
  url: "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACwAAAAAAQABAAACAkQBADs=",
};

/** Ten tasks found down the page, each picked. */
const TASKS: readonly PageTask[] = Array.from({ length: 10 }, (_, i) => ({
  id: `t${i}`,
  frame: { ymin: 60 + i * 90, xmin: 50, ymax: 130 + i * 90, xmax: 950 },
  drawn: false,
  picked: true,
}));

function renderPick(language: Language) {
  render(
    inLanguage(
      <Pick
        photo={PHOTO}
        tasks={TASKS}
        onTasks={() => {}}
        finding={false}
        closed={false}
        starting={false}
        onStart={() => {}}
        onRetake={() => {}}
        onHome={() => {}}
      />,
      language,
    ),
  );
}

/** The end of the bar, where its fit is set. */
function barEnd(): HTMLElement {
  const end = document.querySelector<HTMLElement>(".nt-top-end");
  if (end === null) throw new Error("no end of the bar");
  return end;
}

const width = (element: Element) => element.getBoundingClientRect().width;

/** The tooltip's words, once it shows. */
function tooltip(): string | undefined {
  return document.querySelector(".nt-tooltip")?.textContent ?? undefined;
}

afterEach(async () => {
  cleanup();
  await page.viewport(1024, 768);
});

it("keeps its words on an iPad in landscape, the title unseen, and shows no tooltip", async () => {
  await page.viewport(1194, 834);
  renderPick("ru");
  await waitFor(() => expect(barEnd().dataset.fit).toBe("words"));
  const retake = screen.getByRole("button", { name: "Переснять" });
  expect(width(retake)).toBeGreaterThan(48);
  expect(width(screen.getByRole("button", { name: "Убрать все рамки" }))).toBeGreaterThan(48);
  expect(
    width(screen.getByRole("heading", { level: 1, name: "Задачи на странице" })),
  ).toBeLessThanOrEqual(1);
  await userEvent.hover(retake);
  await new Promise((done) => setTimeout(done, 600));
  expect(tooltip()).toBeUndefined();
});

for (const [device, w, h] of [
  ["an iPad in portrait", 820, 1180],
  ["a phone", 360, 780],
] as const) {
  it(`drops the captions on ${device}, each still a name, with a tooltip, beside Back`, async () => {
    await page.viewport(w, h);
    renderPick("ru");
    await waitFor(() => expect(barEnd().dataset.fit).toBe("icons"));
    const heading = screen.getByRole("heading", { level: 1, name: "Задачи на странице" });
    expect(width(heading)).toBeLessThanOrEqual(1);
    const pill = heading.parentElement as HTMLElement;
    expect(width(pill)).toBeLessThanOrEqual(48.5);
    const end = barEnd();
    const middle = (element: Element) => {
      const at = element.getBoundingClientRect();
      return at.top + at.height / 2;
    };
    expect(Math.abs(middle(pill) - middle(end))).toBeLessThan(2);
    const remove = screen.getByRole("button", { name: "Убрать все рамки" });
    const retake = screen.getByRole("button", { name: "Переснять" });
    expect(width(remove)).toBe(48);
    expect(width(retake)).toBe(48);
    await userEvent.hover(retake);
    await waitFor(() => expect(tooltip()).toBe("Переснять"));
  });
}

it("fits again as the window narrows and widens", async () => {
  await page.viewport(1194, 834);
  renderPick("ru");
  await waitFor(() => expect(barEnd().dataset.fit).toBe("words"));
  await page.viewport(820, 1180);
  await waitFor(() => expect(barEnd().dataset.fit).toBe("icons"));
  await page.viewport(1194, 834);
  await waitFor(() => expect(barEnd().dataset.fit).toBe("words"));
});

it("puts the buttons below Back only where even their icons do not fit", () => {
  render(
    inLanguage(
      <div className="nt-top" data-middle="" style={{ inlineSize: "7.5rem" }}>
        <div className="nt-top-pill nt-top-back">
          <button type="button" className="nt-icon-only" aria-label="Back to Home" />
          <h1 className="nt-hidden-label">Your page</h1>
        </div>
        <p className="nt-finding">10 tasks found</p>
        <div className="nt-top-end">
          <BarButton icon="close" caption="Remove all frames" onClick={() => {}} />
          <BarButton icon="camera" caption="Retake" onClick={() => {}} />
        </div>
      </div>,
    ),
  );
  const end = barEnd();
  expect(fitBar(end)).toBe("below");
  const pill = screen.getByRole("button", { name: "Back to Home" }).parentElement as HTMLElement;
  expect(end.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    pill.getBoundingClientRect().bottom,
  );
  expect(width(screen.getByRole("button", { name: "Retake" }))).toBe(48);
});

it("puts the buttons at the row's end below Back in a bar with no middle too", () => {
  render(
    inLanguage(
      <div className="nt-top" style={{ inlineSize: "7rem" }}>
        <div className="nt-top-pill nt-top-back">
          <button type="button" className="nt-icon-only" aria-label="На главную" />
          <h1 className="nt-hidden-label">Задачи на странице</h1>
        </div>
        <div className="nt-top-end">
          <BarButton icon="close" caption="Убрать все рамки" onClick={() => {}} />
          <BarButton icon="camera" caption="Переснять" onClick={() => {}} />
        </div>
      </div>,
    ),
  );
  const end = barEnd();
  expect(fitBar(end)).toBe("below");
  const bar = end.parentElement as HTMLElement;
  const pill = bar.firstElementChild as HTMLElement;
  expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth + 1);
  expect(end.getBoundingClientRect().top).toBeGreaterThanOrEqual(
    pill.getBoundingClientRect().bottom,
  );
  expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);
  expect(end.getBoundingClientRect().right).toBeCloseTo(bar.getBoundingClientRect().right, 0);
});

it("leaves a bar's end alone with no bar round it as with its words", () => {
  expect(fitBar(document.createElement("div"))).toBe("words");
});

it.each([
  ["30rem", "words"],
  ["19rem", "icons"],
  ["9rem", "below"],
] as const)("fits a row of %s to its %s: Ask's word first, and only then a wrap", (inline, fit) => {
  render(
    inLanguage(
      <div className="nt-task-foot" style={{ inlineSize: inline }}>
        <div className="nt-task-row">
          <BarButton
            icon="tutor"
            caption="Спросить"
            className="nt-icon-button nt-ask"
            onClick={() => {}}
          />
          <button type="button" className="nt-row-button">
            Подсказка
          </button>
          <button type="button" className="nt-check-button">
            Проверить
          </button>
        </div>
      </div>,
      "ru",
    ),
  );
  const row = document.querySelector<HTMLElement>(".nt-task-row");
  if (row === null) throw new Error("no row");
  expect(fitRow(row)).toBe(fit);
  expect(row.dataset.fit).toBe(fit);
  expect(inOneRow(row)).toBe(fit !== "below");
  const ask = screen.getByRole("button", { name: "Спросить" });
  if (fit === "words") expect(width(ask)).toBeGreaterThan(44);
  else expect(width(ask)).toBe(44);
});

it("takes an empty row as one line", () => {
  expect(inOneRow(document.createElement("div"))).toBe(true);
});
