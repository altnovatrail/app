// Where the tooltip of a button that shows an icon alone goes (section 3.9 of
// docs/architecture.md): below the button and centred on it, above it where only above has room,
// and moved along to stay inside the window's margin.
import { describe, expect, it } from "vitest";
import { MARGIN, tipAt } from "./tip.ts";

const VIEW = { width: 390, height: 844 };
const button = (left: number, top: number) => ({
  left,
  top,
  right: left + 44,
  bottom: top + 44,
});

describe("tipAt", () => {
  it("puts it below the button, centred on it", () => {
    expect(tipAt(button(100, 20), 60, 30, VIEW)).toEqual({ left: 92, top: 64, below: true });
  });

  it("puts it above the button where below has no room", () => {
    expect(tipAt(button(100, 790), 60, 30, VIEW)).toEqual({ left: 92, top: 760, below: false });
  });

  it("keeps it below where neither side has room", () => {
    expect(tipAt(button(100, 10), 60, 830, VIEW)).toMatchObject({ top: 54, below: true });
  });

  it("moves it along to stay inside the window's margin at either edge", () => {
    expect(tipAt(button(0, 20), 100, 30, VIEW).left).toBe(MARGIN);
    expect(tipAt(button(346, 20), 100, 30, VIEW).left).toBe(390 - MARGIN - 100);
  });
});
