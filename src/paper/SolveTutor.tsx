// The tutor's panel on the screen of solving a task from paper, the one panel of every screen: in
// its head the learner's share of the quota and the switch of voicing; in the conversation, first
// its line on what comes here, then the verdict of the last Check as a line —
// the reading while it runs —, the tutor's words of that Check, and the tutor's words marked a
// hint — the opening question, the rung's, or the rung's put another way —, each with "Report a
// problem" below them for a learner of the category adult, and what a Check or a Hint failed with,
// which the phone's
// sheet would hide at the screen's foot; at its foot Hint while the task is not solved, "Explain
// differently" once on a rung, and the next task once it is solved. After them the learner's
// questions about the task and the tutor's answers, each answer with "Report a problem" below it
// for a learner of the category adult, and under the conversation the panel's field
// of a question, with its microphone for a learner of the category adult. In the head, before the
// switch of voicing, grown-up mode's key, while the task takes work: behind the grown-ups' PIN the
// field takes a request for anything, up to the full solution, the band under the head says so,
// and the conversation has a line as the mode is turned on and off; the tutor's words on what it
// did on the sheet are marked, and the head says "Writing on the sheet…" till they come. A task
// from paper is in no module: its words are in the language of the interface. A task of a module
// has its hint before the first wrong answer — the givens, the techniques, the leading question —,
// and its words in the module's language. An essay has a greeting of its own, its feedback marked
// so, once Done ends it what Done gave, and no field but in grown-up mode.
import { TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ReactNode, Ref } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HintButton, VerdictLine } from "../solving/parts.tsx";
import { LearnerLine, TutorPanel } from "../solving/TutorPanel.tsx";
import { ExplainButton, TutorWords } from "../solving/TutorWords.tsx";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import type { Said } from "../tutor/report.ts";
import { MAX_QUESTION, type PaperVerdict, paperCard, questionOf, type Turn } from "./solve.ts";

export function SolveTutor({
  quota,
  checking,
  closer = false,
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
  onStop,
  onAsk,
  grown,
  onGrown,
  writing = false,
  module,
}: {
  /** The line of its head: the learner's share of the quota. */
  readonly quota: string | undefined;
  /** A Check is being read. */
  readonly checking: boolean;
  /** The Check went on to a later model, which reads the work more closely. */
  readonly closer?: boolean;
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
  /** A question that came back unanswered, to the field again, or that Stop took back. */
  readonly again?:
    | { readonly text: string; readonly at: number; readonly stopped?: boolean }
    | undefined;
  /** Stop, while the answer to the question sent is awaited; none while nothing can be stopped. */
  readonly onStop?: (() => void) | undefined;
  /** A question, and whether it is the browser's reading of the voice as it came. */
  readonly onAsk: (question: string, voice: boolean) => void;
  /** Grown-up mode is on; none, and its key is not drawn. */
  readonly grown?: boolean | undefined;
  /** Grown-up mode turned on, past the grown-ups' PIN, or off. */
  readonly onGrown?: ((on: boolean) => void) | undefined;
  /** A request in grown-up mode is on its way, its act to be drawn on the sheet. */
  readonly writing?: boolean;
  /**
   * On a task of a module: whether the field stands, its hint, the language of its words, and of an
   * essay what Done gave.
   */
  readonly module?:
    | {
        readonly ask: boolean;
        readonly hint?: ReactNode;
        readonly language: string;
        readonly essay?: boolean;
        readonly finished?: ReactNode;
      }
    | undefined;
}) {
  const { language: screen, words } = useLanguage();
  const language = module?.language ?? screen;
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
        ...(module !== undefined && !module.ask
          ? {}
          : {
              ask: {
                label: words.text("paper.question-label"),
                placeholder: words.text(
                  grown === true ? "grown.placeholder" : "paper.question-placeholder",
                ),
                max: MAX_QUESTION,
                ready: questionOf,
                off: askOff,
                microphone: adult,
                language: screen,
                onSend: onAsk,
                ...(again === undefined ? {} : { again }),
                ...(onStop === undefined ? {} : { onStop }),
              },
            }),
      }}
      greeting={words.text(module?.essay === true ? "paper.essay-hello" : "paper.solve-hello")}
      talk={
        <>
          {/* Drawn alone, as the card: the screen's status line tells the verdict. */}
          {checking ? (
            <VerdictLine
              kind="reading"
              title={words.text(closer ? "task.reading-closer" : "task.reading")}
              line={words.text(closer ? "task.reading-closer-line" : "task.reading-line")}
            />
          ) : verdict === undefined ? null : (
            <VerdictLine
              {...paperCard(verdict, words)}
              // Feedback that came is the bubble under it: the card's line says it is here.
              {...(verdict.kind === "feedback" && verdict.note === undefined
                ? { line: undefined }
                : {})}
            />
          )}
          {checkSaid === undefined ? null : (
            <TutorWords
              words={checkSaid.text}
              feedback={checkSaid.reply === TutorReply.ESSAY_FEEDBACK}
              language={language}
              {...report(checkSaid)}
            />
          )}
          {module?.hint}
          {module?.finished}
          <TutorWords
            words={said?.text}
            rung={said?.reply !== TutorReply.CORRECT_ANSWER}
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
                language={screen}
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
          {acts.hint ? (
            <HintButton parts={{ pending, onHint }} className="nt-act nt-act-hint" />
          ) : null}
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
