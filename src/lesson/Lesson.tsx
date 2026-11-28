// The lesson player (LearningService in the contract): `GetLessonRun` gives an open run
// again, `OpenLesson` a run by an engine's choice of a lesson or of the lesson the learner chose
// by its full ID, each with the lesson's open
// view, its package and the task segments that ended. The lesson opens at the later of the place
// the device keeps and the one after the last task that ended, its examples' demos as they were —
// the state of this run alone, by the lesson's full ID, the package and the run's ID. "Continue"
// goes on; a task segment begins no attempt while the lessons are remade: it says so, and
// "Continue" comes only once api said it ended, as of a run begun before. "Continue" on the
// last segment is "lesson done", `CompleteLesson`, sent again until api answers; any end of the run
// erases the state of the lesson. Leaving sends nothing. At the end come the module's next lesson
// and Solve, its tasks (LessonNext.tsx).
import {
  Cause,
  type EngineChoice,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { DemoState } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { HomeWay } from "../app/HomeButton.tsx";
import { Icon } from "../app/Icon.tsx";
import { ProfilePill } from "../app/LearnerMenu.tsx";
import { HOME, navigate, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, type LessonState, openProfile, type Profile } from "../storage/profile.ts";
import { ModuleTile } from "../subjects/ModuleTile.tsx";
import { Example } from "./Example.tsx";
import { Explanation } from "./Explanation.tsx";
import type { LessonOpen, RunRef } from "./LessonContext.tsx";
import { LessonNext } from "./LessonNext.tsx";
import { ContinueButton, LessonLoading, LessonScreen } from "./LessonScreen.tsx";
import { type Course, continueFrom, firstOpenTask, mayContinue, openingPlace } from "./place.ts";
import { demoOf, endChoiceOf, endedOf, endKey, fullId, kindOf, moduleOf, runEndOf } from "./run.ts";

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
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "ended"; readonly reason: RunEndReason; readonly choice?: EngineChoice }
  | { readonly status: "ready"; readonly opened: Opened };

/** Where what api says of the ended task segments takes the place: on from it, or to the first task not ended. */
type Toward = "on" | "first open";

export interface LessonProps {
  readonly profileId: string;
  readonly open: LessonOpen;
  readonly device: Device;
  /** api gave the run: it is open. */
  readonly onBegan: (run: RunRef) => void;
  /** The run ended, by whatever reason. */
  readonly onEnded: (lessonRunId: string) => void;
}

export function Lesson(props: LessonProps) {
  const { profileId, open: what, device, onBegan, onEnded } = props;
  const api = useApi();
  // On the owner's own key, each request that may give a choice names its provider.
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
              ...(what.kind === "choice" ? { choiceId: what.choiceId } : { lesson: what.lesson }),
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
            : what.kind === "lesson"
              ? what.lesson
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
      };
    }
  }, [api, holder, views, device, profileId, what, attempt]);

  if (read.status === "loading") return <LessonLoading onLeave={() => navigate(HOME)} />;
  if (read.status === "failed") {
    return (
      <>
        <ProfilePill className="nt-home-bar" />
        <ReadFailed failure={read.failure} onRetry={() => setAttempt((n) => n + 1)} home />
      </>
    );
  }
  if (read.status === "ended") {
    const ended =
      what.kind === "run" ? what.run.lesson : what.kind === "lesson" ? what.lesson : undefined;
    return (
      <LessonEnd
        reason={read.reason}
        next={
          <LessonNext
            profileId={profileId}
            device={device}
            moduleId={ended === undefined ? undefined : moduleOf(ended)}
            lesson={ended}
            choice={read.choice}
          />
        }
      />
    );
  }
  return <OpenLesson key={read.opened.runId} {...props} opened={read.opened} />;
}

/**
 * The end of a run, a card in the window's middle as the mockup's `lesson-end`: the module's
 * tile and title if known, the lesson's title if known, how it ended — "Lesson complete" after a
 * star —, what comes next — the module's next lesson and Solve —, and the way to Home. No score, grade or comparison. The profile's pill stands
 * at the top, as on every screen of the profile.
 */
export function LessonEnd({
  reason,
  title,
  language,
  module,
  next,
}: {
  readonly reason: RunEndReason;
  readonly title?: string;
  readonly language?: string | undefined;
  /** The lesson's module, by its manifest: its tile and title above the lesson's. */
  readonly module?: { readonly id: string; readonly title: string } | undefined;
  /** What comes next. */
  readonly next?: ReactNode;
}) {
  const { words } = useLanguage();
  const end = words.text(endKey(reason));
  const lang = language === undefined ? {} : { lang: language };
  const done = reason === RunEndReason.PASSED;
  return (
    <Screen
      title={title ?? end}
      layout="end"
      before={<ProfilePill className="nt-end-bar" />}
      {...(title === undefined ? {} : { heading: <span {...lang}>{title}</span> })}
      {...(module === undefined
        ? {}
        : {
            lead: (
              <>
                <ModuleTile moduleId={module.id} title={module.title} className="nt-end-tile" />
                <p className="nt-end-module" {...lang}>
                  {module.title}
                </p>
              </>
            ),
          })}
    >
      {title === undefined ? null : (
        <p className={done ? "nt-result nt-end-done" : "nt-result"}>
          {done ? <Icon value="lesson-complete" chosen /> : null}
          {end}
        </p>
      )}
      {next}
      <HomeWay />
    </Screen>
  );
}

/** The player of a run read: the segment shown, the place, and what the learner does. */
function OpenLesson({
  profileId,
  device,
  onEnded,
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
    openingPlace({ kinds, ended: new Set(opened.ended) }, opened.kept?.place),
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
  const [unsaved, setUnsaved] = useState(profile === undefined || id === undefined);
  const [note, setNote] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [completeFailure, setCompleteFailure] = useState<Failure | undefined>(undefined);
  const [end, setEnd] = useState<
    { readonly reason: RunEndReason; readonly choice?: EngineChoice } | undefined
  >(undefined);
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
   * first task not ended when api refused "lesson done", which needs them ended.
   */
  const learn = useCallback(
    (places: readonly number[], toward: Toward = "on") => {
      const now = new Set(places);
      setEnded(now);
      const course = { kinds, ended: now };
      const on = openingPlace(course, latest.current.place);
      const to = toward === "on" ? on : (firstOpenTask(course) ?? on);
      if (to !== latest.current.place) move(to);
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
        return run === undefined ? undefined : learn(run.endedSegments, toward);
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
      said === "unsaid" ? refresh(toward) : Promise.resolve(learn(said, toward)),
    [refresh, learn],
  );

  const goTo = useCallback((segment: number) => {
    setNote(undefined);
    setCompleteFailure(undefined);
    setShown(segment);
  }, []);

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
            // Unless the run could not be read again, which its line says.
            const to = await settle(said, "first open");
            if (to === undefined) return;
            goTo(to);
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
        module={manifest === undefined ? undefined : { id: manifest.id, title: manifest.title }}
        next={
          <LessonNext
            profileId={profileId}
            device={device}
            moduleId={manifest?.id ?? (id === undefined ? undefined : moduleOf(id))}
            lesson={id}
            choice={end.choice}
          />
        }
      />
    );
  }

  const segment = segments[shown - 1];
  const kind = kinds[shown - 1];
  // Where "Continue" stands, if it does: under the segment, or in a worked example's canvas.
  let continues: "screen" | "canvas" | undefined = mayContinue(course, place, shown)
    ? "screen"
    : undefined;
  let body: ReactNode = null;
  if (segment?.explanation !== undefined) {
    body = <Explanation parts={segment.explanation} language={language} media={media} />;
  } else if (segment?.worked_example !== undefined) {
    // A segment that is no task always continues (mayContinue).
    continues = "canvas";
    body = (
      <Example
        key={`example-${shown}`}
        example={segment.worked_example}
        manifest={manifest}
        media={media}
        demo={demo[shown]}
        onDemo={(state) => onDemo(shown, state)}
        actions={<ContinueButton slot="actions" pending={pending} onContinue={onContinue} />}
      />
    );
  } else if (kind === "task") {
    body = <p>{words.text(ended.has(shown) ? "lesson.task-over" : "lesson.task-remade")}</p>;
  }

  return (
    <LessonScreen
      title={lesson.title}
      language={language}
      module={manifest?.title}
      course={course}
      place={place}
      shown={shown}
      unsaved={unsaved}
      {...(note === undefined ? {} : { note })}
      {...(completeFailure === undefined ? {} : { failure: completeFailure })}
      {...(continues === "screen" ? { onContinue } : {})}
      pending={pending}
      onGoTo={goTo}
      onNote={setNote}
      onLeave={() => navigate(HOME)}
    >
      {body}
    </LessonScreen>
  );
}
