import { describe, expect, it } from "vitest";
import { ADULTS, formatHash, HOME, LEGAL, LESSON, parseHash, SCREENS, TASK } from "./hash.ts";

describe("parseHash", () => {
  it("gives the home screen for an empty hash, a bare # and a hash without a slash", () => {
    expect(parseHash("")).toEqual(HOME);
    expect(parseHash("#")).toEqual(HOME);
    expect(parseHash("#home")).toEqual(HOME);
  });

  it("gives the home screen for a screen this build does not know", () => {
    expect(parseHash("#/nowhere")).toEqual(HOME);
    expect(parseHash("#/")).toEqual(HOME);
  });

  it("reads a known screen and its parts, percent-decoded", () => {
    expect(parseHash("#/home")).toEqual({ screen: "home", parts: [] });
    expect(parseHash("#/home/a%2Fb/%D1%83%D1%80%D0%BE%D0%BA")).toEqual({
      screen: "home",
      parts: ["a/b", "урок"],
    });
  });

  it("gives the home screen for an empty part and for a malformed escape", () => {
    expect(parseHash("#/home//x")).toEqual(HOME);
    expect(parseHash("#/home/")).toEqual(HOME);
    expect(parseHash("#/home/%E0%A4%A")).toEqual(HOME);
  });
});

describe("formatHash", () => {
  it("percent-encodes each segment, so that parseHash gives the route back", () => {
    const route = { screen: "home", parts: ["a/b", "урок", "x y"] };
    expect(formatHash(route)).toBe("#/home/a%2Fb/%D1%83%D1%80%D0%BE%D0%BA/x%20y");
    expect(parseHash(formatHash(route))).toEqual(route);
  });

  it("knows the task screen and the lesson player, which name no attempt and no run", () => {
    expect(parseHash("#/task")).toEqual(TASK);
    expect(parseHash("#/lesson")).toEqual(LESSON);
    expect(formatHash(LESSON)).toBe("#/lesson");
  });

  it("knows the section for adults and its pages, which name no profile", () => {
    expect(parseHash("#/adults")).toEqual(ADULTS);
    expect(parseHash("#/adults/profile")).toEqual({ screen: "adults", parts: ["profile"] });
    expect(formatHash({ ...ADULTS, parts: ["profile"] })).toBe("#/adults/profile");
  });

  it("knows the legal pages, a text's among them by its ID", () => {
    expect(parseHash("#/legal")).toEqual(LEGAL);
    expect(parseHash("#/legal/privacy-policy")).toEqual({
      screen: "legal",
      parts: ["privacy-policy"],
    });
    expect(formatHash({ ...LEGAL, parts: ["notices"] })).toBe("#/legal/notices");
  });

  it("writes the home screen as #/home", () => {
    expect(formatHash(HOME)).toBe("#/home");
    expect(SCREENS.has(HOME.screen)).toBe(true);
  });
});
