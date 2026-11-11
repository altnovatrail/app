// What app reads of a lesson run (section 3.4 of docs/architecture.md; R06, R23 in
// docs/decisions.md; LearningService in the contract): the lesson's full ID, which keys its state on
// the device; the kind of each segment; how a run ended, in words; and the places of the task
// segments that ended, from a refusal that carries them. None of it needs the DOM.
import { Cause, RunEndReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { DemoState } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { Failure } from "../api/failure.ts";

/** The kind of a segment: exactly one of the three the format knows (section 21 of its text). */
export type Kind = "explanation" | "example" | "task";

/** A segment's kind; a segment of a kind this build does not know reads as an explanation. */
export function kindOf(segment: open.Segment): Kind {
  if (segment.worked_example !== undefined) return "example";
  if (segment.task !== undefined) return "task";
  return "explanation";
}

/**
 * A lesson's full ID — its module's ID, `lesson` and its local ID, joined by `/` (section 10 of the
 * format's text) — as the contract keys the state of a lesson by it and `LessonRunRef` names it.
 */
export function fullId(moduleId: string, lessonId: string): string {
  return `${moduleId}/lesson/${lessonId}`;
}

/** The module's ID of a lesson's full ID: what comes before `/lesson/`. */
export function moduleOf(lessonFullId: string): string {
  const at = lessonFullId.lastIndexOf("/lesson/");
  return at === -1 ? lessonFullId : lessonFullId.slice(0, at);
}

/** The words of a run's end, by its reason; a reason this build does not know is an end all the same. */
export function endKey(
  reason: RunEndReason,
):
  | "lesson.complete"
  | "api.version-gone"
  | "lesson.ended-not-suitable"
  | "lesson.ended-abandoned"
  | "lesson.ended" {
  switch (reason) {
    case RunEndReason.PASSED:
      return "lesson.complete";
    case RunEndReason.UNCHECKED:
      return "api.version-gone";
    case RunEndReason.NOT_SUITABLE:
      return "lesson.ended-not-suitable";
    case RunEndReason.ABANDONED:
      return "lesson.ended-abandoned";
    default:
      return "lesson.ended";
  }
}

/** How a run ended, if a failure is the refusal `CAUSE_RUN_ENDED`; a refusal with no end, unspecified. */
export function runEndOf(failure: Failure): RunEndReason | undefined {
  if (failure.kind !== "refused" || failure.cause !== Cause.RUN_ENDED) return undefined;
  return failure.data.case === "runEnd" ? failure.data.value.reason : RunEndReason.UNSPECIFIED;
}

/**
 * The places of the task segments that ended, if a failure is a refusal that carries them:
 * `CAUSE_SEGMENTS_NOT_ENDED` of "lesson done" and `CAUSE_SEGMENT_UNAVAILABLE` of a segment's attempt.
 * One of them without its places is "unsaid": what ended is to be asked, not taken as nothing.
 */
export function endedOf(failure: Failure): readonly number[] | "unsaid" | undefined {
  if (failure.kind !== "refused") return undefined;
  if (failure.cause !== Cause.SEGMENTS_NOT_ENDED && failure.cause !== Cause.SEGMENT_UNAVAILABLE) {
    return undefined;
  }
  return failure.data.case === "endedSegments" ? failure.data.value.places : "unsaid";
}

/**
 * The demo state kept of an example, if the element would take it: `opened` a whole number from 0
 * to the count of the demo's parts and `hidden` true or false. A record that fails it is a broken
 * database, and the demo starts from the beginning (R06; section 3.4).
 */
export function demoOf(kept: unknown, parts: number): DemoState | undefined {
  if (typeof kept !== "object" || kept === null) return undefined;
  const { opened, hidden } = kept as { opened?: unknown; hidden?: unknown };
  if (typeof opened !== "number" || !Number.isInteger(opened)) return undefined;
  if (opened < 0 || opened > parts || typeof hidden !== "boolean") return undefined;
  return kept as DemoState;
}
