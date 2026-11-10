// The hint asked for before the first wrong answer (section 3.3 of docs/architecture.md; R82, R108
// in spec): what the task gives and asks to find, from its open view; the cards of its techniques,
// which api gave, from the open catalog; and its leading question, the author's question that
// breaks the task down, in the module's explanation language. After a wrong answer the hint is the
// words of the current rung again, which the block "Tutor" shows. Nothing of it needs the key.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { TechniqueCards } from "./TechniqueCards.tsx";

/** A hint api gave: the IDs of the task's techniques, and its leading question if it has one. */
export interface HintGiven {
  readonly techniques: readonly string[];
  readonly question?: string;
}

export function Hint({
  hint,
  task,
  catalog,
  language,
}: {
  readonly hint: HintGiven;
  readonly task: open.Task;
  readonly catalog: open.Techniques | undefined;
  /** The module's explanation language. */
  readonly language: string | undefined;
}) {
  const { words } = useLanguage();
  const id = useId();
  const lang = language === undefined ? {} : { lang: language };
  const givens = task.givens ?? [];
  // Nothing to hint is what api said, not what the catalog on the device happens to name.
  const nothing = hint.techniques.length === 0 && hint.question === undefined;
  return (
    <section aria-labelledby={id} className="nt-tutor">
      <h2 id={id}>{words.text("task.hint")}</h2>
      {givens.length === 0 ? null : (
        <>
          <p className="nt-hint-label">{words.text("steps.givens")}</p>
          <ul className="nt-hint-list">
            {givens.map((given, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the givens never move, and two may say the same.
              <li key={i} {...lang}>
                {given}
              </li>
            ))}
          </ul>
        </>
      )}
      {task.unknown === undefined ? null : (
        <>
          <p className="nt-hint-label">{words.text("steps.unknown")}</p>
          <p {...lang}>{task.unknown}</p>
        </>
      )}
      <TechniqueCards ids={hint.techniques} catalog={catalog} language={language} />
      {hint.question === undefined ? null : <p {...lang}>{hint.question}</p>}
      {nothing ? <p className="nt-hint">{words.text("task.hint-none")}</p> : null}
    </section>
  );
}
