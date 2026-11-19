// The words of what a call came to, in the language of the screen (R05, R17, R18): the outcomes and
// the refusals that every screen shows alike — a failure of AI is a neutral phrase, never "not yet"
// (R04 spec) — and the common string for a cause with no words here: a screen whose own causes they
// are words them itself (R19, R22, R23, R27). The quota says when the tutor comes back by the
// device's clock: today, tomorrow, or on the date of a family day that begins later (R37), and so
// does any other line of when the next family day begins, by phrases of its own. The limit of the
// own key reached says which limit, when the provider named it, and when access comes back, when
// api gives `access_returns` — the ceiling of the provider's tier —, and the checks of an own key
// exhausted say when the next check opens, each by phrases of their own (R47). No DOM.
import { Cause, LimitCause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { keyFor } from "../i18n/codes.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import type { Key, PlacesOf, Words } from "../i18n/words.ts";
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
  [Cause.KEY_NOT_FOR_PROFILE]: "api.key-not-for-profile",
  [Cause.NO_CONSENT]: "api.no-consent",
  [Cause.VERSION_NOT_GIVEN]: "api.version-gone",
  [Cause.NO_CURRENT_VERSION]: "api.version-gone",
  [Cause.NOT_FOUND]: "api.not-found",
  [Cause.NO_PROFILE]: "api.not-found",
  [Cause.ATTEMPT_CLOSED]: "api.attempt-closed",
  // The causes of the hint and the solution (R22): the same words wherever they come.
  [Cause.NO_OTHER_WORDS]: "task.no-other-words",
  // A task from paper with no key (R162 spec).
  [Cause.NO_KEY]: "paper.no-key-line",
  [Cause.ADULT_NEEDED]: "boot.grown-up",
  [Cause.LADDER_NOT_PASSED]: "task.ladder-not-passed",
  [Cause.NO_SHOWING]: "task.no-showing",
  // The causes of a lesson run (R23): a run ended, a segment not open yet, a task left.
  [Cause.RUN_ENDED]: "lesson.ended",
  [Cause.SEGMENT_UNAVAILABLE]: "lesson.not-open",
  [Cause.SEGMENTS_NOT_ENDED]: "lesson.task-left",
  // The causes of the consent and its texts (R27): a screen of its own words them more.
  [Cause.TOO_MANY_CONSENTS]: "api.too-many-consents",
  [Cause.AGE_NEEDED]: "api.age-needed",
  [Cause.TEXT_NOT_CURRENT]: "api.text-not-current",
  [Cause.LEARNER_DECIDES]: "api.learner-decides",
  // The checks of an own key beyond the account's (R47): with when the next one opens, below.
  [Cause.KEY_CHECKS_EXHAUSTED]: "api.key-checks",
} as const;

/** How many days of the device's calendar lie from one moment to another: 0 on the same date. */
export function calendarDays(from: Date, to: Date): number {
  const day = (moment: Date) => Date.UTC(moment.getFullYear(), moment.getMonth(), moment.getDate());
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/** A key whose string takes these places and no other. */
type KeyWith<P extends string> = {
  [K in Key]: [PlacesOf<K>] extends [P] ? ([P] extends [PlacesOf<K>] ? K : never) : never;
}[Key];

/**
 * The three phrases of a line that says when a moment comes — the next family day, or the next
 * check of an own key —, each a whole phrase of the dictionary, not glued from pieces (R37): today
 * at its time, tomorrow at it, or on its date.
 */
export interface DayPhrases {
  readonly today: KeyWith<"time">;
  readonly tomorrow: KeyWith<"time">;
  readonly later: KeyWith<"date" | "time">;
}

/** The quota spent, and when it comes back: the words of every screen alike. */
const QUOTA_PHRASES = {
  today: "api.quota-today",
  tomorrow: "api.quota-tomorrow",
  later: "api.quota",
} as const satisfies DayPhrases;

/** The checks of an own key exhausted, and when the next one opens (R47). */
const KEY_CHECK_PHRASES = {
  today: "api.key-checks-today",
  tomorrow: "api.key-checks-tomorrow",
  later: "api.key-checks-later",
} as const satisfies DayPhrases;

/** The limit of the own key reached, and when access comes back (R47). */
const ACCESS_PHRASES = {
  today: "api.access-returns-today",
  tomorrow: "api.access-returns-tomorrow",
  later: "api.access-returns",
} as const satisfies DayPhrases;

/**
 * A line of when a moment of api comes, on the device's clock: today — a time of today the clock
 * has passed, too, when it runs ahead of api's —, tomorrow, or on its date: later, as when a change
 * of the clock's offset made the family day longer than the device's (R56 api), and when a clock
 * far off puts it on a day before today.
 */
export function dayText(
  phrases: DayPhrases,
  at: Date,
  words: Words,
  now: Date = new Date(),
): string {
  const time = dateTimeFormat(words.language, { timeStyle: "short" }).format(at);
  const days = calendarDays(now, at);
  if (days === 0) return words.text(phrases.today, { time });
  if (days === 1) return words.text(phrases.tomorrow, { time });
  const date = dateTimeFormat(words.language, { day: "numeric", month: "long" }).format(at);
  return words.text(phrases.later, { date, time });
}

/** The words of a cause; the quota with when it comes back, in the screen's language. */
function causeText(cause: Cause, nextFamilyDay: Date | undefined, words: Words, now: Date): string {
  const key = keyFor(CAUSE_KEYS, cause);
  if (key !== "api.quota") return words.text(key);
  if (nextFamilyDay === undefined) return words.text("api.ai-failure");
  return dayText(QUOTA_PHRASES, nextFamilyDay, words, now);
}

/** Which limit of the own key ran out, by its key; none named is the limit of the key at large. */
const LIMIT_KEYS = {
  [LimitCause.LIMIT]: "api.limit-spend",
  [LimitCause.TIER]: "api.limit-tier",
  [LimitCause.BALANCE]: "api.limit-balance",
  [LimitCause.PAYMENT]: "api.limit-payment",
} as const;

/**
 * The limit of the own key reached: which one, and when access comes back on the device's clock if
 * the provider said — api names it beside the ceiling of the tier alone, 00:00 UTC on the first day
 * of the next month, and never beside the owner's own limit (R80 api) —; with no time, or one
 * already past — a repeat of an earlier answer, or a refusal kept beside the key —, none.
 */
function limitText(outcome: ReadOutcome, words: Words, now: Date): string {
  const limit = outcome.ownKeyLimit;
  const line = words.text(keyFor(LIMIT_KEYS, limit?.cause ?? -1, "api.limit-reached"));
  if (limit?.accessReturns === undefined) return line;
  const at = timestampDate(limit.accessReturns);
  if (at <= now) return line;
  return `${line}. ${dayText(ACCESS_PHRASES, at, words, now)}`;
}

/** The words of an outcome of AI, as of `now`. */
export function outcomeText(outcome: ReadOutcome, words: Words, now: Date = new Date()): string {
  if (outcome.cause === Cause.LIMIT_REACHED) return limitText(outcome, words, now);
  return causeText(outcome.cause, outcome.nextFamilyDay, words, now);
}

/** The words of a call that did not answer, as of `now`. */
export function failureText(failure: Failure, words: Words, now: Date = new Date()): string {
  switch (failure.kind) {
    case "refused": {
      const { data } = failure;
      // The moment comes beside this cause alone, so a refusal that carries it is this one, even
      // when the cause says less (contract; R47).
      if (data.case === "nextKeyCheck") {
        return dayText(KEY_CHECK_PHRASES, timestampDate(data.value), words, now);
      }
      const day = data.case === "nextFamilyDay" ? timestampDate(data.value) : undefined;
      return causeText(failure.cause, day, words, now);
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
