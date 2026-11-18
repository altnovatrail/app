// What a module's card shows of its skills, and the legend of it (R62; the mockup's `home` and
// `home-legend`; R148 spec): the bar of the five states of its skills with a verdict, each segment
// in its colour of the mockup's «Contrast» and 2 px of white between them, named by every state and
// mark with its count; beside it, in words, how many are mastered and how many are due for review;
// for a module whose skills have no verdict, the mark in place of the bar. The legend gives each
// state its colour, its icon and its word, and each mark its icon and its word, the words and icons
// the skill map shows too: below the modules from 600 CSS px, and on a phone behind a button, as a
// sheet.
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { listFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { judged, MARKS, type SkillCounts, STATES, segmentsOf } from "./states.ts";

/** The bar and the words of a module's skills; nothing for a module with no skill to count. */
export function SkillBar({ counts }: { readonly counts: SkillCounts }) {
  const { language, words } = useLanguage();
  if (Object.values(counts).every((count) => count === 0)) return null;
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
  const all = judged(counts);
  if (all === 0) {
    const rubric = counts["feedback-by-criteria"];
    const mark = rubric > 0 ? "feedback-by-criteria" : "not-assessed";
    return (
      <div className="nt-skills">
        <p className="nt-skills-mark">
          <Icon value={`state-${mark}`} />
          {words.text(`skill-state.${mark}`)}
        </p>
        {rubric > 0 ? (
          <p className="nt-skills-words">{words.text("subjects.rubric", { count: rubric })}</p>
        ) : null}
      </div>
    );
  }
  const review = counts["time-to-review"];
  return (
    <div className="nt-skills">
      <div
        className="nt-skills-bar"
        role="img"
        aria-label={words.text("subjects.skills", { list: named })}
      >
        {segmentsOf(counts).map(({ state, percent }) => (
          <span key={state} data-state={state} style={{ inlineSize: `${percent}%` }} />
        ))}
      </div>
      <p className="nt-skills-words">
        {[
          words.text("subjects.mastered", { mastered: counts.mastered, count: all }),
          ...(review > 0 ? [words.text("subjects.review", { count: review })] : []),
        ].join(" · ")}
      </p>
    </div>
  );
}

/** The legend's items: each state with its colour, its icon and its word, then each mark. */
function LegendItems() {
  const { words } = useLanguage();
  return (
    <ul className="nt-legend-items">
      {[...STATES, ...MARKS].map((status) => (
        <li key={status} data-state={status}>
          {(STATES as readonly string[]).includes(status) ? (
            <span className="nt-legend-swatch" aria-hidden="true" />
          ) : null}
          <Icon value={`state-${status}`} />
          {words.text(`skill-state.${status}`)}
        </li>
      ))}
    </ul>
  );
}

/** What the marks mean: in place from 600 CSS px, and on a phone behind its button. */
export function Legend() {
  const { words } = useLanguage();
  const title = words.text("subjects.legend");
  return (
    <>
      <section className="nt-legend" aria-label={title}>
        <LegendItems />
      </section>
      <div className="nt-legend-open">
        <PopOver
          label={title}
          className="nt-link"
          popClassName="nt-pop-legend"
          caption={
            <>
              <Icon value="legend" />
              {title}
            </>
          }
        >
          <h2 className="nt-pop-title">{title}</h2>
          <LegendItems />
        </PopOver>
      </div>
    </>
  );
}
