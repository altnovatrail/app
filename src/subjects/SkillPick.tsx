// The choice of a module's task skill, the one of its tile on Home and of the pill on the sheet of
// its task: the tutor's choice first, which gives the choice back, then the skills suggested, then
// every skill of the module by its tier, each locked one shut, as on the map. The pill stands at the
// top right of the sheet where a page from paper has its counter: the skill named, or the tutor's
// choice, its sign green while the skill is the learner's own; it opens the same choice, under it
// from 600 CSS px and a sheet from the bottom below.
import { useId } from "react";
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { ModuleCard, SkillPick, SkillPicks } from "./modules.ts";

/** The `lang` of a module's text, where its explanation language is known. */
function langOf(language: string | undefined): { lang?: string } {
  return language === undefined ? {} : { lang: language };
}

/** The skill of a module's picks by its full ID; none when its graph no longer has it. */
function pickOf(picks: SkillPicks | undefined, skill: string): SkillPick | undefined {
  return picks?.tiers.flatMap((tier) => tier.skills).find((each) => each.skill === skill);
}

/** The local ID of a skill's full ID, which names it while its title is not known. */
const localOf = (skill: string) => skill.slice(skill.lastIndexOf("/skill/") + "/skill/".length);

/** The choice of the task skill: the tutor's first, then the skills suggested, then each tier's. */
export function Picker({
  card,
  picks,
  own,
  onTaskSkill,
  close,
}: {
  readonly card: ModuleCard;
  readonly picks: SkillPicks;
  readonly own: string | undefined;
  readonly onTaskSkill: (skill: string) => void;
  readonly close: () => void;
}) {
  const { words } = useLanguage();
  const choose = (skill: string) => {
    close();
    if (skill !== (own ?? "")) onTaskSkill(skill);
  };
  const chip = (pick: SkillPick) => {
    const locked = pick.status === "locked";
    return (
      <button
        key={pick.skill}
        type="button"
        className="nt-pick-chip"
        aria-pressed={pick.skill === own}
        disabled={locked}
        {...(locked ? { "aria-label": words.text("home.pick-locked", { skill: pick.title }) } : {})}
        onClick={() => choose(pick.skill)}
      >
        <span {...langOf(card.language)}>{pick.title}</span>
        {locked ? <Icon value="state-locked" /> : null}
      </button>
    );
  };
  return (
    <>
      <h2 className="nt-pick-title">{words.text("home.pick")}</h2>
      <button
        type="button"
        className="nt-pick-ai"
        aria-pressed={own === undefined}
        onClick={() => choose("")}
      >
        <span className="nt-way-sign" aria-hidden="true">
          <Icon value="task-skill" />
        </span>
        <span className="nt-way-words">
          <span className="nt-way-title">{words.text("home.pick-tutor")}</span>
          <span className="nt-pick-or">{words.text("home.pick-tutor-line")}</span>
        </span>
        {own === undefined ? <Icon value="ticked" /> : null}
      </button>
      <span className="nt-pick-or">{words.text("home.pick-own")}</span>
      {picks.suggested.length === 0 ? null : (
        <>
          <fieldset className="nt-pick-group">
            <legend className="nt-pick-label">{words.text("home.pick-suggested")}</legend>
            <div className="nt-pick-chips">{picks.suggested.map(chip)}</div>
          </fieldset>
          <div className="nt-pick-rule" aria-hidden="true" />
        </>
      )}
      {picks.tiers.map((tier, n) => (
        <fieldset key={tier.name ?? `tier ${n}`} className="nt-pick-group">
          <legend className="nt-pick-label" {...langOf(card.language)}>
            {tier.name ?? words.text("subjects.tier", { tier: n + 1 })}
          </legend>
          <div className="nt-pick-chips">{tier.skills.map(chip)}</div>
        </fieldset>
      ))}
    </>
  );
}

/** The title of the skill `own` of a card, its local ID while its title is not known; none for none. */
export function skillTitle(card: ModuleCard, own: string | undefined): string | undefined {
  return own === undefined ? undefined : (pickOf(card.picks, own)?.title ?? localOf(own));
}

/**
 * The pill of a module's task skill at the top right of the sheet of its task, which opens the
 * choice of it; while the module's skills are on their way, its own shape.
 */
export function SkillPill({
  card,
  onTaskSkill,
}: {
  /** The module's card; none while it comes. */
  readonly card: ModuleCard | undefined;
  /** Sets the task skill, "" giving the choice back to the tutor. */
  readonly onTaskSkill: (skill: string) => void;
}) {
  const { words } = useLanguage();
  const describedBy = useId();
  const picks = card?.picks;
  if (card === undefined || picks === undefined)
    return (
      <Loading className="nt-skill-loading">
        <Sk width="9.5rem" height="2.75rem" radius="1.375rem" />
      </Loading>
    );
  const own = card.taskSkill;
  const title = skillTitle(card, own);
  return (
    <>
      <span id={describedBy} hidden>
        {words.text("home.tasks-pick")}
      </span>
      <PopOver
        label={words.text("home.pick")}
        describedBy={describedBy}
        caption={
          <>
            <span className="nt-skill-sign" data-own={own !== undefined} aria-hidden="true">
              <Icon value="task-skill" />
            </span>
            <span className="nt-skill-name" {...(title === undefined ? {} : langOf(card.language))}>
              {title ?? words.text("paper.skill-tutor")}
            </span>
            <Icon value="menu-open" />
          </>
        }
        className="nt-skill-pill"
        popClassName="nt-pick nt-pick-skill"
        anchor=".nt-solve-nav"
        gap={6}
      >
        {(close) => (
          <Picker card={card} picks={picks} own={own} onTaskSkill={onTaskSkill} close={close} />
        )}
      </PopOver>
    </>
  );
}
