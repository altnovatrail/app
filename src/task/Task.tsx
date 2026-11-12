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
// Check, Hint or "Explain differently", marks the synthesis at once for WebKit (R07; T45).
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
import { aiFields, idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { keyFor } from "../i18n/codes.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, attemptOver, openProfile, type Profile } from "../storage/profile.ts";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import type { Said } from "../tutor/report.ts";
import { hintPhrases, type Phrase } from "../voice/texts.ts";
import { useVoicing } from "../voice/VoicingContext.tsx";
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
import type { HintGiven } from "./Hint.tsx";
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
  readonly rung?: Said;
  /** The hint asked for before the first wrong answer, as the attempt keeps it. */
  readonly hint?: HintGiven;
  /** "Explain differently" was asked for on the current rung. */
  readonly explained: boolean;
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
      };
    }
  }, [api, views, device, profileId, attemptId, attempt]);

  /**
   * The attempt is over: its work on the device goes, and an unchecked one asks CheckPackages. The
   * screen of an attempt read gives the database it holds; a read that found it closed opens it.
   */
  const ended = useCallback(
    async (reason: CloseReason, held?: Profile, correct?: number) => {
      await attemptOver(device, profileId, attemptId, {
        ...(held === undefined ? {} : { held }),
        ...(correct === undefined ? {} : { correct }),
      });
      if (reason === CloseReason.UNCHECKED) void checks.check();
      onAttempt(undefined);
    },
    [device, profileId, attemptId, checks, onAttempt],
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
  return (
    <OpenTask
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
  const { views, files } = usePackages();
  const { language, words } = useLanguage();
  const { auto: say, prime, speech } = useVoicing();
  // What the screen says by itself is its own: words that come once the learner has left are not
  // said over the next screen, and leaving the screen stops what it was saying — a segment of a
  // lesson goes with no change of the route.
  const mounted = useRef(true);
  const spoken = useRef<object | undefined>(undefined);
  const auto = useCallback(
    (phrases: readonly Phrase[], after?: object) => {
      if (!mounted.current) return undefined;
      const token = say(phrases, after);
      if (token !== undefined) spoken.current = token;
      return token;
    },
    [say],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spoken.current !== undefined && speech.speaking() === spoken.current) speech.stop();
    };
  }, [speech]);
  const { task, profile, steps } = opened;
  const explanation = opened.manifest?.languages.explanation;
  // What the voicing said of the last check — its verdict — which the tutor's words of the same
  // check follow rather than cut short.
  const verdictSaid = useRef<object | undefined>(undefined);
  const element = useRef<CanvasElement>(null);
  const [state, setState] = useState(opened.state);
  const [verdicts, setVerdicts] = useState(opened.verdicts);
  const [filled, setFilled] = useState<readonly (readonly boolean[])[] | null>(null);
  const [notSaved, setNotSaved] = useState(opened.unsaved);
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
              setSaid({ text: answer.words, reply: TutorReply.RUNG, rung: answer.rung });
              setWordsCame(true);
              auto([{ text: answer.words, language: explanation }], verdictSaid.current);
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
        )
        .finally(() => {
          // A newer check cleared it and may wait for words of its own; an attempt that ended has none.
          if (asked === checks.current) setWordsWaiting(false);
        });
    },
    [api, profileId, attemptId, task, words, markName, onClosed, auto, explanation],
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
              setSaid({ text: answer.words, reply: TutorReply.CORRECT_ANSWER, rung: 0 });
              setWordsCame(true);
              auto([{ text: answer.words, language: explanation }], verdictSaid.current);
            }
          },
          () => {},
        )
        .finally(() => {
          if (of.contract !== undefined) void profile?.wordsCame(attemptId).catch(() => {});
        });
    },
    [api, profileId, attemptId, profile, auto, explanation],
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
        const verdicts = verdictsOf(answer.items, task);
        setVerdicts(verdicts);
        const read = outcomeOf(answer.outcome);
        if (read !== undefined) setOutcome(outcomeText(read, words));
        // The lines of the panel that came with the check, in the language of the screen.
        verdictSaid.current = auto(
          [
            summaryText(
              verdicts,
              answer.solved === undefined ? undefined : "correct",
              task.items.length,
              words,
            ),
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
            rungWords(answer.wrongAnswers, of);
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
          await onEnded(CloseReason.CORRECT, profile, of.number);
          setSolution(parts);
          comesNext(answer.next);
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
    comesNext,
    prime,
    auto,
    language,
  ]);

  /** "Hint": api gives the task's techniques and question, or the words of the rung again. */
  const askHint = useCallback(() => {
    prime();
    setFailure(undefined);
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
            auto(hintPhrases(task, techniques, question, opened.catalog, explanation));
          } else if (answer.hint.case === "rung") {
            const { words: text, rung } = answer.hint.value;
            // The words shown again stay the reply they came by — "explain differently" too — and
            // a report begun on them stays open.
            setSaid((before) =>
              before?.text === text ? before : { text, reply: TutorReply.RUNG, rung },
            );
            setWordsCame(true);
            auto([{ text, language: explanation }]);
          }
        },
        (reason: unknown) => {
          const found = parseFailure(reason);
          const closed = closedBy(found);
          if (closed === undefined) setFailure(found);
          else {
            over.current = true;
            onClosed(closed);
          }
        },
      )
      .finally(() => setPending(false));
  }, [api, profileId, attemptId, onClosed, prime, auto, task, opened.catalog, explanation]);

  /** "Explain differently": the same rung in other words, one call of AI on a rung. */
  const explain = useCallback(() => {
    prime();
    explainKey.current ??= idempotencyKey();
    setExplaining(true);
    setExplainNote(undefined);
    // An answer that comes once a newer check began is of a rung that is no more the current.
    const asked = checks.current;
    const late = () => asked !== checks.current || over.current;
    void api.attempt
      .explainDifferently({
        profileId,
        attemptId,
        idempotencyKey: explainKey.current,
        wrongAnswers: latest.current.state.wrongAnswers,
        ...aiFields(),
      })
      .then(
        (answer) => {
          explainKey.current = undefined;
          if (late()) return;
          // The right to it on this rung is spent, whatever the words.
          setExplained(true);
          const read = outcomeOf(answer.outcome);
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
            setWordsCame(true);
            auto([{ text: answer.words, language: explanation }]);
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
  }, [api, profileId, attemptId, words, onClosed, prime, auto, explanation]);

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
      })
      .then(
        async (answer) => {
          showKey.current = undefined;
          over.current = true;
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
          const found = parseFailure(reason);
          const closed = closedBy(found);
          if (closed !== undefined) {
            over.current = true;
            onClosed(closed);
            return;
          }
          // A refusal is the end of the action; anything else may have shown the solution already,
          // and goes again with its key, which gets the solution again.
          if (found.kind === "refused") showKey.current = undefined;
          setShowNote(failureText(found, words));
        },
      )
      .finally(() => setPending(false));
  }, [api, views, profileId, attemptId, profile, words, pause, onEnded, onClosed, comesNext]);

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
      wordsCame={wordsCame}
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
