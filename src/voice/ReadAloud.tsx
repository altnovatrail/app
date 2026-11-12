// "Read aloud" beside a text (R07 and R36 in docs/decisions.md; sections 3.5
// and 3.9 of docs/architecture.md): the speaker button reads the text by the voice of its language,
// the voicing off too, and a second press while it reads stops it. Where the text cannot be said —
// no voice for its language on this device, or on Android and Linux before an adult's leave — the
// button stays, not active, and the line beside it, which describes it, says why. It is no status
// message: it stands from the start, and a status on every button would be read out on every screen.
import { useEffect, useId, useRef, useSyncExternalStore } from "react";
import { Icon } from "../app/Icon.tsx";
import { languageName } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Phrase } from "./texts.ts";
import { useVoicing } from "./VoicingContext.tsx";

/** The line of a language that is not said: its name, or the tag where Intl cannot name it. */
export function useSilentLine() {
  const { language: screen, words } = useLanguage();
  return (why: "leave" | "voice", language: string | undefined) => {
    if (why === "leave") return words.text("voice.ask-adult");
    let name = language ?? "";
    try {
      if (language !== undefined) name = languageName(screen, language);
    } catch {
      // A tag Intl cannot read stands for itself.
    }
    return words.text("voice.no-voice", { language: name });
  };
}

export function ReadAloud({
  phrases,
  language,
}: {
  readonly phrases: readonly Phrase[];
  /** The language of the text, the module's explanation language: its voice says it. */
  readonly language: string | undefined;
}) {
  const { words } = useLanguage();
  const voicing = useVoicing();
  const lineOf = useSilentLine();
  const id = useId();
  const mine = useRef<object | undefined>(undefined);
  const { speech } = voicing;
  const speaking = useSyncExternalStore(speech.subscribe, speech.speaking);
  // A text whose button goes — a segment of a lesson, a hint replaced — is not read on after it.
  useEffect(
    () => () => {
      if (mine.current !== undefined && speech.speaking() === mine.current) speech.stop();
    },
    [speech],
  );
  if (phrases.length === 0) return null;
  const why = voicing.silent(language);
  // Not known yet — the device's record still read, the module's language not come: not active,
  // with no line, which would only flash.
  const waits = why === "wait";
  return (
    <div className="nt-read-aloud">
      {/* Not disabled while it cannot read: a disabled button would drop the focus and its line. */}
      <button
        type="button"
        className="nt-secondary nt-icon-button"
        aria-disabled={why !== undefined}
        {...(why === undefined || waits ? {} : { "aria-describedby": id })}
        onClick={() => {
          if (why !== undefined) return;
          if (speaking !== undefined && speaking === mine.current) {
            speech.stop();
            return;
          }
          mine.current = voicing.read(phrases);
        }}
      >
        <Icon value="read-aloud" />
        {words.text("voice.read")}
      </button>
      {why === undefined || waits ? null : (
        <span id={id} className="nt-hint">
          {lineOf(why, language)}
        </span>
      )}
    </div>
  );
}
