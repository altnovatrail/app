// The voice of a language, by tables of the lists that browsers give (section 3.5 of
// docs/architecture.md): names and flags as the sources of section 4 report them, read 2026-11-02.
// The voices are synthetic stand-ins with the names that matter — a network voice of Chrome, an
// "Online" voice of Edge, WebKit's every voice marked default, Android's `en_US`.
import { VoicingSpeed } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { describe, expect, it } from "vitest";
import { voice } from "../test/speech.ts";
import {
  candidates,
  mayUse,
  needsLeave,
  platformOf,
  rateOf,
  SLOW_RATE,
  tagOf,
  voiceFor,
} from "./voices.ts";

const names = (voices: readonly { name: string }[]) => voices.map(({ name }) => name);

/** The lists of voices a browser gives, by browser and system. */
const LISTS = {
  "Chrome on Windows": [
    voice("Microsoft David - English (United States)", "en-US", { isDefault: true }),
    voice("Microsoft Zira - English (United States)", "en-US"),
    voice("Microsoft Irina - Russian (Russia)", "ru-RU"),
    voice("Google US English", "en-US", { local: false }),
    voice("Google UK English Female", "en-GB", { local: false }),
    voice("Google русский", "ru-RU", { local: false }),
  ],
  "Edge on Windows": [
    voice("Microsoft David - English (United States)", "en-US", { isDefault: true }),
    voice("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
    voice("Microsoft Svetlana Online (Natural) - Russian (Russia)", "ru-RU"),
  ],
  "Safari on a Mac": [
    voice("Samantha", "en-US", { isDefault: true }),
    voice("Daniel", "en-GB", { isDefault: true }),
    voice("Milena", "ru-RU", { isDefault: true }),
  ],
  "Firefox on a Mac": [voice("Samantha", "en-US", { isDefault: true }), voice("Milena", "ru-RU")],
  "Chrome on Android": [
    voice("English United States", "en_US", { isDefault: true }),
    voice("English United Kingdom", "en_GB"),
    voice("Russian Russia", "ru_RU"),
  ],
  "Chrome on a Chromebook": [
    voice("Chrome OS US English", "en-US", { isDefault: true }),
    voice("Google US English", "en-US", { local: false }),
  ],
  "Chrome on Linux with no speech-dispatcher": [],
} as const;

describe("the voice of a language", () => {
  it.each([
    ["Chrome on Windows", "en", "Microsoft David - English (United States)"],
    ["Chrome on Windows", "ru", "Microsoft Irina - Russian (Russia)"],
    ["Edge on Windows", "en", "Microsoft David - English (United States)"],
    ["Edge on Windows", "ru", undefined],
    ["Safari on a Mac", "en", "Samantha"],
    ["Safari on a Mac", "en-GB", "Daniel"],
    ["Safari on a Mac", "ru", "Milena"],
    ["Firefox on a Mac", "ru", "Milena"],
    ["Chrome on Android", "en", "English United States"],
    ["Chrome on Android", "en-GB", "English United Kingdom"],
    ["Chrome on Android", "ru", "Russian Russia"],
    ["Chrome on a Chromebook", "en", "Chrome OS US English"],
    ["Chrome on a Chromebook", "ru", undefined],
    ["Chrome on Linux with no speech-dispatcher", "en", undefined],
  ] as const)("on %s, for %s, is %s", (list, language, expected) => {
    expect(voiceFor(LISTS[list], language)?.name).toBe(expected);
  });

  it("is never a network voice of Chrome nor an Online voice of Edge", () => {
    expect(names(candidates(LISTS["Chrome on Windows"], "en"))).toEqual([
      "Microsoft David - English (United States)",
      "Microsoft Zira - English (United States)",
    ]);
    expect(names(candidates(LISTS["Edge on Windows"], "en"))).toEqual([
      "Microsoft David - English (United States)",
    ]);
    expect(mayUse(voice("Microsoft Jenny Online (Natural)", "en-US"))).toBe(false);
    expect(mayUse(voice("Microsoft Jenny", "en-US"))).toBe(true);
  });

  it("takes the same tag first, then a longer one, then the language less its last subtag", () => {
    const voices = [
      voice("British", "en-GB"),
      voice("Plain", "en"),
      voice("Scottish", "en-GB-scotland"),
    ];
    expect(names(candidates(voices, "en"))).toEqual(["Plain", "British", "Scottish"]);
    expect(names(candidates(voices, "en-GB"))).toEqual(["British", "Scottish"]);
    expect(names(candidates(voices, "en-AU"))).toEqual(["Plain", "British", "Scottish"]);
    expect(names(candidates(voices, "EN_gb"))).toEqual(["British", "Scottish"]);
    // A prefix that is no subtag of it does not match: "e" is no range of "en".
    expect(candidates(voices, "e")).toEqual([]);
    expect(candidates(voices, "")).toEqual([]);
    expect(candidates(voices, "de")).toEqual([]);
  });

  it("is the adult's choice when it is a candidate, and else the device's", () => {
    const list = LISTS["Chrome on Windows"];
    const zira = "uri:Microsoft Zira - English (United States)";
    expect(voiceFor(list, "en", zira)?.name).toBe("Microsoft Zira - English (United States)");
    // A voice no longer there, or one of another language, or a network voice is no choice.
    expect(voiceFor(list, "en", "uri:gone")?.name).toBe(
      "Microsoft David - English (United States)",
    );
    expect(voiceFor(list, "en", "uri:Microsoft Irina - Russian (Russia)")?.name).toBe(
      "Microsoft David - English (United States)",
    );
    expect(voiceFor(list, "en", "uri:Google US English")?.name).toBe(
      "Microsoft David - English (United States)",
    );
  });

  it("is the one default marks only when it marks one alone, else the first", () => {
    const voices = [voice("First", "en-US"), voice("Marked", "en-US", { isDefault: true })];
    expect(voiceFor(voices, "en")?.name).toBe("Marked");
    const all = [
      voice("A", "en-US", { isDefault: true }),
      voice("B", "en-US", { isDefault: true }),
    ];
    expect(voiceFor(all, "en")?.name).toBe("A");
  });

  it("compares tags in lower case, with Android's _ read as -", () => {
    expect(tagOf(" en_US ")).toBe("en-us");
    expect(tagOf("ru-RU")).toBe("ru-ru");
  });
});

describe("the platform", () => {
  const WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const ANDROID =
    "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
  const CHROMEBOOK =
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
  const LINUX = "Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0";
  const IPAD =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

  it.each([
    ["Android", WINDOWS, "android"],
    ["Chrome OS", LINUX, "chromeos"],
    ["Linux", WINDOWS, "linux"],
    ["Windows", ANDROID, "other"],
    ["macOS", LINUX, "other"],
    ["iOS", ANDROID, "other"],
  ] as const)("is named by userAgentData first: %s", (platform, userAgent, expected) => {
    expect(platformOf({ userAgent, userAgentData: { platform } })).toBe(expected);
  });

  it.each([
    [ANDROID, "android"],
    [CHROMEBOOK, "chromeos"],
    [LINUX, "linux"],
    [WINDOWS, "other"],
    [IPAD, "other"],
  ] as const)("else by the user agent string: %s", (userAgent, expected) => {
    expect(platformOf({ userAgent })).toBe(expected);
    // A value app does not know — Fuchsia, Unknown, an empty one — is no value.
    expect(platformOf({ userAgent, userAgentData: { platform: "Unknown" } })).toBe(expected);
    expect(platformOf({ userAgent, userAgentData: { platform: "" } })).toBe(expected);
  });

  it("waits for the adult's leave on Android and Linux alone", () => {
    expect(needsLeave("android")).toBe(true);
    expect(needsLeave("linux")).toBe(true);
    expect(needsLeave("chromeos")).toBe(false);
    expect(needsLeave("other")).toBe(false);
  });
});

describe("the rate", () => {
  it("is the voice's own for the normal speed and for a speed the build does not know", () => {
    expect(rateOf(VoicingSpeed.NORMAL)).toBe(1);
    expect(rateOf(VoicingSpeed.UNSPECIFIED)).toBe(1);
    expect(rateOf(undefined)).toBe(1);
    expect(rateOf(7 as VoicingSpeed)).toBe(1);
  });

  it("is slower for the slow speed", () => {
    expect(rateOf(VoicingSpeed.SLOW)).toBe(SLOW_RATE);
    expect(SLOW_RATE).toBeLessThan(1);
  });
});
