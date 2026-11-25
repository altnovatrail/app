// Subjects, a place of the row of places: the catalog of the server, as the
// mockup's `subjects`. The modules connected to the profile come first, by their count, the others
// below, "More on this server"; each list is in the order of the screen's language, and the focus
// goes with a card to its new place. A card says what its module is: its title in its own
// explanation language; a line of its subject, whom it is for, its kind and, when it is not the
// screen's, its explanation language; its skills, three by name and the rest in a pop-over by tier;
// on a connected one a square for each skill in its state's colour, as Home's card, its counts, the
// mark "Connected" and its skill map; on another, Connect and how many skills it has. ⋯ at its top
// right opens the rest of its manifest — the version, the authors, whom it is for, the explanation
// language and the license, a fact and not a button — and Disconnect. The manifest has no words of
// what a module teaches, so a card has none: its skills say it.
import { type ReactNode, useId, useMemo } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { navigate } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator, listFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Language } from "../i18n/language.ts";
import type { Words } from "../i18n/words.ts";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import { isScreenLanguage, nameOf } from "./CardHeading.tsx";
import { SkillDots } from "./HomeCard.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import { byTitle, type ModuleAbout, type ModuleCard, type SkillList } from "./modules.ts";
import { judged } from "./states.ts";
import { type CardAction, useModules } from "./useModules.ts";

/** How many skills a card names before the chip of the rest. */
const NAMED = 3;

/** Whom a module is for: its grades where it names them, else its age categories. */
export function audienceOf(about: ModuleAbout, words: Words, language: Language): string {
  const grades = [...new Set(about.grades)].sort((a, b) => a - b);
  if (grades.length > 0) {
    const first = grades[0] as number;
    const last = grades[grades.length - 1] as number;
    if (grades.length === 1) return words.text("subjects.grade", { grade: first });
    if (last - first === grades.length - 1) {
      return words.text("subjects.grades", { from: first, to: last });
    }
    return words.text("subjects.grade-list", {
      list: listFormat(language, { type: "unit" }).format(grades.map(String)),
    });
  }
  // The two categories of a teenager are one to the learner: 13 to 17.
  const ages = new Set(
    about.ageCategories.map((category) =>
      category === "under_13" ? "under-13" : category === "adult" ? "adult" : "teen",
    ),
  );
  if (ages.size === 3) return words.text("subjects.age-any");
  return listFormat(language, { type: "unit" }).format(
    (["under-13", "teen", "adult"] as const)
      .filter((age) => ages.has(age))
      .map((age) => words.text(`subjects.age-${age}`)),
  );
}

/** A subject's word; a code this build does not know stands for itself. */
function subjectOf(subject: string, words: Words): string {
  return subject === "mathematics" || subject === "physics" || subject === "writing"
    ? words.text(`subjects.subject-${subject}`)
    : subject;
}

/** The kind of a module, once its graph has come: on a sheet, by a rubric, in order or adaptive. */
function kindOf(card: ModuleCard, words: Words): string | undefined {
  if (card.sheet === true) return words.text("subjects.kind-sheet");
  if (card.skillList === undefined) return undefined;
  if (card.skillList.rubric) return words.text("skill-state.feedback-by-criteria");
  return words.text(card.sequential === true ? "subjects.sequential" : "home.adaptive");
}

/** The line under a card's title: its subject, whom it is for, its kind, its language. */
function lineOf(card: ModuleCard, words: Words, language: Language): string {
  const parts: string[] = [];
  if (card.about !== undefined) {
    parts.push(subjectOf(card.about.subject, words), audienceOf(card.about, words, language));
  }
  const kind = kindOf(card, words);
  if (kind !== undefined) parts.push(kind);
  if (card.language !== undefined && !isScreenLanguage(card.language, language)) {
    parts.push(words.text("subjects.in-language", { language: nameOf(card.language, language) }));
  }
  return parts.join(" · ");
}

/** The skills of a module by tier, in a pop-over from the chip of the rest. */
function AllSkills({
  card,
  list,
  own,
  describedBy,
}: {
  readonly card: ModuleCard;
  readonly list: SkillList;
  readonly own: boolean;
  readonly describedBy: string;
}) {
  const { words } = useLanguage();
  const lang = card.language === undefined ? {} : { lang: card.language };
  const rest = list.count - NAMED;
  return (
    <PopOver
      label={words.text("subjects.skills-head", { count: list.count })}
      caption={
        // The chip of 28 in a button of the target's 44.
        <span className="nt-skill-chip">
          {rest > 0 ? words.text("subjects.skills-more", { count: rest }) : null}
          <Icon value="menu-open" />
        </span>
      }
      buttonLabel={
        rest > 0
          ? words.text("subjects.skills-more", { count: rest })
          : words.text("subjects.skills-head", { count: list.count })
      }
      className="nt-skill-more"
      describedBy={describedBy}
      popClassName="nt-skills-pop"
    >
      {(close) => (
        <>
          <h2 className="nt-pop-heading">
            {words.text("subjects.skills-head", { count: list.count })}
          </h2>
          {list.tiers.map((tier) => (
            <section key={tier.tier ?? "none"} className="nt-skill-tier">
              {tier.tier === undefined ? null : (
                <h3 {...(tier.name === undefined ? {} : lang)}>
                  {tier.name ?? words.text("subjects.tier", { tier: tier.tier })}
                </h3>
              )}
              <ul className="nt-skill-chips" {...lang}>
                {tier.skills.map((skill) => (
                  <li key={skill} className="nt-skill-chip">
                    {skill}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {own && card.digest !== undefined ? (
            <button
              type="button"
              className="nt-link nt-icon-text nt-skills-map"
              onClick={() => {
                close();
                navigate(moduleMapRoute(card.moduleId));
              }}
            >
              <Icon value="skill-map" />
              {words.text("subjects.open-map")}
            </button>
          ) : null}
        </>
      )}
    </PopOver>
  );
}

/** About the module: the facts of its manifest, and Disconnect on a connected one. */
function About({
  card,
  own,
  pending,
  describedBy,
  onDisconnect,
}: {
  readonly card: ModuleCard;
  readonly own: boolean;
  readonly pending: boolean;
  readonly describedBy: string;
  readonly onDisconnect: (moduleId: string) => void;
}) {
  const { language, words } = useLanguage();
  const about = card.about;
  const facts: [string, ReactNode][] =
    about === undefined
      ? []
      : [
          [words.text("subjects.about-version"), about.version],
          [
            words.text("subjects.about-authors"),
            listFormat(language, { type: "conjunction" }).format(about.authors),
          ],
          [words.text("subjects.about-for"), audienceOf(about, words, language)],
          ...(card.language === undefined
            ? []
            : [
                [words.text("subjects.about-language"), nameOf(card.language, language)] as [
                  string,
                  ReactNode,
                ],
              ]),
          [
            words.text("subjects.about-license"),
            <span key="license" lang="en">
              {about.license}
            </span>,
          ],
        ];
  return (
    // The card's focus comes back here once it has moved to its new list: a disconnected module's
    // Connect, a connected one's ⋯.
    <div className="nt-catalog-about" data-module={card.moduleId} data-action="disconnect">
      <PopOver
        label={words.text("subjects.about")}
        icon="about-module"
        describedBy={describedBy}
        popClassName="nt-about-pop"
      >
        {(close) => (
          <>
            <h2 className="nt-pop-heading">{words.text("subjects.about")}</h2>
            {facts.length === 0 ? null : (
              <dl className="nt-facts">
                {facts.map(([name, value]) => (
                  <div key={name}>
                    <dt>{name}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {own ? (
              // Not disabled while a press is under way: a disabled button would drop the focus.
              <button
                type="button"
                className="nt-danger nt-icon-text"
                aria-disabled={pending}
                onClick={() => {
                  if (pending) return;
                  close();
                  onDisconnect(card.moduleId);
                }}
              >
                <Icon value="disconnect" />
                {words.text("subjects.disconnect")}
              </button>
            ) : null}
          </>
        )}
      </PopOver>
    </div>
  );
}

/** A connected module's progress: a square for each skill, and its counts; shapes while they come. */
function Progress({ card }: { readonly card: ModuleCard }) {
  const { words } = useLanguage();
  if (card.counting === true) {
    return (
      <Loading>
        <div className="nt-catalog-progress" aria-hidden="true">
          <Sk width="12rem" height="0.5rem" radius="0.125rem" />
          <Sk width="9rem" height="0.8125rem" radius="0.25rem" />
        </div>
      </Loading>
    );
  }
  const counts = card.skills;
  if (counts === undefined) return null;
  const verdicts = judged(counts);
  const parts =
    verdicts === 0
      ? [words.text("subjects.rubric", { count: counts["feedback-by-criteria"] })]
      : [
          words.text("subjects.mastered", { mastered: counts.mastered, count: verdicts }),
          ...(counts["time-to-review"] > 0
            ? [words.text("subjects.to-review", { count: counts["time-to-review"] })]
            : []),
          ...(counts["in-progress"] > 0
            ? [words.text("subjects.in-progress", { count: counts["in-progress"] })]
            : []),
        ];
  return (
    <div className="nt-catalog-progress">
      <SkillDots counts={counts} />
      <p>{parts.join(" · ")}</p>
    </div>
  );
}

/** A module's card of the catalog, its buttons described by its title. */
function Card({
  card,
  action,
  pending,
  onPress,
}: {
  readonly card: ModuleCard;
  readonly action: CardAction;
  readonly pending: boolean;
  readonly onPress: (moduleId: string) => void;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const own = action === "disconnect";
  const list = card.skillList;
  const line = lineOf(card, words, language);
  const lang = card.language === undefined ? {} : { lang: card.language };
  return (
    <li className="nt-card nt-module nt-catalog-card">
      <article aria-labelledby={id}>
        <div className="nt-module-head">
          <ModuleTile moduleId={card.moduleId} title={card.title} />
          <div className="nt-catalog-name">
            <h3 id={id} {...lang}>
              {card.title}
            </h3>
            {line === "" ? null : <p>{line}</p>}
            {card.digest === undefined ? <p>{words.text("subjects.unavailable")}</p> : null}
          </div>
          {own || card.about !== undefined ? (
            <About
              card={card}
              own={own}
              pending={pending}
              describedBy={id}
              onDisconnect={onPress}
            />
          ) : null}
        </div>
        {list === undefined || list.count === 0 ? null : (
          <div className="nt-catalog-skills">
            <p className="nt-catalog-caps">
              {words.text("subjects.skills-head", { count: list.count })}
            </p>
            <ul className="nt-skill-chips">
              {list.tiers
                .flatMap((tier) => tier.skills)
                .slice(0, NAMED)
                .map((skill) => (
                  <li key={skill} className="nt-skill-chip" {...lang}>
                    {skill}
                  </li>
                ))}
              {list.count > NAMED ? (
                <li>
                  <AllSkills card={card} list={list} own={own} describedBy={id} />
                </li>
              ) : null}
            </ul>
          </div>
        )}
        {own ? <Progress card={card} /> : null}
        <div className="nt-catalog-foot">
          {own ? (
            <p className="nt-connected-mark">
              <Icon value="state-mastered" />
              {words.text("catalog.is-connected")}
            </p>
          ) : (
            // Not disabled while a press is under way: a disabled button would drop the focus.
            <button
              type="button"
              className="nt-icon-text"
              aria-describedby={id}
              aria-disabled={pending}
              data-module={card.moduleId}
              data-action={action}
              onClick={() => {
                if (!pending) onPress(card.moduleId);
              }}
            >
              <Icon value="add" />
              {words.text("subjects.connect")}
            </button>
          )}
          {/* A module connected with a current version has its map. */}
          {own && card.digest !== undefined ? (
            <button
              type="button"
              className="nt-link nt-icon-text"
              aria-describedby={id}
              onClick={() => navigate(moduleMapRoute(card.moduleId))}
            >
              <Icon value="skill-map" />
              {words.text("skillmap.title")}
            </button>
          ) : null}
          {!own && list !== undefined && list.count > 0 ? (
            <p className="nt-catalog-count">
              {words.text("subjects.skill-total", { count: list.count })}
            </p>
          ) : null}
        </div>
      </article>
    </li>
  );
}

/** Two cards of the catalog while its lists are read, in the cards' own frame. */
function CardsLoading() {
  return (
    <Loading>
      <ul className="nt-cards nt-catalog" aria-hidden="true">
        {[0, 1].map((n) => (
          <li key={n} className="nt-card nt-module nt-catalog-card">
            <div className="nt-module-head">
              <Sk width="3.25rem" height="3.25rem" radius="0.9375rem" />
              <div className="nt-loading nt-catalog-loading">
                <Sk width="11rem" height="1.125rem" radius="0.3125rem" />
                <Sk width="7rem" height="0.75rem" radius="0.25rem" />
              </div>
            </div>
            <div className="nt-catalog-foot">
              <Sk width="7rem" height="0.875rem" radius="0.3125rem" />
              <Sk width="8rem" height="var(--nt-target)" radius="999px" />
            </div>
          </li>
        ))}
      </ul>
    </Loading>
  );
}

export interface CatalogScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** The catalog's modules, connected ones too; none while they come. */
  readonly catalog: readonly ModuleCard[] | undefined;
  /** What the last connection or disconnection came to, when it did not answer. */
  readonly failure?: Failure | undefined;
  /** A connection or disconnection under way. */
  readonly pending?: boolean;
  readonly onConnect: (moduleId: string) => void;
  readonly onDisconnect: (moduleId: string) => void;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
}

/** The screen itself, from what its container has read. */
export function CatalogScreen({
  connected,
  catalog,
  failure,
  pending = false,
  onConnect,
  onDisconnect,
  onRetry,
}: CatalogScreenProps) {
  const { language, words } = useLanguage();
  const connectedId = useId();
  const moreId = useId();
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
    <Screen title={words.text("catalog.title")} layout="reference">
      <p className="nt-home-sub">{words.text("catalog.sub")}</p>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
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
        <h2 id={connectedId} className="nt-caps">
          {mine === undefined ? (
            // The count comes with the list: its place a shape till then.
            <>
              {words.pattern("catalog.connected").split("{count}")[0]}
              <Sk width="1.25rem" height="0.75rem" radius="0.25rem" className="nt-sk-inline" />
            </>
          ) : (
            words.text("catalog.connected", { count: mine.length })
          )}
        </h2>
        {mine === undefined ? (
          <CardsLoading />
        ) : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-cards nt-catalog">
            {mine.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="disconnect"
                pending={pending}
                onPress={onDisconnect}
              />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={moreId}>
        <h2 id={moreId} className="nt-caps">
          {words.text("catalog.more")}
        </h2>
        {more === undefined ? (
          <CardsLoading />
        ) : more.length === 0 ? (
          <p>{words.text("subjects.catalog-empty")}</p>
        ) : (
          <ul className="nt-cards nt-catalog">
            {more.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="connect"
                pending={pending}
                onPress={onConnect}
              />
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

/** Subjects of the learner chosen: what api says is connected and in the catalog. */
export function SubjectsPage({ profileId }: { readonly profileId: string }) {
  const modules = useModules(profileId, true);
  if (modules.failed !== undefined) {
    return <ReadFailed failure={modules.failed} onRetry={modules.retry} />;
  }
  return (
    <CatalogScreen
      connected={modules.connected}
      catalog={modules.catalog}
      failure={modules.failure}
      pending={modules.pending}
      onRetry={modules.retry}
      onConnect={modules.connect}
      onDisconnect={modules.disconnect}
    />
  );
}
