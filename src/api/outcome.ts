// What a call of AI in an answer came to when it gave no reading or no words (section 15 of the
// text of the contracts): the outcome's cause, and beside it when the next family day begins or
// which limit of the own key ran out. An outcome the build does not know is a failure of AI. No DOM.
import {
  Cause,
  type Outcome,
  type OwnKeyLimit,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";

/** The causes an outcome may have (the comment of `Outcome`). */
const OUTCOMES: ReadonlySet<Cause> = new Set([
  Cause.AI_FAILURE,
  Cause.QUOTA,
  Cause.PLATFORM_LIMIT,
  Cause.NOT_ADMITTED,
  Cause.LIMIT_REACHED,
  Cause.KEY_REFUSED,
  Cause.NO_OTHER_WORDS,
]);

export interface ReadOutcome {
  readonly cause: Cause;
  /** Beside the quota: when the next family day begins. */
  readonly nextFamilyDay?: Date;
  /** Beside the limit of the own key: which limit ran out. */
  readonly ownKeyLimit?: OwnKeyLimit;
}

/** The outcome of an answer, read; `undefined` when the call of AI gave what it was for. */
export function outcomeOf(outcome: Outcome | undefined): ReadOutcome | undefined {
  if (outcome === undefined) return undefined;
  return {
    cause: OUTCOMES.has(outcome.cause) ? outcome.cause : Cause.AI_FAILURE,
    ...(outcome.nextFamilyDay === undefined
      ? {}
      : { nextFamilyDay: timestampDate(outcome.nextFamilyDay) }),
    ...(outcome.ownKeyLimit === undefined ? {} : { ownKeyLimit: outcome.ownKeyLimit }),
  };
}
