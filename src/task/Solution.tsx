// The solution of a task solved (section 3.3 of docs/architecture.md; R05 in spec): its paragraphs
// and pictures, as its statement's, in the module's explanation language; a picture as
// ../packages/Picture.tsx shows it.
import type { Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Picture } from "../packages/Picture.tsx";

export function Solution({
  parts,
  language,
  media,
}: {
  readonly parts: readonly open.StatementPart[];
  /** The module's explanation language, the solution's `lang`. */
  readonly language: string | undefined;
  readonly media: Media;
}) {
  const { words } = useLanguage();
  const id = useId();
  if (parts.length === 0) return null;
  return (
    <section aria-labelledby={id} className="nt-solution">
      <h2 id={id}>{words.text("task.solution")}</h2>
      <div {...(language === undefined ? {} : { lang: language })}>
        {parts.map((part, i) =>
          part.picture === undefined ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a solution never move.
            <p key={i}>{part.text}</p>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of a solution never move.
            <Picture key={i} part={part} media={media} />
          ),
        )}
      </div>
    </section>
  );
}
