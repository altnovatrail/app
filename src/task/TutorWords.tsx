// The tutor's words on the task screen (sections 3.3 and 3.9 of docs/architecture.md; R10, R21 and
// R67 in docs/decisions.md): bubbles of the conversation in the tutor's panel, under the line that
// the tutor is an AI (R123 in spec; R33) — the words of the rung after "Not yet", marked a hint as the
// mockup's `task-rung`, or of the correct answer, in the module's explanation language with its own
// `lang`. Until a model's words are admitted, the words of the rung are its fallback text, which api
// gives as words (R10 api). While the words of a rung or "Explain differently" are asked, a bubble
// says the tutor is writing: they take seconds to come — the words of a rung ≈ 10 s (section 3.3).
// The words are no live region: the whole text would be read out at once, so a line of the screen
// tells that the words came, and the learner reads them here; "Read aloud" below them says them again
// by the device's voice (R07; ../voice/ReadAloud.tsx). Below the words stands "Report a problem" for
// a learner of the category adult, in E3 the adult of the account (R123 in spec; R33). "Explain
// differently", once on a rung (R82 in spec; R22), is the panel's, at its foot: ExplainButton.
import type { ReactNode } from "react";
import { Icon } from "../app/Icon.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";

export interface TutorWordsProps {
  /** The tutor's words; none while none came. */
  readonly words: string | undefined;
  /** The words are a rung's, after a wrong answer: a hint, as the mockup marks them. */
  readonly rung?: boolean;
  /** The module's explanation language. */
  readonly language: string | undefined;
  /**
   * What the request of the words came to: when it gave none, or, below the fallback text of a
   * rung, why platform AI gave no words of its own (R37).
   */
  readonly failure?: string;
  /** The words of a rung are asked and have not come yet. */
  readonly waiting?: boolean;
  /** "Explain differently" is under way: the tutor is writing, under the words before. */
  readonly explaining?: boolean;
  /** What "Explain differently" came to, when it gave no other words. */
  readonly note?: string;
  /** "Report a problem" with the words shown, below them; none for a learner it is not offered. */
  readonly report?: ReactNode;
}

export function TutorWords({
  words: text,
  rung = false,
  language,
  failure,
  waiting = false,
  explaining = false,
  note,
  report,
}: TutorWordsProps) {
  const { words } = useLanguage();
  return (
    <>
      {text === undefined ? null : (
        <div className="nt-bubble nt-bubble-words" data-rung={rung}>
          {rung ? (
            <span className="nt-bubble-label">
              <Icon value="hint" />
              {words.text("task.hint")}
            </span>
          ) : null}
          <p {...(language === undefined ? {} : { lang: language })}>{text}</p>
          <ReadAloud phrases={[{ text, language }]} language={language} />
        </div>
      )}
      {waiting || explaining ? (
        <p className="nt-bubble nt-typing">{words.text("task.words-waiting")}</p>
      ) : null}
      {failure === undefined ? null : <p className="nt-talk-note">{failure}</p>}
      {/* A refusal of "Explain differently" that says what the line above says is not said twice. */}
      {note === undefined || note === failure ? null : <p className="nt-talk-note">{note}</p>}
      {text === undefined ? null : report}
    </>
  );
}

/** "Explain differently", at the panel's foot while the rung has the right to it (R22). */
export function ExplainButton({
  explaining,
  onExplain,
}: {
  readonly explaining: boolean;
  readonly onExplain: () => void;
}) {
  const { words } = useLanguage();
  return (
    // Not disabled while it is under way: a disabled button would drop the focus.
    <button
      type="button"
      className="nt-act"
      aria-disabled={explaining}
      onClick={() => {
        if (!explaining) onExplain();
      }}
    >
      {words.text("task.explain")}
    </button>
  );
}
