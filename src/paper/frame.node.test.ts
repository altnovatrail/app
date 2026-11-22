// The geometry of a frame the learner draws (R71): a rectangle dragged corner to corner, a tap that
// is no drag, two taps, the corner that resizes it, the photo's edge, and the crop's rectangle in
// pixels.
import { describe, expect, it } from "vitest";
import {
  cropRect,
  dragFrame,
  isFrame,
  isTap,
  MIN_HEIGHT,
  MIN_WIDTH,
  pageOrder,
  resizedFrame,
  type Scale,
  sameFrame,
  spanned,
  tapsFrame,
} from "./frame.ts";

// A photo drawn 500 × 700 CSS px: a thousandth is 0.5 px across and 0.7 px down.
const scale: Scale = { x: 0.5, y: 0.7 };

describe("a drag", () => {
  it("is the rectangle of its two corners, with no margin, in whichever direction", () => {
    const frame = { xmin: 200, ymin: 300, xmax: 600, ymax: 500 };
    expect(dragFrame({ x: 200, y: 300 }, { x: 600, y: 500 }, scale)).toEqual(frame);
    expect(dragFrame({ x: 600, y: 500 }, { x: 200, y: 300 }, scale)).toEqual(frame);
    expect(dragFrame({ x: 600, y: 300 }, { x: 200, y: 500 }, scale)).toEqual(frame);
  });

  it("rounds out to whole thousandths and stays in the photo", () => {
    expect(spanned({ x: 200.6, y: 300.2 }, { x: 599.4, y: 499.9 })).toEqual({
      xmin: 200,
      ymin: 300,
      xmax: 600,
      ymax: 500,
    });
    expect(dragFrame({ x: -40, y: -3 }, { x: 1200, y: 1001 }, scale)).toEqual({
      xmin: 0,
      ymin: 0,
      xmax: 1000,
      ymax: 1000,
    });
  });

  it("smaller than the least frame is none: the pointer came back near where it was pressed", () => {
    const w = MIN_WIDTH / scale.x;
    const h = MIN_HEIGHT / scale.y;
    expect(dragFrame({ x: 100, y: 100 }, { x: 100 + w - 1, y: 400 }, scale)).toBeUndefined();
    expect(dragFrame({ x: 100, y: 100 }, { x: 400, y: 100 + h - 1 }, scale)).toBeUndefined();
    expect(dragFrame({ x: 100, y: 100 }, { x: 100 + w, y: 100 + h }, scale)).toBeDefined();
    // Cut by the photo's edge below the least frame.
    expect(dragFrame({ x: 990, y: 100 }, { x: 1200, y: 400 }, scale)).toBeUndefined();
  });
});

describe("a tap", () => {
  it("is a stroke smaller than the least frame", () => {
    const narrow = [
      { x: 100, y: 100 },
      { x: 100 + MIN_WIDTH / scale.x - 1, y: 400 },
    ];
    const low = [
      { x: 100, y: 100 },
      { x: 400, y: 100 + MIN_HEIGHT / scale.y - 1 },
    ];
    expect(isTap(narrow, scale)).toBe(true);
    expect(isTap(low, scale)).toBe(true);
    expect(isTap([], scale)).toBe(true);
    expect(
      isTap(
        [
          { x: 100, y: 100 },
          { x: 300, y: 300 },
        ],
        scale,
      ),
    ).toBe(false);
  });
});

describe("two taps", () => {
  it("are two opposite corners, in either order", () => {
    const frame = { xmin: 100, ymin: 200, xmax: 400, ymax: 600 };
    expect(tapsFrame({ x: 100, y: 200 }, { x: 400, y: 600 }, scale)).toEqual(frame);
    expect(tapsFrame({ x: 400, y: 600 }, { x: 100, y: 200 }, scale)).toEqual(frame);
    expect(tapsFrame({ x: 400, y: 200 }, { x: 100, y: 600 }, scale)).toEqual(frame);
  });

  it("close together give the least frame, from the first towards the second", () => {
    const w = MIN_WIDTH / scale.x;
    const h = Math.ceil(MIN_HEIGHT / scale.y);
    expect(tapsFrame({ x: 500, y: 500 }, { x: 510, y: 505 }, scale)).toEqual({
      xmin: 500,
      ymin: 500,
      xmax: 500 + w,
      ymax: 500 + h,
    });
    const back = tapsFrame({ x: 500, y: 500 }, { x: 490, y: 495 }, scale);
    expect(back.xmax).toBe(500);
    expect(back.ymax).toBe(500);
    expect(back.xmax - back.xmin).toBe(w);
  });

  it("at the photo's edge stay in it", () => {
    const frame = tapsFrame({ x: 995, y: 998 }, { x: 999, y: 999 }, scale);
    expect(frame.xmax).toBe(1000);
    expect(frame.ymax).toBe(1000);
    expect(frame.xmax - frame.xmin).toBe(MIN_WIDTH / scale.x);
  });
});

describe("the corner", () => {
  const frame = { xmin: 100, ymin: 100, xmax: 300, ymax: 300 };

  it("moves the bottom-right corner", () => {
    expect(resizedFrame(frame, { x: 450.4, y: 520.6 }, scale)).toEqual({
      ...frame,
      xmax: 450,
      ymax: 521,
    });
  });

  it("keeps the least frame and the photo's edge", () => {
    const small = resizedFrame(frame, { x: 0, y: 0 }, scale);
    expect(small.xmax).toBe(100 + MIN_WIDTH / scale.x);
    expect(small.ymax).toBe(Math.ceil(100 + MIN_HEIGHT / scale.y));
    expect(resizedFrame(frame, { x: 2000, y: 1500 }, scale)).toEqual({
      ...frame,
      xmax: 1000,
      ymax: 1000,
    });
  });
});

it("orders the page top to bottom, the left first", () => {
  const a = { xmin: 500, ymin: 100, xmax: 600, ymax: 200 };
  const b = { xmin: 100, ymin: 100, xmax: 200, ymax: 200 };
  const c = { xmin: 0, ymin: 50, xmax: 100, ymax: 80 };
  expect([a, b, c].sort(pageOrder)).toEqual([c, b, a]);
});

describe("a frame", () => {
  it("is four numbers, its edges in order and within the photo", () => {
    expect(isFrame({ ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 })).toBe(true);
    expect(isFrame({ ymin: 100, xmin: 0, ymax: 100, xmax: 400 })).toBe(false);
    expect(isFrame({ ymin: 0, xmin: -1, ymax: 100, xmax: 400 })).toBe(false);
    expect(isFrame({ ymin: 0, xmin: 0, ymax: 100, xmax: 1001 })).toBe(false);
    expect(isFrame({ ymin: "0", xmin: 0, ymax: 100, xmax: 400 })).toBe(false);
    expect(isFrame(undefined)).toBe(false);
  });

  it("is the same as another of its edges, and never as none", () => {
    const a = { ymin: 0, xmin: 0, ymax: 100, xmax: 400 };
    expect(sameFrame({ ...a }, a)).toBe(true);
    expect(sameFrame({ ...a, xmax: 401 }, a)).toBe(false);
    expect(sameFrame(undefined, a)).toBe(false);
  });
});

describe("the crop's rectangle", () => {
  it("is the frame in pixels, rounded out", () => {
    expect(cropRect({ xmin: 100, ymin: 250, xmax: 333, ymax: 500 }, 1200, 1600)).toEqual({
      sx: 120,
      sy: 400,
      sw: 400 - 120,
      sh: 800 - 400,
    });
  });

  it("is at least a pixel, inside the photo", () => {
    expect(cropRect({ xmin: 999, ymin: 999, xmax: 1000, ymax: 1000 }, 10, 10)).toEqual({
      sx: 9,
      sy: 9,
      sw: 1,
      sh: 1,
    });
  });
});
