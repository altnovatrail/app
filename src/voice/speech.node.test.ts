// The one synthesis (section 3.5 of docs/architecture.md), on a synthesis of the test: what it is
// asked to say and to cancel, sentence by sentence, by the voice of each phrase's language.
import { describe, expect, it, vi } from "vitest";
import { fakeSpeech, voice } from "../test/speech.ts";
import { Speech, type SynthLike, speechOf, type UtteranceLike } from "./speech.ts";

const EN = voice("Samantha", "en-US", { isDefault: true });
const RU = voice("Milena", "ru-RU");
const NONE = new Map<string, string>();

describe("the synthesis", () => {
  it("cancels what it said before, then says each sentence by the voice of its language", () => {
    const { speech, asked } = fakeSpeech([EN, RU]);
    const said = speech.say(
      [
        { text: "6 × 7 = 42. Well done!", language: "en" },
        { text: "Молодец.", language: "ru" },
      ],
      { rate: 0.75, chosen: NONE },
    );
    expect(said).toBeDefined();
    expect(speech.speaking()).toBe(said);
    expect(asked[0]).toEqual({ cancel: true });
    expect(
      asked.slice(1).map((each) => {
        const { text, voice: by, lang, rate } = (each as { said: UtteranceLike }).said;
        return [text, by?.name, lang, rate];
      }),
    ).toEqual([
      ["6 times 7 equals 42.", "Samantha", "en", 0.75],
      ["Well done!", "Samantha", "en", 0.75],
      ["Молодец.", "Milena", "ru", 0.75],
    ]);
  });

  it("is said by the voice an adult chose for the language", () => {
    const other = voice("Daniel", "en-GB");
    const { speech, said } = fakeSpeech([EN, other]);
    speech.say([{ text: "Hello.", language: "en" }], {
      rate: 1,
      chosen: new Map([["en", "uri:Daniel"]]),
    });
    expect(said()[0]?.voice?.name).toBe("Daniel");
  });

  it("leaves out a phrase whose language has no voice, or none", () => {
    const { speech, texts } = fakeSpeech([EN]);
    speech.say(
      [
        { text: "Привет.", language: "ru" },
        { text: "Hello.", language: "en" },
        { text: "Hm.", language: undefined },
      ],
      { rate: 1, chosen: NONE },
    );
    expect(texts()).toEqual(["Hello."]);
  });

  it("says nothing, and is not speaking, when no phrase has a voice", () => {
    const { speech, asked } = fakeSpeech([EN]);
    const before = speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE });
    expect(speech.say([{ text: "Привет.", language: "ru" }], { rate: 1, chosen: NONE })).toBe(
      undefined,
    );
    expect(before).toBeDefined();
    expect(speech.speaking()).toBeUndefined();
    expect(asked.at(-1)).toEqual({ cancel: true });
  });

  it("goes on after what is still being said, and cuts in when it ended", () => {
    const { speech, asked, said } = fakeSpeech([EN]);
    const first = speech.say([{ text: "Not yet.", language: "en" }], { rate: 1, chosen: NONE });
    const next = speech.say([{ text: "Look again.", language: "en" }], {
      rate: 1,
      chosen: NONE,
      after: first,
    });
    expect(next).toBe(first);
    expect(asked.filter((each) => "cancel" in each)).toHaveLength(1);
    // Both utterances must end before it is said.
    said()[0]?.onend?.();
    expect(speech.speaking()).toBe(first);
    said()[1]?.onerror?.();
    expect(speech.speaking()).toBeUndefined();
    // What it went on after has ended: a new text cuts in.
    const last = speech.say([{ text: "Try.", language: "en" }], {
      rate: 1,
      chosen: NONE,
      after: first,
    });
    expect(last).not.toBe(first);
    expect(asked.filter((each) => "cancel" in each)).toHaveLength(2);
  });

  it("keeps what it goes on after, with nothing more to say", () => {
    const { speech } = fakeSpeech([EN]);
    const first = speech.say([{ text: "Not yet.", language: "en" }], { rate: 1, chosen: NONE });
    expect(speech.say([], { rate: 1, chosen: NONE, after: first })).toBe(first);
    expect(speech.speaking()).toBe(first);
  });

  it("ignores the end of an utterance of a text it cut short", () => {
    const { speech, said } = fakeSpeech([EN]);
    speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE });
    const second = speech.say([{ text: "Two.", language: "en" }], { rate: 1, chosen: NONE });
    said()[0]?.onend?.();
    expect(speech.speaking()).toBe(second);
  });

  it("primes a press with an empty utterance, and stops", () => {
    const { speech, asked } = fakeSpeech([EN]);
    speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE });
    speech.prime();
    expect(speech.speaking()).toBeUndefined();
    expect(asked.slice(-2)).toEqual([
      { cancel: true },
      { said: expect.objectContaining({ text: "" }) },
    ]);
    speech.say([{ text: "Two.", language: "en" }], { rate: 1, chosen: NONE });
    speech.stop();
    expect(speech.speaking()).toBeUndefined();
    expect(asked.at(-1)).toEqual({ cancel: true });
  });

  it("tells its listeners when the voices change and when it starts and stops speaking", () => {
    const fake = fakeSpeech([]);
    const heard = vi.fn();
    const unsubscribe = fake.speech.subscribe(heard);
    expect(fake.speech.voices()).toEqual([]);
    expect(fake.speech.voiceOf("en", NONE)).toBeUndefined();
    fake.list([EN]);
    expect(heard).toHaveBeenCalledTimes(1);
    const voices = fake.speech.voices();
    expect(fake.speech.voiceOf("en", NONE)).toBe(EN);
    // The same list again is no change, and the array stays the same.
    fake.list([EN]);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(fake.speech.voices()).toBe(voices);
    fake.speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE });
    expect(heard).toHaveBeenCalledTimes(2);
    fake.speech.stop();
    expect(heard).toHaveBeenCalledTimes(3);
    unsubscribe();
    fake.list([]);
    expect(heard).toHaveBeenCalledTimes(3);
    expect(fake.speech.voiceOf(undefined, NONE)).toBeUndefined();
  });

  it("is silent when the synthesis fails", () => {
    const synth: SynthLike = {
      speak: () => {
        throw new Error("speak");
      },
      cancel: () => {
        throw new Error("cancel");
      },
      getVoices: () => {
        throw new Error("voices");
      },
      addEventListener: () => {},
    };
    const speech = new Speech({
      synth,
      utterance: (text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null }),
      platform: "other",
    });
    expect(speech.voices()).toEqual([]);
    expect(() => speech.prime()).not.toThrow();
    expect(() => speech.stop()).not.toThrow();
  });

  it("ends a text whose utterance the synthesis would not take", () => {
    let calls = 0;
    const synth: SynthLike = {
      speak: () => {
        calls += 1;
        throw new Error("speak");
      },
      cancel: () => {},
      getVoices: () => [EN],
      addEventListener: () => {},
    };
    const speech = new Speech({
      synth,
      utterance: (text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null }),
      platform: "other",
    });
    expect(
      speech.say([{ text: "One. Two.", language: "en" }], { rate: 1, chosen: NONE }),
    ).toBeDefined();
    expect(calls).toBe(2);
    expect(speech.speaking()).toBeUndefined();
  });

  it("has nothing to say in a browser with no Web Speech API", () => {
    const speech = new Speech({
      utterance: (text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null }),
      platform: "other",
    });
    expect(speech.supported).toBe(false);
    expect(
      speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE }),
    ).toBeUndefined();
    expect(() => speech.prime()).not.toThrow();
    expect(() => speech.stop()).not.toThrow();
  });
});

describe("the synthesis of a browser", () => {
  function page() {
    const listeners: (() => void)[] = [];
    const document = {
      visibilityState: "visible",
      addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    };
    return {
      document,
      hide(state: string) {
        document.visibilityState = state;
        for (const listener of listeners) listener();
      },
    };
  }

  it("tells its platform, and stops when the tab is hidden", () => {
    const asked: string[] = [];
    const synth: SynthLike = {
      speak: () => asked.push("speak"),
      cancel: () => asked.push("cancel"),
      getVoices: () => [EN],
      addEventListener: () => {},
    };
    const { document, hide } = page();
    const speech = speechOf({
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      synth,
      utterance: (text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null }),
      document,
    });
    expect(speech.platform).toBe("android");
    expect(speech.supported).toBe(true);
    const said = speech.say([{ text: "One.", language: "en" }], { rate: 1, chosen: NONE });
    hide("visible");
    expect(speech.speaking()).toBe(said);
    hide("hidden");
    expect(speech.speaking()).toBeUndefined();
    expect(asked).toEqual(["cancel", "speak", "cancel"]);
  });

  it("has no synthesis where the browser makes no utterance", () => {
    const synth: SynthLike = {
      speak: () => {},
      cancel: () => {},
      getVoices: () => [EN],
      addEventListener: () => {},
    };
    const speech = speechOf({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0)" }, synth });
    expect(speech.supported).toBe(false);
    expect(speech.platform).toBe("other");
  });
});
