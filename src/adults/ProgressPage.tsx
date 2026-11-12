// The progress of a profile in the section for adults (R35 in docs/decisions.md; section 3.10 of
// docs/architecture.md; architecture 3.3 in spec), a page of the profile chosen, `#/adults/progress`:
// the skill maps of the modules connected, each the adult's view of skill-map's element on a page of
// its own, `#/adults/progress/<module>`; the traps that repeat, from the first page of GetProgress
// alone; and the attempts, newest first, a page at a time, each with how it came out, its wrong
// answers, its times and why the engine gave its task or its lesson — the reason code, which the
// adult alone sees (concepts 12 in spec; R100 in spec). The progress names a task and a lesson by
// their full IDs alone, and the screen shows their local IDs; a module by the manifest of its
// current version, or of the one the cache keeps, or else by its ID (В57 in RUN.md). In the
// device's language, as the section is (R10).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type {
  AttemptRecord,
  RepeatingTrap,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { type Timestamp, timestampDate } from "@bufbuild/protobuf/wkt";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { type RequestState, useApi, useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { failureText } from "../api/words.ts";
import { navigate } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { dateTimeFormat, numberFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import { usePackages } from "../packages/PackagesContext.tsx";
import { readModuleMap } from "../skills/map.ts";
import { MapHeading, ModuleSkillMap, mapTitle } from "../skills/SkillMap.tsx";
import { ModuleCardItem, ModuleCardList, useConnectedCards } from "../subjects/ModuleCards.tsx";
import { cardsOf, type ModuleCard } from "../subjects/modules.ts";
import {
  choiceReasonKey,
  entryOf,
  outcomeKey,
  PROGRESS_PAGE,
  progressMapRoute,
  readProgress,
} from "./progress.ts";

/** A module's name by its ID, as a card names it: its title, in its own language when known. */
type Names = (moduleId: string) => ModuleCard;

/** A card that names its module: one whose manifest came, or that had none to come. */
const named = (card: ModuleCard | undefined) => (card?.unnamed === true ? undefined : card);

/**
 * The names of the modules the progress names: the cards of those connected, and for the rest —
 * all of them, when the list did not come — the cards that cardsOf makes of a module with no
 * current version: the manifest the cache keeps, read only when one is needed, or else the ID.
 */
function useNames(connected: RequestState<ModuleCard[]>, moduleIds: readonly string[]): Names {
  const { views } = usePackages();
  const [kept, setKept] = useState<ReadonlyMap<string, ModuleCard>>(new Map());
  const known = connected.status === "done" ? connected.value : undefined;
  const cardOf = useCallback(
    (moduleId: string) => named(known?.find((card) => card.moduleId === moduleId)),
    [known],
  );
  const missing =
    connected.status === "loading"
      ? ""
      : [...new Set(moduleIds)]
          .filter((moduleId) => cardOf(moduleId) === undefined && !kept.has(moduleId))
          .sort()
          .join(" ");
  useEffect(() => {
    if (missing === "") return;
    let current = true;
    const refs = missing.split(" ").map((moduleId) => ({ moduleId, packageDigest: "" }));
    void cardsOf(views, refs).then((cards) => {
      if (current)
        setKept(
          (held) => new Map([...held, ...cards.map((card) => [card.moduleId, card] as const)]),
        );
    });
    return () => {
      current = false;
    };
  }, [views, missing]);
  return useCallback(
    (moduleId: string) => cardOf(moduleId) ?? kept.get(moduleId) ?? { moduleId, title: moduleId },
    [cardOf, kept],
  );
}

/** A module's name, in its own language. */
function Name({ card }: { readonly card: ModuleCard }) {
  return card.language === undefined ? card.title : <span lang={card.language}>{card.title}</span>;
}

/** The formats of the times and numbers of the progress, one of each per language. */
const FORMATS = new Map<
  Language,
  { readonly time: Intl.DateTimeFormat; readonly number: Intl.NumberFormat }
>();

function formatsOf(language: Language) {
  let held = FORMATS.get(language);
  if (held === undefined) {
    held = {
      time: dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }),
      number: numberFormat(language),
    };
    FORMATS.set(language, held);
  }
  return held;
}

/** A time of the progress, in the screen's language, with its machine form. */
function When({ at }: { readonly at: Timestamp }) {
  const { language } = useLanguage();
  const date = timestampDate(at);
  return <time dateTime={date.toISOString()}>{formatsOf(language).time.format(date)}</time>;
}

/** A term of a card and what it says, in a language of its own when it is a module's text. */
function Term({
  term,
  lang,
  children,
}: {
  readonly term: string;
  readonly lang?: string | undefined;
  readonly children: ReactNode;
}) {
  return (
    <>
      <dt>{term}</dt>
      <dd {...(lang === undefined ? {} : { lang })}>{children}</dd>
    </>
  );
}

/** A trap that repeats: what the mistake is, its module, the advice, how often and when last. */
function Trap({ trap, names }: { readonly trap: RepeatingTrap; readonly names: Names }) {
  const { words } = useLanguage();
  const id = useId();
  const entry = entryOf(trap.trap, "trap");
  const card = entry === undefined ? undefined : names(entry.moduleId);
  const lang = card?.language;
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <h3 id={id} {...(trap.description === "" || lang === undefined ? {} : { lang })}>
          {trap.description === "" ? (entry?.local ?? trap.trap) : trap.description}
        </h3>
        <dl className="nt-terms">
          {card === undefined ? null : (
            <Term term={words.text("progress.module")}>
              <Name card={card} />
            </Term>
          )}
          {trap.trapAdvice === "" ? null : (
            <Term term={words.text("progress.trap-advice")} lang={lang}>
              {trap.trapAdvice}
            </Term>
          )}
          <Term term={words.text("progress.trap-found")}>
            {words.text("progress.trap-count", { count: trap.attemptCount })}
          </Term>
          {trap.lastClosedAt === undefined ? null : (
            <Term term={words.text("progress.trap-last")}>
              <When at={trap.lastClosedAt} />
            </Term>
          )}
        </dl>
      </article>
    </li>
  );
}

/** An attempt: its task, module and lesson, how it came out, its times, and why it was given. */
function Attempt({
  record,
  names,
  index,
}: {
  readonly record: AttemptRecord;
  readonly names: Names;
  /** Its place in the list, by which its heading takes the focus after "Show more". */
  readonly index: number;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const task = entryOf(record.task, "task");
  const lesson = record.lesson === "" ? undefined : record.lesson;
  const essay = record.essaySubmissions.length > 0;
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <h3 id={id} tabIndex={-1} data-index={index}>
          {words.text("progress.task", { task: task?.local ?? record.task })}
        </h3>
        <dl className="nt-terms">
          {task === undefined ? null : (
            <Term term={words.text("progress.module")}>
              <Name card={names(task.moduleId)} />
            </Term>
          )}
          {lesson === undefined ? null : (
            <Term term={words.text("progress.lesson")}>
              {entryOf(lesson, "lesson")?.local ?? lesson}
            </Term>
          )}
          <Term term={words.text("progress.version")}>{record.moduleVersion}</Term>
          <Term term={words.text("progress.outcome")}>{words.text(outcomeKey(record))}</Term>
          {essay ? null : (
            <Term term={words.text("progress.wrong")}>
              {formatsOf(language).number.format(record.wrongAnswers)}
            </Term>
          )}
          {record.begunAt === undefined ? null : (
            <Term term={words.text("progress.begun")}>
              <When at={record.begunAt} />
            </Term>
          )}
          {record.closedAt === undefined ? null : (
            <Term term={words.text("progress.closed")}>
              <When at={record.closedAt} />
            </Term>
          )}
          <Term term={words.text(lesson === undefined ? "progress.why" : "progress.why-lesson")}>
            {record.chosenAt === undefined
              ? words.text("progress.again")
              : words.text(choiceReasonKey(record.reasonCode))}
          </Term>
          {record.chosenAt === undefined ? null : (
            <Term term={words.text("progress.chosen")}>
              <When at={record.chosenAt} />
            </Term>
          )}
        </dl>
        {/* The submissions of an essay, each with its end and the marks of its rubric, come here
            with the module of essays (T47; R87 in spec). */}
      </article>
    </li>
  );
}

/** The pages after the first: their attempts, the next token, and where the focus goes. */
interface Later {
  readonly attempts: readonly AttemptRecord[];
  /** The token of the next page, once a page after the first came: empty after the last. */
  readonly next?: string;
  /** The place of the attempt whose heading takes the focus, after each "Show more". */
  readonly focus?: { readonly at: number };
  readonly asking: boolean;
  readonly failure?: Failure;
}

/** The traps and the attempts, the first page first, and the next on "Show more". */
function History({
  profileId,
  connected,
}: {
  readonly profileId: string;
  readonly connected: RequestState<ModuleCard[]>;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const traps = useId();
  const attempts = useId();
  const read = useCallback((api: Api) => readProgress(api, profileId, ""), [profileId]);
  const first = useRequest(read);
  const [later, setLater] = useState<Later>({ attempts: [], asking: false });
  const page = first.status === "done" ? first.value : undefined;
  const all = useMemo(
    () => (page === undefined ? [] : [...page.attempts, ...later.attempts]),
    [page, later.attempts],
  );
  const moduleIds = useMemo(
    () =>
      [
        ...all.map((record) => entryOf(record.task, "task")),
        ...(page?.repeatingTraps ?? []).map((trap) => entryOf(trap.trap, "trap")),
      ].flatMap((entry) => (entry === undefined ? [] : [entry.moduleId])),
    [all, page],
  );
  const names = useNames(connected, moduleIds);
  const next = later.next ?? page?.nextPageToken ?? "";

  // After "Show more", the focus goes to the first attempt of the page that came, so that the
  // reading goes on there; a page with none leaves it on the last attempt, or on the heading.
  const list = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const focus = later.focus;
  useEffect(() => {
    if (focus === undefined) return;
    const found = list.current?.querySelector<HTMLElement>(`h3[data-index="${focus.at}"]`);
    (found ?? heading.current)?.focus();
  }, [focus]);

  const showMore = useCallback(() => {
    if (next === "" || later.asking) return;
    const before = all.length;
    setLater((held) => ({ ...held, asking: true, failure: undefined }));
    readProgress(api, profileId, next).then(
      (more) =>
        setLater((held) => ({
          attempts: [...held.attempts, ...more.attempts],
          next: more.nextPageToken,
          focus: { at: more.attempts.length > 0 ? before : before - 1 },
          asking: false,
        })),
      (reason: unknown) =>
        setLater((held) => ({ ...held, asking: false, failure: parseFailure(reason) })),
    );
  }, [api, profileId, next, later.asking, all.length]);

  if (first.status === "loading") return null;
  if (first.status === "failed") {
    // The first page holds the traps and the attempts alike: what it came to stands under the
    // attempts' heading, so that it is not taken for the maps'.
    return (
      <section aria-labelledby={attempts}>
        <h2 id={attempts}>{words.text("progress.attempts")}</h2>
        <ReadFailure failure={first.failure} onRetry={first.retry} />
      </section>
    );
  }
  const repeating = first.value.repeatingTraps;
  return (
    <>
      <section aria-labelledby={traps}>
        <h2 id={traps}>{words.text("progress.traps")}</h2>
        <p>{words.text("progress.traps-hint")}</p>
        {repeating.length === 0 ? (
          <p>{words.text("progress.traps-none")}</p>
        ) : (
          <ul className="nt-cards">
            {repeating.map((trap) => (
              <Trap key={trap.trap} trap={trap} names={names} />
            ))}
          </ul>
        )}
      </section>
      <section ref={list} aria-labelledby={attempts}>
        <h2 ref={heading} id={attempts} tabIndex={-1}>
          {words.text("progress.attempts")}
        </h2>
        <p>{words.text("progress.attempts-hint")}</p>
        {all.length === 0 ? (
          <p>{words.text("progress.attempts-none")}</p>
        ) : (
          <ul className="nt-cards">
            {all.map((record, index) => (
              <Attempt
                // Pages only grow at their end, and a record has no ID of its own.
                // biome-ignore lint/suspicious/noArrayIndexKey: the place is the record's key.
                key={index}
                record={record}
                names={names}
                index={index}
              />
            ))}
          </ul>
        )}
        {later.failure === undefined ? null : (
          <p role="alert" className="nt-error">
            {failureText(later.failure, words)}
          </p>
        )}
        {next === "" ? null : (
          <div className="nt-buttons">
            {/* Not disabled while the page comes: a disabled button would drop the focus. */}
            <button type="button" aria-disabled={later.asking} onClick={showMore}>
              {words.text("progress.more")}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

/** `#/adults/progress`: the maps of the modules connected, the traps that repeat, the attempts. */
export function ProgressPage({ profile }: { readonly profile: Profile }) {
  const { words } = useLanguage();
  const maps = useId();
  const profileId = profile.profileId;
  const cards = useConnectedCards(profileId);
  let shown = null;
  if (cards.status === "failed") {
    shown = <ReadFailure failure={cards.failure} onRetry={cards.retry} />;
  } else if (cards.status === "done") {
    shown =
      cards.value.length === 0 ? (
        <p>{words.text("subjects.none")}</p>
      ) : (
        <ModuleCardList
          cards={cards.value}
          onRetry={cards.retry}
          render={(card) => (
            <ModuleCardItem
              key={card.moduleId}
              card={card}
              {...(card.digest === undefined
                ? {}
                : {
                    action: {
                      text: words.text("skillmap.open"),
                      onPress: () => navigate(progressMapRoute(card.moduleId)),
                    },
                  })}
            />
          )}
        />
      );
  }
  return (
    <Screen title={words.text("progress.title", { pseudonym: profile.pseudonym })}>
      <p>{words.text("progress.hint")}</p>
      <section aria-labelledby={maps}>
        <h2 id={maps}>{words.text("progress.maps")}</h2>
        <p>{words.text("progress.maps-hint")}</p>
        {shown}
      </section>
      <History profileId={profileId} connected={cards} />
    </Screen>
  );
}

/**
 * `#/adults/progress/<module>`: the adult's view of a module's map, `GetSkillMap` by an adult's
 * action; it chooses nothing (R03 and R04 in skill-map), and leads back to the progress.
 */
export function ProgressMap({
  profile,
  moduleId,
}: {
  readonly profile: Profile;
  readonly moduleId: string;
}) {
  const { words } = useLanguage();
  const { views } = usePackages();
  const profileId = profile.profileId;
  const read = useCallback(
    (api: Api) => readModuleMap(api, views, { profileId, moduleId, action: Action.ADULT }),
    [views, profileId, moduleId],
  );
  const map = useRequest(read);
  const shown = map.status === "done" ? map.value : undefined;
  return (
    <Screen title={mapTitle(shown, words)} heading={<MapHeading map={shown} />}>
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={() => navigate(PROGRESS_PAGE)}>
          {words.text("progress.back")}
        </button>
      </div>
      {map.status === "failed" ? <ReadFailure failure={map.failure} onRetry={map.retry} /> : null}
      {shown === undefined ? null : <ModuleSkillMap map={shown} view="adult" headingLevel="2" />}
    </Screen>
  );
}
