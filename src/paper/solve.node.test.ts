// The tasks begun on a page on the screen of solving: what Start begins once more, the list in
// the order of the page and its tasks left out, ‹ and ›, the work each keeps, what a Check came to,
// the buttons of the tutor's panel, and the tutor's wavy line.
import {
  type ItemVerdict,
  ItemVerdictSchema,
  MarkKind,
  MarkSchema,
  TutorReply,
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
  checkReply,
  notBegun,
  onList,
  paperCard,
  paperVerdictOf,
  shownTask,
  taskState,
  tutorActs,
  verdictMarks,
  viewOnly,
  wavyOf,
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

  it("gives each task its state by its last Check", () => {
    const parts = { read: undefined, parts: [] };
    expect(taskState({})).toBe("to-do");
    expect(taskState({ solved: true })).toBe("solved");
    expect(taskState({ verdict: { kind: "correct", ...parts } })).toBe("solved");
    expect(taskState({ verdict: { kind: "not-yet", ...parts } })).toBe("not-yet");
    expect(taskState({ verdict: { kind: "so-far", ...parts } })).toBe("so-far");
    expect(taskState({ verdict: { kind: "nokey" } })).toBe("no-key");
    expect(taskState({ verdict: { kind: "unchecked", outcome: undefined } })).toBe("to-do");
    expect(taskState({ verdict: { kind: "unreadable", reason: "" } })).toBe("to-do");
    expect(taskState({ over: true })).toBe("closed");
    expect(taskState({ over: true, solved: true })).toBe("solved");
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
    const right = paperVerdictOf(slot("correct", { value: "85" }), undefined, true);
    expect(right).toEqual({ kind: "correct", read: "85", parts: [{ verdict: "correct" }] });
    expect(paperCard(right, en)).toEqual({ kind: "correct", title: "Correct", line: "Read: 85" });
    const wrong = paperVerdictOf(slot("not_yet", { value: "84" }), undefined, false);
    expect(paperCard(wrong, en)).toEqual({ kind: "not-yet", title: "Not yet", line: "Read: 84" });
    expect(paperCard({ kind: "not-yet", read: undefined, parts: [] }, en).line).toBeUndefined();
  });

  /** The items of a frame of several tasks: each verdict, with its value and its box. */
  const items = (...verdicts: string[]): ItemVerdict[] =>
    verdicts.map((verdict, n) =>
      create(ItemVerdictSchema, {
        verdict,
        answerSlots: [
          {
            answerSlot: { item: n + 1, slot: 1 },
            verdict,
            ...(verdict === "correct" || verdict === "not_yet"
              ? {
                  value: "85",
                  cropBox: { ymin: n * 250, xmin: 600, ymax: n * 250 + 200, xmax: 900 },
                }
              : {}),
          },
        ],
      }),
    );

  it("of several tasks is each task's, correct when each with a key is, with the count", () => {
    const all = paperVerdictOf(items("correct", "correct", "unchecked"), undefined, true);
    expect(all.kind).toBe("correct");
    expect(paperCard(all, en)).toEqual({
      kind: "correct",
      title: "Correct · 2 of 2",
      line: undefined,
    });
    const some = paperVerdictOf(
      items("correct", "not_yet", "unreadable", "correct"),
      undefined,
      false,
    );
    expect(some).toEqual({
      kind: "not-yet",
      read: undefined,
      parts: [
        { verdict: "correct", box: [0, 600, 200, 900] },
        { verdict: "not-yet", box: [250, 600, 450, 900] },
        { verdict: "unreadable" },
        { verdict: "correct", box: [750, 600, 950, 900] },
      ],
    });
    expect(paperCard(some, en)).toEqual({
      kind: "not-yet",
      title: "Not yet · 2 of 4 correct",
      line: "No answer was read in tasks 3",
    });
    expect(paperCard(some, WORDS.ru).title).toBe("Пока нет · верно 2 из 4");
    // A task with a key that api could not judge keeps the attempt open, though none is wrong.
    expect(paperVerdictOf(items("correct", "unchecked"), undefined, false).kind).toBe("not-yet");
    // No answer read of any task: why, as of one task.
    expect(paperVerdictOf(items("unreadable", "unchecked"), undefined, false).kind).toBe(
      "unreadable",
    );
    // The repeat of the Check that solved it: api erased its verdicts with the close.
    expect(paperVerdictOf([], undefined, true)).toEqual({
      kind: "correct",
      read: undefined,
      parts: [],
    });
    expect(paperVerdictOf([], undefined, false).kind).toBe("unchecked");
  });

  it("takes a task that is over, as a page of the history keeps it, only to be looked at", () => {
    const over = { ...begun(1), over: true };
    expect(checkOver(over)).toBe(true);
    expect(viewOnly(over)).toBe(true);
    // Solved in this tab: its card stands, and so does the work under it.
    const solved = { ...over, verdict: { kind: "correct", read: undefined, parts: [] } } as const;
    expect(viewOnly(solved)).toBe(false);
    expect(checkOver(begun(1))).toBe(false);
    expect(viewOnly(begun(1))).toBe(false);
  });

  it("puts a tick or a cross by each answer whose place was read, on the context of its Check", () => {
    const checked = {
      crop: {},
      groups: [],
      tracing: { at: [0, 0], hidden: false },
      digest: "0",
    } as never;
    const verdict = paperVerdictOf(items("correct", "not_yet", "unreadable"), undefined, false);
    expect(verdictMarks({ verdict, checked }, en)).toEqual({
      submission: checked,
      marks: [
        {
          kind: "verdict",
          at: { box: [0, 600, 200, 900] },
          correct: true,
          name: "Task 1: correct",
        },
        {
          kind: "verdict",
          at: { box: [250, 600, 450, 900] },
          correct: false,
          name: "Task 2: not yet",
        },
      ],
    });
    expect(verdictMarks({ verdict }, en)).toBeUndefined();
    expect(verdictMarks({ verdict: { kind: "nokey" }, checked }, en)).toBeUndefined();
    const none = paperVerdictOf(slot("correct", { value: "85" }), undefined, true);
    expect(verdictMarks({ verdict: none, checked }, en)).toBeUndefined();
  });

  it("draws the tutor's wavy line beside the ticks and crosses of a Check that is not yet", () => {
    const checked = {
      crop: {},
      groups: [],
      tracing: { at: [0, 0], hidden: false },
      digest: "0",
    } as never;
    const box = { ymin: 600, xmin: 0, ymax: 700, xmax: 400 };
    const wavy = wavyOf([
      create(MarkSchema, { kind: MarkKind.FRAME, place: { case: "cropBox", value: box } }),
      create(MarkSchema, { kind: MarkKind.WAVY_LINE, place: { case: "cropBox", value: box } }),
    ]);
    expect(wavy).toEqual([600, 0, 700, 400]);
    expect(wavyOf([create(MarkSchema, { kind: MarkKind.FRAME })])).toBeUndefined();
    const notYet = paperVerdictOf(items("not_yet"), undefined, false);
    expect(verdictMarks({ verdict: notYet, checked }, en, wavy)?.marks.at(-1)).toEqual({
      kind: "wavy_line",
      at: { box: [600, 0, 700, 400] },
      name: "Tutor's mark: where the mistake is",
    });
    // A Check that was correct has no mistake to underline, and one with no place no tick either.
    const correct = paperVerdictOf(items("correct"), undefined, true);
    expect(verdictMarks({ verdict: correct, checked }, en, wavy)?.marks).toHaveLength(1);
    const unplaced = paperVerdictOf(slot("not_yet", { value: "85" }), undefined, false);
    expect(verdictMarks({ verdict: unplaced, checked }, en, wavy)?.marks).toEqual([
      {
        kind: "wavy_line",
        at: { box: [600, 0, 700, 400] },
        name: "Tutor's mark: where the mistake is",
      },
    ]);
  });

  it("says why a work was not read, in the words of paper for no final answer and several", () => {
    const card = (reason: string) =>
      paperCard(paperVerdictOf(slot("unreadable", { reason }), undefined, false), en);
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
    const noKey = paperVerdictOf(slot("unchecked"), { cause: Cause.NO_KEY }, false);
    expect(paperCard(noKey, en)).toEqual({
      kind: "nokey",
      title: "Couldn't check this one",
      line: "No solution could be read here. Write it out, then Check again. Hints still work.",
    });
    const failed = paperVerdictOf(slot("unchecked"), { cause: Cause.AI_FAILURE }, false);
    expect(paperCard(failed, en).title).toBe("Not checked");
    expect(paperCard(failed, en).line).not.toBeUndefined();
    expect(paperCard(paperVerdictOf([], undefined, false), en)).toEqual({
      kind: "write",
      title: "Not checked",
      line: undefined,
    });
    expect(paperVerdictOf(slot("a verdict the build knows not"), undefined, false).kind).toBe(
      "unchecked",
    );
  });

  it("is over once the task is solved, and open to a Check again after one that read nothing", () => {
    expect(checkOver(begun(1))).toBe(false);
    expect(checkOver({ ...begun(1), verdict: { kind: "correct", read: "85", parts: [] } })).toBe(
      true,
    );
    expect(checkOver({ ...begun(1), verdict: { kind: "nokey" } })).toBe(false);
    expect(checkOver({ ...begun(1), verdict: { kind: "so-far", read: "3", parts: [] } })).toBe(
      false,
    );
    expect(checkOver({ ...begun(1), verdict: { kind: "not-yet", read: "84", parts: [] } })).toBe(
      false,
    );
  });
});

describe("a task with no answer yet and no mistake", () => {
  const en = WORDS.en;
  const items = (...verdicts: string[]): ItemVerdict[] =>
    verdicts.map((verdict, n) =>
      create(ItemVerdictSchema, {
        verdict,
        answerSlots: [
          {
            answerSlot: { item: n + 1, slot: 1 },
            verdict,
            value: "3 + 4",
            ...(verdict === "correct" || verdict === "not_yet"
              ? { cropBox: { ymin: n * 250, xmin: 600, ymax: n * 250 + 200, xmax: 900 } }
              : {}),
          },
        ],
      }),
    );
  const checked = {
    crop: {},
    groups: [],
    tracing: { at: [0, 0], hidden: false },
    digest: "0",
  } as never;

  it("is so far correct, a quiet card with no mark, in both languages", () => {
    const one = paperVerdictOf(items("so_far_correct"), undefined, false);
    expect(one).toEqual({ kind: "so-far", read: "3 + 4", parts: [{ verdict: "so-far" }] });
    expect(paperCard(one, en)).toEqual({
      kind: "so-far",
      title: "So far correct",
      line: "No mistake yet. Go on to the answer, then Check.",
    });
    expect(paperCard(one, WORDS.ru).title).toBe("Пока верно");
    expect(verdictMarks({ verdict: one, checked }, en)).toBeUndefined();
  });

  it("gives way to a task not yet, and counts the frame's tasks correct beside it", () => {
    expect(paperVerdictOf(items("so_far_correct", "not_yet"), undefined, false).kind).toBe(
      "not-yet",
    );
    const mixed = paperVerdictOf(
      items("correct", "so_far_correct", "unreadable"),
      undefined,
      false,
    );
    expect(mixed.kind).toBe("so-far");
    expect(paperCard(mixed, en)).toEqual({
      kind: "so-far",
      title: "So far correct · 1 of 3 done",
      line: "No answer was read in tasks 3",
    });
    expect(paperCard(mixed, WORDS.ru).title).toBe("Пока верно · готово 1 из 3");
    // The tick of the task correct stands; the one so far correct has none.
    expect(verdictMarks({ verdict: mixed, checked }, en)?.marks).toEqual([
      { kind: "verdict", at: { box: [0, 600, 200, 900] }, correct: true, name: "Task 1: correct" },
    ]);
    // A wavy line underlines a mistake alone.
    expect(verdictMarks({ verdict: mixed, checked }, en, [0, 0, 10, 10])?.marks).toHaveLength(1);
  });

  it("is the reply a report names the Check's words by", () => {
    const correct = { kind: "correct", read: undefined, parts: [] } as const;
    const notYet = { kind: "not-yet", read: undefined, parts: [] } as const;
    const soFar = { kind: "so-far", read: undefined, parts: [] } as const;
    expect(checkReply(correct, 2)).toEqual({ reply: TutorReply.CORRECT_ANSWER, rung: 0 });
    expect(checkReply(notYet, 1)).toEqual({ reply: TutorReply.RUNG, rung: 1 });
    expect(checkReply(notYet, 5)).toEqual({ reply: TutorReply.RUNG, rung: 3 });
    expect(checkReply(soFar, 0)).toEqual({ reply: TutorReply.OPENING, rung: 0 });
    expect(checkReply({ kind: "nokey" }, 0)).toEqual({ reply: TutorReply.OPENING, rung: 0 });
  });
});

describe("the buttons of the tutor's panel", () => {
  it("gives Hint till the task is solved, and the next task once its Check is over", () => {
    expect(tutorActs({})).toEqual({ hint: true, next: false });
    expect(tutorActs({ verdict: { kind: "not-yet", read: "84", parts: [] } })).toEqual({
      hint: true,
      next: false,
    });
    expect(tutorActs({ verdict: { kind: "unreadable", reason: "illegible" } })).toEqual({
      hint: true,
      next: false,
    });
    const solved = { verdict: { kind: "correct", read: "85", parts: [] } } as const;
    expect(tutorActs(solved)).toEqual({ hint: false, next: true });
    // Solved in this tab, it stays so once its attempt is over.
    expect(tutorActs({ ...solved, over: true })).toEqual({ hint: false, next: true });
    // A Check that read nothing keeps the hints.
    expect(tutorActs({ verdict: { kind: "nokey" } })).toEqual({ hint: true, next: true });
    expect(tutorActs({ verdict: { kind: "so-far", read: "3", parts: [] } })).toEqual({
      hint: true,
      next: false,
    });
  });

  it("gives neither on a task only to be looked at, whose attempt is over", () => {
    expect(tutorActs({ over: true })).toEqual({ hint: false, next: false });
  });
});
