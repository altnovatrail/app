// A module's card on Home (R79; the mockup's `home`, R148 spec): each module connected a card of
// its own — its tile, its title in its own explanation language, its kind, how many of its skills
// are mastered, the skills due for review, the way to its skill map — and under them a square for
// each skill in the colour of its state. The kind is "Sequential" where its skills go in a chain
// (R06), "Feedback by criteria" where no skill has a verdict, and "Adaptive" otherwise; the line
// under the title names the explanation language when it is not the screen's, and a module not
// available (R92 spec). Its Continue goes on with the module's lesson begun, else its task open,
// else asks ChooseNext for the skill to work on, which its map names (ChooseNext takes no module),
// and opens the task the engine gives; with no such skill, or another task open, it opens the map.
// Under a chain, the skill to work on by its place and the next; under an adaptive module, that the
// tutor chooses, from any module — what it gives is known only once it is asked, ChooseNext being
// an action. While its map is on its way, the card's kind, counts, squares and foot are shapes
// (R168 spec).
import { type ReactNode, useId } from "react";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { navigate } from "../app/router.ts";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { listFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import { isScreenLanguage, nameOf } from "./CardHeading.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import type { ModuleCard } from "./modules.ts";
import { type ChainPlace, judged, MARKS, type SkillCounts, STATES } from "./states.ts";

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

/** A square for each skill, named by every state and mark with its count. */
function SkillDots({ counts }: { readonly counts: SkillCounts }) {
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

/** Under a chain's card: the skill to work on by its place, how much is mastered, and the next. */
function ChainFoot({ chain, lang }: { readonly chain: ChainPlace; readonly lang?: string }) {
  const { words } = useLanguage();
  const percent = chain.total === 0 ? 0 : Math.round((chain.mastered / chain.total) * 100);
  const own = lang === undefined ? {} : { lang };
  return (
    <div className="nt-card-foot nt-chain-foot">
      <span className="nt-chain-step">
        {chain.step}
        <small>/{chain.total}</small>
      </span>
      <div className="nt-foot-words">
        <span className="nt-foot-eyebrow">{words.text("home.chain-current")}</span>
        {chain.current === undefined ? (
          <span className="nt-foot-main">{words.text("home.chain-done")}</span>
        ) : (
          <span className="nt-foot-main" {...own}>
            {chain.current}
          </span>
        )}
      </div>
      <div className="nt-chain-share">
        <span className="nt-chain-bar" aria-hidden="true">
          <span style={{ inlineSize: `${percent}%` }} />
        </span>
        {words.text("home.chain-percent", { percent })}
      </div>
      {chain.next === undefined ? null : (
        <div className="nt-chain-next">
          <div className="nt-foot-words">
            <span className="nt-foot-eyebrow">{words.text("home.chain-next")}</span>
            <span className="nt-foot-next" {...own}>
              {chain.next}
            </span>
          </div>
          <span className="nt-chain-arrow" aria-hidden="true">
            <Icon value="next-skill" />
          </span>
        </div>
      )}
    </div>
  );
}

/** Under an adaptive module's card: the tutor chooses, the skills due for review, any module. */
function EngineFoot({ review }: { readonly review: number }) {
  const { words } = useLanguage();
  return (
    <div className="nt-card-foot nt-engine-foot">
      <span className="nt-engine-sign" aria-hidden="true">
        <Icon value="engine" />
      </span>
      <div className="nt-foot-words">
        <span className="nt-foot-eyebrow">{words.text("home.engine-chooses")}</span>
        <span className="nt-foot-main">{words.text("home.engine-what")}</span>
      </div>
      {review > 0 ? (
        <span className="nt-subject-review">{words.text("home.review", { count: review })}</span>
      ) : null}
      <span className="nt-engine-any">
        {words.text("home.engine-any")}
        <Icon value="engine" />
      </span>
    </div>
  );
}

export function HomeCard({
  card,
  onContinue,
}: {
  readonly card: ModuleCard;
  /** Goes on with the module: its lesson begun, its task open, a task of its skill, or its map. */
  readonly onContinue: () => void;
}) {
  const { language, words } = useLanguage();
  const id = useId();
  const counts = card.skills;
  const all = counts === undefined ? 0 : judged(counts);
  const review = counts?.["time-to-review"] ?? 0;
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
  return (
    <li className="nt-subject">
      <article aria-labelledby={id}>
        <div className="nt-subject-head">
          <ModuleTile moduleId={card.moduleId} title={card.title} />
          <div className="nt-subject-words">
            <div className="nt-subject-name">
              <h3 id={id} {...(explanation === undefined ? {} : { lang: explanation })}>
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
          {/* The adaptive card names them in its foot. */}
          {review > 0 && kind !== "adaptive" ? (
            <span className="nt-subject-review">
              {words.text("home.review", { count: review })}
            </span>
          ) : null}
          {/* A module with a current version has its map, and goes on. */}
          {card.digest === undefined ? null : (
            <div className="nt-subject-acts">
              <IconButton
                value="skill-map"
                className="nt-subject-map"
                aria-describedby={id}
                onClick={() => navigate(moduleMapRoute(card.moduleId))}
              />
              <button
                type="button"
                className="nt-subject-go nt-icon-text"
                aria-describedby={id}
                onClick={onContinue}
              >
                <span className="nt-go-sign" aria-hidden="true">
                  <Icon value="play" />
                </span>
                {words.text("home.continue")}
              </button>
            </div>
          )}
        </div>
        {card.counting === true ? (
          <Loading className="nt-counting">
            <Sk width="9.375rem" height="8px" radius="2px" />
            <Sk width="100%" height="3.875rem" radius="1rem" />
          </Loading>
        ) : null}
        {counts === undefined || Object.values(counts).every((n) => n === 0) ? null : (
          <SkillDots counts={counts} />
        )}
        {counts === undefined || kind === "rubric" ? null : card.chain !== undefined ? (
          <ChainFoot
            chain={card.chain}
            {...(explanation === undefined ? {} : { lang: explanation })}
          />
        ) : (
          <EngineFoot review={review} />
        )}
      </article>
    </li>
  );
}
