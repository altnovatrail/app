import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "./Icon.tsx";
import { ICONS, VALUES } from "./icons.ts";

/** The one svg a render drew. */
function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  if (svg === null) throw new Error("no svg");
  return svg;
}

describe("Icon", () => {
  it("draws the outline's paths, hidden from assistive technology and in the text's colour", () => {
    const svg = svgOf(render(<Icon value="continue" />).container);
    const { viewBox, paths } = ICONS[VALUES.continue.outline];
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
    expect(svg.getAttribute("fill")).toBe("currentColor");
    expect(svg.getAttribute("viewBox")).toBe(viewBox);
    expect(svg.querySelector("title")).toBeNull();
    expect([...svg.querySelectorAll("path")].map((path) => path.getAttribute("d"))).toEqual(paths);
  });

  it("draws the fill while chosen, which a value without a fill draws as its outline", () => {
    const outline = svgOf(render(<Icon value="continue" />).container).innerHTML;
    const chosen = svgOf(render(<Icon value="continue" chosen />).container).innerHTML;
    expect(VALUES.continue.filled).toBe(VALUES.continue.outline);
    expect(chosen).toBe(outline);
  });

  it("is mirrored in a line that runs right to left, and only there", () => {
    const ltr = svgOf(render(<Icon value="continue" />).container);
    const rtl = svgOf(
      render(
        <div dir="rtl">
          <Icon value="continue" />
        </div>,
      ).container,
    );
    expect(getComputedStyle(ltr).transform).toBe("none");
    expect(getComputedStyle(rtl).transform).toBe("matrix(-1, 0, 0, 1, 0, 0)");
  });
});
