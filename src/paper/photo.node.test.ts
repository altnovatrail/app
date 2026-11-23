// The sizes the photo of a page is encoded at: its long side fitted, then smaller each try;
// and the size of the photo turned upright.
import { expect, it } from "vitest";
import { fitted, LONG_SIDE, STEP, TRIES, tries, turnedSize } from "./photo.ts";

it("fits the long side and keeps the shape", () => {
  expect(fitted(4032, 3024)).toEqual({ width: LONG_SIDE, height: 2400 });
  expect(fitted(3024, 4032)).toEqual({ width: 2400, height: LONG_SIDE });
  expect(fitted(1200, 1600)).toEqual({ width: 1200, height: 1600 });
  expect(fitted(0, 0)).toEqual({ width: 0, height: 0 });
  expect(fitted(10_000, 1)).toEqual({ width: LONG_SIDE, height: 1 });
});

it("tries smaller each time", () => {
  const sizes = tries(4032, 3024);
  expect(sizes).toHaveLength(TRIES);
  expect(sizes[0]).toEqual({ width: LONG_SIDE, height: 2400 });
  expect(sizes[1]).toEqual({
    width: Math.round(LONG_SIDE * STEP),
    height: Math.round(2400 * STEP),
  });
  for (let i = 1; i < sizes.length; i += 1) {
    expect(sizes[i]?.width).toBeLessThan(sizes[i - 1]?.width ?? 0);
  }
});

it("turns onto the smallest upright rectangle that holds the photo", () => {
  expect(turnedSize(3000, 4000, 0)).toEqual({ width: 3000, height: 4000 });
  expect(turnedSize(3000, 4000, 90)).toEqual({ width: 4000, height: 3000 });
  expect(turnedSize(3000, 4000, -90)).toEqual({ width: 4000, height: 3000 });
  expect(turnedSize(3000, 4000, 180)).toEqual({ width: 3000, height: 4000 });
  // 3000·cos 30° + 4000·sin 30° = 4598.08, 3000·sin 30° + 4000·cos 30° = 4964.10.
  expect(turnedSize(3000, 4000, 30)).toEqual({ width: 4598, height: 4964 });
  expect(turnedSize(3000, 4000, -30)).toEqual({ width: 4598, height: 4964 });
  expect(turnedSize(1000, 1000, 45)).toEqual({ width: 1414, height: 1414 });
});
