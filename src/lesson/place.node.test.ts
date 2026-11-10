// The place in a lesson and the way along its bar (section 3.4 of docs/architecture.md; R06, R23):
// the lesson of the format's example, gaps-and-posts — an explanation, a worked example, a task and
// an explanation —, and one that ends with its task, as remainders-on-a-workbook.
import { describe, expect, it } from "vitest";
import {
  type Course,
  closedWhy,
  continueFrom,
  firstOpenTask,
  mayContinue,
  openingPlace,
  taskEnded,
} from "./place.ts";
import type { Kind } from "./run.ts";

const GAPS: readonly Kind[] = ["explanation", "example", "task", "explanation"];
const course = (kinds: readonly Kind[], ended: readonly number[] = []): Course => ({
  kinds,
  ended: new Set(ended),
});

describe("the place a lesson opens at", () => {
  it("is the first segment of a run nothing was kept of", () => {
    expect(openingPlace(course(GAPS), undefined, undefined)).toBe(1);
  });

  it("is the place kept, the one after the last task that ended, or the attempt's: the later", () => {
    expect(openingPlace(course(GAPS), 2, undefined)).toBe(2);
    // Another device: the task ended there, and nothing is kept here.
    expect(openingPlace(course(GAPS, [3]), undefined, undefined)).toBe(4);
    expect(openingPlace(course(GAPS, [3]), 2, undefined)).toBe(4);
    expect(openingPlace(course(GAPS), 1, 3)).toBe(3);
    expect(openingPlace(course(GAPS), 4, 3)).toBe(4);
  });

  it("is never a task that ended but the last segment, and never past the last", () => {
    expect(openingPlace(course(GAPS, [3]), 3, undefined)).toBe(4);
    expect(openingPlace(course(["example", "task"], [2]), undefined, undefined)).toBe(2);
    expect(openingPlace(course(GAPS), 9, undefined)).toBe(4);
    expect(openingPlace(course(GAPS), 0, undefined)).toBe(1);
  });
});

describe("the bar of segments", () => {
  it("opens the place and every explanation and example before it", () => {
    const at = course(GAPS, [3]);
    expect(closedWhy(at, 4, 1)).toBeUndefined();
    expect(closedWhy(at, 4, 2)).toBeUndefined();
    expect(closedWhy(at, 4, 4)).toBeUndefined();
  });

  it("does not open a task that ended, nor a segment not reached, and says why", () => {
    expect(closedWhy(course(GAPS, [3]), 4, 3)).toBe("lesson.task-over");
    expect(closedWhy(course(GAPS), 2, 3)).toBe("lesson.not-open");
    expect(taskEnded(course(GAPS, [3]), 3)).toBe(true);
    expect(taskEnded(course(GAPS, [3]), 2)).toBe(false);
  });

  it("opens the last task at the place once it ended: Continue on it is lesson done", () => {
    const at = course(["example", "task"], [2]);
    expect(closedWhy(at, 2, 2)).toBeUndefined();
    expect(mayContinue(at, 2, 2)).toBe(true);
    expect(continueFrom(at, 2, 2)).toBe("complete");
  });
});

describe("Continue", () => {
  it("goes on from the place, and is lesson done on the last segment", () => {
    expect(continueFrom(course(GAPS), 1, 1)).toBe(2);
    expect(continueFrom(course(GAPS, [3]), 4, 4)).toBe("complete");
  });

  it("from a segment passed leads to the next one passed, past a task that ended, then the place", () => {
    const at = course(["explanation", "example", "task", "example", "explanation"], [3]);
    expect(continueFrom(at, 5, 1)).toBe(2);
    expect(continueFrom(at, 5, 2)).toBe(4);
    expect(continueFrom(at, 5, 4)).toBe(5);
  });

  it("stands at once on an explanation and an example, and on a task only once it ended", () => {
    expect(mayContinue(course(GAPS), 1, 1)).toBe(true);
    expect(mayContinue(course(GAPS), 2, 2)).toBe(true);
    expect(mayContinue(course(GAPS), 3, 3)).toBe(false);
    expect(mayContinue(course(GAPS, [3]), 4, 3)).toBe(true);
  });

  it("after lesson done refused goes to the first task that has not ended", () => {
    expect(firstOpenTask(course(["task", "explanation", "task"], [1]))).toBe(3);
    expect(firstOpenTask(course(GAPS, [3]))).toBeUndefined();
  });
});
