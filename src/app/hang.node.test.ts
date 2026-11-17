// Where a pop-over hangs from its button (section 3.9 of docs/architecture.md): below it and at its
// left, or centred below its middle, above it where below has no room, at its right where the left would leave the window, and
// inside the window's margin whatever the button's place.
import { describe, expect, it } from "vitest";
import { GAP, hang, MARGIN } from "./hang.ts";

const VIEW = { width: 1194, height: 834 };
const button = (left: number, top: number) => ({
  left,
  top,
  right: left + 44,
  bottom: top + 44,
});

describe("hang", () => {
  it("hangs below the button at its left, growing from the top left", () => {
    expect(hang(button(16, 12), 300, 200, VIEW)).toEqual({
      left: 16,
      top: 56 + GAP,
      origin: "top left",
    });
  });

  it("hangs the gap it is given below the button, as the home's 6 below its bar", () => {
    expect(hang(button(16, 14), 270, 140, VIEW, false, 6)).toMatchObject({ left: 16, top: 64 });
    expect(hang(button(16, 700), 270, 140, VIEW, false, 6)).toMatchObject({ top: 700 - 6 - 140 });
  });

  it("hangs centred below the button's middle, growing from the middle of its top, when asked", () => {
    expect(hang(button(500, 300), 300, 200, VIEW, true)).toEqual({
      left: 522 - 150,
      top: 344 + GAP,
      origin: "top center",
    });
    // Centred, still inside the margin.
    expect(hang(button(0, 300), 300, 200, VIEW, true).left).toBe(MARGIN);
  });

  it("hangs at the button's right where its left would leave the window", () => {
    expect(hang(button(1134, 12), 300, 200, VIEW)).toEqual({
      left: 1178 - 300,
      top: 56 + GAP,
      origin: "top right",
    });
  });

  it("opens above a button near the bottom, growing from the bottom", () => {
    expect(hang(button(400, 760), 300, 200, VIEW)).toEqual({
      left: 400,
      top: 760 - GAP - 200,
      origin: "bottom left",
    });
  });

  it("takes the side with more room where neither has enough, inside the margin", () => {
    expect(hang(button(4, 300), 300, 700, VIEW)).toEqual({
      left: MARGIN,
      top: 834 - MARGIN - 700,
      origin: "top left",
    });
    expect(hang(button(400, 500), 300, 700, VIEW)).toEqual({
      left: 400,
      top: MARGIN,
      origin: "bottom left",
    });
  });

  it("keeps a pop-over wider than the window's room at the margin", () => {
    expect(hang(button(100, 12), 700, 200, { width: 600, height: 834 }).left).toBe(MARGIN);
  });
});
