// The tasks begun on a page on the screen of solving (R71): what Start begins once more, the list in
// the order of the page and its tasks left out, ‹ and ›, the work each keeps, and what a Check came to.
import {
  type ItemVerdict,
  ItemVerdictSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { HistoryEvent } from "@altnovatrail/spec/canvas";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { WORDS } from "../i18n/words.ts";
import type { Frame } from "./frame.ts";
import type { PageTask } from "./page.ts";
import {
  type BegunTask,
  besideTask,
  changed,
  checkOver,
  notBegun,
  onList,
  paperCard,
  paperVerdictOf,
  shownTask,
  withBegun,
  withChange,
} from "./solve.ts";

const frame = (ymin: number): Frame => ({ ymin, xmin: 0, ymax: ymin + 50, xmax: 400 });

const page = (...picks: boolean[]): readonly PageTask[] =>
  picks.map((picked, i) => ({
    id: `found-${i + 1}`,
    frame: frame(100 * (i + 1)),
    drawn: false,
    picked,
  }));

const begun = (n: number): BegunTask => ({
  attemptId: `a${n}`,
  taskId: `found-${n}`,
  frame: frame(100 * n),
  drawn: false,
  crop: new Blob([String(n)]),
  history: [],
});

const write = (t: number): HistoryEvent => ({
  kind: "write",
  t,
  stroke: { id: t, kind: "pen", points: [{ x: 1, y: 1, t, p: 0.5 }] },
});

describe("Start once more", () => {
  it("begins the tasks picked that no attempt holds, and none begun before", () => {
    const tasks = page(true, true, false);
    expect(notBegun(tasks, undefined).map((task) => task.id)).toEqual(["found-1", "found-2"]);
    expect(notBegun(tasks, [begun(1)]).map((task) => task.id)).toEqual(["found-2"]);
    expect(notBegun(tasks, [begun(1), begun(2)])).toEqual([]);
  });

  it("begins a frame resized since anew, in place of its task begun before", () => {
    const tasks = page(true);
    const resized = { ...begun(1), frame: { ...frame(100), xmax: 300 } };
    expect(notBegun(tasks, [resized]).map((task) => task.id)).toEqual(["found-1"]);
    const again = { ...begun(1), attemptId: "a9" };
    expect(withBegun([resized, begun(2)], [again]).map((task) => task.attemptId)).toEqual([
      "a9",
      "a2",
    ]);
  });

  it("puts the tasks begun now beside those before, in the order of the page", () => {
    expect(withBegun([begun(3), begun(1)], [begun(2)]).map((task) => task.attemptId)).toEqual([
      "a1",
      "a2",
      "a3",
    ]);
    expect(withBegun(undefined, [begun(1)])).toHaveLength(1);
  });
});

describe("the list of the tasks begun", () => {
  const all = [begun(1), begun(2), begun(3)];

  it("holds those picked on the page, and a task left out comes back with its work", () => {
    expect(onList(all, page(true, false, true)).map((task) => task.attemptId)).toEqual([
      "a1",
      "a3",
    ]);
    expect(onList(all, page(true, true, true))).toEqual(all);
  });

  it("shows the task asked for while it is on the list, or the first", () => {
    expect(shownTask(all, "a2")?.attemptId).toBe("a2");
    expect(shownTask(all.slice(0, 1), "a2")?.attemptId).toBe("a1");
    expect(shownTask(all, undefined)?.attemptId).toBe("a1");
    expect(shownTask([], "a1")).toBeUndefined();
  });

  it("goes to the task before and after, and not past either end", () => {
    expect(besideTask(all, "a2", -1)?.attemptId).toBe("a1");
    expect(besideTask(all, "a2", 1)?.attemptId).toBe("a3");
    expect(besideTask(all, "a1", -1)).toBeUndefined();
    expect(besideTask(all, "a3", 1)).toBeUndefined();
    expect(besideTask(all, "a9", 1)).toBeUndefined();
  });
});

describe("the work of each task", () => {
  it("adds what a historychange tells, and takes the whole history when one was missed", () => {
    const whole = [write(1), write(2), write(3)];
    expect(withChange([write(1)], { from: 1, events: [write(2)] }, () => whole)).toEqual([
      write(1),
      write(2),
    ]);
    expect(withChange([write(1)], { from: 2, events: [write(3)] }, () => whole)).toBe(whole);
  });

  it("changes the task of its attempt alone", () => {
    const tracing = { at: [100, 200] as const, hidden: true };
    const after = changed([begun(1), begun(2)], "a2", (task) => ({ ...task, tracing }));
    expect(after[0]?.tracing).toBeUndefined();
    expect(after[1]?.tracing).toBe(tracing);
  });
});

describe("what a Check of a task from paper came to", () => {
  const slot = (verdict: string, read: { value?: string; reason?: string } = {}): ItemVerdict[] => [
    create(ItemVerdictSchema, {
      verdict,
      answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict, ...read }],
    }),
  ];
  const en = WORDS.en;

  it("is the verdict of the one answer slot, with what was read", () => {
    const right = paperVerdictOf(slot("correct", { value: "85" }), undefined);
    expect(right).toEqual({ kind: "correct", read: "85" });
    expect(paperCard(right, en)).toEqual({ kind: "correct", title: "Correct", line: "Read: 85" });
    const wrong = paperVerdictOf(slot("not_yet", { value: "84" }), undefined);
    expect(paperCard(wrong, en)).toEqual({ kind: "not-yet", title: "Not yet", line: "Read: 84" });
    expect(paperCard({ kind: "not-yet", read: undefined }, en).line).toBeUndefined();
  });

  it("says why a work was not read, in the words of paper for no final answer and several", () => {
    const card = (reason: string) =>
      paperCard(paperVerdictOf(slot("unreadable", { reason }), undefined), en);
    expect(card("no_final_answer")).toEqual({
      kind: "write",
      title: "No answer found",
      line: "Write your answer, or circle one option, then Check.",
    });
    expect(card("several_final_answers").title).toBe("More than one answer");
    expect(card("illegible")).toEqual({
      kind: "write",
      title: "Can't read this",
      line: "It can't be made out",
    });
  });

  it("is no key with CAUSE_NO_KEY, and not checked with any other outcome or none", () => {
    const noKey = paperVerdictOf(slot("unchecked"), { cause: Cause.NO_KEY });
    expect(paperCard(noKey, en)).toEqual({
      kind: "nokey",
      title: "Couldn't check this one",
      line: "This task has no answer that can be checked. Hints still work.",
    });
    const failed = paperVerdictOf(slot("unchecked"), { cause: Cause.AI_FAILURE });
    expect(paperCard(failed, en).title).toBe("Not checked");
    expect(paperCard(failed, en).line).not.toBeUndefined();
    expect(paperCard(paperVerdictOf([], undefined), en)).toEqual({
      kind: "write",
      title: "Not checked",
      line: undefined,
    });
    expect(paperVerdictOf(slot("a verdict the build knows not"), undefined).kind).toBe("unchecked");
  });

  it("is over once the task is solved or has no key", () => {
    expect(checkOver(begun(1))).toBe(false);
    expect(checkOver({ ...begun(1), verdict: { kind: "correct", read: "85" } })).toBe(true);
    expect(checkOver({ ...begun(1), verdict: { kind: "nokey" } })).toBe(true);
    expect(checkOver({ ...begun(1), verdict: { kind: "not-yet", read: "84" } })).toBe(false);
  });
});
