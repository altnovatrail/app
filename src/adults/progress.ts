// What the progress of a profile in the section for adults reads (R35 in docs/decisions.md;
// section 3.10 of docs/architecture.md; GetProgress in section 15 of the text of the contracts):
// its pages, the module and the local ID of an entry named by its full ID, how an attempt came out
// by its close reason and its wrong answers, and the words of the reason code of the engine's
// choice. The reason code is the adult's alone (concepts 12 in spec; R100 in spec): no answer to a
// learning request carries it, and only this module of the section gives it words — a test holds
// every other file of app away from it. No DOM.
import { CloseReason, ReasonCode } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type {
  AttemptRecord,
  GetProgressResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type { Api } from "../api/client.ts";
import { ADULTS, type Route } from "../app/hash.ts";
import { keyFor } from "../i18n/codes.ts";

/** The part of the hash of the progress: the page itself, and a module's map below it. */
export const PROGRESS_PART = "progress";

/** The progress of the profile chosen in the section. */
export const PROGRESS_PAGE: Route = { screen: ADULTS.screen, parts: [PROGRESS_PART] };

/** The adult's view of a module's skill map, in the progress, by the module's ID. */
export function progressMapRoute(moduleId: string): Route {
  return { screen: ADULTS.screen, parts: [PROGRESS_PART, moduleId] };
}

/** A page of the progress: the first by an empty token, the next by the page before's. */
export function readProgress(
  api: Api,
  profileId: string,
  pageToken: string,
): Promise<GetProgressResponse> {
  return api.progress.getProgress({ profileId, pageToken });
}

/** An entry of a module named by its full ID: the module's ID and the entry's local ID. */
export interface Entry {
  readonly moduleId: string;
  readonly local: string;
}

/**
 * The module and the local ID of a full ID, `<publisher>/<name>/<kind>/<local>` (section 10 of the
 * format's text), of the kind given; anything else is no entry, and the screen shows it as it is.
 */
export function entryOf(fullId: string, kind: "task" | "lesson" | "trap"): Entry | undefined {
  const parts = fullId.split("/");
  if (parts.length !== 4 || parts[2] !== kind || parts.some((part) => part === "")) {
    return undefined;
  }
  return { moduleId: `${parts[0]}/${parts[1]}`, local: parts[3] as string };
}

/** The words of how an attempt came out, by its close reason. */
const OUTCOME_KEYS = {
  [CloseReason.UNSPECIFIED]: "progress.outcome-open",
  [CloseReason.CORRECT]: "progress.outcome-correct",
  [CloseReason.SOLUTION_SHOWN]: "progress.outcome-solution-shown",
  [CloseReason.LEFT]: "progress.outcome-left",
  [CloseReason.ABANDONED]: "progress.outcome-abandoned",
  [CloseReason.UNCHECKED]: "progress.outcome-unchecked",
  [CloseReason.NOT_SUITABLE]: "progress.outcome-not-suitable",
  [CloseReason.DONE]: "progress.outcome-done",
} as const;

/**
 * How an attempt came out, as its close reason and wrong answers tell it: correct with none is
 * correct at the first answer. A close reason this build does not know gets the common words.
 */
export function outcomeKey(record: AttemptRecord) {
  if (record.closeReason === CloseReason.CORRECT && record.wrongAnswers === 0) {
    return "progress.outcome-first" as const;
  }
  return keyFor(OUTCOME_KEYS, record.closeReason);
}

/**
 * The words of each reason code for the adult, the nine of the contract v0.15.1 (R100 and R107 in
 * spec). `REASON_CODE_OPEN_RUN` is never in the progress — an attempt of a lesson run has the code
 * of the choice that began the run —, and has its words all the same. A code this build does not
 * know, and none beside a time of choice, gets the common words, which name no reason.
 */
export const CHOICE_REASON_KEYS = {
  [ReasonCode.CONSOLIDATION]: "progress.reason-consolidation",
  [ReasonCode.NEW_SKILL]: "progress.reason-new-skill",
  [ReasonCode.QUEUE]: "progress.reason-queue",
  [ReasonCode.REPETITION]: "progress.reason-repetition",
  [ReasonCode.PROBE]: "progress.reason-probe",
  [ReasonCode.SKILL_CHOSEN]: "progress.reason-skill-chosen",
  [ReasonCode.AUTHOR_ORDER]: "progress.reason-author-order",
  [ReasonCode.OPEN_RUN]: "progress.reason-open-run",
  [ReasonCode.ROTATION]: "progress.reason-rotation",
} as const satisfies Record<Exclude<ReasonCode, ReasonCode.UNSPECIFIED>, string>;

/** The words of why the engine gave an attempt's task or its lesson. */
export function choiceReasonKey(code: ReasonCode) {
  return keyFor(CHOICE_REASON_KEYS, code);
}
