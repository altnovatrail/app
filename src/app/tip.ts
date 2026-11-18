// Where the tooltip of a button that shows an icon alone goes (R60): below the button and centred
// on it, as the mockup's `.tip-b` has it, or above it where only above has room; moved along so
// that it stays 8 CSS px inside the window. The gap to the button is the tooltip's own padding, so
// that the pointer crosses no gap on its way onto it (WCAG 1.4.13, Hoverable). No DOM.
import type { Box } from "./hang.ts";

/** The least room between the tooltip and the window's edges, CSS px. */
export const MARGIN = 8;

/** The window's size, CSS px. */
export interface View {
  readonly width: number;
  readonly height: number;
}

/** The tooltip's place: its corner, and whether it is below the button. */
export interface Place {
  readonly left: number;
  readonly top: number;
  readonly below: boolean;
}

/** The place of a tooltip of `width` × `height` at the button's `box` in the window `view`. */
export function tipAt(box: Box, width: number, height: number, view: View): Place {
  const below = box.bottom + height <= view.height - MARGIN || box.top - height < MARGIN;
  const centred = (box.left + box.right - width) / 2;
  const left = Math.max(MARGIN, Math.min(centred, view.width - MARGIN - width));
  return { left, top: below ? box.bottom : box.top - height, below };
}
