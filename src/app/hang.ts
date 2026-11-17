// Where a pop-over hangs from its button in the tablet's layout (the mockup's README, «Pop-overs, not
// panels»; section 3.9 of docs/architecture.md): below the button, or above it where below has no
// room and above has, or more of it where neither has; at the button's left edge, or at its right
// where the left would leave the window — or, centred, below the button's middle, as the mockup
// hangs the avatars from their button in the middle of the owner's column —; inside the window by
// its margin, where what does not fit scrolls inside the pop-over. It grows from the corner nearest
// the button, or from the middle of its edge. Without DOM.

/** A box in CSS px of the viewport, as `getBoundingClientRect` gives it. */
export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** The place of a pop-over, and the corner it grows from as a `transform-origin`. */
export interface Hung {
  readonly left: number;
  readonly top: number;
  readonly origin: string;
}

/** Between the button and the pop-over, CSS px: the mockup's 12 under its top bar. */
export const GAP = 12;
/** Between the pop-over and the edge of the window, CSS px: the mockup's 16. */
export const MARGIN = 16;

/**
 * The place of a pop-over of `width` × `height` hung from `button` in a window of `view`, `gap`
 * from it: GAP, or the home's 6 below its bar (R63).
 */
export function hang(
  button: Box,
  width: number,
  height: number,
  view: { readonly width: number; readonly height: number },
  centred = false,
  gap = GAP,
): Hung {
  const fitsBelow = button.bottom + gap + height <= view.height - MARGIN;
  const fitsAbove = button.top - gap - height >= MARGIN;
  const below = fitsBelow || (!fitsAbove && view.height - button.bottom >= button.top);
  const start = button.left + width <= view.width - MARGIN;
  const top = below ? button.bottom + gap : button.top - gap - height;
  const left = centred
    ? (button.left + button.right - width) / 2
    : start
      ? button.left
      : button.right - width;
  const side = centred ? "center" : start ? "left" : "right";
  return {
    left: Math.max(MARGIN, Math.min(left, view.width - MARGIN - width)),
    top: Math.max(MARGIN, Math.min(top, view.height - MARGIN - height)),
    origin: `${below ? "top" : "bottom"} ${side}`,
  };
}
