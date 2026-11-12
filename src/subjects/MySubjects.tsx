// "My subjects", the learner's home (sections 3.8, 3.9 and 3.10 of docs/architecture.md; R99 in
// spec): the modules connected to the profile and, below them, the catalog of the ones it may
// connect, each a card with its title in its own explanation language and, when that is not the
// screen's, a line that names it, in the order of the screen's language. Connecting and
// disconnecting are a press away; api's answer is the list of connected modules, and the focus goes
// with the card to its new place. An attempt open outside a lesson is a press away, above the lists
// (T24), and so is each lesson run open, by the lesson's title as this device keeps it, or else its
// module's name (T27; R23); and "What's next" asks the engine, or "Something else" beside an
// attempt open, which it closes (T28; R24). A card of a version has the page of its license beside
// its button (R32). Below the lists the screen says that the tutor is an AI, and leads to the page
// on how to use it safely (R33). Beside the engine's way the screen leads to the skill map, the
// second way in, where the learner chooses a skill (R34); a card marks a module whose skill graph
// is a chain "in order" (R06). Under its heading, where the learner begins their work, the screen
// says how much of today's tutor time the profile has used, or, once it is used up, when it comes
// back (section 15 of the text of the contracts, "The quota"; R37).
import type { QuotaShare } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
// Whose action a request is; the cards have actions of their own.
import { Action as Actor } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ConnectedModule } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { learnerQuotaText, readQuota } from "../account/quota.ts";
import { useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { LESSON, navigate, SKILL_MAP, TASK, TUTOR } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type RunRef, useLessons } from "../lesson/LessonContext.tsx";
import { moduleOf } from "../lesson/run.ts";
import { NextStep } from "../next/NextStep.tsx";
import { licenseRoute } from "../packages/LicensePage.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import type { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { openProfile, type Profile } from "../storage/profile.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { CardHeading } from "./CardHeading.tsx";
import { byTitle, cardsOf, type ModuleCard, type ModuleRef } from "./modules.ts";
import { useSequential } from "./useSequential.ts";

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

/** What a card's button does. */
type Action = "connect" | "disconnect";

/** A module's card, its buttons described by its title. */
function Card({
  card,
  action,
  pending,
  onPress,
  onLicense,
}: {
  readonly card: ModuleCard;
  readonly action: Action;
  readonly pending: boolean;
  readonly onPress: (moduleId: string) => void;
  readonly onLicense: ((digest: string) => void) | undefined;
}) {
  const { words } = useLanguage();
  const id = useId();
  const digest = card.digest;
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <CardHeading card={card} id={id} />
        <div className="nt-buttons">
          {/* Not disabled while a press is under way: a disabled button would drop the focus. */}
          <button
            type="button"
            className={action === "disconnect" ? "nt-secondary" : undefined}
            aria-describedby={id}
            aria-disabled={pending}
            data-module={card.moduleId}
            data-action={action}
            onClick={() => {
              if (!pending) onPress(card.moduleId);
            }}
          >
            {words.text(action === "connect" ? "subjects.connect" : "subjects.disconnect")}
          </button>
          {digest === undefined || onLicense === undefined ? null : (
            <button
              type="button"
              className="nt-secondary"
              aria-describedby={id}
              onClick={() => onLicense(digest)}
            >
              {words.text("subjects.license")}
            </button>
          )}
        </div>
      </article>
    </li>
  );
}

export interface SubjectsScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** The catalog's modules, connected ones too; none while they come. */
  readonly catalog: readonly ModuleCard[] | undefined;
  /** What the last connection or disconnection came to, when it did not answer. */
  readonly failure?: Failure;
  /** A connection or disconnection under way. */
  readonly pending?: boolean;
  readonly onConnect: (moduleId: string) => void;
  readonly onDisconnect: (moduleId: string) => void;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
  /** Goes on with the attempt the learner has open; none when there is none. */
  readonly onContinue?: () => void;
  /** The way to what the engine chooses: "What's next", or "Something else" beside Continue. */
  readonly next?: ReactNode;
  /** The learner's lesson runs open, each a press away. */
  readonly runs?: readonly OpenRun[];
  readonly onLesson?: (lessonRunId: string) => void;
  /** Opens the page of a version's license, by its digest; no button without it. */
  readonly onLicense?: (digest: string) => void;
  /** The share of today's quota of platform AI the profile has used; none while it is not known. */
  readonly quota?: QuotaShare;
}

/** The screen itself, from what its container has read. */
export function SubjectsScreen({
  connected,
  catalog,
  failure,
  pending = false,
  onConnect,
  onDisconnect,
  onRetry,
  onContinue,
  runs = [],
  onLesson,
  onLicense,
  next,
  quota,
}: SubjectsScreenProps) {
  const { language, words } = useLanguage();
  // Once for each share that comes, not for each render: its formats of Intl are made anew.
  const spent = useMemo(
    () => (quota === undefined ? undefined : learnerQuotaText(quota, words)),
    [quota, words],
  );
  const connectedId = useId();
  const continueId = useId();
  const lessonsId = useId();
  const catalogId = useId();
  const tutorId = useId();
  const compare = useMemo(() => collator(language).compare, [language]);
  const own = new Set(connected?.map((card) => card.moduleId));
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const more =
    catalog === undefined
      ? undefined
      : byTitle(
          catalog.filter((card) => !own.has(card.moduleId)),
          compare,
        );
  const unnamed = [...(mine ?? []), ...(more ?? [])].some((card) => card.unnamed === true);
  return (
    <Screen title={words.text("subjects.title")}>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      {/* Above where the learner begins their work: how much of today's tutor time is used. */}
      {spent === undefined ? null : <p>{spent}</p>}
      {onContinue === undefined ? null : (
        <section aria-labelledby={continueId} className="nt-continue">
          <h2 id={continueId}>{words.text("task.continue-title")}</h2>
          <div className="nt-buttons">
            <button type="button" onClick={onContinue}>
              {words.text("task.continue")}
            </button>
          </div>
        </section>
      )}
      {/* One place, whatever is open: the step stays itself while its press closes the attempt. */}
      {next}
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={() => navigate(SKILL_MAP)}>
          {words.text("skillmap.title")}
        </button>
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
        <h2 id={connectedId}>{words.text("subjects.connected")}</h2>
        {mine === undefined ? null : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-cards">
            {mine.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="disconnect"
                pending={pending}
                onPress={onDisconnect}
                onLicense={onLicense}
              />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={catalogId}>
        <h2 id={catalogId}>{words.text("subjects.catalog")}</h2>
        {more === undefined ? null : more.length === 0 ? (
          <p>{words.text("subjects.catalog-empty")}</p>
        ) : (
          <ul className="nt-cards">
            {more.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="connect"
                pending={pending}
                onPress={onConnect}
                onLicense={onLicense}
              />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={tutorId}>
        <h2 id={tutorId}>{words.text("tutor.home-title")}</h2>
        <p>{words.text("tutor.home-text")}</p>
        <div className="nt-buttons">
          <button type="button" className="nt-secondary" onClick={() => navigate(TUTOR)}>
            {words.text("tutor.open")}
          </button>
        </div>
      </section>
    </Screen>
  );
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly failure: Failure }
  | { readonly status: "done"; readonly connected: ModuleCard[]; readonly catalog: ModuleCard[] };

/** The key of a module at a version: a module in both lists is one card. */
const keyOf = (module: ModuleRef) => `${module.moduleId} ${module.packageDigest}`;

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

/** "My subjects" of the learner chosen: what api says is connected and in the catalog. */
export function MySubjects({
  profileId,
  device,
}: {
  readonly profileId: string;
  /** The device, whose database names the lessons open; none in a screen's own test. */
  readonly device?: Device;
}) {
  const api = useApi();
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
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // The button the focus goes to once a card has moved: its own, in its new list.
  const focus = useRef<{ moduleId: string; action: Action } | undefined>(undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry reads the lists again.
  useEffect(() => {
    let current = true;
    setRead({ status: "loading" });
    void Promise.all([
      api.module.listConnectedModules({ profileId }),
      api.module.listCatalog({ profileId }),
    ])
      .then(async ([own, catalog]) => {
        // One card for a module in both lists: its manifest is read once.
        const all = new Map<string, ModuleRef>();
        for (const module of [...own.modules, ...catalog.modules]) all.set(keyOf(module), module);
        const cards = await cardsOf(views, [...all.values()]);
        const byKey = new Map([...all.keys()].map((key, i) => [key, cards[i] as ModuleCard]));
        const pick = (modules: readonly ModuleRef[]) =>
          modules.map((module) => byKey.get(keyOf(module)) as ModuleCard);
        return { connected: pick(own.modules), catalog: pick(catalog.modules) };
      })
      .then(
        ({ connected, catalog }) => {
          if (current) setRead({ status: "done", connected, catalog });
        },
        (reason: unknown) => {
          if (current) setRead({ status: "failed", failure: parseFailure(reason) });
        },
      );
    return () => {
      current = false;
    };
  }, [api, views, profileId, attempt]);

  // The share of the quota, by the learner's action: the profile's alone. It holds nothing back:
  // a share that did not come is no line, nor is one from an api that has none yet (R27), and the
  // lists stand as they are. A child's profile, which E4 brings, gets the same: never the account's.
  const readShare = useCallback((of: Api) => readQuota(of, profileId, Actor.LEARNING), [profileId]);
  const share = useRequest(readShare);
  const retryShare = share.retry;
  // A retry reads the lists again, and the share with them: it may have failed with them.
  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    retryShare();
  }, [retryShare]);

  // Once a card has moved, its button in the new list takes the focus the old one had.
  useEffect(() => {
    const target = focus.current;
    if (target === undefined || read.status !== "done") return;
    focus.current = undefined;
    document
      .querySelector<HTMLButtonElement>(
        `button[data-module="${CSS.escape(target.moduleId)}"][data-action="${target.action}"]`,
      )
      ?.focus();
  });

  // api answers with the modules connected: they become the list, the catalog stays.
  const change = useCallback(
    async (moduleId: string, then: Action, call: () => Promise<{ modules: ConnectedModule[] }>) => {
      setPending(true);
      setFailure(undefined);
      try {
        const connected = await cardsOf(views, (await call()).modules);
        focus.current = { moduleId, action: then };
        setRead((held) => (held.status === "done" ? { ...held, connected } : held));
      } catch (reason) {
        setFailure(parseFailure(reason));
      } finally {
        setPending(false);
      }
    },
    [views],
  );

  const done = read.status === "done";
  const connected = useSequential(views, done ? read.connected : undefined);
  const catalog = useSequential(views, done ? read.catalog : undefined);
  if (read.status === "failed") return <ReadFailed failure={read.failure} onRetry={retry} />;
  return (
    <SubjectsScreen
      connected={connected}
      catalog={catalog}
      {...(failure === undefined ? {} : { failure })}
      {...(share.status === "done" && share.value !== undefined ? { quota: share.value } : {})}
      pending={pending}
      onRetry={retry}
      {...(open === undefined ? {} : { onContinue: () => navigate(TASK) })}
      next={<NextStep profileId={profileId} {...(device === undefined ? {} : { device })} />}
      runs={runs}
      onLesson={(lessonRunId) => {
        const run = refs?.find((each) => each.lessonRunId === lessonRunId);
        if (run === undefined) return;
        lessons?.choose({ kind: "run", run });
        navigate(LESSON);
      }}
      onLicense={(digest) => navigate(licenseRoute(digest))}
      onConnect={(moduleId) =>
        void change(moduleId, "disconnect", () => api.module.connectModule({ profileId, moduleId }))
      }
      onDisconnect={(moduleId) =>
        void change(moduleId, "connect", () => api.module.disconnectModule({ profileId, moduleId }))
      }
    />
  );
}
