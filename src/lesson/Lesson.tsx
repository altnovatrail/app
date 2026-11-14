// The lesson player (section 3.4 of docs/architecture.md; R06, R23 in docs/decisions.md;
// LearningService in the contract): `GetLessonRun` gives an open run again, `OpenLesson` a run by an
// engine's choice of a lesson (T28), each with the lesson's open view, its package and the task
// segments that ended. The lesson opens at the later of the place the device keeps and the one after
// the last task that ended, its examples' demos as they were — the state of this run alone, by the
// lesson's full ID, the package and the run's ID. "Continue" goes on; a task segment is an attempt
// of the run, the task screen under the lesson's header, and "Continue" comes once api said the task
// ended, which moves the place at once. "Continue" on the last segment is "lesson done",
// `CompleteLesson`, sent again until api answers; any end of the run erases the state of the lesson.
// Leaving sends nothing.
import type { Mode as ProfileMode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type { Next } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  type EngineChoice,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { LessonRun } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import type { DemoState } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { Code } from "@connectrpc/connect";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { failureText } from "../api/words.ts";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, type LessonState, openProfile, type Profile } from "../storage/profile.ts";
import { Task, type TaskInLesson } from "../task/Task.tsx";
import { Example } from "./Example.tsx";
import { Explanation } from "./Explanation.tsx";
import type { LessonOpen, RunRef } from "./LessonContext.tsx";
import { LessonScreen } from "./LessonScreen.tsx";
import {
  type Course,
  continueFrom,
  firstOpenTask,
  mayContinue,
  openingPlace,
  taskEnded,
} from "./place.ts";
import { demoOf, endChoiceOf, endedOf, endKey, fullId, kindOf, runEndOf } from "./run.ts";

/** What the player has read of the run. */
interface Opened {
  readonly runId: string;
  readonly lesson: open.Lesson;
  readonly digest: string;
  readonly manifest: open.Manifest | undefined;
  /** The lesson's full ID, which keys its state; none when neither the manifest nor a ref gave it. */
  readonly id: string | undefined;
  readonly profile: Profile | undefined;
  readonly kept: LessonState | undefined;
  readonly ended: readonly number[];
  /** The open attempt of a task segment of the run. */
  readonly attempt: SegmentAttempt | undefined;
}

/** An attempt of a task segment. */
interface SegmentAttempt {
  readonly segment: number;
  readonly attemptId: string;
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "ended"; readonly reason: RunEndReason; readonly choice?: EngineChoice }
  | { readonly status: "ready"; readonly opened: Opened };

/**
 * Where what api says of the ended task segments takes the place: on from it, to the first task not
 * ended, or — after a segment's beginning was refused — on if that segment ended, else to the first.
 */
type Toward = "on" | "first open" | number;

/** The task screen's own word of its open attempt: the player keeps it, by the run. */
const ignore = () => {};

/** The open attempt a run names, if it is one of its task segments. */
function attemptOf(run: LessonRun): SegmentAttempt | undefined {
  const open = run.openAttempt;
  if (open?.segment === undefined || open.attemptId === "") return undefined;
  return { segment: open.segment.segment, attemptId: open.attemptId };
}

export interface LessonProps {
  readonly profileId: string;
  readonly open: LessonOpen;
  readonly device: Device;
  /** The profile's default mode, which each task of the lesson starts in. */
  readonly defaultMode: ProfileMode;
  /** Whether the learner is of the category `adult`: the solution is theirs to ask from the start. */
  readonly adult: boolean;
  /** api gave the run: it is open. */
  readonly onBegan: (run: RunRef) => void;
  /** The run ended, by whatever reason. */
  readonly onEnded: (lessonRunId: string) => void;
  /** A task of the run began: the attempt the learner had open, if any, is left. */
  readonly onAttempt: () => void;
}

export function Lesson(props: LessonProps) {
  const { profileId, open: what, device, onBegan, onEnded } = props;
  const api = useApi();
  // On the owner's own key, each request that may give a choice names its provider (R47).
  const holder = useKeyHolder();
  const { views, checks } = usePackages();
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the run again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void load().then(
      (opened) => {
        if (!current) return;
        onBegan({
          lessonRunId: opened.runId,
          lesson: opened.id ?? "",
          packageDigest: opened.digest,
        });
        setRead({ status: "ready", opened });
      },
      async (reason: unknown) => {
        if (!current) return;
        const failure = parseFailure(reason);
        const end = runEndOf(failure);
        if (end !== undefined) {
          if (what.kind === "run") {
            const profile = await openProfile(device, profileId).catch(() => undefined);
            await profile?.lessonEnded(what.run.lesson).catch(() => {});
            onEnded(what.run.lessonRunId);
          }
          if (end === RunEndReason.UNCHECKED) void checks.check();
          const choice = endChoiceOf(failure);
          if (current)
            setRead({ status: "ended", reason: end, ...(choice === undefined ? {} : { choice }) });
        } else if (failure.kind === "refused" && failure.cause === Cause.NOT_FOUND) {
          if (what.kind === "run") onEnded(what.run.lessonRunId);
          redirect(HOME);
        } else setRead({ status: "failed", failure });
      },
    );
    return () => {
      current = false;
    };

    async function load(): Promise<Opened> {
      const run = (
        what.kind === "run"
          ? await api.learning.getLessonRun({
              profileId,
              lessonRunId: what.run.lessonRunId,
              ...holder.routeFields(profileId),
            })
          : await api.learning.openLesson({
              profileId,
              choiceId: what.choiceId,
              ...holder.routeFields(profileId),
            })
      ).run;
      if (run?.lesson === undefined) throw new Error("api: a lesson run without its lesson");
      const lesson = views.parseView(
        run.lesson.json,
        run.lesson.moduleFormatVersion,
      ) as open.Lesson;
      const digest = run.packageDigest;
      const manifest = (await views.get(digest, "manifest"))?.view;
      const id =
        manifest === undefined
          ? what.kind === "run"
            ? what.run.lesson
            : undefined
          : fullId(manifest.id, lesson.id);
      const profile =
        (await openProfile(device, profileId).catch(() => undefined)) ??
        (await addProfile(device, profileId).catch(() => undefined));
      const kept =
        id === undefined
          ? undefined
          : await profile?.readLesson(id, digest, run.lessonRunId).catch(() => undefined);
      return {
        runId: run.lessonRunId,
        lesson,
        digest,
        manifest,
        id,
        profile,
        kept,
        ended: run.endedSegments,
        attempt: attemptOf(run),
      };
    }
  }, [api, holder, views, device, profileId, what, attempt]);

  if (read.status === "loading") return null;
  if (read.status === "failed") {
    return <ReadFailed failure={read.failure} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (read.status === "ended") {
    return <LessonEnd reason={read.reason} next={nextStep(profileId, device, read.choice)} />;
  }
  return <OpenLesson key={read.opened.runId} {...props} opened={read.opened} />;
}

/** The way to what the engine chose at the end of a run: the choice the end gave, or a press. */
function nextStep(profileId: string, device: Device, choice: EngineChoice | undefined) {
  return (
    <NextStep profileId={profileId} device={device} {...(choice === undefined ? {} : { choice })} />
  );
}

/**
 * The end of a run: the lesson's title if known, how it ended, the way to what the engine chose —
 * the choice the end gave, or else a press that asks for it (R24) —, and the way to My subjects.
 */
export function LessonEnd({
  reason,
  title,
  language,
  next,
}: {
  readonly reason: RunEndReason;
  readonly title?: string;
  readonly language?: string | undefined;
  /** The way to what the engine chose. */
  readonly next?: ReactNode;
}) {
  const { words } = useLanguage();
  const end = words.text(endKey(reason));
  return (
    <Screen
      title={title ?? end}
      {...(title === undefined
        ? {}
        : {
            heading: <span {...(language === undefined ? {} : { lang: language })}>{title}</span>,
          })}
    >
      {title === undefined ? null : <p className="nt-result">{end}</p>}
      {next}
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={() => navigate(HOME)}>
          {words.text("task.home")}
        </button>
      </div>
    </Screen>
  );
}

/** The player of a run read: the segment shown, the place, and what the learner does. */
function OpenLesson({
  profileId,
  device,
  defaultMode,
  adult,
  onEnded,
  onAttempt,
  opened,
}: LessonProps & { readonly opened: Opened }) {
  const api = useApi();
  const holder = useKeyHolder();
  const { checks, files } = usePackages();
  const { words } = useLanguage();
  const { lesson, digest, manifest, id, profile, runId } = opened;
  const segments = lesson.segments;
  const kinds = useMemo(() => segments.map(kindOf), [segments]);
  const [ended, setEnded] = useState<ReadonlySet<number>>(() => new Set(opened.ended));
  const course: Course = useMemo(() => ({ kinds, ended }), [kinds, ended]);
  const [place, setPlace] = useState(() =>
    openingPlace(
      { kinds, ended: new Set(opened.ended) },
      opened.kept?.place,
      opened.attempt?.segment,
    ),
  );
  const [shown, setShown] = useState(place);
  const [demo, setDemo] = useState<Readonly<Record<number, DemoState>>>(() => {
    // A kept state the element would refuse is a broken database: that demo starts again.
    const checked: Record<number, DemoState> = {};
    for (const [at, state] of Object.entries(opened.kept?.demo ?? {})) {
      const example = segments[Number(at) - 1]?.worked_example;
      const valid = example === undefined ? undefined : demoOf(state, example.demo.length);
      if (valid !== undefined) checked[Number(at)] = valid;
    }
    return checked;
  });
  const [task, setTask] = useState<SegmentAttempt | undefined>(() =>
    opened.attempt?.segment === place ? opened.attempt : undefined,
  );
  const [unsaved, setUnsaved] = useState(profile === undefined || id === undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [again, setAgain] = useState(false);
  const [beginFailure, setBeginFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [completeFailure, setCompleteFailure] = useState<Failure | undefined>(undefined);
  const [end, setEnd] = useState<
    { readonly reason: RunEndReason; readonly choice?: EngineChoice } | undefined
  >(undefined);
  // One key for the beginning of a segment's attempt, the same with its repeats.
  const beginKey = useRef<string | undefined>(undefined);
  const beginning = useRef(false);
  const latest = useRef({ place, demo, shown });
  latest.current = { place, demo, shown };
  const media = useMemo(() => files.media(digest), [files, digest]);
  const language = manifest?.languages.explanation;

  /** The state of the lesson, written on every move and every change of a demo. */
  const persist = useCallback(
    (nextPlace: number, nextDemo: Readonly<Record<number, DemoState>>) => {
      if (profile === undefined || id === undefined) {
        setUnsaved(true);
        return;
      }
      void profile
        .saveLesson({
          lessonId: id,
          digest,
          passageId: runId,
          view: lesson,
          place: nextPlace,
          demo: nextDemo,
        })
        .then((saved) => {
          if (saved === "unsaved") setUnsaved(true);
        });
    },
    [profile, id, digest, runId, lesson],
  );

  // The state is written as the lesson opens, so that a restart finds this run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once, as the lesson opens.
  useEffect(() => {
    persist(place, demo);
  }, []);

  const move = useCallback(
    (to: number) => {
      setPlace(to);
      persist(to, latest.current.demo);
    },
    [persist],
  );

  /** The run ended: its state goes, and the end is shown. */
  const finish = useCallback(
    async (reason: RunEndReason, choice?: EngineChoice) => {
      if (id !== undefined) await profile?.lessonEnded(id).catch(() => {});
      onEnded(runId);
      if (reason === RunEndReason.UNCHECKED) void checks.check();
      setEnd({ reason, ...(choice === undefined ? {} : { choice }) });
    },
    [id, profile, onEnded, runId, checks],
  );

  /**
   * The task segments that ended, as api says, and the place they give: on from the place, or the
   * first task not ended when api refused what needs it ended — "lesson done", or the beginning of
   * a segment that has not ended itself.
   */
  const learn = useCallback(
    (places: readonly number[], open?: SegmentAttempt, toward: Toward = "on") => {
      const now = new Set(places);
      setEnded(now);
      const course = { kinds, ended: now };
      const on = openingPlace(course, latest.current.place, open?.segment);
      // A segment refused that has ended itself is passed: the place goes on from it.
      const onward = toward === "on" || (typeof toward === "number" && now.has(toward));
      const to = onward ? on : (firstOpenTask(course) ?? on);
      if (to !== latest.current.place) move(to);
      // The attempt open at the place is the one to show; a task that ended stays with its result.
      setTask((held) =>
        open?.segment === to
          ? open
          : held !== undefined && now.has(held.segment)
            ? held
            : undefined,
      );
      return to;
    },
    [kinds, move],
  );

  /** The run again from api: what ended, the open attempt, or the end of the run; the place it gives. */
  const refresh = useCallback(
    async (toward: Toward = "on"): Promise<number | undefined> => {
      try {
        const run = (
          await api.learning.getLessonRun({
            profileId,
            lessonRunId: runId,
            ...holder.routeFields(profileId),
          })
        ).run;
        return run === undefined ? undefined : learn(run.endedSegments, attemptOf(run), toward);
      } catch (reason) {
        const failure = parseFailure(reason);
        const ended = runEndOf(failure);
        if (ended !== undefined) void finish(ended, endChoiceOf(failure));
        else setNote(failureText(failure, words));
        return undefined;
      }
    },
    [api, holder, profileId, runId, learn, finish, words],
  );

  /**
   * The places a refusal says ended — or, when it says none, what api says again — and the place
   * they give; none when nothing came.
   */
  const settle = useCallback(
    (said: readonly number[] | "unsaid", toward: Toward): Promise<number | undefined> =>
      said === "unsaid" ? refresh(toward) : Promise.resolve(learn(said, undefined, toward)),
    [refresh, learn],
  );

  /** The attempt of the task segment at the place, with one key until it is done. */
  const begin = useCallback(
    (segment: number) => {
      beginKey.current ??= idempotencyKey();
      beginning.current = true;
      setBeginFailure(undefined);
      setAgain(false);
      void api.learning
        .beginAttempt({
          profileId,
          idempotencyKey: beginKey.current,
          start: { case: "segment", value: { lessonRunId: runId, segment } },
          ...holder.routeFields(profileId),
        })
        .then(
          (answer) => {
            beginKey.current = undefined;
            const attemptId = answer.attempt?.attemptId;
            // An answer with no attempt is no beginning: the learner may begin again.
            if (attemptId === undefined || attemptId === "") {
              setBeginFailure({ kind: "unknown", code: Code.Internal });
              return;
            }
            onAttempt();
            setTask({ segment, attemptId });
          },
          async (reason: unknown) => {
            const failure = parseFailure(reason);
            // A refusal ends the action; anything else may have begun it, and goes again with its key.
            if (failure.kind === "refused") beginKey.current = undefined;
            const runEnd = runEndOf(failure);
            const said = endedOf(failure);
            if (runEnd !== undefined) void finish(runEnd, endChoiceOf(failure));
            else if (said === undefined) setBeginFailure(failure);
            else {
              // The segment api has open is the place; the same segment again is no way on.
              const to = await settle(said, segment);
              if (to === undefined || to === segment) setBeginFailure(failure);
              else setShown(to);
            }
          },
        )
        .finally(() => {
          beginning.current = false;
        });
    },
    [api, holder, profileId, runId, onAttempt, finish, settle],
  );

  // A task segment reached begins its attempt: the learner went on to it.
  const wantsTask =
    shown === place &&
    kinds[place - 1] === "task" &&
    !ended.has(place) &&
    task === undefined &&
    !again &&
    beginFailure === undefined &&
    end === undefined;
  useEffect(() => {
    if (wantsTask && !beginning.current) begin(place);
  }, [wantsTask, place, begin]);

  const inLesson: TaskInLesson = useMemo(
    () => ({
      onNext: (next: Next | undefined) => {
        // The task screen is the segment shown: its task ended.
        const segment = latest.current.shown;
        setEnded((held) => new Set(held).add(segment));
        const after = next?.next;
        if (after?.case === "segment") move(Math.max(after.value, latest.current.place));
        else if (after?.case !== "segmentsEnded") void refresh();
      },
      onClosed: (reason: CloseReason) => {
        // Left or abandoned, the segment did not end: the learner begins it again (README of the
        // contracts, "Lessons"); any other close is api's word on the run.
        if (reason === CloseReason.LEFT || reason === CloseReason.ABANDONED) setAgain(true);
        else void refresh();
      },
    }),
    [move, refresh],
  );

  const goTo = useCallback(
    (segment: number) => {
      setNote(undefined);
      setCompleteFailure(undefined);
      // The attempt of a task that ended is past once the learner leaves its screen.
      if (task !== undefined && taskEnded(course, task.segment)) setTask(undefined);
      setShown(segment);
    },
    [task, course],
  );

  const complete = useCallback(() => {
    setPending(true);
    setCompleteFailure(undefined);
    void api.learning
      .completeLesson({ profileId, lessonRunId: runId, ...holder.routeFields(profileId) })
      .then(
        (answer) => void finish(answer.end?.reason ?? RunEndReason.PASSED, answer.end?.choice),
        async (reason: unknown) => {
          const failure = parseFailure(reason);
          const runEnd = runEndOf(failure);
          const said = endedOf(failure);
          if (runEnd !== undefined) void finish(runEnd, endChoiceOf(failure));
          else if (said === undefined) setCompleteFailure(failure);
          else {
            // A task of the lesson has not ended: the learner goes to the first such.
            const to = await settle(said, "first open");
            if (to !== undefined) goTo(to);
            setNote(words.text("lesson.task-left"));
          }
        },
      )
      .finally(() => setPending(false));
  }, [api, holder, profileId, runId, finish, settle, goTo, words]);

  const onContinue = useCallback(() => {
    const to = continueFrom(course, place, shown);
    if (to === "complete") {
      complete();
      return;
    }
    if (to > place) move(to);
    goTo(to);
  }, [course, place, shown, complete, move, goTo]);

  const onDemo = useCallback(
    (segment: number, state: DemoState) => {
      const next = { ...latest.current.demo, [segment]: state };
      setDemo(next);
      persist(latest.current.place, next);
    },
    [persist],
  );

  if (end !== undefined) {
    return (
      <LessonEnd
        reason={end.reason}
        title={lesson.title}
        language={language}
        next={nextStep(profileId, device, end.choice)}
      />
    );
  }

  const segment = segments[shown - 1];
  const kind = kinds[shown - 1];
  let body: ReactNode = null;
  if (segment?.explanation !== undefined) {
    body = <Explanation parts={segment.explanation} language={language} media={media} />;
  } else if (segment?.worked_example !== undefined) {
    body = (
      <Example
        key={`example-${shown}`}
        example={segment.worked_example}
        manifest={manifest}
        media={media}
        demo={demo[shown]}
        onDemo={(state) => onDemo(shown, state)}
      />
    );
  } else if (kind === "task") {
    if (task !== undefined && task.segment === shown) {
      body = (
        <Task
          key={task.attemptId}
          profileId={profileId}
          attemptId={task.attemptId}
          defaultMode={defaultMode}
          device={device}
          adult={adult}
          onAttempt={ignore}
          lesson={inLesson}
        />
      );
    } else if (ended.has(shown)) {
      body = <p>{words.text("lesson.task-over")}</p>;
    }
  }
  // Begin the task again: after it was left or abandoned, or after a beginning that failed.
  const offerAgain =
    kind === "task" &&
    shown === place &&
    !ended.has(shown) &&
    (again || beginFailure !== undefined);

  return (
    <LessonScreen
      title={lesson.title}
      language={language}
      course={course}
      place={place}
      shown={shown}
      unsaved={unsaved}
      {...(note === undefined ? {} : { note })}
      {...(beginFailure === undefined || shown !== place ? {} : { failure: beginFailure })}
      {...(completeFailure === undefined ? {} : { failure: completeFailure })}
      {...(offerAgain ? { onAgain: () => begin(place) } : {})}
      {...(mayContinue(course, place, shown) ? { onContinue } : {})}
      pending={pending}
      onGoTo={goTo}
      onNote={setNote}
      onLeave={() => navigate(HOME)}
    >
      {body}
    </LessonScreen>
  );
}
