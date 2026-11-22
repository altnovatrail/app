import { describe, expect, it } from "vitest";
import { SPARK } from "./spark.ts";

/** The points of a path of M, L and l commands, as the spark's is drawn. */
function points(path: string): [number, number][] {
  const out: [number, number][] = [];
  let at: [number, number] = [0, 0];
  for (const [, command, args] of path.matchAll(/([MLlz])([^MLlz]*)/g)) {
    const numbers = (args?.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    for (let i = 0; i + 1 < numbers.length; i += 2) {
      const dx = numbers[i] ?? 0;
      const dy = numbers[i + 1] ?? 0;
      at = command === "l" ? [at[0] + dx, at[1] + dy] : [dx, dy];
      out.push(at);
    }
  }
  return out;
}

describe("the spark", () => {
  it("is centred in its box of 24, so that a halo or a tile centres it", () => {
    const xs = points(SPARK).map(([x]) => x);
    const ys = points(SPARK).map(([, y]) => y);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(12, 5);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(12, 5);
  });
});
