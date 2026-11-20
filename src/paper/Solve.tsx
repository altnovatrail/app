// The screen of solving the tasks from the learner's paper (R71), as the mockup's `solve`: the top
// bar's pill — Back to My subjects and the task's name, "n of N · from your page" under it but on a
// phone —, and at its other end ‹, the counter that opens the list of the tasks begun with "Add",
// and ›. Each task is a sheet in dots of its own under its crop, the tracing paper, which canvas
// draws and the learner moves and hides (R87 canvas); its history and the paper's place stay with
// the page, so that a task left and come back to is as it was, and the page's history keeps them
// (R77). At the foot the row of glass: Hint · Check, Hint till the task is solved. Check sends the
// task's crop with the crop of the work (R162 spec), and the page keeps the context of the work of
// each Check answered, but no verdict: its verdict is that of each task of the frame by the key api
// derived — Correct with Next task, Not yet with Hint, of several tasks with how many are correct,
// the work not read with why, not checked with the outcome —, with a tick or a cross by each answer
// on the sheet; or "Couldn't check this one" when no task has a key, with Hint and Next task. A
// frame solved or with no key takes no Check again, and the list marks the one solved. A task whose
// attempt is over — solved, or closed by api, as a page of the history opened again may hold — is
// only to be looked at: its sheet takes no writing, no Hint stands, and its Check says "This task
// is already over". The tutor's button at the right edge opens its panel, and so does Hint; a
// verdict does not (R75; R148 spec). While the panel is open the verdict is a line in it, the hint
// a bubble there, said by itself while the voicing is on, and on a phone its sheet hides the row and
// the canvas's bar of tools; while it is closed the verdict is a card above the row, with the
// panel's buttons. The tutor's words are of AI (R82 spec): Hint before the first wrong answer asks
// the opening question from the task's crop as printed, once on the attempt; after Not yet, with the
// panel open — or once it opens — the words of the rung come with the work of the Check, and in the
// mode "Show where" with the wavy line under the first mistake, which goes with other work or the
// paper moved; "Explain differently" words the rung anew, once on it; and an adult may report a
// problem with the words. The words stand till another task or Check, and what is said of them
// stops with another task or the panel closed.
import {
  TutorReply,
  type WorkSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type {
  CanvasElement,
  HistoryChangeEvent,
  PaperTask,
  TracingChangeEvent,
} from "@altnovatrail/spec/canvas";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { PAPER_TIMEOUT_MS } from "../api/interceptors.ts";
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useNarrow } from "../app/narrow.ts";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { watched } from "../debug/watched.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { workOf } from "../task/attempt.ts";
import { closedBy, useOwnVoicing } from "../task/shared.ts";
import { HintButton, RowLine, VerdictCard } from "../task/TaskLayout.tsx";
import { TutorButton, usePanelFocus, useQuotaLine } from "../task/TutorPanel.tsx";
import type { Said } from "../tutor/report.ts";
import { numbers, type PageTask } from "./page.ts";
import { SolveTutor } from "./SolveTutor.tsx";
import {
  type BegunTask,
  type Box,
  besideTask,
  checkOver,
  onList,
  paperCard,
  paperVerdictOf,
  shownTask,
  tutorActs,
  verdictMarks,
  viewOnly,
  wavyOf,
  withChange,
} from "./solve.ts";

/** Each crop's task for the element, one object a crop, so that a render gives it no new one. */
const papers = new WeakMap<Blob, PaperTask>();
function paperOf(crop: Blob): PaperTask {
  let paper = papers.get(crop);
  if (paper === undefined) {
    paper = Object.freeze({ statement: crop });
    papers.set(crop, paper);
  }
  return paper;
}

/**
 * A wrong answer whose rung's words are to be asked, with the work its Check sent and the key of
 * the request, the same when it goes again after a failure.
 */
interface RungAsk {
  readonly attemptId: string;
  readonly wrongAnswers: number;
  readonly work: MessageInitShape<typeof WorkSchema>;
  readonly key: string;
}

/** Causes of a refusal of the words of a rung that say there are none to show for this answer. */
const QUIET = new Set([Cause.NOT_CURRENT, Cause.NO_RUNG, Cause.NO_MORE_WORDS]);

export function Solve({
  profileId,
  adult,
  tasks,
  begun,
  onKeep,
  onAdd,
  onHome,
}: {
  readonly profileId: string;
  /** The learner is of the category adult: "Report a problem" stands below the tutor's words (R33). */
  readonly adult: boolean;
  /** The page's tasks, by which the tasks begun are named and listed. */
  readonly tasks: readonly PageTask[];
  readonly begun: readonly BegunTask[];
  readonly onKeep: (attemptId: string, change: (task: BegunTask) => BegunTask) => void;
  readonly onAdd: () => void;
  readonly onHome: () => void;
}) {
  const api = useApi();
  const holder = useKeyHolder();
  const { language, words } = useLanguage();
  const narrow = useNarrow();
  const namesId = useId();
  const writeId = useId();
  const element = useRef<CanvasElement>(null);
  const [asked, setAsked] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  // The tutor's words in its panel, with the reply that brought them (R123 spec).
  const [said, setSaid] = useState<Said | undefined>(undefined);
  const [wordsWaiting, setWordsWaiting] = useState(false);
  // What a request of words came to when it gave none, or why platform AI gave none of its own.
  const [wordsNote, setWordsNote] = useState<string | undefined>(undefined);
  const [explaining, setExplaining] = useState(false);
  // "Explain differently" was asked on the current rung, whatever it gave.
  const [explained, setExplained] = useState(false);
  // The box of the wavy line under the first mistake, of the words of the rung shown.
  const [wavy, setWavy] = useState<Box | undefined>(undefined);
  // The keys of the opening question and of "Explain differently", kept till an answer, so that a
  // press again after a failure repeats the action.
  const openingKey = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);
  const explainKey = useRef<string | undefined>(undefined);
  // The wrong answer of the last Check whose rung's words the closed panel left unasked.
  const unasked = useRef<RungAsk | undefined>(undefined);
  // Another task or Check: an answer asked before it shows nothing.
  const epoch = useRef(0);
  // The tutor's panel, as the learner leaves it from task to task; it is closed at first.
  const [open, setOpen] = useState(false);
  const isOpen = useRef(open);
  isOpen.current = open;
  const { heading, call } = usePanelFocus(open);
  // Each answer to a call of AI reads the share of the quota again.
  const [spent, setSpent] = useState(0);
  const quota = useQuotaLine(profileId, open, spent);
  const { auto, prime, hush } = useOwnVoicing();
  // The verdict told to a screen reader: the card shows it, so it is not shown twice.
  const [told, setTold] = useState("");
  const [unwritten, setUnwritten] = useState(false);
  const [written, setWritten] = useState(false);
  // Check pressed on a task that is over: "This task is already over".
  const [overTold, setOverTold] = useState(false);
  // The keys of the Checks whose work the page keeps: a repeat's answer is none of a new one.
  const kept = useRef(new Set<string>());
  // The key of a check, kept while the work it sent is the same, so that a press again repeats it.
  const sent = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);

  const list = onList(begun, tasks);
  const task = shownTask(list, asked);
  const attemptId = task?.attemptId;

  // Another task: what the one before came to is none of its.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on the task's change alone.
  useEffect(() => {
    hush();
    epoch.current += 1;
    unasked.current = undefined;
    explainKey.current = undefined;
    setWordsWaiting(false);
    setExplaining(false);
    setFailure(undefined);
    setSaid(undefined);
    setWordsNote(undefined);
    setExplained(false);
    setWavy(undefined);
    setTold("");
    setUnwritten(false);
    setOverTold(false);
    setWritten(element.current?.filled?.[0]?.[0] === true);
  }, [attemptId]);

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      if (attemptId === undefined) return;
      const sheet = event.currentTarget as CanvasElement;
      // Other work puts a verdict away, but that of a Check that is over, whose marks go all the
      // same: the canvas drops them, and their context holds strokes the work may no longer have.
      onKeep(attemptId, (was) => {
        const history = withChange(was.history, event.detail, () => sheet.history);
        return checkOver(was)
          ? { ...was, history, checked: undefined }
          : withoutVerdict({ ...was, history });
      });
      setWritten(sheet.filled?.[0]?.[0] === true);
      setUnwritten(false);
      setTold("");
      // The wavy line stood under the work as it was (R82 spec).
      setWavy(undefined);
    },
    [attemptId, onKeep],
  );
  const onTracingChange = useCallback(
    (event: TracingChangeEvent) => {
      if (attemptId === undefined) return;
      const tracing = event.detail;
      // The canvas puts its marks away with the paper moved, and a mount again would give them
      // the context of a Check the tracing is no longer at.
      onKeep(attemptId, (was) => ({ ...was, tracing, checked: undefined }));
      setWavy(undefined);
    },
    [attemptId, onKeep],
  );

  const verdict = task?.verdict;
  const checked = task?.checked;
  // One object while the Check is the same, so that a render gives the element no new marks.
  // The wavy line stands beside the words it underlines, in the open panel.
  const line = open ? wavy : undefined;
  const marks = useMemo(
    () => verdictMarks({ verdict, checked }, words, line),
    [verdict, checked, words, line],
  );

  if (task === undefined || attemptId === undefined) return null;
  const order = numbers(tasks);
  const nameOf = (each: BegunTask) =>
    words.text(each.drawn ? "paper.your-frame" : "paper.task", { n: order.get(each.taskId) ?? 0 });
  const at = list.indexOf(task);
  const place = { n: at + 1, total: list.length };
  const before = besideTask(list, attemptId, -1);
  const after = besideTask(list, attemptId, 1);
  const go = (to: BegunTask | undefined) => {
    if (to !== undefined && !pending) setAsked(to.attemptId);
  };

  /** The tutor's words shown: said by the voicing in the open panel, else told to a screen reader. */
  const show = (next: Said) => {
    setSaid((before) =>
      // The words shown again stay the reply they came by, and a report begun on them stays open.
      before?.text === next.text ? before : next,
    );
    if (isOpen.current) auto([{ text: next.text, language }]);
    else setTold(next.text);
  };

  /** The words of the rung of a wrong answer, by AI with the work of its Check (R82 spec). */
  const rungWords = (ask: RungAsk) => {
    unasked.current = undefined;
    const asked = epoch.current;
    setWordsWaiting(true);
    setWordsNote(undefined);
    const ai = holder.aiFields(profileId);
    void watched(api, () =>
      api.attempt.getRungWords({
        profileId,
        attemptId: ask.attemptId,
        idempotencyKey: ask.key,
        wrongAnswers: ask.wrongAnswers,
        work: ask.work,
        ...ai,
      }),
    )
      .then(
        (answer) => {
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          if (asked !== epoch.current) return;
          if (answer.words !== "") {
            show({ text: answer.words, reply: TutorReply.RUNG, rung: answer.rung });
            setWavy(wavyOf(answer.marks));
          }
          // The fallback text comes with an outcome: beside it stands why, when platform AI is
          // closed beyond this call (R37).
          if (read !== undefined && (answer.words === "" || closesAI(read)))
            setWordsNote(outcomeText(read, words));
        },
        (reason: unknown) => {
          if (asked !== epoch.current) return;
          const found = parseFailure(reason);
          // What may not have reached api goes again with its key, by Hint or the panel opened.
          if (found.kind !== "refused") unasked.current = ask;
          if (found.kind !== "refused" || !QUIET.has(found.cause))
            setWordsNote(failureText(found, words));
        },
      )
      .finally(() => {
        // Another task or Check put the waiting away, and may be waiting for its own.
        if (asked === epoch.current) setWordsWaiting(false);
        setSpent((n) => n + 1);
      });
  };

  /** The opening question of a task with no wrong answer, by AI from its crop as printed. */
  const openingWords = async (asked: number) => {
    if (openingKey.current?.of !== attemptId)
      openingKey.current = { of: attemptId, key: idempotencyKey() };
    const key = openingKey.current.key;
    const statement = new Uint8Array(await task.crop.arrayBuffer());
    const ai = holder.aiFields(profileId);
    const answer = await watched(api, () =>
      api.attempt.getOpeningWords({ profileId, attemptId, idempotencyKey: key, statement, ...ai }),
    );
    openingKey.current = undefined;
    const read = outcomeOf(answer.outcome);
    holder.noteOutcome(profileId, read, ai);
    setSpent((n) => n + 1);
    if (asked !== epoch.current) return;
    show({ text: answer.words, reply: TutorReply.OPENING, rung: 0 });
    if (closesAI(read)) setWordsNote(outcomeText(read, words));
  };

  const hint = () => {
    // The rung's words on their way are the hint: a Hint meanwhile would show the fallback text.
    if (pending || wordsWaiting) return;
    // Within the press: the words that come may be said (WebKit; R07).
    prime();
    setOpen(true);
    setFailure(undefined);
    setTold("");
    // The rung's words of a wrong answer the closed panel left unasked are the hint (R82 spec).
    const ask = unasked.current;
    if (ask?.attemptId === attemptId) return rungWords(ask);
    const asked = epoch.current;
    setPending(true);
    setWordsNote(undefined);
    void (async () => {
      try {
        const answer = await api.attempt.getHint({ profileId, attemptId });
        if (asked !== epoch.current) return;
        // Before the first wrong answer a task from paper has no techniques: the opening question.
        if (answer.hint.case === "rung") {
          const { words: text, rung } = answer.hint.value;
          show({ text, reply: TutorReply.RUNG, rung });
        } else await openingWords(asked);
      } catch (reason) {
        const found = parseFailure(reason);
        if (asked === epoch.current) setFailure(found);
        closed(found);
      } finally {
        setPending(false);
      }
    })();
  };

  /** "Explain differently": the same rung in other words, one call of AI on a rung, with no work. */
  const explain = () => {
    const wrongAnswers = task.wrongAnswers;
    if (explaining || wrongAnswers === undefined) return;
    prime();
    explainKey.current ??= idempotencyKey();
    const key = explainKey.current;
    const asked = epoch.current;
    setExplaining(true);
    setWordsNote(undefined);
    const ai = holder.aiFields(profileId);
    void watched(api, () =>
      api.attempt.explainDifferently({
        profileId,
        attemptId,
        idempotencyKey: key,
        wrongAnswers,
        ...ai,
      }),
    )
      .then(
        (answer) => {
          explainKey.current = undefined;
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          if (asked !== epoch.current) return;
          // The right to it on this rung is spent, whatever the words.
          setExplained(true);
          if (read !== undefined) setWordsNote(outcomeText(read, words));
          if (answer.words !== "" && read?.cause !== Cause.NO_OTHER_WORDS) {
            const rung = said?.rung ?? Math.min(Math.max(wrongAnswers, 1), 3);
            show({ text: answer.words, reply: TutorReply.EXPLAINED_DIFFERENTLY, rung });
          }
        },
        (reason: unknown) => {
          if (asked !== epoch.current) return;
          const found = parseFailure(reason);
          // A refusal is the end of the action; anything else may have reached api, and goes
          // again with its key, which gets what was done.
          if (found.kind !== "refused") return setWordsNote(failureText(found, words));
          explainKey.current = undefined;
          const spent =
            found.cause === Cause.ALREADY_ASKED ||
            found.cause === Cause.NOT_CURRENT ||
            found.cause === Cause.NO_RUNG;
          if (spent) setExplained(true);
          else setWordsNote(failureText(found, words));
        },
      )
      .finally(() => {
        if (asked === epoch.current) setExplaining(false);
        setSpent((n) => n + 1);
      });
  };

  /** The attempt api closed: the task is over, and only to be looked at. */
  const closed = (found: Failure) => {
    // A verdict still shown is put away, so that the task is only to be looked at, as it is when
    // its page is opened again.
    if (closedBy(found) !== undefined)
      onKeep(attemptId, (was) => withoutVerdict({ ...was, over: true }));
  };

  const check = () => {
    if (viewOnly(task)) {
      setOverTold(true);
      return;
    }
    if (pending || checkOver(task)) return;
    if (!written) {
      setUnwritten(true);
      return;
    }
    const sheet = element.current;
    if (sheet === null) return;
    setPending(true);
    setChecking(true);
    setFailure(undefined);
    setSaid(undefined);
    setWordsNote(undefined);
    setWavy(undefined);
    setWordsWaiting(false);
    setExplaining(false);
    setTold("");
    epoch.current += 1;
    unasked.current = undefined;
    onKeep(attemptId, withoutVerdict);
    // Other work is another action, with a key of its own: the history, and where the paper lay,
    // as they are at the press, before the work is read.
    const length = sheet.history.length;
    const of = JSON.stringify([attemptId, length, sheet.tracing]);
    void (async () => {
      try {
        const work = await sheet.exportWork();
        if (work === null) {
          setUnwritten(true);
          return;
        }
        if (sent.current?.of !== of) sent.current = { of, key: idempotencyKey() };
        const ai = holder.aiFields(profileId);
        const key = sent.current.key;
        const paperWork = await workOf(work);
        const surface = paperWork.surface;
        const sentWork = surface?.case === "paper" ? surface.value : undefined;
        const answer = await watched(
          api,
          () =>
            api.attempt.submitWork(
              {
                profileId,
                attemptId,
                idempotencyKey: key,
                work: paperWork,
                ...ai,
              },
              { timeoutMs: PAPER_TIMEOUT_MS },
            ),
          sentWork?.statement instanceof Uint8Array && sentWork.crop instanceof Uint8Array
            ? {
                attemptId,
                statement: sentWork.statement,
                crop: sentWork.crop,
                verdicts: (a) => a.items.map((item) => item.answerSlots[0]?.verdict),
              }
            : undefined,
        );
        const read = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, read, ai);
        const verdict = paperVerdictOf(answer.items, read, answer.solved !== undefined);
        const context =
          "cells" in work || work.statement === undefined ? undefined : work.submission;
        const first = !kept.current.has(key);
        kept.current.add(key);
        onKeep(attemptId, (was) => ({
          ...was,
          verdict,
          wrongAnswers: answer.wrongAnswers,
          ...(context === undefined ? {} : { checked: context }),
          ...(context === undefined || !first
            ? {}
            : { sent: [...(was.sent ?? []), { context, historyLength: length }] }),
          ...(verdict.kind === "correct" ? { over: true } : {}),
        }));
        const card = paperCard(verdict, words);
        setTold(card.line === undefined ? card.title : `${card.title}. ${card.line}`);
        if (verdict.kind === "not-yet" && answer.wrongAnswers > 0) {
          // A new rung: "Explain differently" is its own once more, with a key of its own.
          setExplained(false);
          explainKey.current = undefined;
          // The words of the rung are asked at once while the panel is open, else once it opens
          // (R148 spec).
          const ask = {
            attemptId,
            wrongAnswers: answer.wrongAnswers,
            work: paperWork,
            key: idempotencyKey(),
          };
          if (isOpen.current) rungWords(ask);
          else unasked.current = ask;
        }
      } catch (reason) {
        const found = parseFailure(reason);
        setFailure(found);
        closed(found);
      } finally {
        setPending(false);
        setChecking(false);
        setSpent((n) => n + 1);
      }
    })();
  };

  const counter = (
    <PopOver
      label={words.text("paper.tasks")}
      buttonLabel={words.text("paper.tasks-open", place)}
      caption={words.text("paper.counter", place)}
      className="nt-solve-count"
      anchor=".nt-solve-nav"
      gap={6}
      popClassName="nt-pop-tasks"
    >
      {(close) => (
        <>
          <div className="nt-tasks-head">
            <h2>{words.text("paper.tasks")}</h2>
            <button
              type="button"
              className="nt-plain nt-tasks-add"
              onClick={() => {
                close();
                onAdd();
              }}
            >
              {words.text("paper.add")}
            </button>
          </div>
          <ol className="nt-tasks">
            {list.map((each) => (
              <li key={each.attemptId}>
                <button
                  type="button"
                  className="nt-tasks-row"
                  aria-current={each === task ? "true" : undefined}
                  onClick={() => {
                    close();
                    go(each);
                  }}
                >
                  <span className="nt-tasks-n" aria-hidden="true">
                    {order.get(each.taskId)}
                  </span>
                  {nameOf(each)}
                  {each.verdict?.kind === "correct" ? (
                    <>
                      <Icon value="ticked" />
                      <span className="nt-hidden-label">{words.text("task.correct")}</span>
                    </>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </PopOver>
  );

  const described = [namesId, written ? "" : writeId].join(" ").trim();
  // Hint waits while the rung's words are on their way, as for any request of its own.
  const busy = pending || wordsWaiting;
  const only = viewOnly(task);
  const acts = tutorActs(task);
  const close = () => {
    hush();
    setOpen(false);
  };
  // Beside the open panel the sheet and the foot end where it begins (R148 spec).
  const beside = open ? { "data-beside": "panel" } : {};
  return (
    <Screen
      title={nameOf(task)}
      layout="task"
      bar={{
        back: <IconButton value="back" caption="task.home" onClick={onHome} />,
        ...(narrow ? {} : { under: <p className="nt-top-sub">{words.text("paper.of", place)}</p> }),
        end: (
          <div className="nt-top-end">
            <div className="nt-solve-nav nt-glass">
              <IconButton
                value="previous-task"
                aria-disabled={before === undefined || pending}
                onClick={() => go(before)}
              />
              {counter}
              <IconButton
                value="next-task"
                aria-disabled={after === undefined || pending}
                onClick={() => go(after)}
              />
            </div>
          </div>
        ),
      }}
    >
      <div className="nt-task" {...beside}>
        <div className="nt-task-work" inert={only}>
          {/* The order of the properties is the order React gives them: the paper first (R74 spec). */}
          <novatrail-canvas
            key={attemptId}
            ref={element}
            lang={language}
            {...(narrow && open ? { "tools-hidden": "" } : {})}
            paper={paperOf(task.crop)}
            history={task.history}
            {...(task.tracing === undefined ? {} : { tracing: task.tracing })}
            marks={marks}
            onhistorychange={onHistoryChange}
            ontracingchange={onTracingChange}
          />
        </div>
      </div>
      <div className="nt-task-foot" {...beside}>
        {/* While the panel is open it says the failure, where the phone's sheet does not hide it. */}
        {failure === undefined || open ? null : (
          <p role="alert" className="nt-error">
            {failureText(failure, words)}
          </p>
        )}
        <p id={namesId} className="nt-hint">
          {words.text("task.no-names")}
        </p>
        {written ? null : (
          <span id={writeId} className="nt-hidden-label">
            {words.text("paper.write-first")}
          </span>
        )}
        <p role="status" className="nt-hidden-label">
          {told}
        </p>
        {overTold ? (
          <p role="alert" className="nt-error">
            {words.text("api.attempt-closed")}
          </p>
        ) : null}
        {/* While the panel is open the reading and the verdict are lines in it. */}
        {open ? null : checking ? (
          <VerdictCard
            kind="reading"
            title={words.text("task.reading")}
            line={words.text("task.reading-line")}
          />
        ) : task.verdict === undefined || unwritten ? null : (
          <VerdictCard {...paperCard(task.verdict, words)}>
            {/* The panel's buttons, and the card's own way to put it away. */}
            {acts.hint ? (
              <button type="button" className="nt-card-link" aria-disabled={busy} onClick={hint}>
                {words.text("task.hint")}
              </button>
            ) : null}
            {acts.next ? (
              after === undefined ? null : (
                <button type="button" className="nt-card-button" onClick={() => go(after)}>
                  {words.text("next.task")}
                </button>
              )
            ) : (
              <button
                type="button"
                className="nt-card-button"
                onClick={() => onKeep(attemptId, withoutVerdict)}
              >
                {words.text(task.verdict.kind === "not-yet" ? "task.try-again" : "common.ok")}
              </button>
            )}
          </VerdictCard>
        )}
        {unwritten ? (
          <VerdictCard
            kind="write"
            title={words.text("paper.write-first")}
            line={words.text("paper.write-first-line")}
          >
            <button type="button" className="nt-card-button" onClick={() => setUnwritten(false)}>
              {words.text("common.ok")}
            </button>
          </VerdictCard>
        ) : null}
        <div className="nt-task-row nt-glass">
          {acts.hint ? (
            <>
              <HintButton parts={{ pending: busy, onHint: hint }} />
              <RowLine />
            </>
          ) : null}
          {/* Not disabled while nothing is written: a disabled button would drop the focus. */}
          <button
            type="button"
            className="nt-check-button"
            aria-disabled={!written || pending || checkOver(task)}
            aria-describedby={described}
            onClick={check}
          >
            {words.text("task.check")}
          </button>
        </div>
      </div>
      {open ? (
        <SolveTutor
          quota={quota}
          checking={checking}
          verdict={unwritten ? undefined : task.verdict}
          acts={acts}
          profileId={profileId}
          attemptId={attemptId}
          said={said}
          adult={adult}
          wordsWaiting={wordsWaiting}
          wordsNote={wordsNote}
          explaining={explaining}
          {...(said !== undefined && said.reply === TutorReply.RUNG && !explained
            ? { onExplain: explain }
            : {})}
          failure={failure}
          pending={busy}
          onHint={hint}
          onNext={after === undefined ? undefined : () => go(after)}
          onClose={close}
          headingRef={heading}
        />
      ) : (
        <TutorButton
          onOpen={() => {
            setOpen(true);
            const ask = unasked.current;
            if (ask?.attemptId !== attemptId) return;
            // Within the press: the words that come may be said (WebKit; R07).
            prime();
            rungWords(ask);
          }}
          buttonRef={call}
        />
      )}
    </Screen>
  );
}

/** A task without its verdict: its card put away, and its ticks and crosses. */
function withoutVerdict(task: BegunTask): BegunTask {
  const { verdict: _, checked: __, ...rest } = task;
  return rest;
}
