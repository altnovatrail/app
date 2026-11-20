// The tutor's panel on the screen of solving a task from paper (R75; R148 spec), the shell of the
// task screen's: in its head the learner's share of the quota and the switch of voicing; in the
// conversation, after the line that the tutor is an AI, its line on what comes here, the program's
// verdict of the last Check as a line — the reading while it runs —, the hint asked for, a bubble
// of the hint's tint, and what a Check or a Hint failed with, which the phone's sheet would hide at
// the screen's foot; at its foot Hint while the task is not solved, and the next task once
// its Check is over. No text field and no microphone (R148 spec). "Explain differently" waits till a
// task from paper has words of its own (R82 spec).
import type { Ref } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HintBubble } from "../task/Hint.tsx";
import { HintButton, VerdictLine } from "../task/TaskLayout.tsx";
import { TutorPanel } from "../task/TutorPanel.tsx";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { type PaperVerdict, paperCard, tutorActs } from "./solve.ts";

export function SolveTutor({
  quota,
  checking,
  verdict,
  hint,
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
  /** The hint asked for, while it stands. */
  readonly hint: string | undefined;
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
  const acts = tutorActs(verdict);
  return (
    <TutorPanel
      headingRef={headingRef}
      status={quota}
      // A task from paper is in no module: its words are in the language of the interface.
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
          {/* A region there before the hint comes, so that a screen reader is told it. */}
          <div role="status">
            {hint === undefined ? null : (
              <HintBubble>
                <p>{hint}</p>
              </HintBubble>
            )}
          </div>
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
