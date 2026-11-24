// The tasks of a page on the pick screen: the frames FindTasks gave, picked and in the order of
// the page; a tap, "Select all" and "Select none"; the frames the learner draws; what Start begins;
// and a request about the page, its frames and what its answer leaves on the page; and the
// page on its photo turned upright.
import { FindTasksResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  allOrNone,
  asked,
  canStart,
  counts,
  foundTasks,
  framesOf,
  keptTasks,
  limit,
  MAX_REQUEST,
  MAX_TASKS,
  numbers,
  picked,
  requestOf,
  toggled,
  turnedTasks,
  unturned,
  uprightPage,
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

  it("carry the frame of the instruction above each, when it is a rectangle in the photo", () => {
    const tasks = foundTasks(
      create(FindTasksResponseSchema, {
        frames: [
          { ...box(500, 0, 600, 400), instruction: { ymin: 450, xmin: 0, ymax: 490, xmax: 400 } },
          { ...box(100, 0, 200, 400), instruction: { ymin: 90, xmin: 0, ymax: 90, xmax: 400 } },
        ],
      }),
    );
    // In the order of the page, each with its own; one that is no rectangle is none.
    expect(tasks.map((t) => t.instruction)).toEqual([
      undefined,
      { ymin: 450, xmin: 0, ymax: 490, xmax: 400 },
    ]);
    expect(tasks[0]).not.toHaveProperty("instruction");
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
    // Its frame changes, as the AI's frames' do, the rest as they were; its cross removes it, as
    // theirs do.
    const moved = withFrame(drawn, id, { ymin: 200, xmin: 0, ymax: 290, xmax: 500 });
    expect(moved.find((t) => t.id === id)?.frame.xmax).toBe(500);
    const first = found[0]?.id ?? "";
    const theirs = withFrame(drawn, first, { ymin: 0, xmin: 0, ymax: 1, xmax: 1 });
    expect(theirs.find((t) => t.id === first)?.frame).toEqual({
      ymin: 0,
      xmin: 0,
      ymax: 1,
      xmax: 1,
    });
    expect(theirs.filter((t) => t.id !== first)).toEqual(drawn.filter((t) => t.id !== first));
    expect(without(drawn, id)).toEqual(found);
    expect(without(drawn, found[0]?.id ?? "").map((t) => t.id)).toEqual([found[1]?.id, id]);
  });

  it("gives each frame drawn a key of its own, after one removed", () => {
    const a = withDrawn([], { ymin: 0, xmin: 0, ymax: 100, xmax: 100 });
    const b = withDrawn(a, { ymin: 200, xmin: 0, ymax: 300, xmax: 100 });
    const c = withDrawn(without(b, a[0]?.id ?? ""), { ymin: 400, xmin: 0, ymax: 500, xmax: 100 });
    expect(new Set(c.map((t) => t.id)).size).toBe(2);
  });

  it("never gives a frame drawn the key of a task begun, its frame removed", () => {
    const a = withDrawn([], { ymin: 0, xmin: 0, ymax: 100, xmax: 100 });
    const begun = a.map((t) => t.id);
    const b = withDrawn(
      without(a, a[0]?.id ?? ""),
      { ymin: 200, xmin: 0, ymax: 300, xmax: 100 },
      begun,
    );
    expect(b.map((t) => t.id)).not.toContain(a[0]?.id);
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

describe("a request about the page", () => {
  it("goes trimmed, its control characters spaces, at most MAX_REQUEST code points", () => {
    expect(requestOf("  only the\nfirst column\u0085 ")).toBe("only the first column");
    expect(requestOf(" \t\n")).toBeUndefined();
    const long = requestOf(`${"я".repeat(MAX_REQUEST - 1)}😀😀`);
    expect([...(long ?? "")]).toHaveLength(MAX_REQUEST);
  });

  it("carries the frames found and drawn, each in the order of the page", () => {
    const found = foundTasks(answer([box(500, 0, 600, 400), box(100, 0, 200, 400)]));
    const tasks = withDrawn(withDrawn(found, { ymin: 700, xmin: 0, ymax: 800, xmax: 400 }), {
      ymin: 0,
      xmin: 500,
      ymax: 90,
      xmax: 900,
    });
    const frames = framesOf(tasks);
    expect(frames.found.map((f) => f.ymin)).toEqual([100, 500]);
    expect(frames.drawn.map((f) => f.ymin)).toEqual([0, 700]);
  });

  it("puts its frames in the place of those found, each a key of its own, the learner's own staying", () => {
    const before = withDrawn(foundTasks(answer([box(0, 0, 1000, 1000)])), {
      ymin: 10,
      xmin: 10,
      ymax: 90,
      xmax: 90,
    });
    const found = foundTasks(answer([box(100, 0, 200, 250), box(300, 0, 400, 250)]));
    const after = asked(before, found, "k");
    expect(after.filter((t) => !t.drawn).map((t) => t.frame.ymin)).toEqual([100, 300]);
    expect(after.filter((t) => t.drawn)).toEqual(before.filter((t) => t.drawn));
    expect(new Set([...before, ...after].map((t) => t.id)).size).toBe(4);
    expect(asked(before, [], "k")).toBe(before);
  });
});

describe("a page of the history", () => {
  const frame = (ymin: number) => ({ ymin, xmin: 0, ymax: ymin + 50, xmax: 400 });

  it("picks the frames whose tasks were begun, and lists a task whose frame was removed", () => {
    const frames = [
      { id: "found-1", frame: frame(100), drawn: false },
      { id: "found-2", frame: frame(200), drawn: false },
    ];
    const begun = [
      { taskId: "found-1", frame: frame(100), drawn: false },
      { taskId: "drawn-1", frame: frame(300), drawn: true },
    ];
    expect(keptTasks(frames, begun)).toEqual([
      { id: "found-1", frame: frame(100), drawn: false, picked: true },
      { id: "found-2", frame: frame(200), drawn: false, picked: false },
      { id: "drawn-1", frame: frame(300), drawn: true, picked: true },
    ]);
  });
});

describe("the page on its photo turned upright", () => {
  // A photo 1000 × 2000 px turned 90° clockwise is 2000 × 1000 px.
  const photo = { width: 1000, height: 2000, url: "before" };
  const turned = { width: 2000, height: 1000, url: "turned" };
  const drawn = withDrawn([], { ymin: 200, xmin: 100, ymax: 300, xmax: 400 });
  const page = { photo, tasks: drawn, before: drawn, talk: [] as const };

  it("takes the turned photo, the frames on it before turned with it", () => {
    const upright = uprightPage(page, photo, turned, 90);
    expect(upright?.photo).toBe(turned);
    const frame = { ymin: 100, xmin: 700, ymax: 400, xmax: 800 };
    expect(upright?.tasks).toEqual([{ ...drawn[0], frame }]);
    expect(upright?.before).toEqual([{ ...drawn[0], frame }]);
    expect(upright?.talk).toBe(page.talk);
  });

  it("keeps the frames as they are with no turn", () => {
    expect(uprightPage(page, photo, photo, 0)?.tasks).toEqual(drawn);
    expect(uprightPage({ photo, tasks: [] }, photo, turned, 90)).toEqual({
      photo: turned,
      tasks: [],
    });
  });

  it("is none for an answer about a photo the page no longer holds", () => {
    const other = { width: 1000, height: 2000, url: "other" };
    expect(uprightPage({ ...page, photo: other }, photo, turned, 90)).toBeUndefined();
    expect(uprightPage(undefined, photo, turned, 90)).toBeUndefined();
  });

  it("turns the instruction of a frame with it, and drops one the turn leaves off the photo", () => {
    const [task] = drawn;
    if (task === undefined) throw new Error("no task");
    const instruction = { ymin: 100, xmin: 100, ymax: 190, xmax: 400 };
    expect(turnedTasks([{ ...task, instruction }], 90, photo, turned)).toEqual([
      {
        ...task,
        frame: { ymin: 100, xmin: 700, ymax: 400, xmax: 800 },
        instruction: { ymin: 100, xmin: 810, ymax: 400, xmax: 900 },
      },
    ]);
    // Turned off the photo, the instruction goes, and its task stays.
    const corner = { ymin: 0, xmin: 0, ymax: 1, xmax: 1 };
    const [left] = turnedTasks([{ ...task, instruction: corner }], 45, photo, photo);
    expect(left?.frame).toEqual({ ymin: 146, xmin: 500, ymax: 324, xmax: 854 });
    expect(left).not.toHaveProperty("instruction");
  });

  it("puts the frames found on the photo turned back on the photo as it is", () => {
    const found = foundTasks(answer([box(100, 700, 400, 800)]));
    expect(unturned(found, 90, photo).map((t) => t.frame)).toEqual([
      { ymin: 200, xmin: 100, ymax: 300, xmax: 400 },
    ]);
    expect(turnedTasks(found, 0, photo, photo)).toEqual(found);
  });
});
