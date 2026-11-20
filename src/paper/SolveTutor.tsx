// The tutor's panel on the screen of solving a task from paper (R75; R148 spec), the shell of the
// task screen's: in its head the learner's share of the quota and the switch of voicing; in the
// conversation, after the line that the tutor is an AI, its line on what comes here, the program's
// verdict of the last Check as a line — the reading while it runs —, the tutor's words, marked a
// hint — the opening question, the rung's, or the rung's put another way (R82 spec) —, with "Report
// a problem" below them for a learner of the category adult (R33), and what a Check or a Hint failed
// with, which the phone's sheet would hide at the screen's foot; at its foot Hint while the task is
// not solved, "Explain differently" once on a rung, and the next task once its Check is over. No
// text field and no microphone (R148 spec). A task from paper is in no module: its words are in the
// language of the interface.
import type { Ref } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HintButton, VerdictLine } from "../task/TaskLayout.tsx";
import { TutorPanel } from "../task/TutorPanel.tsx";
import { ExplainButton, TutorWords } from "../task/TutorWords.tsx";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import type { Said } from "../tutor/report.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { type PaperVerdict, paperCard } from "./solve.ts";

export function SolveTutor({
  quota,
  checking,
  verdict,
  acts,
  profileId,
  attemptId,
  said,
  adult,
  wordsWaiting,
  wordsNote,
  explaining,
  onExplain,
  failure,
  pending,
  onHint,
  onNext,
  onClose,
  headingRef,
}: {
  /** The line of its head: the learner's share of the quota. */
  readonly quota: string | undefined;
  /** A Check is being read. */
  readonly checking: boolean;
  /** What the last Check came to, while its verdict stands. */
  readonly verdict: PaperVerdict | undefined;
  /** The buttons at its foot, those of the screen: none on a task only to be looked at. */
  readonly acts: { readonly hint: boolean; readonly next: boolean };
  readonly profileId: string;
  readonly attemptId: string;
  /** The tutor's words, while they stand, with the reply that brought them. */
  readonly said: Said | undefined;
  /** The learner is of the category adult: "Report a problem" stands below the words. */
  readonly adult: boolean;
  /** The words of a rung are asked and have not come yet. */
  readonly wordsWaiting: boolean;
  /** What a request of words came to when it gave none, or why platform AI gave none of its own. */
  readonly wordsNote: string | undefined;
  readonly explaining: boolean;
  /** "Explain differently", while the rung has the right to it; none, and its button is not drawn. */
  readonly onExplain?: (() => void) | undefined;
  /** What the last Check or Hint failed with. */
  readonly failure: Failure | undefined;
  readonly pending: boolean;
  readonly onHint: () => void;
  /** The next task; none, and its button is not drawn. */
  readonly onNext?: (() => void) | undefined;
  readonly onClose: () => void;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { language, words } = useLanguage();
  return (
    <TutorPanel
      headingRef={headingRef}
      status={quota}
      voicing={<VoicingToggle language={language} />}
      onClose={onClose}
      talk={
        <>
          <p className="nt-bubble">{words.text("paper.solve-hello")}</p>
          {/* Drawn alone, as the card: the screen's status line tells the verdict. */}
          {checking ? (
            <VerdictLine
              kind="reading"
              title={words.text("task.reading")}
              line={words.text("task.reading-line")}
            />
          ) : verdict === undefined ? null : (
            <VerdictLine {...paperCard(verdict, words)} />
          )}
          <TutorWords
            words={said?.text}
            rung
            language={language}
            waiting={wordsWaiting}
            explaining={explaining}
            {...(wordsNote === undefined ? {} : { note: wordsNote })}
            {...(adult && said !== undefined && said.text !== ""
              ? {
                  report: (
                    // Other words are another report: the form begins anew with them.
                    <ReportProblem
                      key={`${said.reply} ${said.rung} ${said.text}`}
                      profileId={profileId}
                      attemptId={attemptId}
                      said={said}
                      language={language}
                    />
                  ),
                }
              : {})}
          />
          {failure === undefined ? null : (
            <p role="alert" className="nt-error">
              {failureText(failure, words)}
            </p>
          )}
        </>
      }
      acts={
        <>
          {acts.hint ? <HintButton parts={{ pending, onHint }} className="nt-act" /> : null}
          {onExplain === undefined ? null : (
            <ExplainButton explaining={explaining} onExplain={onExplain} />
          )}
          {acts.next && onNext !== undefined ? (
            <button
              type="button"
              className="nt-act"
              aria-disabled={pending}
              onClick={() => {
                if (!pending) onNext();
              }}
            >
              {words.text("next.task")}
            </button>
          ) : null}
        </>
      }
    />
  );
}
