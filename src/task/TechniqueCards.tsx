// The cards of a task's techniques (section 3.3 of docs/architecture.md; R05): the IDs api gave, at a
// step or on request, by their titles and descriptions in the open catalog, in the module's
// explanation language. An ID the catalog does not name has nothing to show.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export function TechniqueCards({
  ids,
  catalog,
  language,
}: {
  readonly ids: readonly string[];
  readonly catalog: open.Techniques | undefined;
  /** The module's explanation language. */
  readonly language: string | undefined;
}) {
  const { words } = useLanguage();
  const lang = language === undefined ? {} : { lang: language };
  const cards = ids.flatMap((id) => {
    const technique = catalog?.techniques[id];
    return technique === undefined ? [] : [{ id, technique }];
  });
  if (cards.length === 0) return null;
  return (
    <ul className="nt-techniques" aria-label={words.text("steps.techniques")}>
      {cards.map(({ id, technique }) => (
        <li key={id} className="nt-card" {...lang}>
          <p className="nt-technique-title">{technique.title}</p>
          {technique.description === undefined ? null : <p>{technique.description}</p>}
        </li>
      ))}
    </ul>
  );
}
