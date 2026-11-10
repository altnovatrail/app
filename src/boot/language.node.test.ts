import { describe, expect, it } from "vitest";
import { deviceLanguage, lookup } from "./language.ts";

describe("lookup", () => {
  it("cuts a tag from the right until the build has it, a one-letter subtag with the next", () => {
    expect(lookup("ru-RU")).toBe("ru");
    expect(lookup("EN-gb")).toBe("en");
    expect(lookup("ru-x-private")).toBe("ru");
    expect(lookup("en-a-bbb-x")).toBe("en");
    expect(lookup("kk-KZ")).toBeUndefined();
    expect(lookup("be")).toBeUndefined();
  });
});

describe("deviceLanguage", () => {
  it("is the first language of the device the build has, else English", () => {
    expect(deviceLanguage(["kk-KZ", "ru-RU", "en"])).toBe("ru");
    expect(deviceLanguage(["de-DE"])).toBe("en");
    expect(deviceLanguage([])).toBe("en");
  });
});
