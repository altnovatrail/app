// The theme as the browser computes it (section 3.9 of docs/architecture.md; the 2026-11-17
// amendment to R17): the mockup's pill and primary button, a field with its edge, a card, the glass
// and its panel, the page and the weights, in CSS px at the root's 16.
import { render } from "@testing-library/react";
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
          2
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
    // A segment that does not open is grey as a disabled button is, its own colours held over.
    for (const off of [disabled, closed]) {
      expect([off?.backgroundColor, off?.color]).toEqual([
        "rgba(118, 118, 128, 0.16)",
        "rgb(142, 142, 147)",
      ]);
    }
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
});
