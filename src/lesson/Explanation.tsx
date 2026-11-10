// An explanation of a lesson (section 3.4 of docs/architecture.md; R06 in docs/decisions.md): its
// paragraphs and pictures, as a statement's, and from format 0.4 its numbered lists, which app draws
// itself, without the canvas — a picture an <img> with its `alt`, by an address `blob:`, and a list
// an <ol>, whose numbers the list sets, not the text (R111 in spec). All of it is the module's text,
// in its explanation language.
import type { Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { Picture } from "../packages/Picture.tsx";

export function Explanation({
  parts,
  language,
  media,
}: {
  readonly parts: readonly open.ExplanationPart[];
  /** The module's explanation language. */
  readonly language: string | undefined;
  readonly media: Media;
}) {
  return (
    <div className="nt-explanation" {...(language === undefined ? {} : { lang: language })}>
      {parts.map((part, i) => {
        if (part.numbered_list !== undefined) {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parts of an explanation never move.
            <ol key={i}>
              {part.numbered_list.map((item, j) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the items never move, and two may say the same.
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        }
        if (part.picture !== undefined) {
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts of an explanation never move.
          return <Picture key={i} part={part} media={media} />;
        }
        // biome-ignore lint/suspicious/noArrayIndexKey: the parts of an explanation never move.
        return <p key={i}>{part.text}</p>;
      })}
    </div>
  );
}
