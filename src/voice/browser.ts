// The browser's one synthesis (section 3.5 of docs/architecture.md): speech.ts made of the globals
// `navigator`, `speechSynthesis`, `SpeechSynthesisUtterance` and `document`, on first use. Apart
// from speech.ts, so that Node's tests of it see no DOM.
import { type Speech, type SynthLike, speechOf, type UtteranceLike } from "./speech.ts";

let browser: Speech | undefined;

/** The browser's one synthesis, made on first use. */
export function browserSpeech(): Speech {
  browser ??= speechOf({
    navigator,
    synth:
      typeof speechSynthesis === "undefined"
        ? undefined
        : (speechSynthesis as unknown as SynthLike),
    utterance:
      typeof SpeechSynthesisUtterance === "undefined"
        ? undefined
        : (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
    document,
  });
  return browser;
}
