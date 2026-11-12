// A synthesis for the tests: the voices a test gives, and what it was asked to say, in order —
// each utterance as app set it, and each `cancel()` among them.
import { Speech, type SynthLike, type UtteranceLike } from "../voice/speech.ts";
import type { Platform, VoiceLike } from "../voice/voices.ts";

/** A voice as a browser lists it: local and not the default unless the test says. */
export function voice(
  name: string,
  lang: string,
  { local = true, isDefault = false }: { local?: boolean; isDefault?: boolean } = {},
): VoiceLike {
  return { name, lang, localService: local, default: isDefault, voiceURI: `uri:${name}` };
}

/** What the synthesis was asked: an utterance said, or a cancel. */
export type Asked = { readonly said: UtteranceLike } | { readonly cancel: true };

export function fakeSpeech(voices: readonly VoiceLike[] = [], platform: Platform = "other") {
  let listed = voices;
  const asked: Asked[] = [];
  const listeners: (() => void)[] = [];
  const synth: SynthLike = {
    speak: (utterance) => asked.push({ said: utterance }),
    cancel: () => asked.push({ cancel: true }),
    getVoices: () => listed,
    addEventListener: (_type, listener) => listeners.push(listener),
  };
  const speech = new Speech({
    synth,
    utterance: (text) => ({ text, voice: null, lang: "", rate: 1, onend: null, onerror: null }),
    platform,
  });
  return {
    speech,
    asked,
    /** The utterances said, in order. */
    said: () => asked.flatMap((each) => ("said" in each ? [each.said] : [])),
    /** The texts said, with no empty one. */
    texts: () =>
      asked.flatMap((each) => ("said" in each && each.said.text !== "" ? [each.said.text] : [])),
    /** The browser lists other voices, and says so. */
    list(next: readonly VoiceLike[]) {
      listed = next;
      for (const listener of listeners) listener();
    },
  };
}
