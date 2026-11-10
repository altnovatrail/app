import { describe, expect, it } from "vitest";
import { formatHash, HOME, parseHash, SCREENS } from "./hash.ts";

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

  it("writes the home screen as #/home", () => {
    expect(formatHash(HOME)).toBe("#/home");
    expect(SCREENS.has(HOME.screen)).toBe(true);
  });
});
