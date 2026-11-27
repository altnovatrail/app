// The grabber of a phone's sheet — the tutor's and Debug's: a tap turns the sheet between half the
// window and the whole of it; a drag moves its top with the finger, from a third of the window up
// to its top, and once let go the sheet stands at whichever of the two is nearer. The sheet's
// height while dragged is its inline style alone, so React draws nothing in between.
import { type PointerEvent, useRef } from "react";

/** How far a press goes before it is a drag and not a tap, CSS px. */
export const DRAG_PX = 6;

/** The sheet's height at half, a share of the window's, as the style's 51dvh. */
const HALF = 0.51;

/** The lowest a dragged sheet goes, a share of the window's height. */
const LOWEST = 0.3;

/** How long after a drag the click its release may still send is the drag's, not a tap, ms. */
const CLICK_AFTER_MS = 500;

interface Drag {
  readonly id: number;
  readonly y: number;
  readonly height: number;
  readonly sheet: HTMLElement;
  moved: boolean;
}

/** Whether a sheet let go at `height` stands at full: nearer the window's height than half of it. */
export function fullAt(height: number, window: number): boolean {
  return height > ((HALF + 1) / 2) * window;
}

/**
 * The grabber's handlers, for the sheet that `sheet` finds above it: a tap calls `setFull` with the
 * other size, a drag with the size nearer where it was let go.
 */
export function useGrabber(
  sheet: string,
  full: boolean,
  setFull: (full: boolean) => void,
): {
  readonly onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  readonly onClick: () => void;
} {
  const drag = useRef<Drag | undefined>(undefined);
  // When a drag last ended, so that the click its release sends does not turn the sheet again.
  const dragged = useRef(Number.NEGATIVE_INFINITY);
  const end = (event: PointerEvent<HTMLElement>, kept: boolean) => {
    const was = drag.current;
    if (was === undefined || was.id !== event.pointerId) return;
    drag.current = undefined;
    was.sheet.style.removeProperty("block-size");
    if (!was.moved) return;
    dragged.current = performance.now();
    if (kept) setFull(fullAt(was.height - (event.clientY - was.y), window.innerHeight));
  };
  return {
    onPointerDown: (event) => {
      const found = event.currentTarget.closest<HTMLElement>(sheet);
      if (found === null || !event.isPrimary) return;
      // Captured, so that the drag goes on past the grabber; a pointer the browser does not know
      // as active, as a test's, cannot be, and the drag goes on by the grabber's own events.
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Not captured.
      }
      drag.current = {
        id: event.pointerId,
        y: event.clientY,
        height: found.getBoundingClientRect().height,
        sheet: found,
        moved: false,
      };
    },
    onPointerMove: (event) => {
      const was = drag.current;
      if (was === undefined || was.id !== event.pointerId) return;
      const by = event.clientY - was.y;
      if (!was.moved && Math.abs(by) < DRAG_PX) return;
      was.moved = true;
      const height = Math.min(
        window.innerHeight,
        Math.max(window.innerHeight * LOWEST, was.height - by),
      );
      was.sheet.style.blockSize = `${height}px`;
    },
    onPointerUp: (event) => end(event, true),
    onPointerCancel: (event) => end(event, false),
    onClick: () => {
      if (performance.now() - dragged.current < CLICK_AFTER_MS) return;
      setFull(!full);
    },
  };
}
