// The words of what a call came to, in the language of the screen (section 15 of the text of the
// contracts; sections 3.3 and 3.8 of docs/architecture.md; R18): the outcomes and the refusals
// that every screen shows alike — a failure of AI is a neutral phrase, never "not yet" (R04 in
// spec) — and the common string for a cause with no words here: a screen whose own causes they
// are words them itself (T22, T26, T27, T32). The quota says when the tutor comes back by the
// device's clock: today, tomorrow, or on the date of a family day that begins later (R37), and so
// does any other line of when the next family day begins, by phrases of its own. No DOM.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
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
  [Cause.NO_CONSENT]: "api.no-consent",
  [Cause.VERSION_NOT_GIVEN]: "api.version-gone",
  [Cause.NO_CURRENT_VERSION]: "api.version-gone",
  [Cause.NOT_FOUND]: "api.not-found",
  [Cause.NO_PROFILE]: "api.not-found",
  [Cause.ATTEMPT_CLOSED]: "api.attempt-closed",
  // The causes of the hint and the solution (T26; R22): the same words wherever they come.
  [Cause.NO_OTHER_WORDS]: "task.no-other-words",
  [Cause.ADULT_NEEDED]: "boot.grown-up",
  [Cause.LADDER_NOT_PASSED]: "task.ladder-not-passed",
  [Cause.NO_SHOWING]: "task.no-showing",
  // The causes of a lesson run (T27; R23): a run ended, a segment not open yet, a task left.
  [Cause.RUN_ENDED]: "lesson.ended",
  [Cause.SEGMENT_UNAVAILABLE]: "lesson.not-open",
  [Cause.SEGMENTS_NOT_ENDED]: "lesson.task-left",
  // The causes of the consent and its texts (T32; R27): a screen of its own words them more.
  [Cause.TOO_MANY_CONSENTS]: "api.too-many-consents",
  [Cause.AGE_NEEDED]: "api.age-needed",
  [Cause.TEXT_NOT_CURRENT]: "api.text-not-current",
  [Cause.LEARNER_DECIDES]: "api.learner-decides",
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
 * The three phrases of a line that says when the next family day begins, each a whole phrase of
 * the dictionary, not glued from pieces (R37): today at its time, tomorrow at it, or on its date.
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

/**
 * A line of when the next family day begins on the device's clock: today — a time of today the
 * clock has passed, too, when it runs ahead of api's —, tomorrow, or on its date, when a change of
 * the clock's offset made the family day longer than the device's (R56 api), and when a clock far
 * off puts it on a day before today.
 */
export function dayText(
  phrases: DayPhrases,
  nextFamilyDay: Date,
  words: Words,
  now: Date = new Date(),
): string {
  const time = dateTimeFormat(words.language, { timeStyle: "short" }).format(nextFamilyDay);
  const days = calendarDays(now, nextFamilyDay);
  if (days === 0) return words.text(phrases.today, { time });
  if (days === 1) return words.text(phrases.tomorrow, { time });
  const date = dateTimeFormat(words.language, { day: "numeric", month: "long" }).format(
    nextFamilyDay,
  );
  return words.text(phrases.later, { date, time });
}

/** The words of a cause; the quota with when it comes back, in the screen's language. */
function causeText(cause: Cause, nextFamilyDay: Date | undefined, words: Words, now: Date): string {
  const key = keyFor(CAUSE_KEYS, cause);
  if (key !== "api.quota") return words.text(key);
  if (nextFamilyDay === undefined) return words.text("api.ai-failure");
  return dayText(QUOTA_PHRASES, nextFamilyDay, words, now);
}

/** The words of an outcome of AI, as of `now`. */
export function outcomeText(outcome: ReadOutcome, words: Words, now: Date = new Date()): string {
  return causeText(outcome.cause, outcome.nextFamilyDay, words, now);
}

/** The words of a call that did not answer, as of `now`. */
export function failureText(failure: Failure, words: Words, now: Date = new Date()): string {
  switch (failure.kind) {
    case "refused": {
      const day =
        failure.data.case === "nextFamilyDay" ? timestampDate(failure.data.value) : undefined;
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
