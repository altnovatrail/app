// The phone's layout, a width below 600 CSS px (R59 in docs/decisions.md; the mockup's README, «Two
// sizes»), for what CSS alone cannot say: the canvas's attribute `tools-hidden` while the tutor's
// sheet is open (the 2026-11-17 amendment to R148 in spec), and the grabber of that sheet.
import { useSyncExternalStore } from "react";

/** The media query of the phone's layout, as theme.css has it. */
export const NARROW = "(width < 600px)";

function subscribe(changed: () => void): () => void {
  const query = window.matchMedia(NARROW);
  query.addEventListener("change", changed);
  return () => query.removeEventListener("change", changed);
}

/** The window is in the phone's layout now, and the screen draws again when it no longer is. */
export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches);
}
