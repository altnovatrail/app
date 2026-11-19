// The screen of solving the tasks from the learner's paper (R71), as the mockup's `solve`: the top
// bar's pill — Back to My subjects and the task's name, "n of N · from your page" under it but on a
// phone —, and at its other end ‹, the counter that opens the list of the tasks begun with "Add",
// and ›. Each task is a sheet in dots of its own under its crop, the tracing paper, which canvas
// draws and the learner moves and hides (R87 canvas); its history and the paper's place stay in the
// tab's memory, so that a task left and come back to is as it was. At the foot the row of glass:
// Hint · Check. Check sends the task's crop with the crop of the work (R162 spec), and keeps nothing
// on the device: its card is the verdict of the task's one answer slot by the key api derived —
// Correct with Next task, Not yet with Hint, the work not read with why, not checked with the
// outcome —, or "Couldn't check this one" for a task with no key, with Hint and Next task; a task
// solved or with no key takes no Check again, and the list marks the one solved.
import type {
  CanvasElement,
  HistoryChangeEvent,
  PaperTask,
  TracingChangeEvent,
} from "@altnovatrail/spec/canvas";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useNarrow } from "../app/narrow.ts";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { watched } from "../debug/watched.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { workOf } from "../task/attempt.ts";
import { HintButton, RowLine, VerdictCard } from "../task/TaskLayout.tsx";
import { numbers, type PageTask } from "./page.ts";
import {
  type BegunTask,
  besideTask,
  checkOver,
  onList,
  paperCard,
  paperVerdictOf,
  shownTask,
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

export function Solve({
  profileId,
  tasks,
  begun,
  onKeep,
  onAdd,
  onHome,
}: {
  readonly profileId: string;
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
  const [said, setSaid] = useState<string | undefined>(undefined);
  // The verdict told to a screen reader: the card shows it, so it is not shown twice.
  const [told, setTold] = useState("");
  const [unwritten, setUnwritten] = useState(false);
  const [written, setWritten] = useState(false);
  // The key of a check, kept while the work it sent is the same, so that a press again repeats it.
  const sent = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);

  const list = onList(begun, tasks);
  const task = shownTask(list, asked);
  const attemptId = task?.attemptId;

  // Another task: what the one before came to is none of its.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on the task's change alone.
  useEffect(() => {
    setFailure(undefined);
    setSaid(undefined);
    setTold("");
    setUnwritten(false);
    setWritten(element.current?.filled?.[0]?.[0] === true);
  }, [attemptId]);

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      if (attemptId === undefined) return;
      const sheet = event.currentTarget as CanvasElement;
      onKeep(attemptId, (was) => ({
        ...was,
        history: withChange(was.history, event.detail, () => sheet.history),
      }));
      setWritten(sheet.filled?.[0]?.[0] === true);
      setUnwritten(false);
      setSaid(undefined);
      setTold("");
      // Other work puts a verdict away, but that of a Check that is over.
      onKeep(attemptId, (was) => (checkOver(was) ? was : withoutVerdict(was)));
    },
    [attemptId, onKeep],
  );
  const onTracingChange = useCallback(
    (event: TracingChangeEvent) => {
      if (attemptId === undefined) return;
      const tracing = event.detail;
      onKeep(attemptId, (was) => ({ ...was, tracing }));
    },
    [attemptId, onKeep],
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

  const hint = () => {
    if (pending) return;
    setPending(true);
    setFailure(undefined);
    setSaid(undefined);
    setTold("");
    void api.attempt
      .getHint({ profileId, attemptId })
      .then(
        (answer) =>
          setSaid(
            answer.leadingQuestion === "" ? words.text("task.hint-none") : answer.leadingQuestion,
          ),
        (reason: unknown) => setFailure(parseFailure(reason)),
      )
      .finally(() => setPending(false));
  };

  const check = () => {
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
    setTold("");
    onKeep(attemptId, withoutVerdict);
    // Other work is another action, with a key of its own: the history, and where the paper lay,
    // as they are at the press, before the work is read.
    const of = JSON.stringify([attemptId, sheet.history.length, sheet.tracing]);
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
            api.attempt.submitWork({
              profileId,
              attemptId,
              idempotencyKey: key,
              work: paperWork,
              ...ai,
            }),
          sentWork?.statement instanceof Uint8Array && sentWork.crop instanceof Uint8Array
            ? {
                attemptId,
                statement: sentWork.statement,
                crop: sentWork.crop,
                verdict: (a) => a.items[0]?.answerSlots[0]?.verdict,
              }
            : undefined,
        );
        const read = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, read, ai);
        const verdict = paperVerdictOf(answer.items, read);
        onKeep(attemptId, (was) => ({ ...was, verdict }));
        const card = paperCard(verdict, words);
        setTold(card.line === undefined ? card.title : `${card.title}. ${card.line}`);
      } catch (reason) {
        setFailure(parseFailure(reason));
      } finally {
        setPending(false);
        setChecking(false);
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
      <div className="nt-task">
        <div className="nt-task-work">
          {/* The order of the properties is the order React gives them: the paper first (R74 spec). */}
          <novatrail-canvas
            key={attemptId}
            ref={element}
            lang={language}
            paper={paperOf(task.crop)}
            history={task.history}
            {...(task.tracing === undefined ? {} : { tracing: task.tracing })}
            onhistorychange={onHistoryChange}
            ontracingchange={onTracingChange}
          />
        </div>
      </div>
      <div className="nt-task-foot">
        {failure === undefined ? null : (
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
        <p role="status" className="nt-hint">
          {said ?? ""}
        </p>
        <p role="status" className="nt-hidden-label">
          {told}
        </p>
        {checking ? (
          <VerdictCard
            kind="reading"
            title={words.text("task.reading")}
            line={words.text("task.reading-line")}
          />
        ) : task.verdict === undefined || unwritten ? null : (
          <VerdictCard {...paperCard(task.verdict, words)}>
            {task.verdict.kind === "not-yet" || task.verdict.kind === "nokey" ? (
              <button type="button" className="nt-card-link" aria-disabled={pending} onClick={hint}>
                {words.text("task.hint")}
              </button>
            ) : null}
            {task.verdict.kind === "correct" || task.verdict.kind === "nokey" ? (
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
          <HintButton parts={{ pending, onHint: hint }} />
          <RowLine />
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
    </Screen>
  );
}

/** A task without its verdict: its card put away. */
function withoutVerdict(task: BegunTask): BegunTask {
  const { verdict: _, ...rest } = task;
  return rest;
}
