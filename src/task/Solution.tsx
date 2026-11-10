// The solution of a task solved (section 3.3 of docs/architecture.md; R05 in spec): its paragraphs
// and pictures, as its statement's, in the module's explanation language. A picture's file comes by
// the canvas's own `media`, and shows at an address `blob:`, which the CSP lets <img> take (section
// 3.7); until it comes, or if it never does, its `alt` stands in its place.
import type { Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** A picture of the module, by its path from media/. */
function Picture({ part, media }: { readonly part: open.StatementPart; readonly media: Media }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const path = part.picture;
  useEffect(() => {
    if (path === undefined) return;
    let current = true;
    let made: string | undefined;
    media(path).then(
      (blob) => {
        if (!current) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      },
      () => {},
    );
    return () => {
      current = false;
      if (made !== undefined) URL.revokeObjectURL(made);
    };
  }, [media, path]);
  if (url === undefined) return part.alt ? <p>{part.alt}</p> : null;
  return (
    <img
      src={url}
      alt={part.alt ?? ""}
      {...(part.width === undefined ? {} : { width: part.width })}
      {...(part.height === undefined ? {} : { height: part.height })}
    />
  );
}

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
