import { OwnKeySchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
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
import { outcomeOf } from "./outcome.ts";
import { CAUSE_KEYS, failureText, outcomeText } from "./words.ts";

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
});

describe("the words of what a call came to", () => {
  it("has words in English and Russian for every cause of its table", () => {
    for (const key of Object.values(CAUSE_KEYS)) {
      for (const words of [WORDS.en, WORDS.ru]) expect(words.pattern(key)).not.toBe("");
    }
  });

  it("words each outcome, the quota with when it comes back in the screen's language", () => {
    const time = dateTimeFormat("ru", { timeStyle: "short" }).format(DAY);
    expect(outcomeText({ cause: Cause.QUOTA, nextFamilyDay: DAY }, WORDS.ru)).toBe(
      `Время наставника на сегодня кончилось. Оно вернётся в ${time}`,
    );
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
    const quota = refused(Cause.QUOTA, { case: "nextFamilyDay", value: timestampFromDate(DAY) });
    expect(failureText(quota, WORDS.en)).toBe(
      `Today's tutor time is used up. It comes back at ${dateTimeFormat("en", { timeStyle: "short" }).format(DAY)}`,
    );
  });
});
