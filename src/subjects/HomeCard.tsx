// A module's card on Home (the mockup's `home`): each module connected a card of
// its own — its tile, its title in its own explanation language, its kind, how many of its skills
// are mastered, the way to its skill map —, under them a square for each skill in the colour of its
// state, and the module's two ways in. The kind is "Sequential" where its skills go in a chain,
// "Feedback by criteria" where no skill has a verdict, and "Adaptive" otherwise; the line
// under the title names the explanation language when it is not the screen's, and a module not
// available, which has no way in. The tile of its lesson names the lesson `ListLessons` gives for
// it, its step and Continue, and its row leads to the page of the module's lessons; a module with
// no lessons has none. The tile of its tasks, green, names the skill they train — the tutor's
// choice, or the learner's own, the module's task skill —, its row opens the choice of it, where
// the tutor's gives the choice back, and Solve gives a task of the module alone. A module solved on
// the sheet has the tile of its tasks alone, with no choice: Solve opens its page of tasks. While
// its map or its lessons are on their way, the card's kind, counts, squares and tiles are shapes.
import { type ReactNode, useId } from "react";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { navigate } from "../app/router.ts";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { listFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import { isScreenLanguage, nameOf } from "./CardHeading.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import type { LessonTile, ModuleCard } from "./modules.ts";
import { Picker, skillTitle } from "./SkillPick.tsx";
import { judged, MARKS, type SkillCounts, STATES } from "./states.ts";

/** The squares of a module's skills, in the order of the legend's states and marks. */
function squaresOf(counts: SkillCounts): ReactNode[] {
  const squares: ReactNode[] = [];
  for (const status of [...STATES, ...MARKS]) {
    for (let n = 1; n <= counts[status]; n++) {
      squares.push(<i key={`${status} ${n}`} data-state={status} />);
    }
  }
  return squares;
}

/** A square for each skill, named by every state and mark with its count: Home's card and Subjects'. */
export function SkillDots({ counts }: { readonly counts: SkillCounts }) {
  const { language, words } = useLanguage();
  const named = listFormat(language, { type: "unit" }).format(
    [...STATES, ...MARKS]
      .filter((status) => counts[status] > 0)
      .map((status) =>
        words.text("subjects.skill-count", {
          state: words.text(`skill-state.${status}`),
          count: counts[status],
        }),
      ),
  );
  return (
    <div className="nt-dots" role="img" aria-label={words.text("subjects.skills", { list: named })}>
      {squaresOf(counts)}
    </div>
  );
}

/** The `lang` of a module's text, where its explanation language is known. */
function langOf(language: string | undefined): { lang?: string } {
  return language === undefined ? {} : { lang: language };
}

/** The tile of a module's lesson: its row to the page of lessons, its step and Continue. */
function LessonMode({
  card,
  lesson,
  onLesson,
  onLessons,
}: {
  readonly card: ModuleCard;
  readonly lesson: LessonTile;
  readonly onLesson: () => void;
  readonly onLessons: () => void;
}) {
  const { words } = useLanguage();
  const titleId = useId();
  const allId = useId();
  const percent = Math.round((lesson.step / Math.max(1, lesson.segments)) * 100);
  return (
    <section className="nt-way" data-mode="lesson" aria-label={words.text("home.lesson")}>
      {/* Each button is named by its words and described by what it leads to. */}
      <span id={allId} hidden>
        {words.text("home.lessons-all", { module: card.title })}
      </span>
      <button type="button" className="nt-way-row" aria-describedby={allId} onClick={onLessons}>
        <span className="nt-way-sign" aria-hidden="true">
          <Icon value="lesson" />
        </span>
        <span className="nt-way-words">
          <span className="nt-way-eyebrow">{words.text("home.lesson")}</span>
          <span id={titleId} className="nt-way-title" {...langOf(card.language)}>
            {lesson.title}
          </span>
        </span>
        <span className="nt-way-chev" aria-hidden="true">
          <Icon value="more" />
        </span>
      </button>
      <div className="nt-way-foot">
        <div className="nt-way-note">
          <span className="nt-way-bar" aria-hidden="true">
            <i style={{ inlineSize: `${percent}%` }} />
          </span>
          {words.text("home.lesson-step", { step: lesson.step, count: lesson.segments })}
        </div>
        <button type="button" className="nt-way-go" aria-describedby={titleId} onClick={onLesson}>
          <span className="nt-go-sign" aria-hidden="true">
            <Icon value="play" />
          </span>
          {words.text("home.continue")}
        </button>
      </div>
    </section>
  );
}

/** The tile of a module's tasks: its row to the choice of their skill, the way back to the tutor's, Solve. */
function TasksMode({
  card,
  titleId,
  onSolve,
  onTaskSkill,
}: {
  readonly card: ModuleCard;
  /** The ID of the card's title, which describes Solve. */
  readonly titleId: string;
  readonly onSolve: () => void;
  readonly onTaskSkill: (skill: string) => void;
}) {
  const { words } = useLanguage();
  const pickId = useId();
  const own = card.sheet === true ? undefined : card.taskSkill;
  // A module solved on the sheet begins its tasks all at once: there is no skill to choose.
  const picks = card.sheet === true ? undefined : card.picks;
  const title = skillTitle(card, own);
  const row = (
    <>
      <span className="nt-way-sign" aria-hidden="true">
        <Icon value="task-skill" />
      </span>
      <span className="nt-way-words">
        <span className="nt-way-eyebrow">
          {words.text(own === undefined ? "home.tasks" : "home.tasks-own")}
        </span>
        <span className="nt-way-title" {...(title === undefined ? {} : langOf(card.language))}>
          {title ?? words.text("home.tasks-tutor")}
        </span>
      </span>
    </>
  );
  return (
    <section
      className="nt-way"
      data-mode="tasks"
      data-own={own !== undefined}
      aria-label={words.text("home.tasks")}
    >
      {picks === undefined ? (
        <div className="nt-way-row">{row}</div>
      ) : (
        <PopOver
          label={words.text("home.pick")}
          describedBy={pickId}
          caption={
            <>
              {row}
              <span className="nt-way-chev" aria-hidden="true">
                <Icon value="more" />
              </span>
            </>
          }
          className="nt-way-row"
          popClassName="nt-pick"
          anchor=".nt-way"
          fitAnchor
        >
          {(close) => (
            <Picker card={card} picks={picks} own={own} onTaskSkill={onTaskSkill} close={close} />
          )}
        </PopOver>
      )}
      {picks === undefined ? null : (
        <span id={pickId} hidden>
          {words.text("home.tasks-pick")}
        </span>
      )}
      <div className="nt-way-foot">
        <div className="nt-way-note">
          {words.text(own === undefined ? "home.tasks-sub-tutor" : "home.tasks-sub-own")}
        </div>
        <button type="button" className="nt-way-go" aria-describedby={titleId} onClick={onSolve}>
          <span className="nt-go-sign" aria-hidden="true">
            <Icon value="play" />
          </span>
          {words.text("home.solve")}
        </button>
      </div>
    </section>
  );
}

/** The shapes of a card's two tiles, inside a part being read. */
export function ModeShapes() {
  return [0, 1].map((n) => (
    <div key={n} className="nt-way nt-way-loading" aria-hidden="true">
      <span className="nt-way-shape">
        <Sk width="2.25rem" height="2.25rem" radius="50%" />
        <span className="nt-way-words nt-loading">
          <Sk width="4rem" height="0.625rem" radius="0.25rem" />
          <Sk width="11rem" height="0.875rem" radius="0.3125rem" />
        </span>
      </span>
      <span className="nt-way-foot">
        <span className="nt-way-note nt-loading">
          <Sk width="70%" height="0.625rem" radius="0.25rem" />
        </span>
        <Sk width="7.5rem" height="2.75rem" radius="999px" />
      </span>
    </div>
  ));
}

export interface HomeCardProps {
  readonly card: ModuleCard;
  /** Goes on with the lesson its tile names: its open run, or a new run of it. */
  readonly onLesson: (lesson: LessonTile) => void;
  /** Opens the page of the module's lessons. */
  readonly onLessons: () => void;
  /** Solve: a task of the module alone, or its page of tasks on the sheet. */
  readonly onSolve: () => void;
  /** Sets the module's task skill, "" giving the choice back to the tutor. */
  readonly onTaskSkill: (skill: string) => void;
  /** What a way in came to, under the tiles: a question, nothing to offer, a failure. */
  readonly note?: ReactNode;
}

export function HomeCard({ card, onLesson, onLessons, onSolve, onTaskSkill, note }: HomeCardProps) {
  const { language, words } = useLanguage();
  const id = useId();
  const counts = card.skills;
  const all = counts === undefined ? 0 : judged(counts);
  const kind =
    counts !== undefined && all === 0
      ? "rubric"
      : card.sequential === true
        ? "sequential"
        : "adaptive";
  const explanation = card.language;
  const stat = [
    ...(counts === undefined
      ? []
      : all === 0
        ? [words.text("subjects.rubric", { count: counts["feedback-by-criteria"] })]
        : [words.text("subjects.mastered", { mastered: counts.mastered, count: all })]),
    ...(explanation === undefined || isScreenLanguage(explanation, language)
      ? []
      : [
          words.text("subjects.explanation-language", {
            language: nameOf(explanation, language),
          }),
        ]),
    ...(card.digest === undefined ? [words.text("subjects.unavailable")] : []),
  ];
  const lesson = card.lesson;
  const waiting = card.counting === true || lesson === undefined;
  return (
    <li className="nt-subject">
      <article aria-labelledby={id}>
        <div className="nt-subject-head">
          <ModuleTile moduleId={card.moduleId} title={card.title} />
          <div className="nt-subject-words">
            <div className="nt-subject-name">
              <h3 id={id} {...langOf(explanation)}>
                {card.title}
              </h3>
              {card.counting === true ? (
                <Sk width="6.5rem" height="1.5rem" radius="999px" />
              ) : (
                <span className="nt-subject-kind" data-kind={kind}>
                  {kind === "rubric" ? null : (
                    <Icon value={kind === "adaptive" ? "engine" : "chain"} />
                  )}
                  {words.text(
                    kind === "rubric" ? "skill-state.feedback-by-criteria" : `home.${kind}`,
                  )}
                </span>
              )}
            </div>
            {card.counting === true && stat.length === 0 ? (
              <p className="nt-subject-stat">
                <Sk width="9rem" height="0.8125rem" radius="0.25rem" />
              </p>
            ) : stat.length === 0 ? null : (
              <p className="nt-subject-stat">{stat.join(" · ")}</p>
            )}
          </div>
          {/* A module with a current version has its map, and its ways in. */}
          {card.digest === undefined ? null : (
            <div className="nt-subject-acts">
              <IconButton
                value="skill-map"
                className="nt-subject-map"
                aria-describedby={id}
                onClick={() => navigate(moduleMapRoute(card.moduleId))}
              />
            </div>
          )}
        </div>
        {card.counting === true ? (
          <Loading className="nt-counting">
            <Sk width="9.375rem" height="8px" radius="2px" />
          </Loading>
        ) : null}
        {counts === undefined || Object.values(counts).every((n) => n === 0) ? null : (
          <SkillDots counts={counts} />
        )}
        {card.digest === undefined ? null : waiting ? (
          <Loading className="nt-ways">
            <ModeShapes />
          </Loading>
        ) : (
          <div className="nt-ways">
            {lesson === null ? null : (
              <LessonMode
                card={card}
                lesson={lesson}
                onLesson={() => onLesson(lesson)}
                onLessons={onLessons}
              />
            )}
            <TasksMode card={card} titleId={id} onSolve={onSolve} onTaskSkill={onTaskSkill} />
          </div>
        )}
        {note}
      </article>
    </li>
  );
}
