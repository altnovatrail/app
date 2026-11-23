// The tasks begun on a photographed page as the screen of solving holds them: each its own
// sheet under its crop, the tracing paper, in the order of the page; those the learner left out on
// the page again are not on the list, and come back with their work when picked once more. "Add"
// goes back to the page, and Start then begins only the tasks not begun yet. A frame may hold several
// tasks, up to 20, each with an answer of its own: a Check gives the verdict of each task's answer
// slot by its key, and a tick or a cross by each answer on the crop of the work; none when no task
// has a key; after Not yet, in the mode "Show where", the tutor's wavy line under the
// first mistake. No DOM.
import {
  type AnswerSlotVerdict,
  type Mark as ContractMark,
  type ItemVerdict,
  MarkKind,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type {
  HistoryChange,
  HistoryEvent,
  Marks,
  PaperSubmission,
  TracingState,
  VerdictMark,
  WavyLineMark,
} from "@altnovatrail/spec/canvas";
import type { ReadOutcome } from "../api/outcome.ts";
import { outcomeText } from "../api/words.ts";
import type { Words } from "../i18n/words.ts";
import type { PaperSent } from "../storage/profile.ts";
import { reasonKey, verdictKey } from "../task/attempt.ts";
import { type Frame, pageOrder, sameFrame } from "./frame.ts";
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
  /** The history of writing on its sheet and on its tracing paper. */
  readonly history: readonly HistoryEvent[];
  /** Where its tracing paper lies and whether it is hidden; none till the learner moves it. */
  readonly tracing?: TracingState;
  /** What its last Check came to, in the tab's memory: the card shown when the task is again. */
  readonly verdict?: PaperVerdict;
  /** The context of the work of that Check, which the element gave: its ticks and crosses stand on it. */
  readonly checked?: PaperSubmission;
  /** The wrong answers of the attempt by the answer to its last Check: "Explain differently" names them. */
  readonly wrongAnswers?: number;
  /** Each Check that was answered: the context of its work and the history's length at its press. */
  readonly sent?: readonly PaperSent[];
  /** Its attempt is over — solved, or closed by api —, which a page of the history keeps. */
  readonly over?: boolean;
  /** Its Check came to Correct, here or in a tab before: the list marks it, which the page keeps. */
  readonly solved?: true;
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
 * One task of a frame as a Check judged it: the verdict of its answer slot, and where
 * its answer was read on the crop of the work, [ymin, xmin, ymax, xmax] in thousandths, when the
 * reading gave a value.
 */
export interface PaperPart {
  readonly verdict: "correct" | "not-yet" | "unreadable" | "unchecked";
  readonly box?: readonly [number, number, number, number];
}

/**
 * What a Check of a task from paper came to, as its card shows it: correct when every
 * task of the frame that has a key is, or not yet, with what was read of a frame of one task and
 * each task's part; not read, with why, when no answer was; not checked, with the outcome of the
 * call that left it so; or no key, when no task has one answer a program can compare.
 */
export type PaperVerdict =
  | {
      readonly kind: "correct" | "not-yet";
      readonly read: string | undefined;
      readonly parts: readonly PaperPart[];
    }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "unchecked"; readonly outcome: ReadOutcome | undefined }
  | { readonly kind: "nokey" };

/**
 * The verdict of an answer to a Check of a task from paper, by each task's item, in the order of the
 * frame; a verdict the build knows not is none. A task with no key is unchecked and counts for
 * neither. Correct is whether api closed the attempt solved: a task with a key whose answer it could
 * not judge keeps it open, though no other is wrong. A repeat of the Check that solved it holds no
 * verdict of a task, which api erased with the close: it is correct all the same.
 */
export function paperVerdictOf(
  items: readonly ItemVerdict[],
  outcome: ReadOutcome | undefined,
  solved: boolean,
): PaperVerdict {
  if (outcome?.cause === Cause.NO_KEY) return { kind: "nokey" };
  if (solved && items.length === 0) return { kind: "correct", read: undefined, parts: [] };
  const slots = items.map((item) => item.answerSlots[0]);
  const parts = slots.map(partOf);
  if (parts.some(({ verdict }) => verdict === "correct" || verdict === "not-yet")) {
    return {
      kind: solved ? "correct" : "not-yet",
      read: slots.length === 1 ? slots[0]?.value : undefined,
      parts,
    };
  }
  const unread = slots.find((slot) => slot?.verdict === "unreadable");
  if (unread !== undefined) return { kind: "unreadable", reason: unread.reason };
  return { kind: "unchecked", outcome };
}

function partOf(slot: AnswerSlotVerdict | undefined): PaperPart {
  const verdict =
    slot?.verdict === "correct"
      ? "correct"
      : slot?.verdict === "not_yet"
        ? "not-yet"
        : slot?.verdict === "unreadable"
          ? "unreadable"
          : "unchecked";
  const box = slot?.cropBox;
  if (box === undefined || (verdict !== "correct" && verdict !== "not-yet")) return { verdict };
  return { verdict, box: [box.ymin, box.xmin, box.ymax, box.xmax] };
}

/**
 * Whether a task's Check is over: it is solved, and its attempt closed, or it has no key, which a
 * Check again would not find; or its attempt is over, as a page of the history may say.
 */
export function checkOver(task: BegunTask): boolean {
  const kind = task.verdict?.kind;
  return kind === "correct" || kind === "nokey" || task.over === true;
}

/**
 * Whether a task is only to be looked at: its attempt is over, and no verdict of this tab's shows
 * it solved — a task of a page of the history, or one api closed.
 */
export function viewOnly(task: Pick<BegunTask, "verdict" | "over">): boolean {
  return task.over === true && task.verdict === undefined;
}

/**
 * The buttons of the screen of solving and at the foot of the tutor's panel, by the task's last
 * Check: Hint while the task is not solved, a task with no key too, whose hints still work;
 * and the way to the next task once its Check is over. A task only to be looked at has neither.
 */
export function tutorActs(task: Pick<BegunTask, "verdict" | "over">): {
  readonly hint: boolean;
  readonly next: boolean;
} {
  if (viewOnly(task)) return { hint: false, next: false };
  const kind = task.verdict?.kind;
  return { hint: kind !== "correct", next: kind === "correct" || kind === "nokey" };
}

/** A box of the crop of the work, [ymin, xmin, ymax, xmax] in thousandths. */
export type Box = readonly [number, number, number, number];

/**
 * The box of the tutor's wavy line among the marks of a rung's words: none when api sent none —
 * in the mode "Questions only", and with a fallback text — or only marks of a place the build
 * knows not.
 */
export function wavyOf(marks: readonly ContractMark[]): Box | undefined {
  for (const mark of marks) {
    if (mark.kind === MarkKind.WAVY_LINE && mark.place.case === "cropBox") {
      const { ymin, xmin, ymax, xmax } = mark.place.value;
      return [ymin, xmin, ymax, xmax];
    }
  }
  return undefined;
}

/**
 * The ticks and crosses of a task's last Check on the crop of its work: one by each
 * answer that was correct or not yet and whose place the reading gave, named for a screen reader
 * by its task's number in the frame; and the tutor's wavy line under the first mistake, `wavy`,
 * which stands on the same work. None without a Check that judged one, or its context.
 */
export function verdictMarks(
  task: Pick<BegunTask, "verdict" | "checked">,
  words: Words,
  wavy?: Box,
): Marks | undefined {
  const { verdict, checked } = task;
  if (checked === undefined || (verdict?.kind !== "correct" && verdict?.kind !== "not-yet"))
    return undefined;
  const marks = verdict.parts.flatMap(({ verdict: part, box }, n): VerdictMark[] => {
    if (box === undefined) return [];
    const correct = part === "correct";
    const name = words.text(correct ? "paper.mark-correct" : "paper.mark-not-yet", { n: n + 1 });
    return [{ kind: "verdict", at: { box }, correct, name }];
  });
  const line: WavyLineMark[] =
    wavy === undefined || verdict.kind !== "not-yet"
      ? []
      : [{ kind: "wavy_line", at: { box: wavy }, name: words.text("paper.mark-wavy") }];
  const all = [...marks, ...line];
  return all.length === 0 ? undefined : { submission: checked, marks: all };
}

/** The words of each reason a work on paper was not read for that are its own. */
const PAPER_REASONS: Readonly<Record<string, "paper.no-answer" | "paper.several">> = {
  no_final_answer: "paper.no-answer",
  several_final_answers: "paper.several",
};

/**
 * A verdict's card: its kind, title and line. Of a frame of several tasks, the count of those
 * correct of those with a key, and under it the tasks whose answer was not read; of one task,
 * "Read: …" under a value read. Under a work not read, why, in the words of paper for no final
 * answer and more than one; under one not checked, the outcome's words.
 */
export function paperCard(
  verdict: PaperVerdict,
  words: Words,
): { kind: "correct" | "not-yet" | "write" | "nokey"; title: string; line: string | undefined } {
  switch (verdict.kind) {
    case "correct":
    case "not-yet": {
      if (verdict.parts.length > 1) return partsCard(verdict.kind, verdict.parts, words);
      return {
        kind: verdict.kind,
        title: words.text(verdict.kind === "correct" ? "task.correct" : "task.not-yet"),
        line:
          verdict.read === undefined ? undefined : words.text("task.read", { text: verdict.read }),
      };
    }
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

/** The card of a frame of several tasks: how many of those with a key are correct, and which went unread. */
function partsCard(
  kind: "correct" | "not-yet",
  parts: readonly PaperPart[],
  words: Words,
): { kind: "correct" | "not-yet"; title: string; line: string | undefined } {
  const keyed = parts.filter(({ verdict }) => verdict !== "unchecked").length;
  const correct = parts.filter(({ verdict }) => verdict === "correct").length;
  const unread = parts.flatMap(({ verdict }, n) => (verdict === "unreadable" ? [n + 1] : []));
  return {
    kind,
    title: words.text(kind === "correct" ? "paper.parts-correct" : "paper.parts-not-yet", {
      n: correct,
      of: keyed,
    }),
    line:
      unread.length === 0
        ? undefined
        : words.text("paper.parts-unread", { tasks: unread.join(", ") }),
  };
}
