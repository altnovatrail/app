// Home: the learner's home, in the frame of the row of places. Under
// its heading, "Home" — the pseudonym is the profile's menu's —, the learner begins their work:
// what comes next and the tutor time on a card at the top — an attempt open outside a lesson a
// press away, else the engine's way, "What's next": no "Something else" beside the
// attempt, which it would close; a module's Continue or its map goes elsewhere —,
// with how much of today's tutor time the profile has used, or, once it is used up, when it comes
// back (the contract's quota); "A task from my paper" beside it, which opens the camera of a
// new page, and its pages; each lesson run open, by the lesson's title as this device
// keeps it, or else its module's name; and the modules connected, each a card with its title
// in its own explanation language, the states of its skills counted by the rule of skill-map's map,
// the mark "in order" of a chain, and the way to its map. The catalog, connecting and
// the licenses are Subjects' (SubjectsPage.tsx), which "All subjects" opens. The legend of the
// marks stands below the cards, on a phone behind a button; that the tutor is an AI is Help's and
// the tutor's panel's of the top right (Shell.tsx). It is drawn as the mockup's `home`.
import type { QuotaShare } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
// Whose action a request is; the cards have actions of their own.
import { Action as Actor } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { learnerQuotaText, readQuota } from "../account/quota.ts";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { LESSON, navigate, PAPER, TASK } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type RunRef, useLessons } from "../lesson/LessonContext.tsx";
import { moduleOf } from "../lesson/run.ts";
import { givenOf } from "../next/choice.ts";
import { NextStep } from "../next/NextStep.tsx";
import { useEngine } from "../next/useEngine.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { OpenViews } from "../packages/views.ts";
import { paperModuleRoute } from "../paper/module.ts";
import { usePaper } from "../paper/PaperContext.tsx";
import { YourPages } from "../paper/YourPages.tsx";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import type { Device } from "../storage/device.ts";
import { openProfile, type Profile } from "../storage/profile.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { type OpenTask, openTaskOf } from "../task/openTask.ts";
import { HomeCard } from "./HomeCard.tsx";
import { Legend } from "./Legend.tsx";
import { byTitle, type ModuleCard } from "./modules.ts";
import { useModules } from "./useModules.ts";

/** A lesson run open, as Home names it. */
export interface OpenRun {
  readonly lessonRunId: string;
  /** The lesson's title as this device keeps it; none when the device keeps no state of the run. */
  readonly title?: string;
  /** Its module's name, when the title is not kept: its ID while the manifest has not come. */
  readonly module: string;
  /** Its module's ID, by which a module's card goes on with it. */
  readonly moduleId?: string;
  /** The module's explanation language, the `lang` of either. */
  readonly language?: string;
}

/** The name of a run open: the lesson's title, or "A lesson: {module}", the module's own element. */
function RunName({ run }: { readonly run: OpenRun }) {
  const { words } = useLanguage();
  const lang = run.language === undefined ? {} : { lang: run.language };
  if (run.title !== undefined) return <span {...lang}>{run.title}</span>;
  const [before = "", after = ""] = words.pattern("lesson.of-module").split("{module}");
  return (
    <>
      {before}
      <span {...lang}>{run.module}</span>
      {after}
    </>
  );
}

/**
 * How full the bar of the tutor time is, in percent: the profile's share, and full once a cap is
 * reached — the account's too, which the line then names as the time used up.
 */
function quotaFill(quota: QuotaShare | undefined): number {
  if (quota?.capReached === true) return 100;
  return Math.min(100, Math.max(0, quota?.profilePercent ?? 0));
}

export interface HomeScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** What the lists came to, when they did not answer. */
  readonly failure?: Failure;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
  /** Goes on with the attempt the learner has open; none when there is none. */
  readonly onContinue?: () => void;
  /** The way to what the engine chooses, "What's next"; none beside an attempt open. */
  readonly next?: ReactNode;
  /** The learner's lesson runs open, each a press away. */
  readonly runs?: readonly OpenRun[];
  readonly onLesson?: (lessonRunId: string) => void;
  /** The share of today's quota of platform AI the profile has used; none while it is not known. */
  readonly quota?: QuotaShare;
  /**
   * Works on a module's skill, the full ID its card names, when the module has no lesson begun and
   * the task open is not its own: the engine's task of that skill on the task screen.
   */
  readonly onPractise?: (skill: string, moduleId: string) => void;
  /** The share is on its way: its line is a shape meanwhile. */
  readonly quotaLoading?: boolean;
  /** "Your pages", the history of pages from paper, beside "Open camera". */
  readonly pages?: ReactNode;
  /** What the attempt open is, once read; none while it comes, or when it could not be had. */
  readonly openTask?: OpenTask;
}

/** The screen itself, from what its container has read. */
export function HomeScreen({
  connected,
  failure,
  onRetry,
  onContinue,
  runs = [],
  onLesson,
  next,
  quota,
  quotaLoading = false,
  onPractise,
  pages,
  openTask,
}: HomeScreenProps) {
  const { language, words } = useLanguage();
  const paper = usePaper();
  // Once for each share that comes, not for each render: its formats of Intl are made anew.
  const spent = useMemo(
    () => (quota === undefined ? undefined : learnerQuotaText(quota, words)),
    [quota, words],
  );
  const nextId = useId();
  const paperId = useId();
  const connectedId = useId();
  const continueId = useId();
  const compare = useMemo(() => collator(language).compare, [language]);
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const [first, ...later] = runs;
  const unnamed = connected?.some((card) => card.unnamed === true) === true;
  return (
    <Screen title={words.text("home.screen")} layout="reference" unseen>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      <div className="nt-home-top">
        <section aria-labelledby={nextId} className="nt-next-up">
          <GridSheet />
          <h2 id={nextId}>{words.text("subjects.next-up")}</h2>
          {/* What is next in line: the task open, else the lesson begun, else what the engine
              will give — it gives no name before its press, ChooseNext being an action —, or that
              nothing can begin with no subject connected. */}
          {connected === undefined && failure === undefined ? (
            <NextUpLoading />
          ) : onContinue !== undefined ? (
            <>
              <h3 id={continueId}>
                <TaskName task={openTask} />
              </h3>
              {openTask?.kind === "module" && openTask.statement !== undefined ? (
                <p
                  className="nt-next-line nt-next-statement"
                  {...(openTask.language === undefined ? {} : { lang: openTask.language })}
                >
                  {openTask.statement}
                </p>
              ) : null}
              <div className="nt-buttons">
                <button type="button" aria-describedby={continueId} onClick={onContinue}>
                  {words.text("task.continue")}
                </button>
              </div>
            </>
          ) : first !== undefined ? (
            <>
              <h3 id={continueId}>
                <RunName run={first} />
              </h3>
              <div className="nt-buttons">
                <button
                  type="button"
                  aria-describedby={continueId}
                  onClick={() => onLesson?.(first.lessonRunId)}
                >
                  {words.text("lesson.open-continue")}
                </button>
              </div>
            </>
          ) : (
            <p className="nt-next-line">
              {words.text(connected?.length === 0 ? "home.nothing" : "home.engine-picks")}
            </p>
          )}
          {/* The other lessons begun, a press away each. */}
          {later.length === 0 ? null : (
            <p className="nt-next-more">
              {words.text("home.more-runs")}
              {later.map((run) => (
                <button
                  key={run.lessonRunId}
                  type="button"
                  className="nt-link"
                  onClick={() => onLesson?.(run.lessonRunId)}
                >
                  <RunName run={run} />
                </button>
              ))}
            </p>
          )}
          {/* At the card's foot: how much of today's tutor time is used, and at its right the way
              to what the engine chooses, when no attempt is open. */}
          <div className="nt-next-foot">
            {spent === undefined ? (
              quotaLoading ? (
                <Loading className="nt-quota">
                  <Sk width="100%" height="0.375rem" radius="0.1875rem" />
                  <Sk width="68%" height="0.75rem" radius="0.25rem" />
                </Loading>
              ) : null
            ) : (
              <p className="nt-quota">
                <span className="nt-quota-bar" aria-hidden="true">
                  <span style={{ inlineSize: `${quotaFill(quota)}%` }} />
                </span>
                {spent}
              </p>
            )}
            <div className="nt-next-step">{next}</div>
          </div>
        </section>
        {/* A new page each time: the camera, whose screen says to keep names out; and
            beside it the pages of the history. A sheet with a task marked is drawn at the
            right from 600, as the mockup's. */}
        <section aria-labelledby={paperId} className="nt-paper">
          <PaperSheet />
          <p className="nt-paper-eyebrow">
            <Icon value="camera" />
            {words.text("home.camera")}
          </p>
          <h2 id={paperId}>{words.text("subjects.paper")}</h2>
          <p className="nt-paper-sub">{words.text("subjects.paper-sub")}</p>
          <div className="nt-paper-acts">
            <button
              type="button"
              className="nt-icon-text"
              onClick={() => {
                paper?.clear();
                navigate(PAPER);
              }}
            >
              <Icon value="camera" />
              {words.text("subjects.paper-open")}
            </button>
            {pages}
          </div>
        </section>
      </div>
      {unnamed && onRetry !== undefined ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <section aria-labelledby={connectedId}>
        {/* Unseen: the cards say what they are, and Subjects is in the bar; the section keeps its name. */}
        <h2 id={connectedId} className="nt-hidden-label">
          {words.text("subjects.title")}
        </h2>
        {mine === undefined ? (
          failure === undefined ? (
            <CardsLoading />
          ) : null
        ) : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-subjects">
            {mine.map((card) => (
              <HomeCard
                key={card.moduleId}
                card={card}
                onContinue={() => {
                  // A module solved on the sheet: its page of tasks. Else the lesson begun of the
                  // module, else its task open, else a task of its skill to work on, else its map,
                  // where a skill is chosen.
                  const run = runs.find((each) => each.moduleId === card.moduleId);
                  if (card.sheet === true) navigate(paperModuleRoute(card.moduleId));
                  else if (run !== undefined) onLesson?.(run.lessonRunId);
                  else if (
                    onContinue !== undefined &&
                    openTask?.kind === "module" &&
                    openTask.moduleId === card.moduleId
                  ) {
                    onContinue();
                  } else if (card.skill !== undefined && onPractise !== undefined) {
                    onPractise(card.skill, card.moduleId);
                  } else navigate(moduleMapRoute(card.moduleId));
                }}
              />
            ))}
          </ul>
        )}
      </section>
      {mine === undefined || mine.length === 0 ? null : <Legend />}
    </Screen>
  );
}

/** "Next up" while the subjects are read: the name's two lines, a line, the button, the quota. */
function NextUpLoading() {
  return (
    <Loading className="nt-next-loading">
      <Sk width="92%" height="1.75rem" radius="0.5rem" />
      <Sk width="58%" height="1.75rem" radius="0.5rem" />
      <Sk
        width="42%"
        height="0.875rem"
        radius="0.3125rem"
        style={{ marginBlockStart: "0.375rem" }}
      />
      <Sk
        width="9.25rem"
        height="2.625rem"
        radius="999px"
        style={{ marginBlockStart: "0.375rem" }}
      />
      <div className="nt-next-foot">
        <div className="nt-loading">
          <Sk width="100%" height="0.375rem" radius="0.1875rem" />
          <Sk width="68%" height="0.75rem" radius="0.25rem" />
        </div>
      </div>
    </Loading>
  );
}

/** Two subjects' cards while they are read, in the cards' own frame. */
function CardsLoading() {
  return (
    <Loading>
      <ul className="nt-subjects" aria-hidden="true">
        {[0, 1].map((n) => (
          <li key={n} className="nt-subject">
            <article>
              <div className="nt-subject-head">
                <Sk width="3rem" height="3rem" radius="0.8125rem" />
                <div className="nt-subject-words nt-loading">
                  <div className="nt-subject-name">
                    <Sk width="13.75rem" height="1.125rem" />
                    <Sk width="6.875rem" height="1.375rem" radius="999px" />
                  </div>
                  <Sk width="10.625rem" height="0.75rem" radius="0.25rem" />
                </div>
                <div className="nt-subject-acts">
                  <Sk width="2.5rem" height="2.5rem" radius="50%" />
                  <Sk width="9.375rem" height="2.5rem" radius="999px" />
                </div>
              </div>
              <Sk width="38%" height="0.5rem" radius="0.1875rem" />
              <div className="nt-card-foot">
                <Sk width="2.25rem" height="2.25rem" radius="50%" />
                <div className="nt-foot-words nt-loading">
                  <Sk width="8.125rem" height="0.625rem" radius="0.25rem" />
                  <Sk width="17.5rem" height="0.875rem" radius="0.3125rem" />
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </Loading>
  );
}

/** A page of a book with a task marked on it: a picture of the card, not read out. */
function PaperSheet() {
  return (
    <span className="nt-deco" aria-hidden="true">
      <span className="nt-paper-sheet">
        <i />
        <i />
        <i />
        <span className="nt-sheet-task">
          <i />
          <i />
        </span>
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

/**
 * A sheet in squares with a puzzle solved on it, in ink, no words: a row of shapes that repeat, the
 * square of the one that comes next marked "?", and below it that shape ringed in orange — a
 * picture of a task, not of the lesson that comes next, so that it says nothing of one it is not.
 */
function GridSheet() {
  return (
    <span className="nt-deco" aria-hidden="true">
      <span className="nt-grid-sheet">
        <svg
          aria-hidden="true"
          viewBox="0 0 216 104"
          fill="none"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <g stroke="#1f3a93">
            <ellipse cx="17" cy="24" rx="11" ry="10.5" transform="rotate(-8 17 24)" />
            <path d="M40 35.5 52.5 12.5 64.5 35" />
            <path d="M40 35.5 64.5 35" />
            <path d="M77 13.5 99.5 12.8 100.2 35.6 77.6 36.2Z" />
            <ellipse cx="124" cy="24.5" rx="11" ry="10.5" transform="rotate(6 124 24.5)" />
            <path d="M147 35.5 159.5 12.5 171.5 35.2" />
            <path d="M147 35.5 171.5 35.2" />
            <path d="M183 12h26v25h-26z" strokeDasharray="4 3.5" />
            <path d="M190.5 19.5q5.5-6.5 11 0q2 5-5 7.5v3.5" />
            <path d="M196.5 33.6v.2" strokeWidth="3" />
            <path d="M185.8 73.5 207.8 72.8 208.5 94.5 186.4 95.2Z" />
          </g>
          <g stroke="#e8590c">
            <path d="M196 42q-6 7 0 15" />
            <path d="M191.5 52.5 196 57.5 199.5 51.8" />
            <ellipse cx="197" cy="84" rx="18" ry="16.5" transform="rotate(-10 197 84)" />
          </g>
        </svg>
      </span>
    </span>
  );
}

/** The name of the task open: of its module, of paper, or that one is open while neither is known. */
function TaskName({ task }: { readonly task: OpenTask | undefined }) {
  const { words } = useLanguage();
  if (task?.kind === "paper") return <>{words.text("task.of-paper")}</>;
  if (task?.module === undefined) return <>{words.text("task.continue-title")}</>;
  const [before = "", after = ""] = words.pattern("task.of-module").split("{module}");
  return (
    <>
      {before}
      <span {...(task.language === undefined ? {} : { lang: task.language })}>{task.module}</span>
      {after}
    </>
  );
}

/** The name of a run open, from the state of its lesson on this device or its module's manifest. */
async function runOf(
  views: OpenViews,
  profile: Profile | undefined,
  run: RunRef,
): Promise<OpenRun> {
  const manifest = (await views.get(run.packageDigest, "manifest").catch(() => undefined))?.view;
  const kept = await profile
    ?.readLesson(run.lesson, run.packageDigest, run.lessonRunId)
    .catch(() => undefined);
  return {
    lessonRunId: run.lessonRunId,
    ...(kept === undefined ? {} : { title: kept.view.title }),
    module: manifest?.title ?? moduleOf(run.lesson),
    moduleId: moduleOf(run.lesson),
    ...(manifest === undefined ? {} : { language: manifest.languages.explanation }),
  };
}

/** Home of the learner chosen: what api says is connected. */
export function MySubjects({
  profileId,
  device,
}: {
  readonly profileId: string;
  /** The device, whose database names the lessons open; none in a screen's own test. */
  readonly device?: Device;
}) {
  const { views } = usePackages();
  const open = useAttempt()?.attemptId;
  const lessons = useLessons();
  const refs = lessons?.runs;
  const [runs, setRuns] = useState<readonly OpenRun[]>([]);
  useEffect(() => {
    let current = true;
    void (async () => {
      const all = refs ?? [];
      // The profile's database once for every run named.
      const profile =
        all.length === 0 || device === undefined
          ? undefined
          : await openProfile(device, profileId).catch(() => undefined);
      const named = await Promise.all(all.map((run) => runOf(views, profile, run)));
      if (current) setRuns(named);
    })();
    return () => {
      current = false;
    };
  }, [views, device, profileId, refs]);
  const modules = useModules(profileId, false);
  // What the attempt open is: a name that did not come leaves the line that one is open.
  const api = useApi();
  const [openTask, setOpenTask] = useState<OpenTask | undefined>(undefined);
  useEffect(() => {
    setOpenTask(undefined);
    if (open === undefined) return;
    let current = true;
    openTaskOf(api, views, profileId, open).then(
      (task) => {
        if (current) setOpenTask(task);
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [api, views, profileId, open]);

  // The share of the quota, by the learner's action: the profile's alone. It holds nothing back:
  // a share that did not come is no line, nor is one from an api that has none yet, and the
  // lists stand as they are. A child's profile gets the same: never the account's.
  const readShare = useCallback((of: Api) => readQuota(of, profileId, Actor.LEARNING), [profileId]);
  const share = useRequest(readShare);
  const retryShare = share.retry;
  const retryModules = modules.retry;
  // A retry reads the lists again, and the share with them: it may have failed with them.
  const retry = useCallback(() => {
    retryModules();
    retryShare();
  }, [retryModules, retryShare]);

  // A card's skill: the engine's task of it on the task screen. Choosing closes the attempt open,
  // which the map asks of first, so with one open — of another module or of paper — the map is the
  // way; and so it is when the engine gives nothing, or the choice fails, as the map says why.
  const { choose, act } = useEngine(profileId, device);
  const practising = useRef(false);
  const onPractise = useCallback(
    (skill: string, moduleId: string) => {
      if (open !== undefined) {
        navigate(moduleMapRoute(moduleId));
        return;
      }
      if (practising.current) return;
      practising.current = true;
      void (async () => {
        const given = await choose(skill, undefined);
        if (given === undefined || givenOf(given) === "nothing") navigate(moduleMapRoute(moduleId));
        else await act(given, undefined);
      })()
        .catch(() => navigate(moduleMapRoute(moduleId)))
        .finally(() => {
          practising.current = false;
        });
    },
    [open, choose, act],
  );

  if (modules.failed !== undefined) return <ReadFailed failure={modules.failed} onRetry={retry} />;
  return (
    <HomeScreen
      connected={modules.connected}
      {...(share.status === "done" && share.value !== undefined ? { quota: share.value } : {})}
      quotaLoading={share.status === "loading"}
      onPractise={onPractise}
      onRetry={retry}
      {...(open === undefined ? {} : { onContinue: () => navigate(TASK) })}
      {...(openTask === undefined ? {} : { openTask })}
      {...(open !== undefined
        ? {}
        : {
            next: (
              <NextStep
                profileId={profileId}
                secondary={runs.length > 0}
                {...(device === undefined ? {} : { device })}
              />
            ),
          })}
      {...(device === undefined
        ? {}
        : { pages: <YourPages profileId={profileId} device={device} /> })}
      runs={runs}
      onLesson={(lessonRunId) => {
        const run = refs?.find((each) => each.lessonRunId === lessonRunId);
        if (run === undefined) return;
        lessons?.choose({ kind: "run", run });
        navigate(LESSON);
      }}
    />
  );
}
