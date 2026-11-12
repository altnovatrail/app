// The probe of the element in JSX: the package registers it on import, before the first render
// (R42 in canvas), React gives it its properties and listens for its events, and the types of its
// contract are spec's (section 3.1 of docs/architecture.md). Then what canvas declares against
// WCAG for app's Accessibility page, held on the element itself (R11; section 3.9).
import "@altnovatrail/canvas";
import type { CanvasElement, HistoryChangeEvent, Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";

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

/** The sum of widths. */
const sum = (widths: readonly number[]) => widths.reduce((total, width) => total + width, 0);

/** Two frames of the page, for the element to have laid out what it was last given. */
const settled = () =>
  new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done())));

/** More presses than the zoom has steps, from its fit to twice it by quarters. */
const MOST_PRESSES = 8;

/** A button of the row pressed till it is at its end, and no more often than the zoom has steps. */
async function pressToEnd(button: HTMLButtonElement) {
  for (let i = 0; i < MOST_PRESSES && button.getAttribute("aria-disabled") !== "true"; i++) {
    await userEvent.click(button);
  }
  expect(button.getAttribute("aria-disabled")).toBe("true");
}

/** The page's zoom of the sheet back at its fit, as every other test of the page expects it. */
async function unzoom(element: CanvasElement) {
  await pressToEnd(await rowButton(element, "Мельче"));
}

// What canvas declares, or no longer declares, for app's Accessibility page, held on the element
// itself rather than taken from canvas's documents (R11; section 3.9 of docs/architecture.md). A
// later canvas that changes any of it fails here, and the page's list is to be read again.
describe("what canvas declares for app's Accessibility page", () => {
  it("zooms a workbook's print to 200 % by «Крупнее», and scrolls it across: 1.4.4 is met", async () => {
    const ref = createRef<CanvasElement>();
    render(
      <div style={{ inlineSize: "20rem" }}>
        <novatrail-canvas ref={ref} lang="ru" task={PAGE} />
      </div>,
    );
    const element = ref.current as CanvasElement;
    const larger = await rowButton(element, "Крупнее");
    expect((await rowButton(element, "Мельче")).getAttribute("aria-disabled")).toBe("true");
    await waitFor(() => expect(printWidths(element).length).toBeGreaterThan(0));
    await settled();
    // The sheet fits the element's width, 20rem, below the sheet's cap.
    const fit = { page: element.clientWidth, print: sum(printWidths(element)) };
    expect(fit.page).toBeGreaterThan(0);
    try {
      await pressToEnd(larger);
      // Twice the fit, and not a step short of it: 150 % and 175 % are steps of the zoom too. The
      // print by the sum of its pieces: a glyph's own box, as of a lone «r», does not scale to the
      // pixel.
      // The zoomed sheet is wider than the element: a region of its own, named in the element's
      // language, which Left and Right scroll with a single pointer (2.5.1).
      await waitFor(() => expect(region(element)?.getAttribute("aria-label")).toBe("Тетрадь"));
      await waitFor(() => {
        expect((region(element)?.scrollWidth ?? 0) / fit.page).toBeCloseTo(2, 2);
        expect(sum(printWidths(element)) / fit.print).toBeCloseTo(2, 1);
      });
      expect((await rowButton(element, "Левее")).closest("[hidden]")).toBeNull();
      expect((await rowButton(element, "Правее")).closest("[hidden]")).toBeNull();
    } finally {
      await unzoom(element);
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
      expect(named.hasAttribute("lang")).toBe(false);
      expect(named.matches(`:lang(${lang})`)).toBe(true);
      unmount();
    }
  });
});
