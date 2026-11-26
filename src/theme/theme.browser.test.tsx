// The theme as the browser computes it: the mockup's pill and primary button, a field with
// its edge, a card, the glass and its panel, the page and the weights, a group of the section for
// adults, in CSS px at the root's 16; and the canvas's bar of tools in the same glass and
// accent, from the top of the window.
import "@altnovatrail/canvas";
import type { CanvasElement } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import "./theme.css";

function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error("not drawn");
  return getComputedStyle(element);
}

describe("the theme", () => {
  it("draws the page grey, its text the mockup's, 14 px, and a heading bold", () => {
    render(<h1>Learn anything</h1>);
    const body = styleOf(document.body);
    expect(body.backgroundColor).toBe("rgb(242, 242, 247)");
    expect(body.color).toBe("rgb(29, 29, 31)");
    expect(body.fontSize).toBe("14px");
    const heading = styleOf(document.querySelector("h1"));
    expect([heading.fontSize, heading.fontWeight]).toEqual(["28px", "700"]);
  });

  it("draws a button as the mockup's pill, and the primary button 52 high", () => {
    const { container } = render(
      <>
        <button type="button">Next</button>
        <button type="button" className="nt-main">
          Continue
        </button>
        <button type="button" className="nt-secondary">
          Later
        </button>
        <button type="button" disabled>
          Wait
        </button>
        <button type="button" className="nt-segment" aria-disabled="true">
          <span className="nt-segment-kind">Task</span>
        </button>
      </>,
    );
    const [pill, main, secondary, disabled, closed] = [...container.querySelectorAll("button")].map(
      styleOf,
    );
    expect(pill?.backgroundColor).toBe("rgb(0, 113, 227)");
    expect(pill?.color).toBe("rgb(255, 255, 255)");
    expect([pill?.borderTopLeftRadius, pill?.fontWeight, pill?.minHeight]).toEqual([
      "22px",
      "600",
      "44px",
    ]);
    expect(pill?.borderTopColor).toBe("rgba(0, 0, 0, 0)");
    expect([main?.minHeight, main?.borderTopLeftRadius, main?.fontSize]).toEqual([
      "52px",
      "14px",
      "16px",
    ]);
    expect([secondary?.backgroundColor, secondary?.color, secondary?.borderTopColor]).toEqual([
      "rgb(255, 255, 255)",
      "rgb(0, 102, 204)",
      "rgb(0, 113, 227)",
    ]);
    expect([disabled?.backgroundColor, disabled?.color]).toEqual([
      "rgba(118, 118, 128, 0.16)",
      "rgb(142, 142, 147)",
    ]);
    // A segment that does not open is a row of the pop-over as the mockup's, with no fill, its kind
    // grey.
    expect(closed?.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(styleOf(container.querySelector(".nt-segment-kind")).color).toBe("rgb(110, 110, 115)");
  });

  it("draws a field white with an edge of 1 px, and a card white and round", () => {
    const { container } = render(
      <>
        <div className="nt-field">
          <label htmlFor="name">Name</label>
          <input id="name" />
        </div>
        <div className="nt-card">A card</div>
      </>,
    );
    const field = styleOf(container.querySelector("input"));
    expect([field.borderTopWidth, field.borderTopColor, field.borderTopLeftRadius]).toEqual([
      "1px",
      "rgb(142, 142, 147)",
      "12px",
    ]);
    expect(field.backgroundColor).toBe("rgb(255, 255, 255)");
    // 16 px, under which Safari on iOS zooms the page on the field's focus.
    expect(field.fontSize).toBe("16px");
    const card = styleOf(container.querySelector(".nt-card"));
    expect([card.backgroundColor, card.borderTopLeftRadius]).toEqual([
      "rgb(255, 255, 255)",
      "16px",
    ]);
  });

  it("draws a card of a page of Settings that keeps its cards, its heading 17 bold, its rows 52 high", () => {
    const { container } = render(
      <main className="nt-settings">
        <section className="nt-group">
          <h2>Profiles</h2>
          <p className="nt-hint">The profiles of the account</p>
          <ul className="nt-rows">
            <li>
              <button type="button" className="nt-row">
                Ёжик
              </button>
            </li>
          </ul>
        </section>
      </main>,
    );
    const group = styleOf(container.querySelector(".nt-group"));
    expect([group.backgroundColor, group.borderTopLeftRadius, group.paddingTop]).toEqual([
      "rgb(255, 255, 255)",
      "16px",
      "16px",
    ]);
    const heading = styleOf(container.querySelector("h2"));
    expect([heading.fontSize, heading.fontWeight]).toEqual(["17px", "700"]);
    expect(styleOf(container.querySelector(".nt-hint")).color).toBe("rgb(110, 110, 115)");
    const row = container.querySelector(".nt-row") as HTMLElement;
    expect(row.getBoundingClientRect().height).toBe(52);
    expect(styleOf(row).backgroundColor).toBe("rgba(0, 0, 0, 0)");
    // The rows reach the card's edges, as the owner's profile has them.
    const card = (container.querySelector(".nt-group") as HTMLElement).getBoundingClientRect();
    expect(row.getBoundingClientRect().width).toBeCloseTo(card.width - 2, 0);
  });

  it("draws a group of Settings as a device's: white, radius 12, its caption 13 in capitals, its rows 44 and 17, the switch on in green", () => {
    const { container } = render(
      <main className="nt-settings">
        <section className="nt-set-sec">
          <h2 className="nt-set-head">Voice</h2>
          <div className="nt-set-group">
            <label className="nt-set-row">
              <span className="nt-set-text">
                <span className="nt-set-label">Read aloud</span>
              </span>
              <input
                type="checkbox"
                role="switch"
                aria-checked="true"
                className="nt-set-input"
                defaultChecked
              />
              <span className="nt-set-switch" />
            </label>
          </div>
          <div className="nt-set-note">A line under the group</div>
        </section>
      </main>,
    );
    const group = styleOf(container.querySelector(".nt-set-group"));
    expect([group.backgroundColor, group.borderTopLeftRadius]).toEqual([
      "rgb(255, 255, 255)",
      "12px",
    ]);
    const head = styleOf(container.querySelector(".nt-set-head"));
    expect([head.fontSize, head.textTransform, head.color]).toEqual([
      "13px",
      "uppercase",
      "rgb(110, 110, 115)",
    ]);
    const row = container.querySelector(".nt-set-row") as HTMLElement;
    expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(styleOf(row).fontSize).toBe("17px");
    // The input is unseen over the whole row, the target; the switch drawn after it.
    const input = (container.querySelector(".nt-set-input") as HTMLElement).getBoundingClientRect();
    expect([input.width, input.height]).toEqual([
      row.getBoundingClientRect().width,
      row.getBoundingClientRect().height,
    ]);
    expect(styleOf(container.querySelector(".nt-set-switch")).backgroundColor).toBe(
      "rgb(36, 138, 61)",
    );
  });

  it("draws glass translucent, the panel more opaque, with the mockup's shadow", () => {
    const { container } = render(
      <>
        <div className="nt-glass">A bar</div>
        <div className="nt-glass nt-glass-panel">The tutor</div>
      </>,
    );
    const [bar, panel] = [...container.querySelectorAll(".nt-glass")].map(styleOf);
    expect(bar?.backgroundColor).toBe("rgba(255, 255, 255, 0.76)");
    expect(panel?.backgroundColor).toBe("rgba(255, 255, 255, 0.86)");
    expect(bar?.boxShadow).toContain("28px");
    expect(bar?.backdropFilter ?? "").toMatch(
      /^(blur\(22px\) saturate\(1\.8\)|blur\(22px\) saturate\(180%\))$/,
    );
  });

  it("draws the canvas's bar of tools in the same glass, the tool in use in the accent", async () => {
    const task: open.Task = {
      id: "rungs",
      statement: [{ text: "How many rungs?" }],
      canvas: { kind: "handwriting_sheet", grid: "squares" },
      items: [{ answer_slots: [{ binding: "anywhere" }] }],
    };
    const ref = createRef<CanvasElement>();
    render(<novatrail-canvas ref={ref} lang="en" task={task} />);
    const element = ref.current as CanvasElement;
    let pen: Element | null | undefined;
    await waitFor(() => {
      pen = element.shadowRoot?.querySelector('[role="radio"][aria-checked="true"]');
      expect(pen).toBeTruthy();
    });
    const bar = styleOf(element.shadowRoot?.querySelector('[role="toolbar"]') ?? null);
    expect(bar.backgroundColor).toBe("rgba(255, 255, 255, 0.76)");
    expect(styleOf(pen ?? null).color).toBe("rgb(0, 113, 227)");
    // No sticky header: the bar's band starts at the window's top.
    expect(styleOf(element).getPropertyValue("--novatrail-canvas-top").trim()).toBe("0px");
  });

  it("keeps a task's statement below the floating top bar, and lets a task from paper's sheet run under it", () => {
    const pad = (paper: boolean) => {
      const { container, unmount } = render(
        <main className="nt-task-screen">
          <div className={paper ? "nt-task nt-task-paper" : "nt-task"}>
            <div className="sheet" />
          </div>
        </main>,
      );
      const value = styleOf(container.querySelector(".sheet"))
        .getPropertyValue("--novatrail-canvas-pad-top")
        .trim();
      unmount();
      return value;
    };
    expect(pad(false)).toBe("4.25rem");
    expect(pad(true)).toBe("0px");
  });

  it("sweeps the page being searched with a line through the middle of its glow, the same above and below it", () => {
    const { container } = render(
      <div style={{ position: "relative", inlineSize: 400, blockSize: 500 }}>
        <span className="nt-page-scan">
          <span />
        </span>
      </div>,
    );
    const band = container.querySelector(".nt-page-scan > span");
    const height = band?.getBoundingClientRect().height ?? 0;
    expect(height).toBeGreaterThan(0);
    // The band has no edge or shadow to one side: the line and its glow are its pseudo-element,
    // whose middle is the band's.
    expect(styleOf(band).borderBottomStyle).toBe("none");
    expect(styleOf(band).boxShadow).toBe("none");
    const line = getComputedStyle(band as Element, "::after");
    expect(Number.parseFloat(line.top) + Number.parseFloat(line.height) / 2).toBeCloseTo(
      height / 2,
      1,
    );
    // The glow fades the same way on each side of it: its colours and stops read the same from
    // either end.
    const stops = [...styleOf(band).backgroundImage.matchAll(/(rgba?\([^)]*\))\s*([\d.]+)%/g)];
    expect(stops.length).toBe(3);
    expect(stops.map((stop) => stop[1])).toEqual(stops.map((stop) => stop[1]).reverse());
    expect(stops.map((stop) => Number(stop[2]))).toEqual(
      stops.map((stop) => 100 - Number(stop[2])).reverse(),
    );
  });
});
