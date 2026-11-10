// The tutor's words on the task screen (sections 3.3 and 3.9 of docs/architecture.md; R10, R21 in
// docs/decisions.md): the block "Tutor" at the top of the panel, the words of the rung after "Not
// yet" or of the correct answer, in the module's explanation language with its own `lang`. Until a
// model's words are admitted, the words of the rung are its fallback text, which api gives as words
// (R10 api). Beside the words of a rung stands "Explain differently", once on a rung (R82 in spec;
// R22). The block is no live region: the whole text would be read out at once, so a line of the
// screen tells that the words came, and the learner reads them from here.
import { useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export interface TutorWordsProps {
  /** The tutor's words; none while none came. */
  readonly words: string | undefined;
  /** The module's explanation language. */
  readonly language: string | undefined;
  /** What the request of the words came to, when it gave none. */
  readonly failure?: string;
  /** "Explain differently", while the rung has the right to it; none otherwise. */
  readonly onExplain?: () => void;
  /** "Explain differently" is under way. */
  readonly explaining?: boolean;
  /** What "Explain differently" came to, when it gave no other words. */
  readonly note?: string;
}

export function TutorWords({
  words: text,
  language,
  failure,
  onExplain,
  explaining = false,
  note,
}: TutorWordsProps) {
  const { words } = useLanguage();
  const id = useId();
  if (text === undefined && failure === undefined) return null;
  return (
    <section aria-labelledby={id} className="nt-tutor">
      <h2 id={id}>{words.text("task.tutor")}</h2>
      {text === undefined ? null : (
        <p {...(language === undefined ? {} : { lang: language })}>{text}</p>
      )}
      {failure === undefined ? null : <p className="nt-hint">{failure}</p>}
      {note === undefined ? null : <p className="nt-hint">{note}</p>}
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
    </section>
  );
}
