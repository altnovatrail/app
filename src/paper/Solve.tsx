// The screen of solving the tasks from the learner's paper, as the mockup's `solve`: the top bar's
// pill — Back to Home alone, the task's name the screen's heading unseen —, and at its other end ‹,
// the counter that opens the list of the tasks begun with "Add", and ›. Each task is a sheet in
// dots of its own under its crop, the tracing paper, which canvas draws and the learner moves and
// hides; its history and the paper's place stay with the page, so that a task left and come back to
// is as it was, and the page's history keeps them. At the foot the row of glass: the debug button
// and a line, for an account with debug, Ask, Hint till the task is solved, a line and Check, kept
// to one row by BarFit.tsx — Ask its icon alone first, and only then wrapped. Check sends the
// task's crop with the crop of the work and the crop of its instruction, and the page keeps the
// context of the work of each Check answered, but no verdict: its verdict is that of each task of
// the frame as the model of the Check judged it — Correct with Next task, Not yet with Hint, So far
// correct with no answer yet and no mistake, of several tasks with how many are correct, the work
// not read with why, not checked with the outcome —, with a tick or a cross by each answer on the
// sheet; or "Couldn't check this one" when the Check read nothing of a solution, with Hint and Next
// task, and the next Check checks again. A frame solved takes no Check again, and the list marks
// it. A task whose
// attempt is over — solved, or closed by api, as a page of the history opened again may hold — is
// only to be looked at: its sheet takes no writing, no Hint stands, and its Check says "This task
// is already over". Ask opens the tutor's panel, and so does Hint; a verdict does not; Ask and the
// debug button leave the row while the panel is open. While the panel is open the verdict is a line
// in it, the hint a bubble there, said by itself while the voicing is on, and on a phone its sheet
// hides the row and the canvas's bar of tools; while it is closed the verdict is a card above the
// row, with the panel's buttons. The tutor's words are of AI: the Check's own words on the work
// come with its verdict, in a bubble of the panel; Hint before the first Check sends the work as it
// stands to the Check for the opening question, once on the attempt; after Not yet, with the panel
// open — or once it opens — the words of the rung come from the hints the Check gave, and in the
// mode "Show where" with the wavy line under the first mistake, which goes with other work or the
// paper moved; "Explain differently" words the rung anew, once on it; and an adult may report a
// problem with either words. The words stand till another task or Check, and what is said of them
// stops with another task or the panel closed. In the panel's field the learner asks about the task
// by text, or an adult by voice too: the question goes with the last turns of the conversation and
// the work as it stands, and the tutor's answer, by AI, stands under it and is said as a hint is;
// the conversation of each task is the tab's alone, while the screen is open. Behind the grown-ups'
// PIN, grown-up mode lifts the tutor's limits on the task shown till it is turned off or the task
// changes: the field's request goes with the strokes the crop of the work shows, and the tutor's
// act — strokes written, strokes taken off — is drawn on the sheet, one action of its history,
// before its words. "Recognise" on the tracing paper reads the task's
// crop into its text by AI; the page keeps the reading while it is open, and the paper shows the
// photo again each time it is mounted.
import {
  TutorReply,
  type WorkSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type {
  CanvasElement,
  GridChangeEvent,
  HistoryChangeEvent,
  PaperGrid,
  PaperTask,
  TracingChangeEvent,
  TracingReading,
} from "@altnovatrail/spec/canvas";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { GROWN_UP_TIMEOUT_MS, PAPER_TIMEOUT_MS } from "../api/interceptors.ts";
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import type { IconValue } from "../app/icons.ts";
import { useNarrow } from "../app/narrow.ts";
import { PopOver } from "../app/PopOver.tsx";
import { Screen } from "../app/Screen.tsx";
import { usePens } from "../canvas/pens.ts";
import { DebugSlot } from "../debug/slot.tsx";
import { watched } from "../debug/watched.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Key } from "../i18n/words.ts";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { workOf } from "../task/attempt.ts";
import { closedBy, useOwnVoicing } from "../task/shared.ts";
import { HintButton, RowLine, VerdictCard } from "../task/TaskLayout.tsx";
import { usePanelFocus, useQuotaLine } from "../task/TutorPanel.tsx";
import type { Said } from "../tutor/report.ts";
import { BarButton, fitRow, useBarFit } from "./BarFit.tsx";
import { numbers, type PageTask } from "./page.ts";
import { SolveTutor } from "./SolveTutor.tsx";
import {
  type BegunTask,
  type Box,
  besideTask,
  checkOver,
  checkReply,
  MAX_SHEET_STROKES,
  onList,
  paperCard,
  paperVerdictOf,
  pixelsPerMm,
  shownTask,
  type TaskState,
  type Turn,
  taskState,
  turnsOf,
  tutorActs,
  verdictMarks,
  viewOnly,
  wavyOf,
  withChange,
  withTurn,
} from "./solve.ts";

/** The sign of each state in the list of the tasks, and the key of the line under the name. */
const STATES = {
  solved: { icon: "task-solved", word: "paper.task-solved" },
  "not-yet": { icon: "task-not-yet", word: "paper.task-not-yet" },
  "so-far": { icon: "task-to-do", word: "paper.task-so-far" },
  "no-key": { icon: "task-closed", word: "paper.task-no-key" },
  closed: { icon: "task-closed", word: "paper.task-closed" },
  "to-do": { icon: "task-to-do", word: "paper.task-to-do" },
} as const satisfies Record<TaskState, { readonly icon: IconValue; readonly word: Key }>;

/** The reading of a statement not asked yet, or asked again after none came. */
const READY: TracingReading = Object.freeze({ state: "ready" });

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
 * A wrong answer whose rung's words are to be asked, and the key of the request, the same when it
 * goes again after a failure. The rung comes from the hints of the attempt's Check: no work goes.
 */
interface RungAsk {
  readonly attemptId: string;
  readonly wrongAnswers: number;
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
  /** The learner is of the category adult: "Report a problem" stands below the tutor's words. */
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
  const writeId = useId();
  const pens = usePens();
  const element = useRef<CanvasElement>(null);
  const [asked, setAsked] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [checking, setChecking] = useState(false);
  // The sheet's grid the learner turned, kept from task to task of the page while the screen is
  // open: it is the interface's, not the work's, and no store holds it.
  const [grid, setGrid] = useState<PaperGrid | undefined>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  // The tutor's words in its panel, with the reply that brought them: the hint's, and the Check's.
  const [said, setSaid] = useState<Said | undefined>(undefined);
  const [checkSaid, setCheckSaid] = useState<Said | undefined>(undefined);
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
  // The reading of each task's statement by Recognise, while the page is open, and the key of the
  // one on its way, kept till an answer, so that a press again after a failure repeats it.
  const [readings, setReadings] = useState<ReadonlyMap<string, TracingReading>>(new Map());
  const readKey = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);
  // What a reading came to when it gave no text.
  const [readNote, setReadNote] = useState<string | undefined>(undefined);
  // The wrong answer of the last Check whose rung's words the closed panel left unasked.
  const unasked = useRef<RungAsk | undefined>(undefined);
  // Another task or Check: an answer asked before it shows nothing.
  const epoch = useRef(0);
  // The tutor's panel, as the learner leaves it from task to task; it is closed at first.
  const [open, setOpen] = useState(false);
  const isOpen = useRef(open);
  isOpen.current = open;
  const { heading, call } = usePanelFocus(open);
  const row = useRef<HTMLDivElement>(null);
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
  // The key of a check, kept while the work it sent is the same, so that a press again repeats it;
  // dropped after a failure of AI, which a press again asks anew.
  const sent = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);
  // The conversation on each task — the learner's questions, the tutor's hints, words and
  // answers — in the tab's memory alone, while the screen is open: no store keeps it.
  const [talks, setTalks] = useState<ReadonlyMap<string, readonly Turn[]>>(new Map());
  // The task whose question is on its way: one at a time.
  const [asking, setAsking] = useState<string | undefined>(undefined);
  // What the last question came to when no answer came, and the question, back in the field.
  const [askNote, setAskNote] = useState<string | undefined>(undefined);
  const [again, setAgain] = useState<{ readonly text: string; readonly at: number } | undefined>(
    undefined,
  );
  // The key of a question, kept till an answer, so that the same question sent again after a
  // failure repeats it.
  const askKey = useRef<{ readonly of: string; readonly key: string } | undefined>(undefined);
  // The task whose grown-up mode is on, behind the grown-ups' PIN: in the tab's memory alone, off
  // with another task and with the screen left.
  const [grown, setGrown] = useState<string | undefined>(undefined);
  // The task whose request in grown-up mode is on its way, its act drawn on the sheet after it.
  const [writing, setWriting] = useState<string | undefined>(undefined);

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
    setReadNote(undefined);
    setSaid(undefined);
    setCheckSaid(undefined);
    setWordsNote(undefined);
    setExplained(false);
    setWavy(undefined);
    setTold("");
    setUnwritten(false);
    setOverTold(false);
    setAskNote(undefined);
    setAgain(undefined);
    setGrown(undefined);
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
      // The wavy line stood under the work as it was.
      setWavy(undefined);
    },
    [attemptId, onKeep],
  );
  const onGridChange = useCallback((event: GridChangeEvent) => setGrid(event.detail.grid), []);
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

  // The row is fitted once it is drawn, and again with the words; a button that comes or goes in it
  // fits it anew by itself.
  useBarFit(row, [language, task === undefined].join(" "), fitRow);
  if (task === undefined || attemptId === undefined) return null;
  const order = numbers(tasks);
  const nameOf = (each: BegunTask) =>
    words.text(each.drawn ? "paper.your-frame" : "paper.task", { n: order.get(each.taskId) ?? 0 });
  const at = list.indexOf(task);
  const done = list.filter((each) => taskState(each) === "solved").length;
  const place = { n: at + 1, total: list.length };
  const before = besideTask(list, attemptId, -1);
  const after = besideTask(list, attemptId, 1);
  const go = (to: BegunTask | undefined) => {
    if (to !== undefined && !pending) setAsked(to.attemptId);
  };

  /** A turn of the conversation on a task, and none of it again but a question. */
  const remember = (of: string, turn: Turn) =>
    setTalks((before) => new Map(before).set(of, withTurn(before.get(of) ?? [], turn)));
  /** The last question of a task taken back out of its conversation: no answer came to it. */
  const unask = (of: string) =>
    setTalks((before) => {
      const turns = before.get(of) ?? [];
      return turns.at(-1)?.learner === true ? new Map(before).set(of, turns.slice(0, -1)) : before;
    });

  /** The tutor's words shown: said by the voicing in the open panel, else told to a screen reader. */
  const show = (next: Said) => {
    remember(attemptId, { learner: false, text: next.text, line: false });
    setSaid((before) =>
      // The words shown again stay the reply they came by, and a report begun on them stays open.
      before?.text === next.text ? before : next,
    );
    if (isOpen.current) auto([{ text: next.text, language }]);
    else setTold(next.text);
  };

  /** The words of the rung of a wrong answer, by AI with the work of its Check. */
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
        wordsLanguage: language,
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
          // closed beyond this call.
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

  /**
   * The work as it stands, for the opening question: the sheet's, or with nothing written the task's
   * crop as printed in the place of the work's, which holds no stroke.
   */
  const workNow = async (): Promise<MessageInitShape<typeof WorkSchema>> => {
    const work = await element.current?.exportWork();
    if (work !== undefined && work !== null) return workOf(work, task.instruction);
    const crop = new Uint8Array(await task.crop.arrayBuffer());
    const above =
      task.instruction === undefined
        ? undefined
        : new Uint8Array(await task.instruction.arrayBuffer());
    return {
      surface: {
        case: "paper",
        value: { statement: crop, crop, ...(above === undefined ? {} : { instruction: above }) },
      },
    };
  };

  /** The opening question of a task before its first Check, by AI from the work as it stands. */
  const openingWords = async (asked: number) => {
    // Other work is another action, with a key of its own, as a Check's.
    const sheet = element.current;
    const of = JSON.stringify([attemptId, sheet?.history.length ?? 0, sheet?.tracing]);
    if (openingKey.current?.of !== of) openingKey.current = { of, key: idempotencyKey() };
    const key = openingKey.current.key;
    const work = await workNow();
    const ai = holder.aiFields(profileId);
    const answer = await watched(api, () =>
      api.attempt.getOpeningWords(
        { profileId, attemptId, idempotencyKey: key, work, wordsLanguage: language, ...ai },
        { timeoutMs: PAPER_TIMEOUT_MS },
      ),
    );
    openingKey.current = undefined;
    const read = outcomeOf(answer.outcome);
    holder.noteOutcome(profileId, read, ai);
    setSpent((n) => n + 1);
    if (asked !== epoch.current) return;
    show({ text: answer.words, reply: TutorReply.OPENING, rung: 0 });
    if (closesAI(read)) setWordsNote(outcomeText(read, words));
  };

  /** The task's statement read by AI into its text, on the learner's Recognise. */
  const recognise = () => {
    const of = attemptId;
    if (readings.get(of)?.state === "busy") return;
    if (readKey.current?.of !== of) readKey.current = { of, key: idempotencyKey() };
    const key = readKey.current.key;
    const asked = epoch.current;
    const keep = (reading: TracingReading) =>
      setReadings((before) => new Map(before).set(of, reading));
    keep({ state: "busy" });
    setReadNote(undefined);
    setFailure(undefined);
    const ai = holder.aiFields(profileId);
    void task.crop
      .arrayBuffer()
      .then((buffer) =>
        watched(api, () =>
          api.attempt.readStatement({
            profileId,
            attemptId: of,
            idempotencyKey: key,
            statement: new Uint8Array(buffer),
            ...ai,
          }),
        ),
      )
      .then(
        (answer) => {
          readKey.current = undefined;
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          const got = answer.statements.length > 0;
          keep(got ? { state: "done", statements: answer.statements } : READY);
          if (asked === epoch.current && read !== undefined && (!got || closesAI(read)))
            setReadNote(outcomeText(read, words));
        },
        (reason: unknown) => {
          keep(READY);
          if (asked === epoch.current) setFailure(parseFailure(reason));
        },
      )
      .finally(() => setSpent((n) => n + 1));
  };

  const hint = () => {
    // The rung's words on their way are the hint: a Hint meanwhile would show the fallback text.
    if (pending || wordsWaiting) return;
    // Within the press: the words that come may be said (WebKit).
    prime();
    setOpen(true);
    setFailure(undefined);
    setTold("");
    // The rung's words of a wrong answer the closed panel left unasked are the hint.
    const ask = unasked.current;
    if (ask?.attemptId === attemptId) return rungWords(ask);
    const asked = epoch.current;
    setPending(true);
    setWordsNote(undefined);
    void (async () => {
      try {
        const answer = await api.attempt.getHint({
          profileId,
          attemptId,
          wordsLanguage: language,
        });
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

  /** A request of the field that brought no answer: out of the conversation, and back in the field. */
  const giveBack = (of: string, asked: number, question: string, note: string | undefined) => {
    unask(of);
    if (asked !== epoch.current) return;
    setAskNote(note);
    setAgain({ text: question, at: Date.now() });
  };

  /** Grown-up mode turned on or off on this task, a line of its conversation. */
  const grownMode = (on: boolean) => {
    setGrown(on ? attemptId : undefined);
    remember(attemptId, { learner: false, text: "", line: true, mode: on ? "on" : "off" });
  };

  /**
   * The learner's own question about the task, by AI with the conversation before it and the work
   * as it stands, which the Check reads while the attempt keeps no Check of its own. The question
   * stands in the conversation at once; one that brings no answer goes back to the field, and the
   * same question sent again goes with the same key, which gets what was done.
   */
  const ask = (question: string, voice: boolean) => {
    if (asking !== undefined || viewOnly(task)) return;
    // Within the press: the words that come may be said (WebKit).
    prime();
    if (grown === attemptId) return askGrown(question, voice);
    const of = attemptId;
    const turns = turnsOf(talks.get(of) ?? []);
    remember(of, { learner: true, text: question, line: true, ...(voice ? { voice } : {}) });
    const same = JSON.stringify([of, question]);
    if (askKey.current?.of !== same) askKey.current = { of: same, key: idempotencyKey() };
    const key = askKey.current.key;
    const asked = epoch.current;
    setAsking(of);
    setAskNote(undefined);
    const ai = holder.aiFields(profileId);
    const back = (note: string) => giveBack(of, asked, question, note);
    void (async () => {
      try {
        const work = await workNow();
        const answer = await watched(api, () =>
          api.attempt.askTutor(
            {
              profileId,
              attemptId: of,
              idempotencyKey: key,
              question,
              turns: [...turns],
              work,
              wordsLanguage: language,
              ...ai,
            },
            { timeoutMs: PAPER_TIMEOUT_MS },
          ),
        );
        askKey.current = undefined;
        const read = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, read, ai);
        // A repeat holds no words: api keeps none, and the question sent again is a new one.
        if (answer.repeated || answer.words === "") {
          back(failureText({ kind: "offline" }, words));
          return;
        }
        remember(of, { learner: false, text: answer.words, line: true });
        if (asked !== epoch.current) return;
        if (isOpen.current) auto([{ text: answer.words, language }]);
        else setTold(answer.words);
        if (closesAI(read)) setAskNote(outcomeText(read, words));
      } catch (reason) {
        const found = parseFailure(reason);
        // A refusal is the end of the action; anything else may have reached api, and goes again
        // with its key.
        if (found.kind === "refused") askKey.current = undefined;
        back(failureText(found, words));
        closed(found);
      } finally {
        setAsking(undefined);
        setSpent((n) => n + 1);
      }
    })();
  };

  /**
   * The grown-up's request in grown-up mode, by AI with the conversation before it, the part of the
   * sheet in sight and the strokes its crop shows, a blank sheet too: the tutor's act is drawn on
   * the sheet — one action, which the history keeps as any other and an undo takes back whole —,
   * and then its words stand under the request, marked. Turned off meanwhile, the act still comes:
   * it was asked while the mode was on. A request that brings no act puts it back in the field, as a question
   * that brings no answer does; so does an act the sheet cannot take, as one on a stroke erased
   * meanwhile. A repeat holds nothing: api keeps nothing of the answer.
   */
  const askGrown = (question: string, voice: boolean) => {
    const sheet = element.current;
    if (sheet === null) return;
    const of = attemptId;
    const turns = turnsOf(talks.get(of) ?? []);
    remember(of, {
      learner: true,
      text: question,
      line: true,
      grown: true,
      ...(voice ? { voice } : {}),
    });
    const same = JSON.stringify([of, question, "grown"]);
    if (askKey.current?.of !== same) askKey.current = { of: same, key: idempotencyKey() };
    const key = askKey.current.key;
    const asked = epoch.current;
    setAsking(of);
    setWriting(of);
    setAskNote(undefined);
    const ai = holder.aiFields(profileId);
    const back = (note?: string) => giveBack(of, asked, question, note);
    void (async () => {
      try {
        // The part of the sheet in sight, with room to write in, a blank sheet's too: the drawing
        // acts where the grown-up looks.
        const work = await sheet.exportForDrawing();
        const context = work.submission;
        const strokes = sheet
          .cropStrokes(context)
          .slice(-MAX_SHEET_STROKES)
          .map(({ id, points }) => ({ id, points: [...points] }));
        const paperWork = await workOf(work, task.instruction);
        const answer = await watched(api, () =>
          api.attempt.askGrownUp(
            {
              profileId,
              attemptId: of,
              idempotencyKey: key,
              question,
              turns: [...turns],
              work: paperWork,
              strokes,
              pixelsPerMm: pixelsPerMm(context.crop),
              wordsLanguage: language,
              ...ai,
            },
            { timeoutMs: GROWN_UP_TIMEOUT_MS },
          ),
        );
        askKey.current = undefined;
        const read = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, read, ai);
        if (answer.repeated) return back();
        const act = {
          strokes: answer.strokes.map(({ points, color, width }) => ({
            points: [...points],
            color,
            width,
          })),
          erase: [...answer.erase],
        };
        const acts = act.strokes.length > 0 || act.erase.length > 0;
        if (read !== undefined) return back(outcomeText(read, words));
        if (!acts && answer.words === "") return back(words.text("api.ai-failure"));
        // Another task is another sheet: the act was on this one's crop.
        if (!sheet.isConnected) return unask(of);
        if (acts) {
          try {
            await sheet.drawTutor(context, act);
          } catch (reason) {
            if (!(reason instanceof TypeError)) throw reason;
            return back(words.text("api.ai-failure"));
          }
        }
        if (answer.words === "") return;
        remember(of, { learner: false, text: answer.words, line: true, grown: true });
        if (asked !== epoch.current) return;
        if (isOpen.current) auto([{ text: answer.words, language }]);
        else setTold(answer.words);
      } catch (reason) {
        const found = parseFailure(reason);
        if (found.kind === "refused") askKey.current = undefined;
        back(failureText(found, words));
        closed(found);
      } finally {
        setAsking(undefined);
        setWriting(undefined);
        setSpent((n) => n + 1);
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
        wordsLanguage: language,
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
    const reason = closedBy(found);
    if (reason !== undefined)
      onKeep(attemptId, (was) =>
        withoutVerdict({
          ...was,
          over: true,
          ...(reason === CloseReason.CORRECT ? { solved: true } : {}),
        }),
      );
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
    setCheckSaid(undefined);
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
        const paperWork = await workOf(work, task.instruction);
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
                wordsLanguage: language,
                ...ai,
              },
              { timeoutMs: PAPER_TIMEOUT_MS },
            ),
          sentWork?.statement instanceof Uint8Array && sentWork.crop instanceof Uint8Array
            ? {
                attemptId,
                statement: sentWork.statement,
                crop: sentWork.crop,
                ...(sentWork.instruction instanceof Uint8Array
                  ? { instruction: sentWork.instruction }
                  : {}),
                verdicts: (a) => a.items.map((item) => item.answerSlots[0]?.verdict),
              }
            : undefined,
        );
        const read = outcomeOf(answer.outcome);
        holder.noteOutcome(profileId, read, ai);
        // A failure of AI is a moment's: api keeps it under the key, so a press again with the same
        // work would get it back with no call; the next press is a new action.
        if (read?.cause === Cause.AI_FAILURE) sent.current = undefined;
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
          ...(verdict.kind === "correct" ? { over: true, solved: true } : {}),
        }));
        const card = paperCard(verdict, words);
        setTold(card.line === undefined ? card.title : `${card.title}. ${card.line}`);
        if (answer.tutorWords !== "") {
          remember(attemptId, { learner: false, text: answer.tutorWords, line: false });
          setCheckSaid({ text: answer.tutorWords, ...checkReply(verdict, answer.wrongAnswers) });
          if (isOpen.current) auto([{ text: answer.tutorWords, language }]);
        }
        if (verdict.kind === "not-yet" && answer.wrongAnswers > 0) {
          // A new rung: "Explain differently" is its own once more, with a key of its own.
          setExplained(false);
          explainKey.current = undefined;
          // The words of the rung are asked at once while the panel is open, else once it opens.
          const ask = { attemptId, wrongAnswers: answer.wrongAnswers, key: idempotencyKey() };
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
      caption={
        <>
          <Icon value="tasks" />
          {words.text("paper.counter", place)}
        </>
      }
      className="nt-solve-count"
      anchor=".nt-solve-nav"
      gap={6}
      popClassName="nt-pop-tasks"
    >
      {(close) => (
        <>
          <div className="nt-tasks-head">
            <h2>
              {words.text("paper.tasks")}
              <span className="nt-tasks-done">
                {words.text("paper.tasks-done", { n: done, total: list.length })}
              </span>
            </h2>
            <button
              type="button"
              className="nt-plain nt-tasks-add"
              onClick={() => {
                close();
                onAdd();
              }}
            >
              <Icon value="add" />
              {words.text("paper.add")}
            </button>
          </div>
          <ol className="nt-tasks">
            {list.map((each) => {
              const state = taskState(each);
              return (
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
                    <span className="nt-tasks-name">
                      {nameOf(each)}
                      <span className="nt-tasks-said">{words.text(STATES[state].word)}</span>
                    </span>
                    <span className="nt-tasks-state" data-state={state}>
                      <Icon
                        value={STATES[state].icon}
                        chosen={STATES[state].icon !== "task-to-do"}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </PopOver>
  );

  // Hint waits while the rung's words are on their way, as for any request of its own.
  const busy = pending || wordsWaiting;
  const only = viewOnly(task);
  const acts = tutorActs(task);
  const close = () => {
    hush();
    setOpen(false);
  };
  // Beside the open panel the sheet and the foot end where it begins.
  const beside = open ? { "data-beside": "panel" } : {};
  return (
    <Screen
      title={nameOf(task)}
      layout="task"
      unseen
      bar={{
        back: <IconButton value="back" caption="task.home" onClick={onHome} />,
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
      <div className="nt-task nt-task-paper" {...beside}>
        <div className="nt-task-work" inert={only}>
          {/* The order of the properties is the order React gives them: the paper first. */}
          <novatrail-canvas
            key={attemptId}
            ref={element}
            lang={language}
            {...(narrow && open ? { "tools-hidden": "" } : {})}
            paper={paperOf(task.crop)}
            history={task.history}
            {...(task.tracing === undefined ? {} : { tracing: task.tracing })}
            {...(only ? {} : { reading: readings.get(attemptId) ?? READY })}
            {...(grid === undefined ? {} : { grid })}
            marks={marks}
            onhistorychange={onHistoryChange}
            ontracingchange={onTracingChange}
            {...(only ? {} : { ontracingread: recognise })}
            ongridchange={onGridChange}
            {...pens}
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
        {written ? null : (
          <span id={writeId} className="nt-hidden-label">
            {words.text("paper.write-first")}
          </span>
        )}
        <p role="status" className="nt-hidden-label">
          {told}
        </p>
        {readNote === undefined ? null : (
          <p role="alert" className="nt-error">
            {readNote}
          </p>
        )}
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
        <div ref={row} className="nt-task-row nt-glass">
          {/* Debug's button leaves with Ask, so that its window never opens over the panel. */}
          {open ? null : (
            <>
              <DebugSlot line />
              <BarButton
                icon="tutor"
                caption={words.text("paper.ask")}
                className="nt-icon-button nt-ask"
                expanded={false}
                buttonRef={call}
                onClick={() => {
                  setOpen(true);
                  const ask = unasked.current;
                  if (ask?.attemptId !== attemptId) return;
                  // Within the press: the words that come may be said (WebKit).
                  prime();
                  rungWords(ask);
                }}
              />
            </>
          )}
          {acts.hint ? <HintButton parts={{ pending: busy, onHint: hint }} /> : null}
          {acts.hint || !open ? <RowLine /> : null}
          {/* Not disabled while nothing is written: a disabled button would drop the focus. */}
          <button
            type="button"
            className="nt-check-button"
            aria-disabled={!written || pending || checkOver(task)}
            {...(written ? {} : { "aria-describedby": writeId })}
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
          checkSaid={checkSaid}
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
          turns={talks.get(attemptId) ?? []}
          asking={asking === attemptId}
          askNote={askNote}
          askOff={asking !== undefined || only}
          again={again}
          onAsk={ask}
          {...(only ? {} : { grown: grown === attemptId, onGrown: grownMode })}
          writing={writing === attemptId}
        />
      ) : null}
    </Screen>
  );
}

/** A task without its verdict: its card put away, and its ticks and crosses. */
function withoutVerdict(task: BegunTask): BegunTask {
  const { verdict: _, checked: __, ...rest } = task;
  return rest;
}
