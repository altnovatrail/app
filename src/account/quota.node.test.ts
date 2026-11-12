// The share of the quota of platform AI, in Node (section 15 of the text of the contracts, "The
// quota"): GetQuota by whose action, an api with no GetQuota as no share and no reload, and the
// words of the learner's line and of the adult's section — the shares in percent, the cap reached,
// when the next family day begins by the device's calendar, and no share at all.
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
import { adultQuotaTexts, learnerQuotaText, readQuota } from "./quota.ts";

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

describe("the learner's line", () => {
  it("says the profile's share in percent, as the language writes it, and never the account's", () => {
    const spent = share({ profilePercent: 40, accountPercent: 90 });
    expect(learnerQuotaText(spent, WORDS.en)).toBe("Tutor time today: 40% used");
    expect(learnerQuotaText(spent, WORDS.ru)).toBe(
      `Время наставника на сегодня: потрачено ${percentText("ru", 40)}`,
    );
    expect(learnerQuotaText(share({ profilePercent: 0 }), WORDS.en)).toBe(
      "Tutor time today: 0% used",
    );
  });

  it("says, once a cap is reached, what a refusal of the quota says: when the tutor comes back", () => {
    const reached = share({
      profilePercent: 70,
      capReached: true,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    });
    expect(learnerQuotaText(reached, WORDS.en, EVENING)).toBe(
      `Today's tutor time is used up. It comes back tomorrow at ${time("en", MIDNIGHT)}`,
    );
    expect(learnerQuotaText(reached, WORDS.ru, EVENING)).toBe(
      `Время наставника на сегодня кончилось. Оно вернётся завтра в ${time("ru", MIDNIGHT)}`,
    );
    // With no day beside it, the neutral phrase, as the refusal has.
    expect(learnerQuotaText(share({ profilePercent: 100, capReached: true }), WORDS.en)).toBe(
      "The tutor can't answer right now",
    );
  });

  it("is no line while the tariff has no caps", () => {
    expect(learnerQuotaText(share({}), WORDS.en)).toBeUndefined();
    expect(learnerQuotaText(share({ capReached: true }), WORDS.ru)).toBeUndefined();
  });
});

describe("the adult's lines", () => {
  it("say the profile's share and the account's, and when the next family day begins", () => {
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
    // A family day of up to 44 hours after a change of the offset: the date of its end (R56 api).
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
