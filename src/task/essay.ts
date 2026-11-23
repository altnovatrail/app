// What the task screen knows of an essay: a task is an essay when its
// answer slot is bound `sheet`, which the open view gives with no check; and how a submission of
// an essay ended, as the screen says it while the attempt is open: the device keeps none of it, and
// the server neither the text read nor the words. No DOM.
import {
  SubmissionEnd,
  type SubmitEssayResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { ReadOutcome } from "../api/outcome.ts";
import { outcomeText } from "../api/words.ts";
import type { Words } from "../i18n/words.ts";
import { reasonKey } from "./attempt.ts";

/** Whether the task is an essay: its one answer slot is bound `sheet`. */
export function isEssay(task: open.Task): boolean {
  return task.items.some((item) => item.answer_slots?.some((slot) => slot.binding === "sheet"));
}

/** How a submission of an essay ended: feedback, unreadable or unchecked. */
export type EssayEnd = "feedback" | "unreadable" | "unchecked";

/** What the answer to a submission of an essay brought. */
export interface Answered {
  readonly end: EssayEnd;
  /** The text read, as it is written; none when the essay was not read. */
  readonly text?: string;
  /** Beside "unreadable": "blank" or "illegible", or a reason the build does not know. */
  readonly reason?: string;
  /** Beside feedback: its words; none when they did not pass, "no feedback this time". */
  readonly feedback?: string;
  /** The answer was a repeat of one lost on the way: neither the text nor the words came. */
  readonly repeated?: boolean;
}

const ENDS: ReadonlyMap<SubmissionEnd, EssayEnd> = new Map([
  [SubmissionEnd.FEEDBACK, "feedback"],
  [SubmissionEnd.UNREADABLE, "unreadable"],
  [SubmissionEnd.UNCHECKED, "unchecked"],
]);

/**
 * How a submission of an essay ended: an end the build does not know is "unchecked", which is no
 * learner's error. A repeat carries neither the text nor the words.
 */
export function sentOf(answer: SubmitEssayResponse): Answered {
  const end = ENDS.get(answer.end) ?? "unchecked";
  return {
    end,
    ...(answer.text === undefined ? {} : { text: answer.text }),
    ...(end === "unreadable" && answer.reason !== "" ? { reason: answer.reason } : {}),
    ...(end === "feedback" && answer.feedback !== undefined ? { feedback: answer.feedback } : {}),
    ...(answer.repeated ? { repeated: true } : {}),
  };
}

/** How a submission ended, as the screen shows it: what the answer brought, and the call's outcome. */
export type Shown = Answered & { readonly outcome?: ReadOutcome };

/** Why a submission gave no words of feedback, in words; none when its words came. */
export function noteOf(shown: Shown, words: Words): string | undefined {
  if (shown.repeated === true && shown.end === "feedback") return words.text("task.feedback-lost");
  if (shown.end === "feedback") {
    return shown.feedback === undefined ? words.text("task.feedback-none") : undefined;
  }
  if (shown.end === "unreadable") {
    return words.text("task.essay-unreadable", {
      reason: words.text(reasonKey(shown.reason ?? "")),
    });
  }
  return shown.outcome === undefined
    ? words.text("task.essay-unchecked")
    : outcomeText(shown.outcome, words);
}
