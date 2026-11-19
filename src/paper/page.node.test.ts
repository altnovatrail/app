// The tasks of a page on the pick screen (R71): the frames FindTasks gave, picked and in the order of
// the page; a tap, "Select all" and "Select none"; the frames the learner draws; what Start begins.
import { FindTasksResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  allOrNone,
  canStart,
  counts,
  foundTasks,
  limit,
  MAX_TASKS,
  numbers,
  picked,
  toggled,
  withDrawn,
  withFrame,
  without,
} from "./page.ts";

const box = (ymin: number, xmin: number, ymax: number, xmax: number) => ({
  box: { ymin, xmin, ymax, xmax },
});

const answer = (frames: ReturnType<typeof box>[]) =>
  create(FindTasksResponseSchema, { frames: frames.map((f) => ({ box: f.box })) });

describe("the tasks found", () => {
  it("are each picked, in the order of the page", () => {
    const tasks = foundTasks(
      answer([box(500, 0, 600, 400), box(100, 500, 200, 900), box(100, 0, 200, 400)]),
    );
    expect(tasks.map((t) => [t.frame.ymin, t.frame.xmin])).toEqual([
      [100, 0],
      [100, 500],
      [500, 0],
    ]);
    expect(tasks.every((t) => t.picked && !t.drawn)).toBe(true);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(3);
  });

  it("leave out a frame that is no rectangle in the photo", () => {
    const tasks = foundTasks(
      create(FindTasksResponseSchema, {
        frames: [
          {},
          box(100, 100, 100, 200),
          box(0, 0, 1001, 10),
          box(200, 300, 100, 400),
          box(0, 0, 10, 10),
        ],
      }),
    );
    expect(tasks.map((t) => t.frame)).toEqual([{ ymin: 0, xmin: 0, ymax: 10, xmax: 10 }]);
  });

  it("are none in an answer of none", () => {
    expect(foundTasks(create(FindTasksResponseSchema, {}))).toEqual([]);
  });

  it("are no more than a page begins", () => {
    const many = Array.from({ length: MAX_TASKS + 3 }, (_, i) => box(i * 10, 0, i * 10 + 5, 10));
    expect(foundTasks(answer(many))).toHaveLength(MAX_TASKS);
  });
});

describe("the pick", () => {
  const found = foundTasks(answer([box(100, 0, 200, 400), box(300, 0, 400, 400)]));

  it("leaves a task out by a tap, and takes it back", () => {
    const first = found[0]?.id ?? "";
    const out = toggled(found, first);
    expect(picked(out).map((t) => t.id)).toEqual([found[1]?.id]);
    expect(picked(toggled(out, first))).toHaveLength(2);
  });

  it("selects all, then none", () => {
    const one = toggled(found, found[0]?.id ?? "");
    const all = allOrNone(one);
    expect(picked(all)).toHaveLength(2);
    expect(picked(allOrNone(all))).toHaveLength(0);
    expect(canStart(allOrNone(all))).toBe(false);
    expect(canStart(all)).toBe(true);
  });

  it("takes a frame drawn, picked, in the order of the page", () => {
    const drawn = withDrawn(found, { ymin: 200, xmin: 0, ymax: 280, xmax: 400 });
    expect(picked(drawn).map((t) => t.frame.ymin)).toEqual([100, 200, 300]);
    expect(counts(drawn)).toEqual({ found: 2, drawn: 1, picked: 3, all: 3 });
    const id = drawn.find((t) => t.drawn)?.id ?? "";
    expect(numbers(drawn).get(id)).toBe(2);
    // Its corner moves, and the AI's frames' does not; its cross removes it, as theirs do.
    const moved = withFrame(drawn, id, { ymin: 200, xmin: 0, ymax: 290, xmax: 500 });
    expect(moved.find((t) => t.id === id)?.frame.xmax).toBe(500);
    expect(withFrame(drawn, found[0]?.id ?? "", { ymin: 0, xmin: 0, ymax: 1, xmax: 1 })).toEqual(
      drawn,
    );
    expect(without(drawn, id)).toEqual(found);
    expect(without(drawn, found[0]?.id ?? "").map((t) => t.id)).toEqual([found[1]?.id, id]);
  });

  it("gives each frame drawn a key of its own, after one removed", () => {
    const a = withDrawn([], { ymin: 0, xmin: 0, ymax: 100, xmax: 100 });
    const b = withDrawn(a, { ymin: 200, xmin: 0, ymax: 300, xmax: 100 });
    const c = withDrawn(without(b, a[0]?.id ?? ""), { ymin: 400, xmin: 0, ymax: 500, xmax: 100 });
    expect(new Set(c.map((t) => t.id)).size).toBe(2);
  });

  it("starts from one task to twenty", () => {
    let tasks = foundTasks(answer([]));
    expect(canStart(tasks)).toBe(false);
    for (let i = 0; i <= MAX_TASKS; i += 1) {
      tasks = withDrawn(tasks, { ymin: i * 40, xmin: 0, ymax: i * 40 + 30, xmax: 100 });
    }
    expect(canStart(tasks)).toBe(false);
    expect(canStart(toggled(tasks, tasks[0]?.id ?? ""))).toBe(true);
  });

  it("says the limit when as many are found, or more are picked", () => {
    const frames = (n: number) =>
      Array.from({ length: n }, (_, i) => box(i * 40, 0, i * 40 + 30, 100));
    expect(limit(foundTasks(answer(frames(MAX_TASKS - 1))))).toBeUndefined();
    const full = foundTasks(answer(frames(MAX_TASKS + 3)));
    expect(full).toHaveLength(MAX_TASKS);
    expect(limit(full)).toBe("at-most");
    const more = withDrawn(full, { ymin: 900, xmin: 500, ymax: 950, xmax: 600 });
    expect(limit(more)).toBe("too-many");
    expect(limit(toggled(more, more[0]?.id ?? ""))).toBe("at-most");
  });
});
