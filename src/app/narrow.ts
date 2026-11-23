// The phone's layout, a width below 600 CSS px, for what CSS alone cannot say: the canvas's
// attribute `tools-hidden` while the tutor's sheet is open, and the grabber of that
// sheet.
import { useSyncExternalStore } from "react";

/** The media query of the phone's layout, as theme.css has it. */
export const NARROW = "(width < 600px)";

let query: MediaQueryList | undefined;
/** The one list of the query, made at its first reading. */
function narrow(): MediaQueryList {
  query ??= window.matchMedia(NARROW);
  return query;
}

function subscribe(changed: () => void): () => void {
  const list = narrow();
  list.addEventListener("change", changed);
  return () => list.removeEventListener("change", changed);
}

/** The window is in the phone's layout now, and the screen draws again when it no longer is. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => narrow().matches);
}
