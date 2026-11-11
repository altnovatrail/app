import { describe, expect, it, vi } from "vitest";
import { PSEUDO, pseudoString } from "../test/pseudo.ts";
import { keyFor } from "./codes.ts";
import { en } from "./en.ts";
import { collator, dateTimeFormat, languageName, languageNames, numberFormat } from "./intl.ts";
import { LANGUAGES } from "./language.ts";
import { ru } from "./ru.ts";
import {
  CATEGORIES,
  type Dictionary,
  type Holds,
  plural,
  type SamePlaces,
  type Translation,
} from "./types.ts";
import { fill, type Strings, WORDS, wordsOf } from "./words.ts";

describe("the dictionaries", () => {
  it("have the categories of the forms of a number that Intl gives each language, other among them", () => {
    for (const language of LANGUAGES) {
      const categories = new Intl.PluralRules(language).resolvedOptions().pluralCategories;
      expect([...CATEGORIES[language]].sort()).toEqual([...categories].sort());
      expect(CATEGORIES[language]).toContain("other");
    }
  });

  it("have the same keys, and Russian strings that are Russian", () => {
    expect(Object.keys(ru).sort()).toEqual(Object.keys(en).sort());
    expect(ru["boot.offline"]).toBe("Нет связи");
  });

  it("are held to the source by tsc: a key missing, a key more, a form missing, a place renamed", () => {
    const source = {
      count: plural({ one: "{count} step", other: "{count} steps" }),
      named: "Profile: {name}",
    } as const satisfies Dictionary;
    const good = {
      count: plural({
        one: "{count} шаг",
        few: "{count} шага",
        many: "{count} шагов",
        other: "{count} шага",
      }),
      named: "Профиль: {name}",
    } as const satisfies Translation<typeof source, "ru">;
    // @ts-expect-error -- "named" is missing.
    const missing = { count: good.count } as const satisfies Translation<typeof source, "ru">;
    const more = {
      ...good,
      // @ts-expect-error -- no such key in the source.
      extra: "x",
    } as const satisfies Translation<typeof source, "ru">;
    const noFew = {
      // @ts-expect-error -- Russian has the form `few`.
      count: plural({ one: "{count} шаг", many: "{count} шагов", other: "{count} шага" }),
      named: "Профиль: {name}",
    } as const satisfies Translation<typeof source, "ru">;
    const renamed = { ...good, named: "Профиль: {pseudonym}" } as const;
    type Good = Holds<SamePlaces<typeof source, typeof good>>;
    // @ts-expect-error -- "named" has {pseudonym}, not {name}.
    type Renamed = Holds<SamePlaces<typeof source, typeof renamed>>;
    const checks: [Good, Renamed?] = [true];
    expect([missing, more, noFew, checks]).toHaveLength(4);
  });
});

describe("words", () => {
  it("fill each place by name, and leave one without a value as it is", () => {
    expect(WORDS.en.text("app.document-title", { screen: "No connection" })).toBe(
      "No connection — NovaTrail",
    );
    expect(WORDS.ru.text("boot.offline")).toBe("Нет связи");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    expect(fill("{constructor}, {toString}", {})).toBe("{constructor}, {toString}");
  });

  it("take the form of a number that Intl.PluralRules chooses, and `other` where the form is not there", () => {
    const forms = plural({
      one: "{count} шаг",
      few: "{count} шага",
      many: "{count} шагов",
      other: "{count} шага",
    });
    const strings = { ...ru, "boot.retry": forms } as unknown as Strings;
    const words = wordsOf(strings, "ru");
    expect(
      [1, 2, 5, 0, 21, 1.5].map((count) => fill(words.pattern("boot.retry", count), { count })),
    ).toEqual(["1 шаг", "2 шага", "5 шагов", "0 шагов", "21 шаг", "1.5 шага"]);
    const short = {
      ...ru,
      "boot.retry": plural({ one: "{count} шаг", other: "{count} шага" }),
    } as unknown as Strings;
    expect(wordsOf(short, "ru").pattern("boot.retry", 2)).toBe("{count} шага");
    expect(wordsOf(short, "ru").pattern("boot.retry")).toBe("{count} шага");
  });
});

describe("keyFor", () => {
  it("gives a known code's words, and the common string for one the build does not know", () => {
    const table = { VERDICT_CORRECT: "boot.retry", 2: "boot.offline" } as const;
    expect(keyFor(table, "VERDICT_CORRECT")).toBe("boot.retry");
    expect(keyFor(table, 2)).toBe("boot.offline");
    expect(keyFor(table, "VERDICT_NEW")).toBe("common.unknown");
    expect(keyFor(table, "toString")).toBe("common.unknown");
    expect(WORDS.ru.text(keyFor(table, 99))).toBe("Эта версия приложения этого ещё не знает");
  });
});

describe("Intl in the screen's language", () => {
  it("writes numbers, dates, names of languages and orders as the language does", () => {
    expect(numberFormat("ru").format(1.5)).toBe("1,5");
    expect(numberFormat("en").format(1.5)).toBe("1.5");
    const day = new Date(Date.UTC(2026, 10, 10));
    expect(dateTimeFormat("ru", { dateStyle: "long", timeZone: "UTC" }).format(day)).toBe(
      "10 ноября 2026 г.",
    );
    expect(languageNames("ru").of("en")).toBe("английский");
    // By the language's order, not by code units, which would put "борис" last.
    expect(["Яна", "борис", "Анна", "Ель"].sort(collator("ru").compare)).toEqual([
      "Анна",
      "борис",
      "Ель",
      "Яна",
    ]);
  });

  it("writes a language's name in a Russian sentence in lower case, whatever the engine gives", () => {
    expect(languageName("ru", "en")).toBe("английский");
    expect(languageName("en", "ru")).toBe("Russian");
    // JavaScriptCore's Intl writes it with a capital, as WebKit showed it in T34.
    const of = vi.spyOn(Intl.DisplayNames.prototype, "of").mockReturnValue("Английский");
    try {
      expect(languageName("ru", "en")).toBe("английский");
      expect(languageName("en", "en")).toBe("Английский");
      of.mockReturnValue(undefined);
      expect(languageName("ru", "en")).toBe("en");
    } finally {
      of.mockRestore();
    }
  });
});

describe("the pseudo-language", () => {
  it("accents English, makes it half as long again, and keeps its places", () => {
    const text = pseudoString("{screen} — NovaTrail");
    expect(text.startsWith("{screen} — ÑőváTráíl")).toBe(true);
    expect(text.length).toBeGreaterThanOrEqual(Math.floor("{screen} — NovaTrail".length * 1.5));
    expect(Object.keys(PSEUDO).sort()).toEqual(Object.keys(en).sort());
    expect(wordsOf(PSEUDO, "en").text("app.document-title", { screen: "X" })).toMatch(/^X — /);
  });
});
