// The share of the family day's quota of platform AI that a profile has spent (section 15 of the
// text of the contracts, "The quota"; concepts 14 in spec; R11 in api): `GetQuota` by the learner's
// action, where the learner begins their work — the share of their own profile alone —, and by an
// adult's, in the section for adults — the account's beside it, so that a child never sees what the
// family spends. A share is of a cap, in whole percent: never a sum in dollars, and never the cap.
// When the next family day begins, the screens say by the device's calendar, as the refusals of
// the quota do (R37). An api on a tag of spec older than v0.16.3 has no `GetQuota`, and its
// `unimplemented` is no share, with no reload offered, as the legal texts' is (R27). No DOM.
import type { QuotaShare } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Api } from "../api/client.ts";
import { parseFailure } from "../api/failure.ts";
import type { ReadOutcome } from "../api/outcome.ts";
import { type DayPhrases, dayText, outcomeText } from "../api/words.ts";
import { percentText } from "../i18n/intl.ts";
import type { Words } from "../i18n/words.ts";

/** The share of a profile, by whose action: none from an api with no `GetQuota` yet. */
export async function readQuota(
  api: Api,
  profileId: string,
  action: Action.LEARNING | Action.ADULT,
): Promise<QuotaShare | undefined> {
  try {
    return (await api.account.getQuota({ profileId, action })).share;
  } catch (reason) {
    if (parseFailure(reason).kind === "stale") return undefined;
    throw reason;
  }
}

/**
 * The learner's line: their profile's share, or, once a cap is reached, what a refusal of the quota
 * says — that the tutor's time is over, and when it comes back. None while the account's tariff has
 * no caps: platform AI is closed to it, and the screens say so where a call meets it. A share of
 * the account, which a learning action never gets, the line never shows.
 */
export function learnerQuotaText(
  share: QuotaShare,
  words: Words,
  now: Date = new Date(),
): string | undefined {
  if (share.profilePercent === undefined) return undefined;
  if (share.capReached) {
    // The words a refusal of the quota has on every screen: with no day beside it, the neutral one.
    const closed: ReadOutcome =
      share.nextFamilyDay === undefined
        ? { cause: Cause.QUOTA }
        : { cause: Cause.QUOTA, nextFamilyDay: timestampDate(share.nextFamilyDay) };
    return outcomeText(closed, words, now);
  }
  return words.text("quota.learner", {
    percent: percentText(words.language, share.profilePercent),
  });
}

/** When the next family day brings the quota back, beside the shares of the section for adults. */
const RENEWS = {
  today: "quota.renews-today",
  tomorrow: "quota.renews-tomorrow",
  later: "quota.renews",
} as const satisfies DayPhrases;

/**
 * The adult's lines, each a whole phrase: the profile's share and the account's, that the profile
 * checks no work by platform AI once a cap is reached, and when the next family day begins. With
 * no share at all — the tariff has no caps — the one line that platform AI is closed to the account.
 */
export function adultQuotaTexts(share: QuotaShare, words: Words, now: Date = new Date()): string[] {
  const { profilePercent, accountPercent } = share;
  if (profilePercent === undefined && accountPercent === undefined) {
    return [words.text("quota.closed")];
  }
  const percent = (value: number) => ({ percent: percentText(words.language, value) });
  return [
    ...(profilePercent === undefined ? [] : [words.text("quota.profile", percent(profilePercent))]),
    ...(accountPercent === undefined ? [] : [words.text("quota.account", percent(accountPercent))]),
    ...(share.capReached ? [words.text("quota.reached")] : []),
    ...(share.nextFamilyDay === undefined
      ? []
      : [dayText(RENEWS, timestampDate(share.nextFamilyDay), words, now)]),
  ];
}
