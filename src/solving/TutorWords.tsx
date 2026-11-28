// The tutor's words on the task screen: bubbles of the conversation in the
// tutor's panel — the words of the rung after "Not yet", marked a hint as the mockup's
// `task-rung`, of an essay's feedback, marked so, or of the correct answer, in the module's
// explanation language with its own `lang`.
// Until a model's words are admitted, the words of the rung are its fallback text, which api gives
// as words. While the words of a rung or "Explain differently" are asked, a bubble says
// the tutor is writing: they take seconds to come. The words are no live region: the whole text
// would be read out at once, so a line of the screen tells that the words came, and the learner
// reads them here; "Read aloud" below them says them again by the device's voice
// (../voice/ReadAloud.tsx). Below the words stands "Report a problem" for a learner of the category
// adult. "Explain differently", once on a rung, is the panel's, at
// its foot: ExplainButton.
import type { ReactNode } from "react";
import { Icon } from "../app/Icon.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";

export interface TutorWordsProps {
  /** The tutor's words; none while none came. */
  readonly words: string | undefined;
  /** The words are a rung's, after a wrong answer: a hint, as the mockup marks them. */
  readonly rung?: boolean;
  /** The words are the tutor's on what it did in grown-up mode, marked so, as the mockup marks them. */
  readonly grown?: boolean;
  /** The words are an essay's feedback by its rubric, marked so, as the mockup marks them. */
  readonly feedback?: boolean;
  /** The module's explanation language. */
  readonly language: string | undefined;
  /**
   * What the request of the words came to: when it gave none, or, below the fallback text of a
   * rung, why platform AI gave no words of its own.
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
  grown = false,
  feedback = false,
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
        <div className="nt-bubble nt-bubble-words" data-rung={rung} data-grown={grown}>
          {grown ? (
            <span className="nt-bubble-label">
              <Icon value="grown-up" />
              {words.text("grown.mode")}
            </span>
          ) : feedback ? (
            <span className="nt-bubble-label" data-feedback="true">
              <Icon value="feedback" />
              {words.text("task.feedback")}
            </span>
          ) : rung ? (
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

/** "Explain differently", at the panel's foot while the rung has the right to it. */
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
