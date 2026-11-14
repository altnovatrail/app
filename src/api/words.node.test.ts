import { OwnKeySchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  LimitCause,
  OutcomeSchema,
  OwnKeyLimitSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { dateTimeFormat } from "../i18n/intl.ts";
import { WORDS } from "../i18n/words.ts";
import type { Failure } from "./failure.ts";
import { aiFields, clockOffsetMinutes, idempotencyKey } from "./keys.ts";
import { closesAI, outcomeOf } from "./outcome.ts";
import { CAUSE_KEYS, calendarDays, failureText, outcomeText } from "./words.ts";

const DAY = new Date(Date.UTC(2026, 10, 11, 4, 0));

describe("the keys of a request", () => {
  it("makes a new idempotency key for each action", () => {
    const keys = new Set(Array.from({ length: 50 }, idempotencyKey));
    expect(keys.size).toBe(50);
    expect([...keys][0]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sends the clock's offset on platform AI alone, and the own key without it", () => {
    const winter = new Date(Date.UTC(2026, 0, 15));
    expect(clockOffsetMinutes(winter)).toBe(-winter.getTimezoneOffset() || 0);
    expect(aiFields(undefined, winter)).toEqual({ clockOffsetMinutes: clockOffsetMinutes(winter) });
    const ownKey = create(OwnKeySchema, {});
    expect(aiFields(ownKey)).toEqual({ ownKey });
    expect(typeof clockOffsetMinutes()).toBe("number");
  });
});

describe("outcomeOf", () => {
  it("reads an outcome with what it tells, and one the build does not know as a failure of AI", () => {
    expect(outcomeOf(undefined)).toBeUndefined();
    const quota = outcomeOf(
      create(OutcomeSchema, { cause: Cause.QUOTA, nextFamilyDay: timestampFromDate(DAY) }),
    );
    expect(quota).toEqual({ cause: Cause.QUOTA, nextFamilyDay: DAY });
    const limit = create(OwnKeyLimitSchema, {});
    expect(
      outcomeOf(create(OutcomeSchema, { cause: Cause.LIMIT_REACHED, ownKeyLimit: limit })),
    ).toEqual({
      cause: Cause.LIMIT_REACHED,
      ownKeyLimit: limit,
    });
    expect(outcomeOf(create(OutcomeSchema, { cause: 999 as Cause }))).toEqual({
      cause: Cause.AI_FAILURE,
    });
    expect(outcomeOf(create(OutcomeSchema, { cause: Cause.ATTEMPT_CLOSED }))).toEqual({
      cause: Cause.AI_FAILURE,
    });
  });

  it("tells the quota and the limits, and the key refused, apart from a moment's failure and no admission", () => {
    expect(closesAI({ cause: Cause.QUOTA, nextFamilyDay: DAY })).toBe(true);
    expect(closesAI({ cause: Cause.PLATFORM_LIMIT })).toBe(true);
    expect(closesAI({ cause: Cause.LIMIT_REACHED })).toBe(true);
    expect(closesAI({ cause: Cause.KEY_REFUSED })).toBe(true);
    for (const cause of [Cause.AI_FAILURE, Cause.NOT_ADMITTED, Cause.NO_OTHER_WORDS]) {
      expect(closesAI({ cause })).toBe(false);
    }
    expect(closesAI(undefined)).toBe(false);
  });
});

describe("calendarDays", () => {
  it("counts the dates of the device's calendar, not the hours between", () => {
    const late = new Date(2026, 10, 12, 23, 59);
    expect(calendarDays(late, new Date(2026, 10, 12, 0, 0))).toBe(0);
    expect(calendarDays(late, new Date(2026, 10, 13, 0, 1))).toBe(1);
    expect(calendarDays(new Date(2026, 10, 12, 0, 0), new Date(2026, 10, 13, 23, 59))).toBe(1);
    expect(calendarDays(late, new Date(2026, 10, 14, 6, 0))).toBe(2);
    expect(calendarDays(late, new Date(2026, 10, 11, 23, 0))).toBe(-1);
    // Across a change of summer time the days stay whole.
    expect(calendarDays(new Date(2026, 2, 28, 12, 0), new Date(2026, 2, 30, 12, 0))).toBe(2);
    expect(calendarDays(new Date(2026, 9, 24, 12, 0), new Date(2026, 9, 26, 12, 0))).toBe(2);
  });
});

describe("the words of what a call came to", () => {
  it("has words in English and Russian for every cause of its table", () => {
    for (const key of Object.values(CAUSE_KEYS)) {
      for (const words of [WORDS.en, WORDS.ru]) expect(words.pattern(key)).not.toBe("");
    }
  });

  it("words each outcome, the quota with when it comes back in the screen's language", () => {
    // In the device's time zone, whatever it is: an evening, and the midnight after it.
    const evening = new Date(2026, 10, 12, 21, 30);
    const midnight = new Date(2026, 10, 13, 0, 0);
    const time = (language: "en" | "ru", at: Date) =>
      dateTimeFormat(language, { timeStyle: "short" }).format(at);
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: midnight }, WORDS.ru, evening)).toBe(
      `Время наставника на сегодня кончилось. Оно вернётся завтра в ${time("ru", midnight)}`,
    );
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: midnight }, WORDS.en, evening)).toBe(
      `Today's tutor time is used up. It comes back tomorrow at ${time("en", midnight)}`,
    );
    // A family day that ends later today by the device's clock: the offset changed to the east.
    const late = new Date(2026, 10, 12, 23, 0);
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: late }, WORDS.ru, evening)).toBe(
      `Время наставника на сегодня кончилось. Оно вернётся сегодня в ${time("ru", late)}`,
    );
    // A time of today the device's clock has passed — it runs ahead of api's — is today as well,
    // and one on a day before today, by a clock far off, is its date.
    expect(
      outcomeText(
        { cause: Cause.QUOTA, nextFamilyDay: late },
        WORDS.en,
        new Date(2026, 10, 12, 23, 30),
      ),
    ).toBe(`Today's tutor time is used up. It comes back today at ${time("en", late)}`);
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: late }, WORDS.en, midnight)).toBe(
      `Today's tutor time is used up. It comes back on November 12 at ${time("en", late)}`,
    );
    // A family day of up to 44 hours after a change of the offset: the date of its end (R56 api).
    const after = new Date(2026, 10, 14, 6, 0);
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: after }, WORDS.ru, evening)).toBe(
      `Время наставника на сегодня кончилось. Оно вернётся 14 ноября в ${time("ru", after)}`,
    );
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: after }, WORDS.en, evening)).toBe(
      `Today's tutor time is used up. It comes back on November 14 at ${time("en", after)}`,
    );
    // The last day of a month, and of a year: tomorrow is the first of the next.
    const eve = new Date(2026, 11, 31, 22, 0);
    expect(
      outcomeText({ cause: Cause.QUOTA, nextFamilyDay: new Date(2027, 0, 1) }, WORDS.en, eve),
    ).toMatch(/It comes back tomorrow at /);
    expect(typeof outcomeText({ cause: Cause.QUOTA, nextFamilyDay: DAY }, WORDS.ru)).toBe("string");
    expect(outcomeText({ cause: Cause.QUOTA }, WORDS.en)).toBe("The tutor can't answer right now");
    expect(outcomeText({ cause: Cause.PLATFORM_LIMIT }, WORDS.ru)).toBe(
      "Наставник сейчас не может ответить",
    );
    expect(outcomeText({ cause: Cause.KEY_REFUSED }, WORDS.en)).toBe(
      "The AI service didn't accept your key",
    );
    expect(outcomeText({ cause: Cause.NO_OTHER_WORDS }, WORDS.en)).toBe(
      "The tutor has no other words for this",
    );
  });

  it("words the own key's limit by which one ran out, and when access comes back", () => {
    const limit = (cause: LimitCause, accessReturns?: Date) =>
      create(OwnKeyLimitSchema, {
        cause,
        ...(accessReturns === undefined ? {} : { accessReturns: timestampFromDate(accessReturns) }),
      });
    expect(outcomeText({ cause: Cause.LIMIT_REACHED }, WORDS.en)).toBe(
      "The limit of your AI key is used up",
    );
    expect(
      outcomeText(
        { cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(LimitCause.UNSPECIFIED) },
        WORDS.ru,
      ),
    ).toBe("Лимит вашего ключа ИИ исчерпан");
    expect(
      outcomeText({ cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(LimitCause.LIMIT) }, WORDS.en),
    ).toBe("The spending limit set for your AI key is reached");
    expect(
      outcomeText({ cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(LimitCause.TIER) }, WORDS.ru),
    ).toBe("Ваш ключ ИИ упёрся в предел своего уровня у поставщика");
    expect(
      outcomeText({ cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(LimitCause.PAYMENT) }, WORDS.en),
    ).toBe("The AI provider couldn't take the payment for your key");
    // A cause the build does not know is the limit at large.
    expect(
      outcomeText({ cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(99 as LimitCause) }, WORDS.en),
    ).toBe("The limit of your AI key is used up");
    const at = new Date(2026, 11, 1, 9, 0);
    const time = dateTimeFormat("ru", { timeStyle: "short" }).format(at);
    expect(
      outcomeText(
        { cause: Cause.LIMIT_REACHED, ownKeyLimit: limit(LimitCause.BALANCE, at) },
        WORDS.ru,
      ),
    ).toBe(`На счёте вашего ключа ИИ кончились деньги. Доступ вернётся 1 декабря в ${time}`);
  });

  it("words each failure, and a cause with no words of its own by the common string", () => {
    const refused = (
      cause: Cause,
      data: Failure & { kind: "refused" } extends { data: infer D } ? D : never,
    ): Failure => ({
      kind: "refused",
      cause,
      data,
      code: Code.FailedPrecondition,
    });
    const none = { case: undefined } as const;
    const cases: [Failure, string][] = [
      [refused(Cause.ATTEMPT_CLOSED, none), "Эта задача уже закончена"],
      [refused(Cause.NO_CONSENT, none), "Сначала нужно согласие взрослого"],
      [refused(Cause.VERSION_NOT_GIVEN, none), "Эта версия модуля больше не выдаётся"],
      [refused(Cause.PIN_LOCKED, none), "Эта версия приложения этого ещё не знает"],
      [refused(999 as Cause, none), "Эта версия приложения этого ещё не знает"],
      [{ kind: "offline" }, "Нет связи"],
      [{ kind: "sign-in" }, "Нужно войти снова"],
      [{ kind: "account-gone" }, "Нужно войти снова"],
      [{ kind: "fresh-sign-in", maxAuthAgeSeconds: 300 }, "Чтобы это сделать, нужно войти снова"],
      [{ kind: "no-access" }, "У этого аккаунта ещё нет доступа"],
      [{ kind: "stale" }, "Вышла новая версия приложения"],
      [{ kind: "invalid" }, "Эта версия приложения этого ещё не знает"],
      [{ kind: "forbidden" }, "Эта версия приложения этого ещё не знает"],
      [{ kind: "unknown", code: Code.Internal }, "Эта версия приложения этого ещё не знает"],
    ];
    for (const [failure, text] of cases) expect(failureText(failure, WORDS.ru)).toBe(text);
    // The refusal says the same as the outcome, by the device's calendar.
    const midnight = new Date(2026, 10, 13, 0, 0);
    const quota = refused(Cause.QUOTA, {
      case: "nextFamilyDay",
      value: timestampFromDate(midnight),
    });
    expect(failureText(quota, WORDS.en, new Date(2026, 10, 12, 18, 0))).toBe(
      `Today's tutor time is used up. It comes back tomorrow at ${dateTimeFormat("en", { timeStyle: "short" }).format(midnight)}`,
    );
    expect(failureText(refused(Cause.QUOTA, none), WORDS.en)).toBe(
      "The tutor can't answer right now",
    );
    expect(typeof failureText(quota, WORDS.ru)).toBe("string");
  });
});
