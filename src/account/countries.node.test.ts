import { describe, expect, it } from "vitest";
import { COUNTRIES, countryNames } from "./countries.ts";

describe("the countries", () => {
  it("are the 249 codes of ISO 3166-1 alpha-2, each once, in their order", () => {
    expect(COUNTRIES).toHaveLength(249);
    expect(new Set(COUNTRIES).size).toBe(249);
    expect([...COUNTRIES].sort()).toEqual(COUNTRIES);
    for (const code of COUNTRIES) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("each have a name of their own in English and in Russian", () => {
    for (const language of ["en", "ru"] as const) {
      const names = new Intl.DisplayNames([language], { type: "region", fallback: "none" });
      for (const code of COUNTRIES) expect(names.of(code), `${language} ${code}`).toBeDefined();
    }
  });

  it("go by their names, in the order of the screen's language", () => {
    const ru = countryNames("ru");
    expect(ru).toHaveLength(249);
    expect(ru[0]?.name).toBe("Австралия");
    expect(ru.find((country) => country.code === "US")?.name).toBe("Соединенные Штаты");
    expect(countryNames("en")[0]).toEqual({ code: "AF", name: "Afghanistan" });
  });
});
