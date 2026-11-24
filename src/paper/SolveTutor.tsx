// The tutor's panel on the screen of solving a task from paper, the one panel of every screen: in
// its head the learner's share of the quota and the switch of voicing; in the conversation, first
// its line on what comes here, then the verdict of the last Check as a line —
// the reading while it runs —, the tutor's words of that Check, and the tutor's words marked a
// hint — the opening question, the rung's, or the rung's put another way —, each with "Report a
// problem" below them for a learner of the category adult, and what a Check or a Hint failed with,
// which the phone's
// sheet would hide at the screen's foot; at its foot Hint while the task is not solved, "Explain
// differently" once on a rung, and the next task once its Check is over. After them the learner's
// questions about the task and the tutor's answers, each answer with "Report a problem" below it
// for a learner of the category adult, and under the conversation the panel's field
// of a question, with its microphone for a learner of the category adult. In the head, before the
// switch of voicing, grown-up mode's key, while the task takes work: behind the grown-ups' PIN the
// field takes a request for anything, up to the full solution, the band under the head says so,
// and the conversation has a line as the mode is turned on and off; the tutor's words on what it
// did on the sheet are marked, and the head says "Writing on the sheet…" till they come. A task
// from paper is in no module: its words are in the language of the interface.
import { TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { Ref } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HintButton, VerdictLine } from "../task/TaskLayout.tsx";
import { LearnerLine, TutorPanel } from "../task/TutorPanel.tsx";
import { ExplainButton, TutorWords } from "../task/TutorWords.tsx";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import type { Said } from "../tutor/report.ts";
import { MAX_QUESTION, type PaperVerdict, paperCard, questionOf, type Turn } from "./solve.ts";

export function SolveTutor({
  quota,
  checking,
  verdict,
  acts,
  profileId,
  attemptId,
  said,
  checkSaid,
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
  turns,
  asking,
  askNote,
  askOff,
  again,
  onAsk,
  grown,
  onGrown,
  writing = false,
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
  /** The tutor's words of a hint, while they stand, with the reply that brought them. */
  readonly said: Said | undefined;
  /** The tutor's words of the last Check, while they stand. */
  readonly checkSaid?: Said | undefined;
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
  /** The conversation on the task, of which the questions and their answers are drawn as lines. */
  readonly turns: readonly Turn[];
  /** A question about this task is on its way. */
  readonly asking: boolean;
  /** What the last question came to when no answer came, or why platform AI gave none of its own. */
  readonly askNote: string | undefined;
  /** The field waits: a question is on its way, or the task is over. */
  readonly askOff: boolean;
  /** A question that came back unanswered, to the field again. */
  readonly again?: { readonly text: string; readonly at: number } | undefined;
  /** A question, and whether it is the browser's reading of the voice as it came. */
  readonly onAsk: (question: string, voice: boolean) => void;
  /** Grown-up mode is on; none, and its key is not drawn. */
  readonly grown?: boolean | undefined;
  /** Grown-up mode turned on, past the grown-ups' PIN, or off. */
  readonly onGrown?: ((on: boolean) => void) | undefined;
  /** A request in grown-up mode is on its way, its act to be drawn on the sheet. */
  readonly writing?: boolean;
}) {
  const { language, words } = useLanguage();
  // Other words are another report: the form begins anew with them.
  const report = (shown: Said | undefined) =>
    adult && shown !== undefined && shown.text !== ""
      ? {
          report: (
            <ReportProblem
              key={`${shown.reply} ${shown.rung} ${shown.text}`}
              profileId={profileId}
              attemptId={attemptId}
              said={shown}
              language={language}
            />
          ),
        }
      : {};
  return (
    <TutorPanel
      headingRef={headingRef}
      status={writing ? words.text("grown.writing") : quota}
      acting={writing}
      onClose={onClose}
      kit={{
        voicing: { language },
        ...(grown === undefined || onGrown === undefined
          ? {}
          : { grown: { on: grown, onChange: onGrown } }),
        ask: {
          label: words.text("paper.question-label"),
          placeholder: words.text(
            grown === true ? "grown.placeholder" : "paper.question-placeholder",
          ),
          max: MAX_QUESTION,
          ready: questionOf,
          off: askOff,
          microphone: adult,
          language,
          onSend: onAsk,
          ...(again === undefined ? {} : { again }),
        },
      }}
      greeting={words.text("paper.solve-hello")}
      talk={
        <>
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
          {checkSaid === undefined ? null : (
            <TutorWords words={checkSaid.text} language={language} {...report(checkSaid)} />
          )}
          <TutorWords
            words={said?.text}
            rung
            language={language}
            waiting={wordsWaiting}
            explaining={explaining}
            {...(wordsNote === undefined ? {} : { note: wordsNote })}
            {...report(said)}
          />
          {turns.map((turn, i) =>
            !turn.line ? null : turn.mode !== undefined ? (
              <VerdictLine
                // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
                key={i}
                kind="grown"
                title={words.text(turn.mode === "on" ? "grown.on-title" : "grown.off-title")}
                line={words.text(turn.mode === "on" ? "grown.on-line" : "grown.off-line")}
              />
            ) : turn.learner ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
              <LearnerLine key={i} text={turn.text} voice={turn.voice === true} />
            ) : (
              <TutorWords
                // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
                key={i}
                words={turn.text}
                grown={turn.grown === true}
                language={language}
                {...report({ text: turn.text, reply: TutorReply.ANSWER, rung: 0 })}
              />
            ),
          )}
          {asking ? (
            <p className="nt-bubble nt-typing">{words.text("task.words-waiting")}</p>
          ) : null}
          {askNote === undefined ? null : <p className="nt-talk-note">{askNote}</p>}
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
