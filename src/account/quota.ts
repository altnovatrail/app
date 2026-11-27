// The share of the family day's quota of platform AI that a profile has spent (the contract):
// `GetQuota` by the learner's action, where the learner begins their work — the share of
// their own profile alone —, and by an adult's, in the section for adults — the account's beside
// it, so that a child never sees what the family spends. A share is of a cap, in whole percent:
// never a sum in dollars, and never the cap. When the next family day begins, the screens say by
// the device's calendar, as the refusals of the quota do. An api with no `GetQuota` answers
// `unimplemented`, which is no share, with no reload offered, as the legal texts' is. No DOM.
import type { QuotaShare } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Api } from "../api/client.ts";
import { parseFailure } from "../api/failure.ts";
import { type DayPhrases, dayText } from "../api/words.ts";
import { numberFormat, percentText } from "../i18n/intl.ts";
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

/** When the next family day brings the quota back, beside the shares of the section for adults. */
const RENEWS = {
  today: "quota.renews-today",
  tomorrow: "quota.renews-tomorrow",
  later: "quota.renews",
} as const satisfies DayPhrases;

/**
 * How the ring of tutor time at the top right looks: none of today's used yet, a sparkle in place of
 * the number; below 50% green; to 80% yellow; from 80% red; once a cap is reached — the profile's or
 * the account's, which the learner never sees — the full red ring, an hourglass in place of the
 * number.
 */
export type RingLevel = "fresh" | "low" | "half" | "high" | "out";

/** The ring of the frame's top right and its pop-over, in the screen's language. */
export interface Ring {
  readonly level: RingLevel;
  /** How full the ring and the bar are, 0 to 100: full once a cap is reached. */
  readonly fill: number;
  /** The number in the ring, "20", with no sign of percent: it is 32 px wide. */
  readonly number: string;
  /** The share as the language writes it, "20%", in the pop-over's ring. */
  readonly percent: string;
  /** The button's name, which the number alone does not tell. */
  readonly name: string;
  /** What the share means, under the pop-over's heading, and its line: no number, the ring's. */
  readonly title: string;
  readonly line: string;
  /** When the next family day brings it back, by the device's calendar; none with no day. */
  readonly renews: string | undefined;
}

/** When the next family day brings the quota back, in the ring's pop-over under its heading. */
const RING_RENEWS = {
  today: "quota.ring-renews-today",
  tomorrow: "quota.ring-renews-tomorrow",
  later: "quota.ring-renews",
} as const satisfies DayPhrases;

/**
 * The learner's ring: their profile's share, its number in the ring alone, and once a cap is
 * reached that the tutor waits till the quota renews, when the pop-over says. None while the account's tariff has
 * no caps: platform AI is closed to it, and the screens say so where a call meets it. A share of
 * the account, which a learning action never gets, the ring never shows.
 */
export function ringOf(share: QuotaShare, words: Words, now: Date = new Date()): Ring | undefined {
  if (share.profilePercent === undefined) return undefined;
  const fill = share.capReached ? 100 : Math.min(100, Math.max(0, share.profilePercent));
  const level: RingLevel =
    fill >= 100 ? "out" : fill === 0 ? "fresh" : fill >= 80 ? "high" : fill >= 50 ? "half" : "low";
  const percent = percentText(words.language, fill);
  const renews =
    share.nextFamilyDay === undefined
      ? undefined
      : dayText(RING_RENEWS, timestampDate(share.nextFamilyDay), words, now);
  return {
    level,
    fill,
    number: numberFormat(words.language).format(fill),
    percent,
    name:
      level === "fresh"
        ? words.text("quota.ring-fresh")
        : level === "out"
          ? words.text("quota.ring-out")
          : words.text("quota.ring", { percent }),
    title: words.text(`quota.${level}-title`),
    line: words.text(`quota.${level}-line`),
    renews,
  };
}

/**
 * The line of the tutor's panel's head, the mockup's: the profile's share alone, "100% used" too once
 * its cap is reached — why the tutor says nothing then is the panel's own line. None without a
 * share of the profile.
 */
export function shareText(share: QuotaShare | undefined, words: Words): string | undefined {
  if (share?.profilePercent === undefined) return undefined;
  return words.text("quota.learner", {
    percent: percentText(words.language, share.profilePercent),
  });
}

/** A share as the adult sees it: whose, how much in words, and the percentage its bar fills. */
export interface AdultShare {
  readonly whose: "profile" | "account";
  readonly label: string;
  /** "40% used", in the screen's language. */
  readonly used: string;
  readonly percent: number;
}

/**
 * What the adult sees of the quota: the profile's share and the account's, that the profile checks
 * no work by platform AI once a cap is reached, and when the next family day begins. With no share
 * at all — the tariff has no caps — the one line that platform AI is closed to the account.
 */
export type AdultQuota =
  | { readonly closed: string }
  | {
      readonly shares: readonly AdultShare[];
      readonly reached: string | undefined;
      readonly renews: string | undefined;
    };

export function adultQuota(share: QuotaShare, words: Words, now: Date = new Date()): AdultQuota {
  const { profilePercent, accountPercent } = share;
  if (profilePercent === undefined && accountPercent === undefined) {
    return { closed: words.text("quota.closed") };
  }
  const of = (whose: AdultShare["whose"], percent: number | undefined): AdultShare[] =>
    percent === undefined
      ? []
      : [
          {
            whose,
            label: words.text(whose === "profile" ? "quota.this-profile" : "quota.whole-account"),
            used: words.text("quota.used", { percent: percentText(words.language, percent) }),
            percent,
          },
        ];
  return {
    shares: [...of("profile", profilePercent), ...of("account", accountPercent)],
    reached: share.capReached ? words.text("quota.reached") : undefined,
    renews:
      share.nextFamilyDay === undefined
        ? undefined
        : dayText(RENEWS, timestampDate(share.nextFamilyDay), words, now),
  };
}
