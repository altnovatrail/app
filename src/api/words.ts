// The words of what a call came to, in the language of the screen (section 15 of the text of the
// contracts; sections 3.3 and 3.8 of docs/architecture.md; R18): the outcomes and the refusals
// that every screen shows alike — a failure of AI is a neutral phrase, never "not yet" (R04 in
// spec) — and the common string for a cause with no words here: a screen whose own causes they
// are words them itself (T22, T26, T27). No DOM.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { keyFor } from "../i18n/codes.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import type { Words } from "../i18n/words.ts";
import type { Failure } from "./failure.ts";
import type { ReadOutcome } from "./outcome.ts";

/** The causes every screen words alike, by their key. */
export const CAUSE_KEYS = {
  [Cause.AI_FAILURE]: "api.ai-failure",
  [Cause.PLATFORM_LIMIT]: "api.ai-failure",
  [Cause.QUOTA]: "api.quota",
  [Cause.NOT_ADMITTED]: "api.not-admitted",
  [Cause.LIMIT_REACHED]: "api.limit-reached",
  [Cause.KEY_REFUSED]: "api.key-refused",
  [Cause.NO_CONSENT]: "api.no-consent",
  [Cause.VERSION_NOT_GIVEN]: "api.version-gone",
  [Cause.NO_CURRENT_VERSION]: "api.version-gone",
  [Cause.NOT_FOUND]: "api.not-found",
  [Cause.NO_PROFILE]: "api.not-found",
  [Cause.ATTEMPT_CLOSED]: "api.attempt-closed",
} as const;

/** The words of a cause; the quota with when it comes back, in the screen's language. */
function causeText(cause: Cause, nextFamilyDay: Date | undefined, words: Words): string {
  const key = keyFor(CAUSE_KEYS, cause);
  if (key !== "api.quota") return words.text(key);
  if (nextFamilyDay === undefined) return words.text("api.ai-failure");
  const time = dateTimeFormat(words.language, { timeStyle: "short" }).format(nextFamilyDay);
  return words.text("api.quota", { time });
}

/** The words of an outcome of AI. */
export function outcomeText(outcome: ReadOutcome, words: Words): string {
  return causeText(outcome.cause, outcome.nextFamilyDay, words);
}

/** The words of a call that did not answer. */
export function failureText(failure: Failure, words: Words): string {
  switch (failure.kind) {
    case "refused": {
      const day =
        failure.data.case === "nextFamilyDay" ? timestampDate(failure.data.value) : undefined;
      return causeText(failure.cause, day, words);
    }
    case "offline":
      return words.text("boot.offline");
    case "sign-in":
    case "account-gone":
      return words.text("api.sign-in");
    case "fresh-sign-in":
      return words.text("api.fresh-sign-in");
    case "no-access":
      return words.text("api.no-access");
    case "stale":
      return words.text("boot.new-version");
    default:
      return words.text("common.unknown");
  }
}
