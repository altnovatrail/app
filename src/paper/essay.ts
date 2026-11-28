// An essay, a task whose answer slot is bound `sheet`, which the open view gives with no check, on
// the sheet of a task from paper: how a submission of it ended, as the card and the tutor's panel
// show it while the attempt is open. The device keeps none of it, and the server neither the text
// read nor the words. No DOM.
import {
  SubmissionEnd,
  type SubmitEssayResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { outcomeOf } from "../api/outcome.ts";
import type { PaperVerdict } from "./solve.ts";

/** Whether the task is an essay: its one answer slot is bound `sheet`. */
export function isEssay(task: open.Task): boolean {
  return task.items.some((item) => item.answer_slots?.some((slot) => slot.binding === "sheet"));
}

/** What a submission of an essay came to: the card's verdict, and the words of its feedback. */
export interface EssaySent {
  readonly verdict: PaperVerdict;
  /** The words of the feedback; none when they did not pass, or a repeat lost them. */
  readonly feedback?: string;
}

/**
 * How a submission of an essay ended, as the card says it: feedback, with its words or why there
 * are none — none passed, or a repeat, which carries no words, lost them —; an essay that cannot be
 * read, with why; or no check, with the call's outcome. An end the build does not know is no check,
 * which is no learner's error.
 */
export function essaySentOf(answer: SubmitEssayResponse): EssaySent {
  if (answer.end === SubmissionEnd.FEEDBACK) {
    if (answer.repeated) return { verdict: { kind: "feedback", note: "lost" } };
    return answer.feedback === undefined
      ? { verdict: { kind: "feedback", note: "none" } }
      : { verdict: { kind: "feedback" }, feedback: answer.feedback };
  }
  if (answer.end === SubmissionEnd.UNREADABLE)
    return { verdict: { kind: "unreadable", reason: answer.reason } };
  return { verdict: { kind: "unchecked", outcome: outcomeOf(answer.outcome) } };
}
