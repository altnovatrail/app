// The sizes the photo of a page is encoded at (R71): its long side fitted, then smaller each try.
import { expect, it } from "vitest";
import { fitted, LONG_SIDE, STEP, TRIES, tries } from "./photo.ts";

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
