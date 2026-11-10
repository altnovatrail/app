// The task screen of an open attempt (sections 3.2 and 3.3 of docs/architecture.md; R05, R20 in
// docs/decisions.md; AttemptService and LearningService in the contract): `GetOpenAttempt` gives
// the attempt's start — the open view of its task and its package — and the screen takes the
// package's manifest, solving steps and technique catalog from the shared cache, and what this
// device wrote of the attempt from the profile's database: the history of writing and the state of
// the steps. Every stroke and every change of the steps is written there, and a write that did not
// land says so. A tap only chooses; Check sends the options tapped and the handwriting, the crop the
// canvas gives, with one idempotency key for the action and the same with every repeat of it; the
// submission is kept with its context, for the tutor's marks. "Not yet" asks the words of its rung
// at once, with the same work, and the marks that come with them go on the canvas (R21). "Correct"
// closes the attempt: its work on the device goes but the correct one's, which goes with the request
// of the words after a correct answer and is erased once it ends, and the solution comes. An attempt
// api closed meanwhile is a screen of its own, and one closed unchecked asks CheckPackages (T21).
import { Mode as ProfileMode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type { WorkSchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { OpenAttempt } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import type {
  CanvasElement,
  ExportedWork,
  HistoryChangeEvent,
  HistoryEvent,
  Marks,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { aiFields, idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Offline } from "../boot/Screens.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile, type Profile } from "../storage/profile.ts";
import {
  markNames,
  marksOf,
  resumed,
  solutionOf,
  tappedChoices,
  type Verdicts,
  verdictsOf,
  withoutSlot,
  withoutWriting,
  workOf,
} from "./attempt.ts";
import { Pause } from "./pause.ts";
import {
  choicesOnly,
  choose,
  givesTechniques,
  goTo,
  gotTechniques,
  type Mode,
  modeOf,
  readState,
  type StepsState,
  slotsFilled,
  stepDone,
  tick,
} from "./steps.ts";
import { TaskScreen } from "./TaskScreen.tsx";

/** Why an attempt is over, in words, by its close reason. */
const CLOSED_KEYS = {
  [CloseReason.CORRECT]: "task.closed-correct",
  [CloseReason.SOLUTION_SHOWN]: "task.closed-solution-shown",
  [CloseReason.LEFT]: "task.closed-left",
  [CloseReason.ABANDONED]: "task.closed-abandoned",
  [CloseReason.UNCHECKED]: "task.unchecked",
  [CloseReason.NOT_SUITABLE]: "task.closed-not-suitable",
  [CloseReason.DONE]: "task.closed-done",
} as const;

/** What the screen has read of the attempt. */
interface Opened {
  readonly task: open.Task;
  readonly digest: string;
  readonly manifest: open.Manifest | undefined;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly profile: Profile | undefined;
  readonly history: readonly HistoryEvent[];
  readonly state: StepsState;
  readonly verdicts: Verdicts;
  /** The first write of the attempt on this device did not land. */
  readonly unsaved: boolean;
  /** The words of the current rung the attempt keeps, for an attempt gone on with. */
  readonly rung?: string;
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "closed"; readonly reason: CloseReason }
  | { readonly status: "ready"; readonly opened: Opened };

/** The close reason a refusal `CAUSE_ATTEMPT_CLOSED` tells, if it is one. */
function closedBy(failure: Failure): CloseReason | undefined {
  if (failure.kind !== "refused" || failure.cause !== Cause.ATTEMPT_CLOSED) return undefined;
  return failure.data.case === "closeReason" ? failure.data.value : CloseReason.UNSPECIFIED;
}

export interface TaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  /** The profile's default mode, which each attempt starts in. */
  readonly defaultMode: ProfileMode;
  readonly device: Device;
  /** The learner's open attempt changed: a new one began, or this one ended. */
  readonly onAttempt: (attemptId: string | undefined) => void;
}

export function Task({ profileId, attemptId, defaultMode, device, onAttempt }: TaskProps) {
  const api = useApi();
  const { views, checks } = usePackages();
  const { words } = useLanguage();
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the attempt again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void load().then(
      (opened) => {
        if (current) setRead({ status: "ready", opened });
      },
      async (reason: unknown) => {
        const failure = parseFailure(reason);
        const closed = closedBy(failure);
        if (closed !== undefined) {
          // A read a retry or StrictMode left behind erases nothing: the one that stays does.
          if (!current) return;
          await ended(closed);
          if (current) setRead({ status: "closed", reason: closed });
        } else if (failure.kind === "refused" && failure.cause === Cause.NOT_FOUND) {
          if (!current) return;
          onAttempt(undefined);
          redirect(HOME);
        } else if (current) setRead({ status: "failed", failure });
      },
    );
    return () => {
      current = false;
    };

    async function load(): Promise<Opened> {
      const answer: OpenAttempt | undefined = (
        await api.learning.getOpenAttempt({ profileId, attemptId })
      ).attempt;
      const start = answer?.start;
      if (answer === undefined || start?.task === undefined) {
        throw new Error("api: an open attempt without its start");
      }
      const task = views.parseView(start.task.json, start.task.moduleFormatVersion) as open.Task;
      const digest = start.packageDigest;
      const [manifest, steps, catalog] = await Promise.all([
        views.get(digest, "manifest"),
        views.get(digest, "solving-steps"),
        views.get(digest, "techniques"),
      ]);
      const stepList = steps?.view.steps ?? [];
      const profile =
        (await openProfile(device, profileId).catch(() => undefined)) ??
        (await addProfile(device, profileId).catch(() => undefined));
      const stored = await profile?.readAttempt(attemptId).catch(() => undefined);
      const kept = stored?.attempt.digest === digest ? stored : undefined;
      let unsaved = profile === undefined;
      if (profile !== undefined && kept === undefined) {
        unsaved = (await profile.beginAttempt({ attemptId, digest, task })) === "unsaved";
      }
      const { state, verdicts } = resumed(
        task,
        stepList,
        readState(kept?.attempt.steps),
        answer,
        defaultMode === ProfileMode.SELF ? "self" : "steps",
      );
      return {
        task,
        digest,
        manifest: manifest?.view,
        steps: stepList,
        catalog: catalog?.view,
        profile,
        history: kept?.history ?? [],
        state,
        verdicts,
        unsaved,
        ...(answer.rung === undefined ? {} : { rung: answer.rung.words }),
      };
    }
  }, [api, views, device, profileId, attemptId, attempt]);

  /**
   * The attempt is over: its work on the device goes, and an unchecked one asks CheckPackages. The
   * screen of an attempt read gives the database it holds; a read that found it closed opens it.
   */
  const ended = useCallback(
    async (reason: CloseReason, held?: Profile, correct?: number) => {
      const profile = held ?? (await openProfile(device, profileId).catch(() => undefined));
      await profile?.attemptEnded(attemptId, correct).catch(() => {});
      if (reason === CloseReason.UNCHECKED) void checks.check();
      onAttempt(undefined);
    },
    [device, profileId, attemptId, checks, onAttempt],
  );

  const again = useAgain(profileId, attemptId, onAttempt);

  if (read.status === "loading") return null;
  if (read.status === "failed") {
    if (read.failure.kind === "offline")
      return <Offline onRetry={() => setAttempt((n) => n + 1)} />;
    return (
      <Screen title={failureText(read.failure, words)}>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          {words.text("boot.retry")}
        </button>
      </Screen>
    );
  }
  if (read.status === "closed") {
    return (
      <Screen title={words.text("api.attempt-closed")}>
        {read.reason === CloseReason.UNSPECIFIED ? null : (
          <p>{words.text(keyFor(CLOSED_KEYS, read.reason))}</p>
        )}
        {again.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(again.failure, words)}
          </p>
        )}
        <div className="nt-buttons">
          <button
            type="button"
            aria-disabled={again.pending}
            onClick={() => {
              if (!again.pending) again.start();
            }}
          >
            {words.text("task.again")}
          </button>
          <button type="button" className="nt-secondary" onClick={() => navigate(HOME)}>
            {words.text("task.home")}
          </button>
        </div>
      </Screen>
    );
  }
  return (
    <OpenTask
      key={read.opened.digest}
      profileId={profileId}
      attemptId={attemptId}
      opened={read.opened}
      again={again}
      onEnded={ended}
      onClosed={(reason) => {
        void ended(reason, read.opened.profile).then(() => setRead({ status: "closed", reason }));
      }}
    />
  );
}

/** "Try it again": `BeginAttempt` of the same task, with one key until it is done. */
function useAgain(
  profileId: string,
  attemptId: string,
  onAttempt: (attemptId: string | undefined) => void,
) {
  const api = useApi();
  const key = useRef<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const start = useCallback(() => {
    key.current ??= idempotencyKey();
    setPending(true);
    setFailure(undefined);
    void api.learning
      .beginAttempt({
        profileId,
        idempotencyKey: key.current,
        start: { case: "previousAttemptId", value: attemptId },
      })
      .then(
        (answer) => {
          key.current = undefined;
          const next = answer.attempt?.attemptId;
          if (next !== undefined) onAttempt(next);
        },
        (reason: unknown) => setFailure(parseFailure(reason)),
      )
      .finally(() => setPending(false));
  }, [api, profileId, attemptId, onAttempt]);
  return { start, pending, failure };
}

interface OpenTaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  readonly opened: Opened;
  readonly again: ReturnType<typeof useAgain>;
  readonly onEnded: (reason: CloseReason, held?: Profile, correct?: number) => Promise<void>;
  readonly onClosed: (reason: CloseReason) => void;
}

/** A submission sent: its key, the work the canvas gave and as the contract carries it, its number. */
interface Sent {
  readonly key: string;
  readonly work: ExportedWork | undefined;
  readonly contract: MessageInitShape<typeof WorkSchema> | undefined;
  /** Its number among the submissions the device keeps, from 0; none when it was not kept. */
  readonly number: number | undefined;
}

/** The screen of an attempt read: what the learner does on it, written as it is done. */
function OpenTask({ profileId, attemptId, opened, again, onEnded, onClosed }: OpenTaskProps) {
  const api = useApi();
  const { views, files } = usePackages();
  const { words } = useLanguage();
  const { task, profile, steps } = opened;
  const element = useRef<CanvasElement>(null);
  const [state, setState] = useState(opened.state);
  const [verdicts, setVerdicts] = useState(opened.verdicts);
  const [filled, setFilled] = useState<readonly (readonly boolean[])[] | null>(null);
  const [notSaved, setNotSaved] = useState(opened.unsaved);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [solution, setSolution] = useState<readonly open.StatementPart[] | undefined>(undefined);
  const [blink, setBlink] = useState(false);
  const [tutorWords, setTutorWords] = useState<string | undefined>(opened.rung);
  const [wordsFailure, setWordsFailure] = useState<string | undefined>(undefined);
  const [wordsCame, setWordsCame] = useState(false);
  const [outcome, setOutcome] = useState<string | undefined>(undefined);
  const [marks, setMarks] = useState<Marks | undefined>(undefined);
  // One key for a check of this work, the same with every repeat of it (section 3.3): a new
  // stroke or a new option is a new action.
  const sent = useRef<Sent | undefined>(undefined);
  // How many changes the sheet has had: a stroke during an export makes the work exported older.
  const drawn = useRef(0);
  // The checks begun: an answer of words that belongs to an earlier check is dropped.
  const checks = useRef(0);
  // Once the attempt is over its record is gone: nothing more is written, and no write says unsaved.
  const over = useRef(false);
  const latest = useRef({ state, solution, filled });
  latest.current = { state, solution, filled };
  const mode = modeOf(state, steps);
  const handwriting = !choicesOnly(task);

  const media = useMemo(() => files.media(opened.digest), [files, opened.digest]);
  // Check blinks on a pause only while it is open.
  const pause = useMemo(
    () =>
      new Pause(setBlink, () => {
        const now = latest.current;
        return now.solution === undefined && slotsFilled(task, now.state.choices, now.filled);
      }),
    [task],
  );
  useEffect(() => () => pause.stop(), [pause]);

  // `filled` changes with no event when the task and the history are given: read it after them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once the element has its task.
  useEffect(() => {
    setFilled(element.current?.filled ?? null);
  }, [task]);

  // The tutor's marks go to the canvas after its task and its history, which React gave it in the
  // render (R36 in spec). Marks it refuses — a box it cannot place — are dropped, not a broken screen.
  useEffect(() => {
    const canvas = element.current;
    if (canvas === null) return;
    try {
      canvas.marks = marks;
    } catch {
      canvas.marks = undefined;
    }
  }, [marks]);

  const save = useCallback(
    (next: StepsState) => {
      setState(next);
      if (over.current) return;
      void profile?.saveSteps(attemptId, next).then((saved) => {
        if (saved === "unsaved") setNotSaved(true);
      });
      if (profile === undefined) setNotSaved(true);
    },
    [profile, attemptId],
  );

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      setFilled(element.current?.filled ?? null);
      pause.acted();
      // Other work is another action: its check gets a key of its own, and what was read of the
      // work before is no verdict of this one.
      sent.current = undefined;
      drawn.current += 1;
      setVerdicts((held) => withoutWriting(held, task));
      if (profile === undefined || over.current) return;
      void profile.appendHistory(attemptId, event.detail).then(async (saved) => {
        // Events were missed: the element's whole history takes the place of what was kept.
        const result =
          saved === "missed"
            ? await profile.replaceHistory(attemptId, element.current?.history ?? [])
            : saved;
        if (result === "unsaved") setNotSaved(true);
      });
    },
    [profile, attemptId, pause, task],
  );

  // A step that gives techniques asks api for them once, by steps, and keeps what it gave.
  const asked = useRef(new Set<number>());
  const place = state.place;
  const step = steps[place - 1];
  const want =
    mode === "steps" &&
    solution === undefined &&
    givesTechniques(step) &&
    state.techniques[place] === undefined;
  useEffect(() => {
    if (!want || asked.current.has(place)) return;
    asked.current.add(place);
    void api.attempt.beginStep({ profileId, attemptId, step: place }).then(
      (answer) =>
        save(gotTechniques(latest.current.state, place, answer.techniques?.techniqueIds ?? [])),
      (reason: unknown) => {
        const closed = closedBy(parseFailure(reason));
        if (closed !== undefined) {
          over.current = true;
          onClosed(closed);
        }
        // Any other failure asks again when the learner comes back to the step.
        else asked.current.delete(place);
      },
    );
  }, [want, place, api, profileId, attemptId, save, onClosed]);

  const markName = useMemo(() => markNames(words), [words]);

  /** The words of the rung of a wrong answer, asked at once with the same work (R82 in spec). */
  const rungWords = useCallback(
    (wrongAnswers: number, of: Sent) => {
      setWordsFailure(undefined);
      const asked = checks.current;
      // The words of an earlier check, or of an attempt that ended meanwhile, show nothing.
      const late = () => asked !== checks.current || over.current;
      void api.attempt
        .getRungWords({
          profileId,
          attemptId,
          idempotencyKey: idempotencyKey(),
          wrongAnswers,
          ...(of.contract === undefined ? {} : { work: of.contract }),
          ...aiFields(),
        })
        .then(
          (answer) => {
            if (late()) return;
            const read = outcomeOf(answer.outcome);
            if (answer.words !== "") {
              // The fallback text of the rung comes with the outcome "not admitted": words all the same.
              setTutorWords(answer.words);
              setWordsCame(true);
            } else if (read !== undefined) setWordsFailure(outcomeText(read, words));
            if (of.work !== undefined && answer.marks.length > 0) {
              setMarks(
                marksOf(
                  answer.marks,
                  of.work.submission,
                  markName,
                  task.canvas.kind === "workbook",
                ),
              );
            }
          },
          (reason: unknown) => {
            if (late()) return;
            const found = parseFailure(reason);
            const closed = closedBy(found);
            if (closed !== undefined) {
              over.current = true;
              onClosed(closed);
              return;
            }
            // A rung that is not this answer's, or none, has no words to show.
            const quiet =
              found.kind === "refused" &&
              (found.cause === Cause.NOT_CURRENT ||
                found.cause === Cause.NO_RUNG ||
                found.cause === Cause.NO_MORE_WORDS);
            if (!quiet) setWordsFailure(failureText(found, words));
          },
        );
    },
    [api, profileId, attemptId, task, words, markName, onClosed],
  );

  /** The words after a correct answer, with its work: once they came or their request ended, it goes. */
  const correctWords = useCallback(
    (of: Sent) => {
      void api.attempt
        .getCorrectAnswerWords({
          profileId,
          attemptId,
          idempotencyKey: idempotencyKey(),
          ...(of.contract === undefined ? {} : { work: of.contract }),
          ...aiFields(),
        })
        .then(
          (answer) => {
            if (answer.words !== undefined && answer.words !== "") {
              setTutorWords(answer.words);
              setWordsCame(true);
            }
          },
          () => {},
        )
        .finally(() => {
          if (of.contract !== undefined) void profile?.wordsCame(attemptId).catch(() => {});
        });
    },
    [api, profileId, attemptId, profile],
  );

  /** The submission of what the sheet and the options hold now, or the one sent before, again. */
  const submission = useCallback(async (): Promise<Sent | undefined> => {
    if (sent.current !== undefined) return sent.current;
    if (!handwriting) {
      sent.current = {
        key: idempotencyKey(),
        work: undefined,
        contract: undefined,
        number: undefined,
      };
      return sent.current;
    }
    // The work and the history's length as the sheet is now; a stroke while they are kept and sent
    // is another action, and this submission is not the one a repeat sends.
    const at = drawn.current;
    const historyLength = element.current?.history.length ?? 0;
    const work = (await element.current?.exportWork()) ?? null;
    if (work === null) return undefined;
    let number: number | undefined;
    if (profile === undefined) setNotSaved(true);
    else {
      const saved = await profile.addSubmission(attemptId, work, historyLength);
      if (saved === "unsaved") setNotSaved(true);
      else number = saved;
    }
    const made: Sent = { key: idempotencyKey(), work, contract: await workOf(work), number };
    if (drawn.current === at) sent.current = made;
    return made;
  }, [handwriting, profile, attemptId]);

  const check = useCallback(() => {
    setPending(true);
    setFailure(undefined);
    pause.stop();
    checks.current += 1;
    void (async () => {
      try {
        const of = await submission();
        // Nothing on the sheet to check after all: the screen stays as it was.
        if (of === undefined) return;
        setOutcome(undefined);
        setWordsCame(false);
        setMarks(undefined);
        const before = latest.current.state.wrongAnswers;
        const answer = await api.attempt.submitWork({
          profileId,
          attemptId,
          idempotencyKey: of.key,
          tappedChoices: tappedChoices(task, latest.current.state.choices),
          ...(of.contract === undefined ? {} : { work: of.contract, ...aiFields() }),
        });
        sent.current = undefined;
        setVerdicts(verdictsOf(answer.items, task));
        const read = outcomeOf(answer.outcome);
        if (read !== undefined) setOutcome(outcomeText(read, words));
        if (answer.solved === undefined) {
          save({ ...latest.current.state, wrongAnswers: answer.wrongAnswers });
          if (answer.wrongAnswers > before) rungWords(answer.wrongAnswers, of);
        } else {
          over.current = true;
          let parts: readonly open.StatementPart[] = [];
          try {
            parts = solutionOf(views, answer.solved);
          } catch {
            // A solution the build cannot read is no reason to hide that the task is solved.
          }
          setTutorWords(undefined);
          await onEnded(CloseReason.CORRECT, profile, of.number);
          setSolution(parts);
          correctWords(of);
        }
      } catch (reason) {
        const found = parseFailure(reason);
        const closed = closedBy(found);
        if (closed === undefined) setFailure(found);
        else {
          over.current = true;
          onClosed(closed);
        }
      }
    })().finally(() => setPending(false));
  }, [
    api,
    views,
    words,
    profileId,
    attemptId,
    task,
    profile,
    save,
    pause,
    submission,
    rungWords,
    correctWords,
    onEnded,
    onClosed,
  ]);

  return (
    <TaskScreen
      task={task}
      manifest={opened.manifest}
      steps={steps}
      catalog={opened.catalog}
      state={state}
      mode={mode}
      verdicts={verdicts}
      filled={filled}
      history={opened.history}
      media={media}
      notSaved={notSaved}
      pending={pending || again.pending}
      {...(failure === undefined ? {} : { failure })}
      {...(solution === undefined ? {} : { solution })}
      {...(again.failure === undefined ? {} : { againFailure: again.failure })}
      {...(tutorWords === undefined ? {} : { tutorWords })}
      {...(wordsFailure === undefined ? {} : { wordsFailure })}
      {...(outcome === undefined ? {} : { outcome })}
      wordsCame={wordsCame}
      blink={blink}
      canvasRef={element}
      onHistoryChange={onHistoryChange}
      onMode={(next: Mode) => save({ ...state, mode: next })}
      onGoTo={(to) => save(goTo(state, to))}
      onTick={(chip) => save(tick(state, chip))}
      onDone={() => save(stepDone(state, steps))}
      onChoose={(slot, option) => {
        // Another option is another action: its check gets a key of its own.
        sent.current = undefined;
        setVerdicts((held) => withoutSlot(held, slot));
        save(choose(state, slot, option));
        pause.acted();
      }}
      onCheck={check}
      onAgain={again.start}
      onHome={() => navigate(HOME)}
    />
  );
}
