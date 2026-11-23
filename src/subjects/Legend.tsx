// The legend of a module's skills (the mockup's `home` and `home-legend`): each
// state its colour, its icon and its word, and each mark its icon and its word, the words and icons
// the skill map shows too: below the modules from 600 CSS px, and on a phone behind a button, as a
// sheet.
import { Icon } from "../app/Icon.tsx";
import { PopOver } from "../app/PopOver.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { MARKS, STATES } from "./states.ts";

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
