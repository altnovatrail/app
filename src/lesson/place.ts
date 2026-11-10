// The place in a lesson and the way along its bar (section 3.4 of docs/architecture.md; R06, R23 in
// docs/decisions.md). The place is the segment the learner has reached: "Continue" moves it, and so
// does api's word that the task on it ended. A lesson opens at the later of the place the device
// keeps and the one after the last task segment that ended, and never on a task that ended but the
// last. Back is a touch of the bar, to any explanation or example passed; a task that ended does not
// open again, for its attempt is closed. Segments are named by their places, from 1. No DOM.
import type { Kind } from "./run.ts";

/** The lesson as the place needs it: the kind of each segment, and the task segments that ended. */
export interface Course {
  readonly kinds: readonly Kind[];
  readonly ended: ReadonlySet<number>;
}

/** Whether a segment is a task that ended. */
export function taskEnded(course: Course, segment: number): boolean {
  return course.kinds[segment - 1] === "task" && course.ended.has(segment);
}

/**
 * The place a lesson opens at: the later of the place kept on the device, the one after the last
 * task segment that ended, and the segment of the attempt open; past the tasks that ended, but the
 * last segment, which "lesson done" follows.
 */
export function openingPlace(
  course: Course,
  kept: number | undefined,
  openAttempt: number | undefined,
): number {
  const last = course.kinds.length;
  const after = course.ended.size === 0 ? 1 : Math.max(...course.ended) + 1;
  let place = Math.min(Math.max(kept ?? 1, after, openAttempt ?? 1, 1), last);
  while (place < last && taskEnded(course, place)) place += 1;
  return place;
}

/** Why a segment of the bar does not open, if it does not: a task that ended, or one not reached. */
export function closedWhy(
  course: Course,
  place: number,
  segment: number,
): "lesson.task-over" | "lesson.not-open" | undefined {
  if (segment === place) return undefined;
  if (segment > place) return "lesson.not-open";
  return taskEnded(course, segment) ? "lesson.task-over" : undefined;
}

/**
 * Where "Continue" leads from the segment shown: from a segment passed, to the next explanation or
 * example passed, past the tasks that ended, and after the last of them to the place; from the
 * place, to the next segment, or "lesson done" from the last.
 */
export function continueFrom(course: Course, place: number, shown: number): number | "complete" {
  if (shown < place) {
    for (let segment = shown + 1; segment < place; segment += 1) {
      if (closedWhy(course, place, segment) === undefined) return segment;
    }
    return place;
  }
  return shown >= course.kinds.length ? "complete" : shown + 1;
}

/** Whether "Continue" stands under a segment shown: on a task only once it ended (R06). */
export function mayContinue(course: Course, place: number, shown: number): boolean {
  return course.kinds[shown - 1] !== "task" || shown < place || course.ended.has(shown);
}

/** The first task segment that has not ended, where "lesson done" refused sends the learner. */
export function firstOpenTask(course: Course): number | undefined {
  const at = course.kinds.findIndex((kind, i) => kind === "task" && !course.ended.has(i + 1));
  return at === -1 ? undefined : at + 1;
}
