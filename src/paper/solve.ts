// The tasks begun on a photographed page as the screen of solving holds them (R71): each its own
// sheet under its crop, the tracing paper, in the order of the page; those the learner left out on
// the page again are not on the list, and come back with their work when picked once more. "Add"
// goes back to the page, and Start then begins only the tasks not begun yet. A Check gives the verdict
// of the task's one answer slot by its key, or none when it has no key (R162 spec). No DOM.
import type { ItemVerdict } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { HistoryChange, HistoryEvent, TracingState } from "@altnovatrail/spec/canvas";
import type { ReadOutcome } from "../api/outcome.ts";
import { outcomeText } from "../api/words.ts";
import type { Words } from "../i18n/words.ts";
import { reasonKey, verdictKey } from "../task/attempt.ts";
import { type Frame, pageOrder } from "./frame.ts";
import { type PageTask, picked } from "./page.ts";

/** A task begun: its attempt, the page's task it began from, its crop, and its work so far. */
export interface BegunTask {
  readonly attemptId: string;
  /** The page's task it began from: picking it again goes back to this attempt. */
  readonly taskId: string;
  readonly frame: Frame;
  /** The learner drew its frame. */
  readonly drawn: boolean;
  readonly crop: Blob;
  /** The history of writing on its sheet and on its tracing paper, in the tab's memory. */
  readonly history: readonly HistoryEvent[];
  /** Where its tracing paper lies and whether it is hidden; none till the learner moves it. */
  readonly tracing?: TracingState;
  /** What its last Check came to, in the tab's memory: the card shown when the task is again. */
  readonly verdict?: PaperVerdict;
}

/**
 * The tasks picked on the page that no attempt holds yet, by the frame it was begun with: those
 * Start begins. A frame drawn and resized since is begun anew, with its new crop.
 */
export function notBegun(
  tasks: readonly PageTask[],
  begun: readonly BegunTask[] | undefined,
): readonly PageTask[] {
  const held = new Map(begun?.map((task) => [task.taskId, task.frame]));
  return picked(tasks).filter((task) => !sameFrame(held.get(task.id), task.frame));
}

function sameFrame(a: Frame | undefined, b: Frame): boolean {
  return (
    a !== undefined &&
    a.ymin === b.ymin &&
    a.xmin === b.xmin &&
    a.ymax === b.ymax &&
    a.xmax === b.xmax
  );
}

/**
 * The tasks begun before and those begun now, in the order of the page: one begun anew takes the
 * place of its task's before.
 */
export function withBegun(
  before: readonly BegunTask[] | undefined,
  added: readonly BegunTask[],
): readonly BegunTask[] {
  const anew = new Set(added.map((task) => task.taskId));
  return [...(before ?? []).filter((task) => !anew.has(task.taskId)), ...added].sort((a, b) =>
    pageOrder(a.frame, b.frame),
  );
}

/** The tasks begun that are picked on the page: the list of the screen, in the order of the page. */
export function onList(
  begun: readonly BegunTask[],
  tasks: readonly PageTask[],
): readonly BegunTask[] {
  const chosen = new Set(picked(tasks).map((task) => task.id));
  return begun.filter((task) => chosen.has(task.taskId));
}

/**
 * The task shown: the one asked for while it is on the list, or else the first. None with an empty
 * list.
 */
export function shownTask(
  list: readonly BegunTask[],
  asked: string | undefined,
): BegunTask | undefined {
  return list.find((task) => task.attemptId === asked) ?? list[0];
}

/** The task before or after the one shown, ‹ and ›: none at either end, as the list does not wrap. */
export function besideTask(
  list: readonly BegunTask[],
  attemptId: string,
  by: -1 | 1,
): BegunTask | undefined {
  const at = list.findIndex((task) => task.attemptId === attemptId);
  return at < 0 ? undefined : list[at + by];
}

/**
 * A task's history with what a `historychange` told: the events added where it says. A history
 * whose length is not `from` has missed events, and the element's whole history takes its place.
 */
export function withChange(
  history: readonly HistoryEvent[],
  change: HistoryChange,
  whole: () => readonly HistoryEvent[],
): readonly HistoryEvent[] {
  return history.length === change.from ? [...history, ...change.events] : whole();
}

/** A task begun, changed by its attempt; the others as they were. */
export function changed(
  begun: readonly BegunTask[],
  attemptId: string,
  change: (task: BegunTask) => BegunTask,
): readonly BegunTask[] {
  return begun.map((task) => (task.attemptId === attemptId ? change(task) : task));
}

/**
 * What a Check of a task from paper came to, as its card shows it (R162 spec): its one answer slot
 * correct or not yet, with what was read; not read, with why; not checked, with the outcome of the
 * call that left it so; or no key, when the task has no one answer a program can compare.
 */
export type PaperVerdict =
  | { readonly kind: "correct" | "not-yet"; readonly read: string | undefined }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "unchecked"; readonly outcome: ReadOutcome | undefined }
  | { readonly kind: "nokey" };

/** The verdict of an answer to a Check of a task from paper; a verdict the build knows not is none. */
export function paperVerdictOf(
  items: readonly ItemVerdict[],
  outcome: ReadOutcome | undefined,
): PaperVerdict {
  if (outcome?.cause === Cause.NO_KEY) return { kind: "nokey" };
  const slot = items[0]?.answerSlots[0];
  switch (slot?.verdict) {
    case "correct":
      return { kind: "correct", read: slot.value };
    case "not_yet":
      return { kind: "not-yet", read: slot.value };
    case "unreadable":
      return { kind: "unreadable", reason: slot.reason };
  }
  return { kind: "unchecked", outcome };
}

/**
 * Whether a task's Check is over: it is solved, and its attempt closed, or it has no key, which a
 * Check again would not find.
 */
export function checkOver(task: BegunTask): boolean {
  return task.verdict?.kind === "correct" || task.verdict?.kind === "nokey";
}

/** The words of each reason a work on paper was not read for that are its own (R162 spec). */
const PAPER_REASONS: Readonly<Record<string, "paper.no-answer" | "paper.several">> = {
  no_final_answer: "paper.no-answer",
  several_final_answers: "paper.several",
};

/**
 * A verdict's card: its kind, title and line. "Read: …" under a value read; under a work not read,
 * why, in the words of paper for no final answer and more than one; under one not checked, the
 * outcome's words.
 */
export function paperCard(
  verdict: PaperVerdict,
  words: Words,
): { kind: "correct" | "not-yet" | "write" | "nokey"; title: string; line: string | undefined } {
  switch (verdict.kind) {
    case "correct":
    case "not-yet":
      return {
        kind: verdict.kind,
        title: words.text(verdict.kind === "correct" ? "task.correct" : "task.not-yet"),
        line:
          verdict.read === undefined ? undefined : words.text("task.read", { text: verdict.read }),
      };
    case "unreadable": {
      const own = PAPER_REASONS[verdict.reason];
      if (own !== undefined)
        return { kind: "write", title: words.text(own), line: words.text(`${own}-line`) };
      return {
        kind: "write",
        title: words.text(verdictKey("unreadable")),
        line: words.text(reasonKey(verdict.reason)),
      };
    }
    case "nokey":
      return {
        kind: "nokey",
        title: words.text("paper.no-key"),
        line: words.text("paper.no-key-line"),
      };
  }
  return {
    kind: "write",
    title: words.text(verdictKey("unchecked")),
    line: verdict.outcome === undefined ? undefined : outcomeText(verdict.outcome, words),
  };
}
