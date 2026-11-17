// The task screen of an open attempt (sections 3.2 and 3.3 of docs/architecture.md; R05, R20 in
// docs/decisions.md; AttemptService and LearningService in the contract): `GetOpenAttempt` gives
// the attempt's start — the open view of its task and its package — and the screen takes the
// package's manifest, solving steps and technique catalog from the shared cache, and what this
// device wrote of the attempt from the profile's database: the history of writing and the state of
// the steps. Every stroke and every change of the steps is written there, and a write that did not
// land says so. A tap only chooses; Check sends the options tapped and the handwriting, the crop the
// canvas gives, with one idempotency key for the action and the same with every repeat of it; the
// submission is kept with its context, for the tutor's marks, and while the profile's storage of
// works is on the work goes to the server by `PutWork`, as it does once more when the attempt
// closes (T62). The tutor speaks of the work only while its panel is open (the second 2026-11-17
// amendment to R148 in spec; R21): then "Not yet" asks the words of its rung at once, with the same
// work, and the marks that come with them go on the canvas, and "Correct" the words after it; with
// the panel closed the check ends at the verdict, and the panel's opening asks, once, the words of
// the last submission that gave "not yet" or "correct", with its work, which the screen holds in
// memory until then. "Correct"
// closes the attempt: its work on the device goes but the correct one's, which goes with the request
// of the words after a correct answer and is erased once it ends, or once the screen is left with
// them unasked, and the solution comes. An attempt
// api closed meanwhile is a screen of its own, and one closed unchecked asks CheckPackages (T21).
// Hint asks api, with no work and no AI: before the first wrong answer the task's techniques and its
// leading question, after it the words of the current rung again; "Explain differently" asks the
// same rung in other words, once on a rung; "Show the solution" — the learner's from the start of
// the attempt if an adult, from the fourth wrong answer if a child — ends the attempt with its
// solution (R82 in spec; R22). A task of a lesson is a segment of its run: under the lesson's header,
// with no "Try it again", and what api says comes next after it goes up to the player (R23). The
// tutor's words are kept with the reply that brought them and its rung, so that the adult of the
// account can report a problem with them as they are shown (R123 in spec; R33). While the voicing
// is on, what comes after a press is said by itself — the verdict and the outcome of a check in the
// screen's language, then the tutor's words and a hint in the module's —, and the press itself,
// Check, Hint or "Explain differently", marks the synthesis at once for WebKit (R07; T45). While
// platform AI is closed beyond a call — its quota for the family day is spent, or its limit ran
// out —, the block "Tutor" says why beside the fallback text of a rung, and in place of the words
// after a correct answer (R37).
import { Mode as ProfileMode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Action,
  type Next,
  TutorReply,
  type WorkSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  type EngineChoice,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
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
import { idempotencyKey } from "../api/keys.ts";
import { closesAI, outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import {
  addProfile,
  attemptOver,
  type Essay,
  openProfile,
  type Profile,
} from "../storage/profile.ts";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import type { Said } from "../tutor/report.ts";
import { hintPhrases } from "../voice/texts.ts";
import { useWorks } from "../works/useWorks.ts";
import {
  markNames,
  marksOf,
  resumed,
  solutionOf,
  summaryText,
  tappedChoices,
  type Verdicts,
  verdictsOf,
  withoutSlot,
  withoutWriting,
  workOf,
} from "./attempt.ts";
import { OpenEssay } from "./Essay.tsx";
import { isEssay } from "./essay.ts";
import type { HintGiven } from "./Hint.tsx";
import { Pause } from "./pause.ts";
import {
  CLOSED_KEYS,
  closedBy,
  unlessClosed,
  useKeptWork,
  useOwnVoicing,
  useStepTechniques,
} from "./shared.ts";
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

/** What the screen has read of the attempt. */
export interface Opened {
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
  readonly rung?: Said;
  /** The hint asked for before the first wrong answer, as the attempt keeps it. */
  readonly hint?: HintGiven;
  /** "Explain differently" was asked for on the current rung. */
  readonly explained: boolean;
  /** Of an essay: what the device keeps of it, and how many submissions api counts (R53). */
  readonly essay?: { readonly kept: Essay | undefined; readonly submissions: number };
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "closed"; readonly reason: CloseReason }
  | { readonly status: "ready"; readonly opened: Opened };

export interface TaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  /** The profile's default mode, which each attempt starts in. */
  readonly defaultMode: ProfileMode;
  readonly device: Device;
  /** Whether the learner is of the category `adult`: the solution is theirs to ask from the start. */
  readonly adult: boolean;
  /** The learner's open attempt changed: a new one began, or this one ended. */
  readonly onAttempt: (attemptId: string | undefined) => void;
  /** The attempt is a task segment of a lesson run: the player's, under its header. */
  readonly lesson?: TaskInLesson;
}

/** What the lesson player hears of a task of its run. */
export interface TaskInLesson {
  /** The task ended on this screen: what api said comes next, if it said. */
  readonly onNext: (next: Next | undefined) => void;
  /** The attempt was closed when it was read, or api closed it meanwhile. */
  readonly onClosed: (reason: CloseReason) => void;
}

export function Task({
  profileId,
  attemptId,
  defaultMode,
  device,
  adult,
  onAttempt,
  lesson,
}: TaskProps) {
  const api = useApi();
  const { views, checks } = usePackages();
  const { words } = useLanguage();
  const works = useWorks(profileId);
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  // The lesson player, if the attempt is a task of its run: it hears of a closed attempt once,
  // whichever way it came.
  const player = useRef(lesson);
  player.current = lesson;

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
          if (player.current !== undefined) {
            // In a lesson the attempt is the run's: the player asks the run what became of it.
            await ended(CloseReason.UNSPECIFIED);
            if (current) setRead({ status: "closed", reason: CloseReason.UNSPECIFIED });
            return;
          }
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
      const essay = isEssay(task);
      if (profile !== undefined && kept === undefined) {
        unsaved = (await profile.beginAttempt({ attemptId, digest, task })) === "unsaved";
      }
      if (profile !== undefined && essay) {
        const language = manifest?.view.languages.explanation;
        const begun = await profile.beginEssay({ attemptId, digest, task }, language);
        unsaved ||= begun === "unsaved";
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
        ...(answer.rung === undefined
          ? {}
          : {
              // What GetHint would give again: the words of a rung (TutorReply in the contract).
              rung: { text: answer.rung.words, reply: TutorReply.RUNG, rung: answer.rung.rung },
            }),
        ...(answer.wrongAnswers === 0 &&
        (answer.requestedTechniqueIds.length > 0 || answer.requestedLeadingQuestion !== "")
          ? {
              hint: {
                techniques: answer.requestedTechniqueIds,
                ...(answer.requestedLeadingQuestion === ""
                  ? {}
                  : { question: answer.requestedLeadingQuestion }),
              },
            }
          : {}),
        explained: answer.explainedDifferently,
        ...(essay
          ? {
              essay: {
                kept: await profile?.essay(attemptId).catch(() => undefined),
                submissions: answer.essaySubmissions.length,
              },
            }
          : {}),
      };
    }
  }, [api, views, device, profileId, attemptId, attempt]);

  /**
   * The attempt is over: its work goes to the server as it was at the end, while the storage is on,
   * then off the device, and an unchecked one asks CheckPackages. The screen of an attempt read
   * gives the database it holds; a read that found it closed opens it.
   */
  const ended = useCallback(
    async (reason: CloseReason, held?: Profile, correct?: number) => {
      await attemptOver(device, profileId, attemptId, {
        ...(held === undefined ? {} : { held }),
        ...(correct === undefined ? {} : { correct }),
        works,
      });
      if (reason === CloseReason.UNCHECKED) void checks.check();
      onAttempt(undefined);
    },
    [device, profileId, attemptId, checks, onAttempt, works],
  );

  const again = useAgain(profileId, attemptId, onAttempt);

  const closedReason = read.status === "closed" ? read.reason : undefined;
  useEffect(() => {
    if (closedReason !== undefined) player.current?.onClosed(closedReason);
  }, [closedReason]);

  if (read.status === "loading") return null;
  if (lesson !== undefined && read.status !== "ready") {
    // Under a lesson's header: a line of the segment, not a screen of its own.
    return read.status === "failed" ? (
      <div className="nt-lesson-task">
        <p role="alert" className="nt-error">
          {failureText(read.failure, words)}
        </p>
        <button type="button" onClick={() => setAttempt((n) => n + 1)}>
          {words.text("boot.retry")}
        </button>
      </div>
    ) : (
      <div className="nt-lesson-task">
        <p>{words.text("api.attempt-closed")}</p>
        {read.reason === CloseReason.UNSPECIFIED ? null : (
          <p>{words.text(keyFor(CLOSED_KEYS, read.reason))}</p>
        )}
      </div>
    );
  }
  if (read.status === "failed") {
    return <ReadFailed failure={read.failure} onRetry={() => setAttempt((n) => n + 1)} />;
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
        <NextStep profileId={profileId} secondary />
      </Screen>
    );
  }
  const Open = read.opened.essay === undefined ? OpenTask : OpenEssay;
  return (
    <Open
      key={read.opened.digest}
      profileId={profileId}
      attemptId={attemptId}
      adult={adult}
      opened={read.opened}
      again={again}
      {...(lesson === undefined ? {} : { lesson })}
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
  const holder = useKeyHolder();
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
        ...holder.routeFields(profileId),
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
  }, [api, holder, profileId, attemptId, onAttempt]);
  return { start, pending, failure };
}

export interface OpenTaskProps {
  readonly profileId: string;
  readonly attemptId: string;
  readonly adult: boolean;
  readonly opened: Opened;
  readonly again: ReturnType<typeof useAgain>;
  readonly lesson?: TaskInLesson;
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

/**
 * The last submission whose words were not asked, the tutor's panel closed at its check: after
 * "not yet", the words of its rung, by its number of wrong answers; after "correct", the words after it.
 */
type Unasked =
  | { readonly reply: "rung"; readonly wrongAnswers: number; readonly of: Sent }
  | { readonly reply: "correct"; readonly of: Sent };

/** The screen of an attempt read: what the learner does on it, written as it is done. */
function OpenTask({
  profileId,
  attemptId,
  adult,
  opened,
  again,
  lesson,
  onEnded,
  onClosed,
}: OpenTaskProps) {
  const api = useApi();
  // The own key, or on platform AI the clock's offset, for each request that calls AI (R47).
  const holder = useKeyHolder();
  const works = useWorks(profileId);
  const { views, files } = usePackages();
  const { language, words } = useLanguage();
  const { auto, prime } = useOwnVoicing();
  const { task, profile, steps } = opened;
  const explanation = opened.manifest?.languages.explanation;
  // What the voicing said of the last check — its verdict — which the tutor's words of the same
  // check follow rather than cut short.
  const verdictSaid = useRef<object | undefined>(undefined);
  const element = useRef<CanvasElement>(null);
  const [state, setState] = useState(opened.state);
  const [verdicts, setVerdicts] = useState(opened.verdicts);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [solution, setSolution] = useState<readonly open.StatementPart[] | undefined>(undefined);
  const [blink, setBlink] = useState(false);
  const [said, setSaid] = useState<Said | undefined>(opened.rung);
  const tutorWords = said?.text;
  const [wordsFailure, setWordsFailure] = useState<string | undefined>(undefined);
  const [wordsWaiting, setWordsWaiting] = useState(false);
  const [wordsCame, setWordsCame] = useState(false);
  const [outcome, setOutcome] = useState<string | undefined>(undefined);
  const [marks, setMarks] = useState<Marks | undefined>(undefined);
  const [hint, setHint] = useState<HintGiven | undefined>(opened.hint);
  const [explained, setExplained] = useState(opened.explained);
  const [explaining, setExplaining] = useState(false);
  const [explainNote, setExplainNote] = useState<string | undefined>(undefined);
  const [showNote, setShowNote] = useState<string | undefined>(undefined);
  const [shown, setShown] = useState(false);
  // What the engine chose, when the answer that closed the attempt outside a lesson said (R24).
  const [choice, setChoice] = useState<EngineChoice | undefined>(undefined);
  // The keys of "Explain differently" and "Show the solution": each the same with its repeats.
  const explainKey = useRef<string | undefined>(undefined);
  const showKey = useRef<string | undefined>(undefined);
  // One key for a check of this work, the same with every repeat of it (section 3.3): a new
  // stroke or a new option is a new action.
  const sent = useRef<Sent | undefined>(undefined);
  // The checks begun: an answer of words that belongs to an earlier check is dropped.
  const checks = useRef(0);
  // The last check said platform AI is closed, by Check: the words it asked do not say it again.
  const closedAtCheck = useRef(false);
  // Once the attempt is over its record is gone: nothing more is written, and no write says unsaved.
  const over = useRef(false);
  const { filled, notSaved, unsavedNow, drawn, keepSteps, keepHistory } = useKeptWork({
    profile,
    attemptId,
    unsaved: opened.unsaved,
    task,
    element,
    over,
  });
  // api closed the attempt: the screen that says so takes this one's place.
  const close = useCallback(
    (reason: CloseReason) => {
      over.current = true;
      onClosed(reason);
    },
    [onClosed],
  );
  const latest = useRef({ state, solution, filled });
  latest.current = { state, solution, filled };
  const mode = modeOf(state, steps);
  const handwriting = !choicesOnly(task);
  // The tutor's panel: always open by steps, whose steps stand in it; on my own, opened by the
  // learner — the button "Tutor" or Hint —, and by what the attempt kept of it.
  const [panel, setPanel] = useState(opened.hint !== undefined || opened.rung !== undefined);
  const open = mode === "steps" || panel;
  const isOpen = useRef(open);
  isOpen.current = open;
  const unasked = useRef<Unasked | undefined>(undefined);
  // The screen is left with the words after a correct answer unasked: its work goes.
  useEffect(
    () => () => {
      const waiting = unasked.current;
      if (waiting?.reply === "correct" && waiting.of.contract !== undefined) {
        void profile?.wordsCame(attemptId).catch(() => {});
      }
    },
    [profile, attemptId],
  );

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

  // The tutor's marks go to the canvas after its task and its history, which React gave it in the
  // render (R36 in spec). Marks it refuses — a box it cannot place — are dropped, not a broken screen.
  // They are the tutor's: out of sight while its panel is closed, and back once it opens.
  useEffect(() => {
    const canvas = element.current;
    if (canvas === null) return;
    try {
      canvas.marks = open ? marks : undefined;
    } catch {
      canvas.marks = undefined;
    }
  }, [marks, open]);

  /** What the tutor says by itself: nothing while its panel is closed, the words kept for it. */
  const tutorSays = useCallback(
    (phrases: Parameters<typeof auto>[0], after?: object) =>
      isOpen.current ? auto(phrases, after) : undefined,
    [auto],
  );

  const save = useCallback(
    (next: StepsState) => {
      setState(next);
      keepSteps(next);
    },
    [keepSteps],
  );

  const onHistoryChange = useCallback(
    (event: HistoryChangeEvent) => {
      keepHistory(event);
      pause.acted();
      // Other work is another action: its check gets a key of its own, and what was read of the
      // work before is no verdict of this one.
      sent.current = undefined;
      setVerdicts((held) => withoutWriting(held, task));
    },
    [keepHistory, pause, task],
  );

  // A step that gives techniques asks api for them once, by steps, and keeps what it gave.
  const place = state.place;
  useStepTechniques({
    api,
    profileId,
    attemptId,
    want:
      mode === "steps" &&
      solution === undefined &&
      givesTechniques(steps[place - 1]) &&
      state.techniques[place] === undefined,
    place,
    onTechniques: useCallback(
      (at: number, ids: readonly string[]) => save(gotTechniques(latest.current.state, at, ids)),
      [save],
    ),
    onClosed: close,
  });

  /** What the answer that closed the attempt says comes next: the lesson's segment, or a choice. */
  const comesNext = useCallback(
    (next: Next | undefined) => {
      lesson?.onNext(next);
      if (next?.next.case === "choice") setChoice(next.next.value);
    },
    [lesson],
  );

  const markName = useMemo(() => markNames(words), [words]);

  /** The words of the rung of a wrong answer, asked at once with the same work (R82 in spec). */
  const rungWords = useCallback(
    (wrongAnswers: number, of: Sent) => {
      setWordsFailure(undefined);
      setWordsWaiting(true);
      const asked = checks.current;
      // The words of an earlier check, or of an attempt that ended meanwhile, show nothing.
      const late = () => asked !== checks.current || over.current;
      const ai = holder.aiFields(profileId);
      void api.attempt
        .getRungWords({
          profileId,
          attemptId,
          idempotencyKey: idempotencyKey(),
          wrongAnswers,
          ...(of.contract === undefined ? {} : { work: of.contract }),
          ...ai,
        })
        .then(
          (answer) => {
            const read = outcomeOf(answer.outcome);
            holder.noteOutcome(profileId, read, ai);
            if (late()) return;
            if (answer.words !== "") {
              // The fallback text of the rung comes with an outcome: words all the same. Beside it
              // stands why, when platform AI is closed beyond this call — the quota, with when it
              // comes back, or its limit (R37).
              const why =
                closesAI(read) && !closedAtCheck.current ? outcomeText(read, words) : undefined;
              setSaid({ text: answer.words, reply: TutorReply.RUNG, rung: answer.rung });
              if (why !== undefined) setWordsFailure(why);
              setWordsCame(true);
              tutorSays(
                [
                  { text: answer.words, language: explanation },
                  ...(why === undefined ? [] : [{ text: why, language }]),
                ],
                verdictSaid.current,
              );
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
            const found = unlessClosed(reason, close);
            if (found === undefined) return;
            // A rung that is not this answer's, or none, has no words to show.
            const quiet =
              found.kind === "refused" &&
              (found.cause === Cause.NOT_CURRENT ||
                found.cause === Cause.NO_RUNG ||
                found.cause === Cause.NO_MORE_WORDS);
            if (!quiet) setWordsFailure(failureText(found, words));
          },
        )
        .finally(() => {
          // A newer check cleared it and may wait for words of its own; an attempt that ended has none.
          if (asked === checks.current) setWordsWaiting(false);
        });
    },
    [
      api,
      holder,
      profileId,
      attemptId,
      task,
      words,
      markName,
      explanation,
      language,
      close,
      tutorSays,
    ],
  );

  /**
   * The words after a correct answer, with its work: once they came or their request ended, it
   * goes. None came, and platform AI is closed beyond this call: the block says why (R37).
   */
  const correctWords = useCallback(
    (of: Sent) => {
      const ai = holder.aiFields(profileId);
      void api.attempt
        .getCorrectAnswerWords({
          profileId,
          attemptId,
          idempotencyKey: idempotencyKey(),
          ...(of.contract === undefined ? {} : { work: of.contract }),
          ...ai,
        })
        .then(
          (answer) => {
            if (answer.words !== undefined && answer.words !== "") {
              holder.noteOutcome(profileId, undefined, ai);
              setSaid({ text: answer.words, reply: TutorReply.CORRECT_ANSWER, rung: 0 });
              setWordsCame(true);
              tutorSays([{ text: answer.words, language: explanation }], verdictSaid.current);
              return;
            }
            const read = outcomeOf(answer.outcome);
            holder.noteOutcome(profileId, read, ai);
            if (!closesAI(read) || closedAtCheck.current) return;
            const why = outcomeText(read, words);
            setWordsFailure(why);
            tutorSays([{ text: why, language }], verdictSaid.current);
          },
          () => {},
        )
        .finally(() => {
          if (of.contract !== undefined) void profile?.wordsCame(attemptId).catch(() => {});
        });
    },
    [api, holder, profileId, attemptId, profile, explanation, words, language, tutorSays],
  );

  /** The panel opens: the words of the last submission not asked, once. */
  const askUnasked = useCallback(() => {
    const waiting = unasked.current;
    unasked.current = undefined;
    if (waiting === undefined) return;
    if (waiting.reply === "rung") rungWords(waiting.wrongAnswers, waiting.of);
    else correctWords(waiting.of);
  }, [rungWords, correctWords]);

  /** The panel opens — the button "Tutor", Hint, the choice of "by steps" —, and asks what it must. */
  const openPanel = useCallback(() => {
    // Within the press: the words the opening asks may be said (WebKit; section 3.5).
    if (unasked.current !== undefined) prime();
    setPanel(true);
    askUnasked();
  }, [prime, askUnasked]);

  /** The button "Tutor", on my own: it opens the panel, or closes it. */
  const togglePanel = useCallback(() => {
    if (isOpen.current) setPanel(false);
    else openPanel();
  }, [openPanel]);

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
    const saved = (await profile?.addSubmission(attemptId, work, historyLength)) ?? "unsaved";
    if (saved === "unsaved") unsavedNow();
    else number = saved;
    // Written to the device, the work goes to the server too, while the storage is on.
    if (profile !== undefined && saved !== "unsaved") void works.put(profile, attemptId);
    const made: Sent = { key: idempotencyKey(), work, contract: await workOf(work), number };
    if (drawn.current === at) sent.current = made;
    return made;
  }, [handwriting, profile, attemptId, drawn, unsavedNow, works]);

  const check = useCallback(() => {
    // Within the press: the words that come after it may be said (WebKit; section 3.5).
    prime();
    verdictSaid.current = undefined;
    setPending(true);
    setFailure(undefined);
    pause.stop();
    checks.current += 1;
    // The words a check before asked are no more awaited: its answer would be dropped.
    setWordsWaiting(false);
    void (async () => {
      try {
        const of = await submission();
        // Nothing on the sheet to check after all: the screen stays as it was.
        if (of === undefined) return;
        setOutcome(undefined);
        closedAtCheck.current = false;
        setWordsCame(false);
        setMarks(undefined);
        const before = latest.current.state.wrongAnswers;
        const ai = holder.aiFields(profileId);
        const answer = await api.attempt.submitWork({
          profileId,
          attemptId,
          idempotencyKey: of.key,
          tappedChoices: tappedChoices(task, latest.current.state.choices),
          // A work AI reads goes with the key, or the clock's offset; taps alone name the provider
          // of the key, and never beside a work (contract, section 15).
          ...(of.contract === undefined
            ? holder.routeFields(profileId)
            : { work: of.contract, ...ai }),
        });
        sent.current = undefined;
        const verdicts = verdictsOf(answer.items, task);
        setVerdicts(verdicts);
        const read = outcomeOf(answer.outcome);
        if (of.contract !== undefined) holder.noteOutcome(profileId, read, ai);
        if (read !== undefined) setOutcome(outcomeText(read, words));
        closedAtCheck.current = closesAI(read);
        // The lines of the panel that came with the check, in the language of the screen.
        verdictSaid.current = auto(
          [
            summaryText(verdicts, answer.solved === undefined ? undefined : "correct", task, words),
            read === undefined ? "" : outcomeText(read, words),
          ].map((text) => ({ text, language })),
        );
        if (answer.solved === undefined) {
          save({ ...latest.current.state, wrongAnswers: answer.wrongAnswers });
          if (answer.wrongAnswers > before) {
            // A new rung: "Explain differently" is its own once more.
            setExplained(false);
            setExplainNote(undefined);
            explainKey.current = undefined;
            // The words of the rung before, and the hint before the first wrong answer, are past.
            setSaid(undefined);
            setHint(undefined);
            unasked.current = undefined;
            if (isOpen.current) rungWords(answer.wrongAnswers, of);
            else unasked.current = { reply: "rung", wrongAnswers: answer.wrongAnswers, of };
          }
        } else {
          over.current = true;
          let parts: readonly open.StatementPart[] = [];
          try {
            parts = solutionOf(views, answer.solved);
          } catch {
            // A solution the build cannot read is no reason to hide that the task is solved.
          }
          setSaid(undefined);
          // What the words of a rung came to is past too: the block is the correct answer's now.
          setWordsFailure(undefined);
          await onEnded(CloseReason.CORRECT, profile, of.number);
          setSolution(parts);
          comesNext(answer.next);
          unasked.current = undefined;
          if (isOpen.current) correctWords(of);
          else unasked.current = { reply: "correct", of };
        }
      } catch (reason) {
        setFailure(unlessClosed(reason, close));
      }
    })().finally(() => setPending(false));
  }, [
    api,
    holder,
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
    comesNext,
    prime,
    auto,
    language,
    close,
  ]);

  /** "Hint": api gives the task's techniques and question, or the words of the rung again. */
  const askHint = useCallback(() => {
    prime();
    setFailure(undefined);
    // The rung's words of a wrong answer the closed panel left unasked: the opening asks them, by AI
    // and with the work, and they are the hint (the 2026-11-17 amendment to R82 in spec).
    const rungUnasked = unasked.current?.reply === "rung";
    openPanel();
    if (rungUnasked) return;
    setPending(true);
    void api.attempt
      .getHint({ profileId, attemptId })
      .then(
        (answer) => {
          if (over.current) return;
          if (answer.hint.case === "techniques") {
            const techniques = answer.hint.value.techniqueIds;
            const question = answer.leadingQuestion === "" ? undefined : answer.leadingQuestion;
            setHint({ techniques, ...(question === undefined ? {} : { question }) });
            tutorSays(hintPhrases(task, techniques, question, opened.catalog, explanation));
          } else if (answer.hint.case === "rung") {
            const { words: text, rung } = answer.hint.value;
            // The words shown again stay the reply they came by — "explain differently" too — and
            // a report begun on them stays open.
            setSaid((before) =>
              before?.text === text ? before : { text, reply: TutorReply.RUNG, rung },
            );
            setWordsCame(true);
            tutorSays([{ text, language: explanation }]);
          }
        },
        (reason: unknown) => {
          setFailure(unlessClosed(reason, close));
        },
      )
      .finally(() => setPending(false));
  }, [
    api,
    profileId,
    attemptId,
    prime,
    openPanel,
    tutorSays,
    task,
    opened.catalog,
    explanation,
    close,
  ]);

  /** "Explain differently": the same rung in other words, one call of AI on a rung. */
  const explain = useCallback(() => {
    prime();
    explainKey.current ??= idempotencyKey();
    setExplaining(true);
    setExplainNote(undefined);
    // An answer that comes once a newer check began is of a rung that is no more the current.
    const asked = checks.current;
    const late = () => asked !== checks.current || over.current;
    const ai = holder.aiFields(profileId);
    void api.attempt
      .explainDifferently({
        profileId,
        attemptId,
        idempotencyKey: explainKey.current,
        wrongAnswers: latest.current.state.wrongAnswers,
        ...ai,
      })
      .then(
        (answer) => {
          explainKey.current = undefined;
          const read = outcomeOf(answer.outcome);
          holder.noteOutcome(profileId, read, ai);
          if (late()) return;
          // The right to it on this rung is spent, whatever the words.
          setExplained(true);
          if (read !== undefined) setExplainNote(outcomeText(read, words));
          if (answer.words !== "" && read?.cause !== Cause.NO_OTHER_WORDS) {
            // The same rung in other words: the rung of the words they take the place of, which
            // are always there when it is asked; else the rung of the wrong answers, 1 to 3.
            const wrongAnswers = latest.current.state.wrongAnswers;
            setSaid((before) => ({
              text: answer.words,
              reply: TutorReply.EXPLAINED_DIFFERENTLY,
              rung: before?.rung ?? Math.min(Math.max(wrongAnswers, 1), 3),
            }));
            // Words of a model came: what the block said of platform AI closed is past.
            setWordsFailure(undefined);
            setWordsCame(true);
            tutorSays([{ text: answer.words, language: explanation }]);
          }
        },
        (reason: unknown) => {
          if (late()) return;
          const found = unlessClosed(reason, close);
          if (found === undefined) return;
          // A refusal is the end of the action; anything else may have reached api, and goes again
          // with its key, which gets what was done.
          if (found.kind === "refused") explainKey.current = undefined;
          const spent =
            found.kind === "refused" &&
            (found.cause === Cause.ALREADY_ASKED ||
              found.cause === Cause.NOT_CURRENT ||
              found.cause === Cause.NO_RUNG);
          if (spent) setExplained(true);
          else setExplainNote(failureText(found, words));
        },
      )
      .finally(() => setExplaining(false));
  }, [api, holder, profileId, attemptId, words, prime, explanation, close, tutorSays]);

  /** "Show the solution": the attempt ends with the solution shown (R82 in spec). */
  const showSolution = useCallback(() => {
    showKey.current ??= idempotencyKey();
    setPending(true);
    setShowNote(undefined);
    pause.stop();
    void api.attempt
      .showSolution({
        profileId,
        attemptId,
        idempotencyKey: showKey.current,
        action: Action.LEARNING,
        ...holder.routeFields(profileId),
      })
      .then(
        async (answer) => {
          showKey.current = undefined;
          over.current = true;
          unasked.current = undefined;
          let parts: readonly open.StatementPart[] = [];
          try {
            if (answer.solved !== undefined) parts = solutionOf(views, answer.solved);
          } catch {
            // A solution the build cannot read is no reason to hide that the attempt is over.
          }
          setSaid(undefined);
          setHint(undefined);
          setMarks(undefined);
          setFailure(undefined);
          setOutcome(undefined);
          setWordsFailure(undefined);
          setWordsWaiting(false);
          setExplainNote(undefined);
          await onEnded(CloseReason.SOLUTION_SHOWN, profile);
          setShown(true);
          setSolution(parts);
          comesNext(answer.next);
        },
        (reason: unknown) => {
          const found = unlessClosed(reason, close);
          if (found === undefined) return;
          // A refusal is the end of the action; anything else may have shown the solution already,
          // and goes again with its key, which gets the solution again.
          if (found.kind === "refused") showKey.current = undefined;
          setShowNote(failureText(found, words));
        },
      )
      .finally(() => setPending(false));
  }, [api, holder, views, profileId, attemptId, profile, words, pause, onEnded, comesNext, close]);

  // An adult may ask for the solution from the start of the attempt, a child from the fourth wrong
  // answer, once the ladder of hints is passed (R82 in spec).
  const mayShow = adult || state.wrongAnswers >= 4;
  // Not while the words of the rung are still asked: the right would go on the words before them.
  const mayExplain =
    !explained && state.wrongAnswers > 0 && tutorWords !== undefined && !wordsWaiting;

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
      panelOpen={open}
      {...(mode === "self" ? { onPanel: togglePanel } : {})}
      {...(adult && said !== undefined && said.text !== ""
        ? {
            report: (
              // Other words are another report: the form begins anew with them.
              <ReportProblem
                key={`${said.reply} ${said.rung} ${said.text}`}
                profileId={profileId}
                attemptId={attemptId}
                said={said}
              />
            ),
          }
        : {})}
      {...(wordsFailure === undefined ? {} : { wordsFailure })}
      wordsWaiting={wordsWaiting}
      {...(outcome === undefined ? {} : { outcome })}
      wordsCame={wordsCame && open}
      {...(hint === undefined ? {} : { hint })}
      onHint={askHint}
      {...(mayExplain ? { onExplain: explain } : {})}
      explaining={explaining}
      {...(explainNote === undefined ? {} : { explainNote })}
      {...(mayShow ? { onShow: showSolution } : {})}
      {...(showNote === undefined ? {} : { showNote })}
      shown={shown}
      blink={blink}
      canvasRef={element}
      onHistoryChange={onHistoryChange}
      onMode={(next: Mode) => {
        save({ ...state, mode: next });
        // By steps the panel is open, its steps in it: the opening asks what was left unasked. Back
        // on my own, it stays open while it holds the tutor's words or a hint.
        if (next === "steps" && unasked.current !== undefined) openPanel();
        if (next === "self" && open && (said !== undefined || hint !== undefined || wordsWaiting)) {
          setPanel(true);
        }
      }}
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
      inLesson={lesson !== undefined}
      next={
        <NextStep
          key={choice?.choiceId ?? "ask"}
          profileId={profileId}
          {...(choice === undefined ? {} : { choice })}
        />
      }
    />
  );
}
