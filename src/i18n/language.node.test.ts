import { describe, expect, it } from "vitest";
import { deviceLanguage, learnerLanguage, lookup } from "./language.ts";

describe("lookup", () => {
  it("cuts a tag from the right until the build has it, a one-letter subtag with the next", () => {
    expect(lookup("ru-RU")).toBe("ru");
    expect(lookup("ru-Latn-RU")).toBe("ru");
    expect(lookup("en-GB")).toBe("en");
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

describe("learnerLanguage", () => {
  it("is the profile's field as the build finds it, else the device's", () => {
    expect(learnerLanguage("ru", "en")).toBe("ru");
    expect(learnerLanguage("ru-RU", "en")).toBe("ru");
    expect(learnerLanguage(undefined, "ru")).toBe("ru");
    expect(learnerLanguage("", "ru")).toBe("ru");
    expect(learnerLanguage("kk", "ru")).toBe("ru");
  });
});
