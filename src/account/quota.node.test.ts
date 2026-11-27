// The share of the quota of platform AI, in Node (the contract): GetQuota by whose action, an api
// with no GetQuota as no share and no reload, and the learner's ring — its level, its words and its sign — and the words of the
// adult's section — the shares in percent, the cap reached, when the next family day begins by the
// device's calendar, and no share at all.
import {
  AccountService,
  type GetQuotaRequest,
  type QuotaShare,
  QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { dateTimeFormat, percentText } from "../i18n/intl.ts";
import { WORDS } from "../i18n/words.ts";
import { type AdultQuota, adultQuota, readQuota, ringOf, shareText } from "./quota.ts";

function harness(routes: (router: ConnectRouter) => void) {
  const on = { stale: vi.fn(), accountGone: async () => {}, noAccess: async () => {} };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t1", signOut: async () => {} },
    on,
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  return { api, on };
}

const share = (init: MessageInitShape<typeof QuotaShareSchema>): QuotaShare =>
  create(QuotaShareSchema, init);

// In the device's time zone, whatever it is: an evening, and the midnight after it.
const EVENING = new Date(2026, 10, 12, 21, 30);
const MIDNIGHT = new Date(2026, 10, 13, 0, 0);
const time = (language: "en" | "ru", at: Date) =>
  dateTimeFormat(language, { timeStyle: "short" }).format(at);

describe("readQuota", () => {
  it("asks the share of a profile by whose action, and gives it", async () => {
    const asked: GetQuotaRequest[] = [];
    const { api } = harness(({ service }) =>
      service(AccountService, {
        getQuota(request) {
          asked.push(request);
          const adult = request.action === Action.ADULT;
          return { share: { profilePercent: 40, ...(adult ? { accountPercent: 25 } : {}) } };
        },
      }),
    );
    expect((await readQuota(api, "p1", Action.ADULT))?.accountPercent).toBe(25);
    const learning = await readQuota(api, "p1", Action.LEARNING);
    expect([learning?.profilePercent, learning?.accountPercent]).toEqual([40, undefined]);
    expect(asked.map(({ profileId, action }) => [profileId, action])).toEqual([
      ["p1", Action.ADULT],
      ["p1", Action.LEARNING],
    ]);
  });

  it("reads an api with no GetQuota yet as no share, and offers it no reload", async () => {
    const { api, on } = harness(() => {});
    expect(await readQuota(api, "p1", Action.LEARNING)).toBeUndefined();
    expect(on.stale).not.toHaveBeenCalled();
  });

  it("gives any other failure to the screen", async () => {
    const { api } = harness(({ service }) =>
      service(AccountService, {
        getQuota() {
          throw new ConnectError("down", Code.Unavailable);
        },
      }),
    );
    const error = await readQuota(api, "p1", Action.ADULT).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure).toEqual({ kind: "offline" });
  });
});

describe("the learner's ring", () => {
  /** The ring of a share, there. */
  const ring = (init: Parameters<typeof share>[0], words = WORDS.en, now?: Date) => {
    const made = ringOf(share(init), words, now);
    if (made === undefined) throw new Error("no ring");
    return made;
  };

  it("is green below 50%, yellow from 50 to 80, red from 80, by the profile's share alone", () => {
    expect([0, 1, 49, 50, 79, 80, 99].map((p) => ring({ profilePercent: p }).level)).toEqual([
      "fresh",
      "low",
      "low",
      "half",
      "half",
      "high",
      "high",
    ]);
    const spent = ring({ profilePercent: 40, accountPercent: 90 });
    expect(spent).toMatchObject({
      fill: 40,
      number: "40",
      percent: "40%",
      name: "Tutor time: 40% used today",
      title: "Plenty left today",
      line: "Enough for many more questions and checks.",
    });
    // The number is the ring's alone: the words under the heading hold none.
    expect(spent.title + spent.line).not.toMatch(/\d/);
    // The account's share, which a learning action never gets, nowhere.
    expect(JSON.stringify(spent)).not.toMatch(/90/);
    expect(ring({ profilePercent: 40 }, WORDS.ru)).toMatchObject({
      name: `Время наставника: сегодня потрачено ${percentText("ru", 40)}`,
      percent: percentText("ru", 40),
    });
  });

  it("names its sign, not a number, while none is used, and says what each share means", () => {
    expect(ring({ profilePercent: 0 })).toMatchObject({
      fill: 0,
      name: "Tutor time: none used today",
      title: "None used yet today",
    });
    expect(ring({ profilePercent: 65 }).title).toBe("More than half used");
    expect(ring({ profilePercent: 85 }).line).toBe(
      "When it ends, the tutor and the AI's check of works wait until it renews.",
    );
  });

  it("is full and red once a cap is reached — the account's too —, and says when it renews", () => {
    const reached = {
      profilePercent: 70,
      capReached: true,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    };
    expect(ring(reached, WORDS.en, EVENING)).toMatchObject({
      level: "out",
      fill: 100,
      name: "Tutor time: used up today",
      title: "Used up for today",
      line: "Until it renews, the tutor and the AI's check of works wait.",
      renews: `Renews tomorrow at ${time("en", MIDNIGHT)}`,
    });
    expect(ring(reached, WORDS.ru, EVENING).renews).toBe(
      `Обновится завтра в ${time("ru", MIDNIGHT)}`,
    );
    // With no day beside it, no day it renews.
    expect(ring({ profilePercent: 100, capReached: true }).renews).toBeUndefined();
  });

  it("is none while the tariff has no caps", () => {
    expect(ringOf(share({}), WORDS.en)).toBeUndefined();
    expect(ringOf(share({ capReached: true }), WORDS.ru)).toBeUndefined();
  });
});

describe("the line of the tutor's panel", () => {
  it("says the profile's share, its cap reached too, and is none without it", () => {
    expect(shareText(share({ profilePercent: 20 }), WORDS.en)).toBe("Tutor time today: 20% used");
    expect(shareText(share({ profilePercent: 100, capReached: true }), WORDS.en)).toBe(
      "Tutor time today: 100% used",
    );
    expect(shareText(share({ accountPercent: 50 }), WORDS.en)).toBeUndefined();
    expect(shareText(undefined, WORDS.en)).toBeUndefined();
  });
});

/** What the adult sees, as lines: each share by its words and how much, then the cap and the day. */
function adultQuotaTexts(...args: Parameters<typeof adultQuota>): string[] {
  const quota: AdultQuota = adultQuota(...args);
  if ("closed" in quota) return [quota.closed];
  return [
    ...quota.shares.map((each) => `${each.label}: ${each.used}`),
    ...(quota.reached === undefined ? [] : [quota.reached]),
    ...(quota.renews === undefined ? [] : [quota.renews]),
  ];
}

describe("the adult's lines", () => {
  it("say the profile's share and the account's, each with its percentage, and when the next family day begins", () => {
    const spent = share({
      profilePercent: 40,
      accountPercent: 65,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    });
    expect(adultQuotaTexts(spent, WORDS.en, EVENING)).toEqual([
      "This profile: 40% used",
      "The whole account: 65% used",
      `Tutor time renews tomorrow at ${time("en", MIDNIGHT)}`,
    ]);
    const quota = adultQuota(spent, WORDS.en, EVENING);
    expect("shares" in quota && quota.shares.map((each) => [each.whose, each.percent])).toEqual([
      ["profile", 40],
      ["account", 65],
    ]);
    expect(adultQuotaTexts(spent, WORDS.ru, EVENING)).toEqual([
      `Этот профиль: потрачено ${percentText("ru", 40)}`,
      `Весь аккаунт: потрачено ${percentText("ru", 65)}`,
      `Время наставника обновится завтра в ${time("ru", MIDNIGHT)}`,
    ]);
  });

  it("say that no work of the profile goes to platform AI once a cap is reached, the account's too", () => {
    const reached = share({
      profilePercent: 30,
      accountPercent: 100,
      capReached: true,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    });
    expect(adultQuotaTexts(reached, WORDS.ru, EVENING)).toEqual([
      `Этот профиль: потрачено ${percentText("ru", 30)}`,
      `Весь аккаунт: потрачено ${percentText("ru", 100)}`,
      "Время наставника на сегодня кончилось: пока оно не обновится, ИИ платформы не проверяет работы этого профиля",
      `Время наставника обновится завтра в ${time("ru", MIDNIGHT)}`,
    ]);
  });

  it("name the day by the device's calendar: today, tomorrow, or its date", () => {
    const at = (day: Date) => share({ profilePercent: 1, nextFamilyDay: timestampFromDate(day) });
    // A family day that ends later today by the device's clock: the offset changed to the east.
    const late = new Date(2026, 10, 12, 23, 0);
    expect(adultQuotaTexts(at(late), WORDS.en, EVENING).at(-1)).toBe(
      `Tutor time renews today at ${time("en", late)}`,
    );
    // A family day of up to 44 hours after a change of the offset: the date of its end.
    const after = new Date(2026, 10, 14, 6, 0);
    expect(adultQuotaTexts(at(after), WORDS.en, EVENING).at(-1)).toBe(
      `Tutor time renews on November 14 at ${time("en", after)}`,
    );
    expect(adultQuotaTexts(at(after), WORDS.ru, EVENING).at(-1)).toBe(
      `Время наставника обновится 14 ноября в ${time("ru", after)}`,
    );
    // No day, no line of it.
    expect(adultQuotaTexts(share({ profilePercent: 1 }), WORDS.en)).toEqual([
      "This profile: 1% used",
    ]);
  });

  it("are one line, that platform AI is closed to the account, while the tariff has no caps", () => {
    const none = share({ nextFamilyDay: timestampFromDate(MIDNIGHT) });
    expect(adultQuotaTexts(none, WORDS.en, EVENING)).toEqual([
      "The platform's AI has no tutor time on this account now: it is closed to it",
    ]);
    expect(adultQuotaTexts(share({}), WORDS.ru)).toEqual([
      "У этого аккаунта сейчас нет времени наставника: ИИ платформы для него закрыт",
    ]);
    // A share of the account alone, which api should not give, is shown as it came.
    expect(adultQuotaTexts(share({ accountPercent: 5 }), WORDS.en)).toEqual([
      "The whole account: 5% used",
    ]);
  });
});
