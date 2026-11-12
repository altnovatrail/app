// The tutor's words on the task screen (sections 3.3 and 3.9 of docs/architecture.md; R10, R21 in
// docs/decisions.md): the block "Tutor" at the top of the panel, the words of the rung after "Not
// yet" or of the correct answer, in the module's explanation language with its own `lang`. Until a
// model's words are admitted, the words of the rung are its fallback text, which api gives as words
// (R10 api). Beside the words of a rung stands "Explain differently", once on a rung (R82 in spec;
// R22). While the words of a rung or "Explain differently" are asked, the block says the tutor is
// writing: they take seconds to come — the words of a rung ≈ 10 s (section 3.3). The block is no
// live region: the whole text would be read out at once, so a line of the screen tells that the
// words came, and the learner reads them here; "Read aloud" below them says them again by the
// device's voice (R07; ../voice/ReadAloud.tsx). Below its heading it says, always, that the tutor is
// an AI, not a person, and below the words stands "Report a problem" for a learner of the category
// adult, in E3 the adult of the account (R123 in spec; R33).
import { type ReactNode, useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";

export interface TutorWordsProps {
  /** The tutor's words; none while none came. */
  readonly words: string | undefined;
  /** The module's explanation language. */
  readonly language: string | undefined;
  /**
   * What the request of the words came to: when it gave none, or, below the fallback text of a
   * rung, why platform AI gave no words of its own (R37).
   */
  readonly failure?: string;
  /** The words of a rung are asked and have not come yet. */
  readonly waiting?: boolean;
  /** "Explain differently", while the rung has the right to it; none otherwise. */
  readonly onExplain?: () => void;
  /** "Explain differently" is under way: the tutor is writing, under the words before. */
  readonly explaining?: boolean;
  /** What "Explain differently" came to, when it gave no other words. */
  readonly note?: string;
  /** "Report a problem" with the words shown, below them; none for a learner it is not offered. */
  readonly report?: ReactNode;
}

export function TutorWords({
  words: text,
  language,
  failure,
  waiting = false,
  onExplain,
  explaining = false,
  note,
  report,
}: TutorWordsProps) {
  const { words } = useLanguage();
  const id = useId();
  if (text === undefined && failure === undefined && !waiting) return null;
  return (
    <section aria-labelledby={id} className="nt-tutor">
      <h2 id={id}>{words.text("task.tutor")}</h2>
      <p className="nt-hint">{words.text("tutor.ai")}</p>
      {text === undefined ? null : (
        <>
          <p {...(language === undefined ? {} : { lang: language })}>{text}</p>
          <ReadAloud phrases={[{ text, language }]} language={language} />
        </>
      )}
      {waiting || explaining ? <p className="nt-hint">{words.text("task.words-waiting")}</p> : null}
      {failure === undefined ? null : <p className="nt-hint">{failure}</p>}
      {/* A refusal of "Explain differently" that says what the line above says is not said twice. */}
      {note === undefined || note === failure ? null : <p className="nt-hint">{note}</p>}
      {onExplain === undefined || text === undefined ? null : (
        <div className="nt-buttons">
          {/* Not disabled while it is under way: a disabled button would drop the focus. */}
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={explaining}
            onClick={() => {
              if (!explaining) onExplain();
            }}
          >
            {words.text("task.explain")}
          </button>
        </div>
      )}
      {text === undefined ? null : report}
    </section>
  );
}
