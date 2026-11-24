// The tasks begun on a photographed page as the screen of solving holds them: each its own
// sheet under its crop, the tracing paper, in the order of the page; those the learner left out on
// the page again are not on the list, and come back with their work when picked once more. "Add"
// goes back to the page, and Start then begins only the tasks not begun yet. A frame may hold several
// tasks, up to 20, each with an answer of its own: a Check, in which a model judges the work, gives
// the verdict of each task's answer slot, and a tick or a cross by each answer on the crop of the
// work; a task with no answer yet and no mistake in its solution is "So far correct", with no mark;
// none when the Check read nothing of a solution; after Not yet, in the mode "Show where", the
// tutor's wavy line under the first mistake. No DOM.
import {
  type AnswerSlotVerdict,
  type Mark as ContractMark,
  type ItemVerdict,
  MarkKind,
  TutorReply,
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
import type { Said } from "../tutor/report.ts";
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
  /**
   * The crop of the instruction printed above it, cut by the frame the finding gave; none for a
   * frame drawn, one the finding gave none, and a task of a page of the history, which keeps none.
   */
  readonly instruction?: Blob;
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
 * One task of a frame as a Check judged it: the verdict of its answer slot — "so-far" with no answer
 * yet and no mistake —, and where its answer was read on the crop of the work, [ymin, xmin, ymax,
 * xmax] in thousandths, beside correct and not yet when the Check read it.
 */
export interface PaperPart {
  readonly verdict: "correct" | "not-yet" | "so-far" | "unreadable" | "unchecked";
  readonly box?: readonly [number, number, number, number];
}

/**
 * What a Check of a task from paper came to, as its card shows it: correct when every task of the
 * frame is, or not yet, with what was read of a frame of one task and each task's part; so far
 * correct when no task is not yet and one has no answer yet but a solution with no mistake; not
 * read, with why, when no answer was; not checked, with the outcome of the call that left it so; or
 * no key, when the Check read nothing of a solution in any task.
 */
export type PaperVerdict =
  | {
      readonly kind: "correct" | "not-yet" | "so-far";
      readonly read: string | undefined;
      readonly parts: readonly PaperPart[];
    }
  | { readonly kind: "unreadable"; readonly reason: string }
  | { readonly kind: "unchecked"; readonly outcome: ReadOutcome | undefined }
  | { readonly kind: "nokey" };

/**
 * The verdict of an answer to a Check of a task from paper, by each task's item, in the order of the
 * frame; a verdict the build knows not is none. Correct is whether api closed the attempt solved: a
 * task whose answer the Check could not read keeps it open, though no other is wrong. A task not yet
 * makes the frame not yet; else one so far correct makes it so far correct, which counts no wrong
 * answer. A repeat of the Check that solved it holds no verdict of a task, which api erased with the
 * close: it is correct all the same.
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
  const has = (verdict: PaperPart["verdict"]) => parts.some((part) => part.verdict === verdict);
  const read = slots.length === 1 ? slots[0]?.value : undefined;
  if (solved) return { kind: "correct", read, parts };
  if (has("not-yet")) return { kind: "not-yet", read, parts };
  if (has("so-far")) return { kind: "so-far", read, parts };
  if (has("correct")) return { kind: "not-yet", read, parts };
  const unread = slots.find((slot) => slot?.verdict === "unreadable");
  if (unread !== undefined) return { kind: "unreadable", reason: unread.reason };
  return { kind: "unchecked", outcome };
}

/** The verdicts of an answer slot the build knows, as a part names them. */
const PARTS: Readonly<Record<string, PaperPart["verdict"]>> = {
  correct: "correct",
  not_yet: "not-yet",
  so_far_correct: "so-far",
  unreadable: "unreadable",
};

function partOf(slot: AnswerSlotVerdict | undefined): PaperPart {
  const verdict = PARTS[slot?.verdict ?? ""] ?? "unchecked";
  const box = slot?.cropBox;
  if (box === undefined || (verdict !== "correct" && verdict !== "not-yet")) return { verdict };
  return { verdict, box: [box.ymin, box.xmin, box.ymax, box.xmax] };
}

/** Where a task stands in the list of the tasks begun: its sign and the line under its name. */
export type TaskState = "solved" | "not-yet" | "so-far" | "no-key" | "closed" | "to-do";

/**
 * A task's place in the list by what its last Check came to: solved, here or in a tab before; not
 * yet; so far correct; one the Check has no key to; closed unsolved, as api or a page of the history
 * says; else still to do, a Check that read nothing too.
 */
export function taskState(task: Pick<BegunTask, "verdict" | "over" | "solved">): TaskState {
  const kind = task.verdict?.kind;
  if (task.solved === true || kind === "correct") return "solved";
  if (kind === "not-yet") return "not-yet";
  if (kind === "nokey") return "no-key";
  if (task.over === true) return "closed";
  return kind === "so-far" ? "so-far" : "to-do";
}

/**
 * Whether a task's Check is over: it is solved, and its attempt closed, or its attempt is over, as a
 * page of the history may say. A Check that read nothing leaves it open: the next one checks again.
 */
export function checkOver(task: BegunTask): boolean {
  return task.verdict?.kind === "correct" || task.over === true;
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
 * Check: Hint while the task is not solved, one the Check read nothing of too, whose hints still
 * work; and the way to the next task once it is solved, or after a Check that read nothing. A task
 * only to be looked at has neither.
 */
export function tutorActs(task: Pick<BegunTask, "verdict" | "over">): {
  readonly hint: boolean;
  readonly next: boolean;
} {
  if (viewOnly(task)) return { hint: false, next: false };
  const kind = task.verdict?.kind;
  return { hint: kind !== "correct", next: kind === "correct" || kind === "nokey" };
}

/**
 * Which reply of the tutor the words of a Check are, as a report of a problem names it: after a
 * correct answer the words after it; after a wrong one the rung it gave; before any, the opening.
 */
export function checkReply(
  verdict: PaperVerdict,
  wrongAnswers: number,
): Pick<Said, "reply" | "rung"> {
  if (verdict.kind === "correct") return { reply: TutorReply.CORRECT_ANSWER, rung: 0 };
  if (wrongAnswers > 0) return { reply: TutorReply.RUNG, rung: Math.min(wrongAnswers, 3) };
  return { reply: TutorReply.OPENING, rung: 0 };
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
 * The ticks and crosses of a task's last Check on the crop of its work: one by each answer that was
 * correct or not yet and whose place the Check read, named for a screen reader by its task's number
 * in the frame — a task so far correct has none —; and the tutor's wavy line under the first
 * mistake, `wavy`, which stands on the same work. None without a Check that judged one, or its
 * context.
 */
export function verdictMarks(
  task: Pick<BegunTask, "verdict" | "checked">,
  words: Words,
  wavy?: Box,
): Marks | undefined {
  const { verdict, checked } = task;
  if (
    checked === undefined ||
    (verdict?.kind !== "correct" && verdict?.kind !== "not-yet" && verdict?.kind !== "so-far")
  )
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
 * correct of those checked, and under it the tasks whose answer was not read; of one task, "Read: …"
 * under a value read, and under "So far correct" that there is no mistake yet. Under a work not
 * read, why, in the words of paper for no final answer and more than one; under one not checked,
 * the outcome's words.
 */
export function paperCard(
  verdict: PaperVerdict,
  words: Words,
): {
  kind: "correct" | "not-yet" | "so-far" | "write" | "nokey";
  title: string;
  line: string | undefined;
} {
  switch (verdict.kind) {
    case "so-far": {
      if (verdict.parts.length > 1) return partsCard(verdict.kind, verdict.parts, words);
      return {
        kind: "so-far",
        title: words.text("paper.so-far"),
        line: words.text("paper.so-far-line"),
      };
    }
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

/** The titles of a frame of several tasks, by its verdict. */
const PARTS_TITLES = {
  correct: "paper.parts-correct",
  "not-yet": "paper.parts-not-yet",
  "so-far": "paper.parts-so-far",
} as const;

/** The card of a frame of several tasks: how many of those checked are correct, and which went unread. */
function partsCard(
  kind: "correct" | "not-yet" | "so-far",
  parts: readonly PaperPart[],
  words: Words,
): { kind: "correct" | "not-yet" | "so-far"; title: string; line: string | undefined } {
  const checked = parts.filter(({ verdict }) => verdict !== "unchecked").length;
  const correct = parts.filter(({ verdict }) => verdict === "correct").length;
  const unread = parts.flatMap(({ verdict }, n) => (verdict === "unreadable" ? [n + 1] : []));
  return {
    kind,
    title: words.text(PARTS_TITLES[kind], { n: correct, of: checked }),
    line:
      unread.length === 0
        ? undefined
        : words.text("paper.parts-unread", { tasks: unread.join(", ") }),
  };
}

/** The longest question about a task, in code points (the contract's `AskTutorRequest.question`). */
export const MAX_QUESTION = 500;
/** The turns of the conversation a question carries, and the longest of each, in code points. */
export const MAX_TURNS = 8;
export const MAX_TURN = 1000;
/**
 * The most strokes a request of grown-up mode carries (the contract's `AskGrownUpRequest.strokes`):
 * of a sheet with more, the newest, which a request most likely names.
 */
export const MAX_SHEET_STROKES = 3000;

/** The width of a task's page in units of the sheet, and in millimetres: A4's. */
const PAGE_UNITS = 1000;
const PAGE_MM = 210;

/**
 * How many pixels of a crop of the sheet make a millimetre of the task's page, by the crop's width
 * and the units of the sheet it spans, for a request in millimetres of grown-up mode, as a grid
 * every 2 mm; 0 when the crop gives none, or one the contract does not take, above 100.
 */
export function pixelsPerMm(crop: {
  readonly width: number;
  readonly sheetBox: readonly [number, number, number, number];
}): number {
  const units = crop.sheetBox[3] - crop.sheetBox[1];
  const perMm = (crop.width / units) * (PAGE_UNITS / PAGE_MM);
  return Number.isFinite(perMm) && perMm > 0 && perMm <= 100 ? perMm : 0;
}

/**
 * A question as it goes: its line breaks kept, Windows' as one, its other control characters
 * spaces, trimmed and cut to MAX_QUESTION code points; none when nothing is left of it.
 */
export function questionOf(text: string): string | undefined {
  // The contract refuses a control character but a line break: C0, DEL and C1.
  const plain = [...text.replace(/\r\n?/g, "\n")].map((c) => {
    const n = c.codePointAt(0) ?? 0;
    return c !== "\n" && (n < 0x20 || (n >= 0x7f && n <= 0x9f)) ? " " : c;
  });
  const kept = plain.join("").trim();
  const cut = [...kept].slice(0, MAX_QUESTION).join("").trim();
  return cut === "" ? undefined : cut;
}

/**
 * A turn of the conversation on a task, as the tab keeps it: the learner's question, or the tutor's
 * words — a hint, the words of a Check, an answer. `line`: the conversation draws it as a line of
 * its own, as it does a question and its answer; the words of a hint and of a Check have their own
 * place in the panel. In grown-up mode the grown-up's request and the tutor's words on what it did
 * are turns too, marked `grown`; the mode turned on or off is a line of the conversation, `mode`,
 * and no turn a request carries.
 */
export interface Turn {
  readonly learner: boolean;
  readonly text: string;
  readonly line: boolean;
  /** The question went as the browser read it from the learner's voice. */
  readonly voice?: boolean;
  /** Said in grown-up mode: the grown-up's request, or the tutor's words on its act. */
  readonly grown?: boolean;
  /** The line of grown-up mode turned on or off, with no text. */
  readonly mode?: "on" | "off";
}

/** The turns a question carries: the last MAX_TURNS before it, each cut to MAX_TURN code points. */
export function turnsOf(
  turns: readonly Turn[],
): readonly { readonly learner: boolean; readonly text: string }[] {
  return turns
    .filter((turn) => turn.mode === undefined)
    .slice(-MAX_TURNS)
    .map(({ learner, text }) => ({
      learner,
      text: [...text].slice(0, MAX_TURN).join(""),
    }));
}

/** The conversation with a turn after it; the tutor's words said again are not a turn again. */
export function withTurn(turns: readonly Turn[], turn: Turn): readonly Turn[] {
  const last = turns.at(-1);
  const again =
    turn.mode === undefined &&
    !turn.learner &&
    last !== undefined &&
    last.mode === undefined &&
    !last.learner &&
    last.text === turn.text;
  if (again) return turns;
  return [...turns, turn];
}
