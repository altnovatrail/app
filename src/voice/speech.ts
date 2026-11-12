// The one synthesis of the whole app (R36 in spec; R07 and R36 in docs/decisions.md; section 3.5 of
// docs/architecture.md): `speechSynthesis` behind a narrow interface, so that Node's tests give it
// lists of voices. Every utterance names its voice, by voices.ts; a new text cuts the one before
// short — `cancel()` — rather than queueing behind it, and each sentence is an utterance of its own,
// queued after the one before, since Chrome cuts a long utterance after about 15 s. `pause()` and
// `resume()` are not used: Chrome on Android only stops on the one and does nothing on the other.
// A press after which a text will come is marked at once by an empty utterance: WebKit on an iPhone
// or iPad lifts its bar on speech only for a `speak()` called within a user's press, and says
// nothing otherwise. The list of voices is read when it starts and again on `voiceschanged`. A
// failure of the synthesis is silent: the text is on the screen.
import { sentencesOf, spokenText } from "./spoken.ts";
import type { Phrase } from "./texts.ts";
import {
  type NavigatorLike,
  type Platform,
  platformOf,
  tagOf,
  type VoiceLike,
  voiceFor,
} from "./voices.ts";

/** What app sets of an utterance: SpeechSynthesisUtterance has it all. */
export interface UtteranceLike {
  text: string;
  voice: VoiceLike | null;
  lang: string;
  rate: number;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

/** What app calls of the synthesis: `speechSynthesis` has it all. */
export interface SynthLike {
  speak(utterance: UtteranceLike): void;
  cancel(): void;
  getVoices(): readonly VoiceLike[];
  addEventListener(type: "voiceschanged", listener: () => void): void;
}

export interface SpeechOptions {
  /** None in a browser without the Web Speech API: then nothing has a voice. */
  readonly synth?: SynthLike | undefined;
  readonly utterance: (text: string) => UtteranceLike;
  readonly platform: Platform;
}

/** How a text is said: the rate of the profile's speed, and the voices the adult chose by language. */
export interface Saying {
  readonly rate: number;
  readonly chosen: ReadonlyMap<string, string>;
  /** Said after what this one began, if that is still being said: else it cuts in as any text. */
  readonly after?: object | undefined;
}

const NO_VOICES: readonly VoiceLike[] = [];

export class Speech {
  readonly platform: Platform;
  readonly #synth: SynthLike | undefined;
  readonly #utterance: (text: string) => UtteranceLike;
  #voices: readonly VoiceLike[] = NO_VOICES;
  /** What is being said: the text a `say` began, until its last sentence ends or it is stopped. */
  #current: object | undefined;
  /** The utterances of the current text not ended yet. */
  #left = 0;
  readonly #listeners = new Set<() => void>();

  constructor(options: SpeechOptions) {
    this.platform = options.platform;
    this.#synth = options.synth;
    this.#utterance = options.utterance;
    this.#read();
    this.#synth?.addEventListener("voiceschanged", () => this.#read());
  }

  /** Whether the browser has a synthesis at all. */
  get supported(): boolean {
    return this.#synth !== undefined;
  }

  #read(): void {
    let voices: readonly VoiceLike[] = NO_VOICES;
    try {
      voices = [...(this.#synth?.getVoices() ?? [])];
    } catch {
      // A synthesis that will not tell its voices has none.
    }
    const same =
      voices.length === this.#voices.length &&
      voices.every((voice, i) => voice === this.#voices[i]);
    if (same) return;
    this.#voices = voices.length === 0 ? NO_VOICES : voices;
    this.#tell();
  }

  #tell(): void {
    for (const listener of this.#listeners) listener();
  }

  /** Listens for a change of the voices or of what is being said; gives back what stops it. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  /** The device's voices as the browser last listed them: the same array until they change. */
  readonly voices = (): readonly VoiceLike[] => this.#voices;

  /** What is being said: the value `say` gave, while it is. */
  readonly speaking = (): object | undefined => this.#current;

  /** The voice that speaks a language now: the adult's choice among the candidates, else voices.ts's. */
  voiceOf(
    language: string | undefined,
    chosen: ReadonlyMap<string, string>,
  ): VoiceLike | undefined {
    if (language === undefined) return undefined;
    return voiceFor(this.#voices, language, chosen.get(tagOf(language)));
  }

  #set(current: object | undefined, left: number): void {
    const changed = current !== this.#current;
    this.#current = current;
    this.#left = left;
    if (changed) this.#tell();
  }

  /**
   * Says phrases, each by the voice of its language, sentence by sentence, with its signs in words;
   * a phrase whose language has no voice is left out. Gives what is being said, or none when
   * nothing could be.
   */
  say(phrases: readonly Phrase[], saying: Saying): object | undefined {
    const synth = this.#synth;
    if (synth === undefined) return undefined;
    const goingOn = saying.after !== undefined && saying.after === this.#current;
    const token = goingOn ? (saying.after as object) : {};
    const utterances: UtteranceLike[] = [];
    for (const phrase of phrases) {
      const voice = this.voiceOf(phrase.language, saying.chosen);
      if (voice === undefined || phrase.language === undefined) continue;
      for (const sentence of sentencesOf(
        spokenText(phrase.text, phrase.language),
        phrase.language,
      )) {
        const utterance = this.#utterance(sentence);
        utterance.voice = voice;
        utterance.lang = phrase.language;
        utterance.rate = saying.rate;
        utterances.push(utterance);
      }
    }
    if (!goingOn) this.#cancel(synth);
    if (utterances.length === 0) {
      if (!goingOn) this.#set(undefined, 0);
      return goingOn ? token : undefined;
    }
    this.#set(token, (goingOn ? this.#left : 0) + utterances.length);
    for (const utterance of utterances) {
      const ended = () => {
        if (this.#current !== token) return;
        if (this.#left <= 1) this.#set(undefined, 0);
        else this.#left -= 1;
      };
      utterance.onend = ended;
      utterance.onerror = ended;
      try {
        synth.speak(utterance);
      } catch {
        ended();
      }
    }
    return token;
  }

  /** Marks a press after which a text will come, so that WebKit lets it be said (section 3.5). */
  prime(): void {
    const synth = this.#synth;
    if (synth === undefined) return;
    this.#cancel(synth);
    this.#set(undefined, 0);
    try {
      synth.speak(this.#utterance(""));
    } catch {
      // Silent, as every failure of the synthesis.
    }
  }

  /** Stops what is being said: leaving the screen, another learner, a hidden tab, a second press. */
  stop(): void {
    if (this.#synth !== undefined) this.#cancel(this.#synth);
    this.#set(undefined, 0);
  }

  #cancel(synth: SynthLike): void {
    try {
      synth.cancel();
    } catch {
      // Silent, as every failure of the synthesis.
    }
  }
}

/** The browser's `navigator` and `speechSynthesis`, as the one synthesis reads them. */
export interface BrowserParts {
  readonly navigator: NavigatorLike;
  readonly synth?: SynthLike | undefined;
  readonly utterance?: ((text: string) => UtteranceLike) | undefined;
  readonly document?: PageLike | undefined;
}

/** What app reads of `document`: whether the tab is hidden. */
export interface PageLike {
  readonly visibilityState: string;
  addEventListener(type: "visibilitychange", listener: () => void): void;
}

/**
 * The synthesis of a browser, which stops when the tab is hidden; one without the Web Speech API
 * has none, and nothing has a voice in it.
 */
export function speechOf(parts: BrowserParts): Speech {
  const speech = new Speech({
    synth: parts.utterance === undefined ? undefined : parts.synth,
    utterance:
      parts.utterance ??
      ((text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null })),
    platform: platformOf(parts.navigator),
  });
  const page = parts.document;
  page?.addEventListener("visibilitychange", () => {
    if (page.visibilityState === "hidden") speech.stop();
  });
  return speech;
}
