// The probe of the element in JSX: the package registers it on import, before the first render
// (R42 canvas), React gives it its properties and listens for its events, and the types of its
// contract are spec's (R15). Then what canvas declares against WCAG for app's Accessibility page,
// held on the element itself (R11).
import "@altnovatrail/canvas";
import type { CanvasElement, HistoryChangeEvent, Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("<novatrail-canvas> in JSX", () => {
  it("is the registered element, and takes its language as an attribute and media as a property", () => {
    const media: Media = () => Promise.reject(new Error("no file in this test"));
    const ref = createRef<CanvasElement>();
    render(<novatrail-canvas ref={ref} lang="ru" tool="pen" media={media} />);
    const element = ref.current;
    expect(element).toBeInstanceOf(
      customElements.get("novatrail-canvas") as CustomElementConstructor,
    );
    expect(element?.getAttribute("lang")).toBe("ru");
    expect(element?.media).toBe(media);
    expect(element?.tool).toBe("pen");
    expect(element?.hasAttribute("media")).toBe(false);
  });

  it("hands the element's events to the listener named in lower case", () => {
    const changed = vi.fn<(event: HistoryChangeEvent) => void>();
    const ref = createRef<CanvasElement>();
    render(<novatrail-canvas ref={ref} lang="en" onhistorychange={changed} />);
    const detail = { events: [], from: 0 };
    ref.current?.dispatchEvent(new CustomEvent("historychange", { detail }));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0].detail).toEqual(detail);
  });

  it("holds the contract's types: a tool the contract does not name does not compile", () => {
    // Never rendered: tsc checks it, and an unused directive would fail ci-lint.
    const wrong = () => (
      // @ts-expect-error -- "brush" is no Tool of the contract.
      <novatrail-canvas lang="en" tool="brush" />
    );
    expect(typeof wrong).toBe("function");
  });

  it("takes no element without its language, nor one the build has not (R11)", () => {
    // Never rendered, as above.
    const none = () => (
      // @ts-expect-error -- lang is no option: without it canvas fails WCAG 3.1.2.
      <novatrail-canvas tool="pen" />
    );
    const other = () => (
      // @ts-expect-error -- "de" is no language of the build, nor of canvas's labels.
      <novatrail-canvas lang="de" tool="pen" />
    );
    expect([typeof none, typeof other]).toEqual(["function", "function"]);
  });
});

/**
 * A page of a workbook, as its open view comes: two lines of print and boxes, as in the module
 * format's example tables-page.yaml.
 */
const PAGE: open.Task = {
  id: "tables-page",
  statement: [{ text: "Write the missing numbers." }],
  canvas: { kind: "workbook" },
  items: [
    { line: [{ text: "7 ×" }, { binding: "box" }, { text: "= 56" }] },
    { line: [{ text: "47 ÷ 6 =" }, { binding: "box" }, { text: "r" }, { binding: "box" }] },
  ],
};

const SHEET: open.Task = {
  id: "rungs",
  statement: [{ text: "How many rungs?" }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

/** The element's own button by its label, once the element has drawn its row. */
async function rowButton(element: CanvasElement, label: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await waitFor(() => {
    found = [...(element.shadowRoot?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent?.trim() === label,
    );
    expect(found).toBeDefined();
  });
  return found as HTMLButtonElement;
}

/** The element's scroll container, while it is a region of its own. */
const region = (element: CanvasElement) =>
  element.shadowRoot?.querySelector<HTMLElement>('[role="region"]') ?? null;

/** A workbook's printed lines: each piece of text, by its width on the screen. */
const printWidths = (element: CanvasElement) =>
  [...(element.shadowRoot?.querySelectorAll(".print text") ?? [])].map(
    (text) => text.getBoundingClientRect().width,
  );

/**
 * The width of the print from its leftmost piece to its rightmost. Not the sum of the pieces' boxes:
 * a glyph's own box does not scale to the pixel — a lone «r» in Chromium, some 2 px of every box in
 * Firefox.
 */
function printSpan(element: CanvasElement): number {
  const boxes = [...(element.shadowRoot?.querySelectorAll(".print text") ?? [])].map((text) =>
    text.getBoundingClientRect(),
  );
  return Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
}

/** Two frames of the page, for the element to have laid out what it was last given. */
const settled = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/** Every button of the element, in any row, by its text and by a name of its own. */
const buttonLabels = (element: CanvasElement) =>
  [...(element.shadowRoot?.querySelectorAll("button") ?? [])].flatMap((button) => [
    button.textContent?.trim(),
    button.getAttribute("aria-label"),
  ]);

/** The print's span and the page's width, as the statement takes it, once laid out anew. */
async function fitOf(element: CanvasElement) {
  await settled();
  const statement = element.shadowRoot?.querySelector(".statement") as HTMLElement;
  return { page: statement.getBoundingClientRect().width, print: printSpan(element) };
}

// What canvas declares, or does not, for app's Accessibility page, held on the element itself
// rather than taken from canvas's documents (R11). A later canvas that changes any of it fails
// here, and the page's list is to be read again.
describe("what canvas declares for app's Accessibility page", () => {
  it("does not grow a workbook's print past the page's fit to the width: 1.4.4 is not met", async () => {
    const ref = createRef<CanvasElement>();
    const { rerender } = render(
      <div style={{ inlineSize: "20rem" }}>
        <novatrail-canvas ref={ref} lang="ru" task={PAGE} />
      </div>,
    );
    const element = ref.current as CanvasElement;
    await rowButton(element, "Перо");
    // Nothing on the bar enlarges the sheet (R73 canvas).
    for (const gone of ["Крупнее", "Мельче"]) expect(buttonLabels(element)).not.toContain(gone);
    await waitFor(() => expect(printWidths(element).length).toBeGreaterThan(0));
    const narrow = await fitOf(element);
    // The page fits the element's width, below 1000 CSS px: the browser's zoom, which narrows
    // the element in CSS px, narrows the page with it, and the print stays a share of the page.
    expect(narrow.page).toBeLessThanOrEqual(element.clientWidth);
    expect(narrow.page).toBeGreaterThan(element.clientWidth * 0.9);
    rerender(
      <div style={{ inlineSize: "40rem" }}>
        <novatrail-canvas ref={ref} lang="ru" task={PAGE} />
      </div>,
    );
    await waitFor(async () => {
      const wide = await fitOf(element);
      expect(wide.page / narrow.page).toBeGreaterThan(1.8);
      expect(wide.print / wide.page).toBeCloseTo(narrow.print / narrow.page, 2);
    });
    // The sheet goes on past the page: a region of its own, named in the element's language,
    // which the wheel, the trackpad and the keys scroll across.
    await waitFor(() => expect(region(element)?.getAttribute("aria-label")).toBe("Тетрадь"));
    expect(region(element)?.tabIndex).toBe(0);
  });

  it("moves the sheet by dragging alone, with no button that scrolls it: 2.5.7 is not met", async () => {
    for (const task of [SHEET, PAGE]) {
      const ref = createRef<CanvasElement>();
      const { unmount } = render(<novatrail-canvas ref={ref} lang="ru" task={task} />);
      const element = ref.current as CanvasElement;
      // The bar of glass holds the tools, the hand among them, and no button that scrolls
      // (R90 spec; R88 canvas).
      await rowButton(element, "Рука");
      const labels = buttonLabels(element);
      expect(labels).toEqual(expect.arrayContaining(["Перо", "Рука", "Отменить"]));
      for (const gone of ["Выше", "Ниже", "Левее", "Правее"]) expect(labels).not.toContain(gone);
      unmount();
    }
  });

  it("keeps a workbook's print to its own widths under the user's text spacing: 1.4.12 is not met", async () => {
    const ref = createRef<CanvasElement>();
    render(
      <div data-testid="spacing">
        <novatrail-canvas ref={ref} lang="ru" task={PAGE} />
      </div>,
    );
    const element = ref.current as CanvasElement;
    await waitFor(() => expect(printWidths(element).length).toBeGreaterThan(0));
    await settled();
    const before = printWidths(element);
    // The spacing of WCAG 1.4.12, as a user's style sheet or a bookmarklet sets it on the page.
    const spacing = screen.getByTestId("spacing");
    for (const target of [spacing, element]) {
      target.style.setProperty("line-height", "1.5");
      target.style.setProperty("letter-spacing", "0.12em");
      target.style.setProperty("word-spacing", "0.16em");
    }
    const statement = element.shadowRoot?.querySelector(".statement p") as HTMLElement;
    await waitFor(() => expect(getComputedStyle(statement).letterSpacing).not.toBe("normal"));
    // The statement takes the spacing, and the print keeps the widths of the page's rule, after
    // whatever the element lays out anew on a frame of its own.
    await settled();
    const after = printWidths(element);
    expect(after).toHaveLength(before.length);
    for (const [i, width] of after.entries()) expect(width).toBeCloseTo(before[i] ?? 0, 1);
  });

  it("names its scroll container in the language app always gives it: 3.1.2 is met", async () => {
    for (const [lang, name] of [
      ["ru", "Лист"],
      ["en", "Sheet"],
    ] as const) {
      const ref = createRef<CanvasElement>();
      const { unmount } = render(<novatrail-canvas ref={ref} lang={lang} task={SHEET} />);
      const element = ref.current as CanvasElement;
      // A height of its own, lower than its sheet: the container overflows and is a region.
      element.style.blockSize = "12rem";
      await waitFor(() => expect(region(element)?.getAttribute("aria-label")).toBe(name));
      const named = region(element) as HTMLElement;
      // The region names the element's language by an attribute of its own: Firefox, which gives a
      // shadow tree no language of its host, has it too.
      expect(named.getAttribute("lang")).toBe(lang);
      expect(named.matches(`:lang(${lang})`)).toBe(true);
      unmount();
    }
  });
});
