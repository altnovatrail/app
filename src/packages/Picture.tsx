// A picture of a module, by its path from media/ (sections 3.3 and 3.4 of docs/architecture.md): of
// a task's solution or of a lesson's explanation, which app draws itself, without the canvas. Its
// file comes by the canvas's own `media`, and shows at an address `blob:`, which the CSP lets <img>
// take (section 3.7); until it comes, or if it never does, its `alt` stands in its place.
import type { Media } from "@altnovatrail/spec/canvas";
import { useEffect, useState } from "react";

/** What a part of a statement, a solution or an explanation says of its picture. */
export interface PicturePart {
  readonly picture?: string;
  readonly alt?: string;
  readonly width?: number;
  readonly height?: number;
}

export function Picture({ part, media }: { readonly part: PicturePart; readonly media: Media }) {
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
