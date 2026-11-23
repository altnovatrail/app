// The top bar of the page to pick from keeps one row: where its words do not fit beside what was
// found, the title and the captions of the buttons at its end go together, each button its icon
// alone, its caption still its name and now a tooltip too; only where even the icons do not fit
// do the buttons go below the title. The row is measured, not set by a width, since the words of
// each language differ in length.
import { type RefObject, useLayoutEffect } from "react";
import { Icon } from "../app/Icon.tsx";
import type { IconValue } from "../app/icons.ts";
import { useTooltip } from "../app/Tooltip.tsx";

/** How the bar's end stands: with its words, its icons alone, or below the title. */
export type Fit = "words" | "icons" | "below";

/** Whether the bar holds its pill and its end in one row, neither of them cut. */
export function oneRow(bar: HTMLElement, end: HTMLElement): boolean {
  const pill = (bar.firstElementChild ?? end) as HTMLElement;
  const cut = (box: HTMLElement) => box.scrollWidth > box.clientWidth + 1;
  const middle = (box: HTMLElement) => {
    const at = box.getBoundingClientRect();
    return at.top + at.height / 2;
  };
  return Math.abs(middle(pill) - middle(end)) < 2 && !cut(pill) && !cut(end);
}

/** Sets on the bar's end, as `data-fit`, the first fit that holds one row. */
export function fitBar(end: HTMLElement): Fit {
  const bar = end.parentElement;
  for (const fit of ["words", "icons"] as const) {
    end.dataset.fit = fit;
    if (bar === null || oneRow(bar, end)) return fit;
  }
  end.dataset.fit = "below";
  return "below";
}

/**
 * Fits the bar whose end `end` is, and again when the bar's width changes, when a web font comes,
 * and when `content` — what its words are — changes.
 */
export function useBarFit(end: RefObject<HTMLElement | null>, content: string): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again when the words change.
  useLayoutEffect(() => {
    const node = end.current;
    const bar = node?.parentElement;
    if (node == null || bar == null) return;
    fitBar(node);
    let width = bar.clientWidth;
    let frame = 0;
    let live = true;
    const refit = () => {
      if (bar.clientWidth === width) return;
      width = bar.clientWidth;
      fitBar(node);
    };
    // The window's resize comes before the frame is drawn, so no frame shows the old fit; the
    // observer, for a width the window does not change, fits on the next frame, outside its
    // callback, since the fit changes the bar's height.
    window.addEventListener("resize", refit);
    const watch = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refit);
    });
    watch.observe(bar);
    void document.fonts?.ready.then(() => {
      if (live) fitBar(node);
    });
    return () => {
      live = false;
      window.removeEventListener("resize", refit);
      watch.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [end, content]);
}

/** Whether the button's caption is hidden, its bar's end fitted to its icons. */
function captionHidden(button: HTMLElement): boolean {
  const fit = button.closest<HTMLElement>("[data-fit]")?.dataset.fit;
  return fit !== undefined && fit !== "words";
}

/** A button at the bar's end: its icon and its caption, which the fit may hide to the eye. */
export function BarButton({
  icon,
  caption,
  onClick,
}: {
  readonly icon: IconValue;
  readonly caption: string;
  readonly onClick: () => void;
}) {
  const tooltip = useTooltip<HTMLButtonElement>(caption, { needed: captionHidden });
  return tooltip.wrap(
    <button
      ref={tooltip.host}
      type="button"
      className="nt-glass nt-retake"
      onClick={onClick}
      onFocus={tooltip.onFocus}
      onBlur={tooltip.onBlur}
    >
      <Icon value={icon} />
      <span className="nt-retake-words">{caption}</span>
    </button>,
  );
}
