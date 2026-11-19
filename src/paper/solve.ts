// The tasks begun on a photographed page as the screen of solving holds them (R71): each its own
// sheet under its crop, the tracing paper, in the order of the page; those the learner left out on
// the page again are not on the list, and come back with their work when picked once more. "Add"
// goes back to the page, and Start then begins only the tasks not begun yet. No DOM.
import type { HistoryChange, HistoryEvent, TracingState } from "@altnovatrail/spec/canvas";
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
