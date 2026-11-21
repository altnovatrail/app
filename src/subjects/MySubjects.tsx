// Home, "My subjects" (R99 spec; R62, R79): the learner's home, in the frame of the side menu. Under
// its heading, "Home" — the pseudonym is the profile's menu's —, the learner begins their work:
// what comes next and the tutor time on a card at the top — an attempt open outside a lesson a press away (R20), and the
// engine's way, "What's next", or "Something else" beside an attempt open, which it closes (R24) —,
// with how much of today's tutor time the profile has used, or, once it is used up, when it comes
// back (the contract's quota; R37); "A task from my paper" beside it, which opens the camera of a
// new page (R71), and its pages (R77); each lesson run open, by the lesson's title as this device
// keeps it, or else its module's name (R23); and the modules connected, each a card with its title
// in its own explanation language, the states of its skills counted by the rule of skill-map's map,
// the mark "in order" of a chain (R06), and the way to its map (R34). The catalog, connecting and
// the licenses are Subjects' (SubjectsPage.tsx), which "All subjects" opens. The legend of the
// marks stands below the cards, on a phone behind a button; that the tutor is an AI is its panel's
// (Shell.tsx). It is drawn as the mockup's `home` (R148 spec).
import type { QuotaShare } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
// Whose action a request is; the cards have actions of their own.
import { Action as Actor } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { learnerQuotaText, readQuota } from "../account/quota.ts";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { LESSON, navigate, PAPER, SUBJECTS, TASK } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type RunRef, useLessons } from "../lesson/LessonContext.tsx";
import { moduleOf } from "../lesson/run.ts";
import { NextStep } from "../next/NextStep.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { OpenViews } from "../packages/views.ts";
import { usePaper } from "../paper/PaperContext.tsx";
import { YourPages } from "../paper/YourPages.tsx";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import type { Device } from "../storage/device.ts";
import { openProfile, type Profile } from "../storage/profile.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { CardHeading } from "./CardHeading.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import { byTitle, type ModuleCard } from "./modules.ts";
import { Legend, SkillBar } from "./SkillBar.tsx";
import { useModules } from "./useModules.ts";

/** A lesson run open, as My subjects names it. */
export interface OpenRun {
  readonly lessonRunId: string;
  /** The lesson's title as this device keeps it; none when the device keeps no state of the run. */
  readonly title?: string;
  /** Its module's name, when the title is not kept: its ID while the manifest has not come. */
  readonly module: string;
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

/** A module's card on Home: its tile, its title, its skills, and the way to its map. */
function Card({ card }: { readonly card: ModuleCard }) {
  const { words } = useLanguage();
  const id = useId();
  return (
    <li className="nt-card nt-module">
      <article aria-labelledby={id}>
        <div className="nt-module-head">
          <ModuleTile moduleId={card.moduleId} title={card.title} />
          <div>
            <CardHeading card={card} id={id} />
          </div>
        </div>
        {card.skills === undefined ? null : <SkillBar counts={card.skills} />}
        {/* A module with a current version has its map; ChooseNext takes no module, so no Continue. */}
        {card.digest === undefined ? null : (
          <div className="nt-buttons">
            <button
              type="button"
              className="nt-link nt-icon-text"
              aria-describedby={id}
              onClick={() => navigate(moduleMapRoute(card.moduleId))}
            >
              <Icon value="skill-map" />
              {words.text("skillmap.title")}
            </button>
          </div>
        )}
      </article>
    </li>
  );
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
  /** The way to what the engine chooses: "What's next", or "Something else" beside Continue. */
  readonly next?: ReactNode;
  /** The learner's lesson runs open, each a press away. */
  readonly runs?: readonly OpenRun[];
  readonly onLesson?: (lessonRunId: string) => void;
  /** The share of today's quota of platform AI the profile has used; none while it is not known. */
  readonly quota?: QuotaShare;
  /** "Your pages", the history of pages from paper, beside "Open camera". */
  readonly pages?: ReactNode;
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
  pages,
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
  const lessonsId = useId();
  const compare = useMemo(() => collator(language).compare, [language]);
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const unnamed = mine?.some((card) => card.unnamed === true) === true;
  return (
    <Screen title={words.text("home.screen")} layout="reference">
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      <div className="nt-home-top">
        <section aria-labelledby={nextId} className="nt-next-up">
          <h2 id={nextId}>{words.text("subjects.next-up")}</h2>
          {onContinue === undefined ? null : (
            <section aria-labelledby={continueId} className="nt-continue">
              <h3 id={continueId}>{words.text("task.continue-title")}</h3>
              <div className="nt-buttons">
                <button type="button" onClick={onContinue}>
                  {words.text("task.continue")}
                </button>
              </div>
            </section>
          )}
          {/* One place, whatever is open: the step stays itself while its press closes the attempt. */}
          {next}
          {/* At the card's foot, as the mockup has it: how much of today's tutor time is used. */}
          {spent === undefined ? null : (
            <p className="nt-quota">
              <span className="nt-quota-bar" aria-hidden="true">
                <span style={{ inlineSize: `${quotaFill(quota)}%` }} />
              </span>
              {spent}
            </p>
          )}
        </section>
        {/* A new page each time: the camera, and before it the line to keep names out (R71); and
            beside it the pages of the history (R77). */}
        <section aria-labelledby={paperId} className="nt-paper">
          <span className="nt-paper-icon" aria-hidden="true">
            <Icon value="camera" />
          </span>
          <h2 id={paperId}>{words.text("subjects.paper")}</h2>
          <div className="nt-paper-acts">
            <button
              type="button"
              className="nt-paper-open"
              aria-describedby={`${paperId}-names`}
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
          <p id={`${paperId}-names`} className="nt-hint">
            {words.text("paper.names")}
          </p>
        </section>
      </div>
      {runs.length === 0 ? null : (
        <section aria-labelledby={lessonsId} className="nt-continue">
          <h2 id={lessonsId}>{words.text("lesson.open-title")}</h2>
          <ul className="nt-cards">
            {runs.map((run) => (
              <li key={run.lessonRunId} className="nt-card">
                <h3 id={`${lessonsId}-${run.lessonRunId}`}>
                  <RunName run={run} />
                </h3>
                <div className="nt-buttons">
                  <button
                    type="button"
                    aria-describedby={`${lessonsId}-${run.lessonRunId}`}
                    onClick={() => onLesson?.(run.lessonRunId)}
                  >
                    {words.text("lesson.open-continue")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {unnamed && onRetry !== undefined ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <section aria-labelledby={connectedId}>
        <div className="nt-section-head">
          <h2 id={connectedId}>{words.text("subjects.title")}</h2>
          <button
            type="button"
            className="nt-link nt-icon-text nt-all-link"
            onClick={() => navigate(SUBJECTS)}
          >
            {words.text("home.all-subjects")}
            <Icon value="more" />
          </button>
        </div>
        {mine === undefined ? null : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-cards">
            {mine.map((card) => (
              <Card key={card.moduleId} card={card} />
            ))}
          </ul>
        )}
      </section>
      {mine === undefined || mine.length === 0 ? null : <Legend />}
    </Screen>
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

  // The share of the quota, by the learner's action: the profile's alone. It holds nothing back:
  // a share that did not come is no line, nor is one from an api that has none yet (R27), and the
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

  if (modules.failed !== undefined) return <ReadFailed failure={modules.failed} onRetry={retry} />;
  return (
    <HomeScreen
      connected={modules.connected}
      {...(share.status === "done" && share.value !== undefined ? { quota: share.value } : {})}
      onRetry={retry}
      {...(open === undefined ? {} : { onContinue: () => navigate(TASK) })}
      next={<NextStep profileId={profileId} {...(device === undefined ? {} : { device })} />}
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
