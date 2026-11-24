// The top bar of the page to pick from keeps one row: where its words do not fit beside what was
// found, the title and the captions of the buttons at its end go together, each button its icon
// alone, its caption still its name and now a tooltip too; only where even the icons do not fit
// do the buttons go below the title. The row of the screen of solving keeps one row the same way:
// "Ask" goes to its icon first, and only then does the row wrap. A row is measured, not set by a
// width, since the words of each language differ in length.
import { type Ref, type RefObject, useLayoutEffect } from "react";
import { Icon } from "../app/Icon.tsx";
import type { IconValue } from "../app/icons.ts";
import { useHostRef, useTooltip } from "../app/Tooltip.tsx";

/**
 * How the bar's end or the row stands: with its words, its icons alone, or below — the end under
 * the title, the row wrapped.
 */
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

/**
 * The boxes a row lays out: its children drawn, and those of a child that draws no box itself, as
 * a tooltip's host; not a tooltip, which stands in the top layer.
 */
function laidOut(parent: Element): Element[] {
  return [...parent.children].flatMap((child) =>
    getComputedStyle(child).display === "contents"
      ? laidOut(child)
      : child.getClientRects().length > 0 && !child.hasAttribute("popover")
        ? [child]
        : [],
  );
}

/** Whether the row's buttons stand in one line, none of them wrapped below the others. */
export function inOneRow(row: HTMLElement): boolean {
  const shown = laidOut(row);
  const first = shown[0];
  const last = shown.at(-1);
  if (first === undefined || last === undefined) return true;
  const middle = (box: Element) => {
    const at = box.getBoundingClientRect();
    return at.top + at.height / 2;
  };
  return Math.abs(middle(first) - middle(last)) < 2 && row.scrollWidth <= row.clientWidth + 1;
}

/** Sets on the row, as `data-fit`, the first fit that holds one line; "below", it wraps. */
export function fitRow(row: HTMLElement): Fit {
  for (const fit of ["words", "icons"] as const) {
    row.dataset.fit = fit;
    if (inOneRow(row)) return fit;
  }
  row.dataset.fit = "below";
  return "below";
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
 * Fits `end` by `fitNode` — the end of a bar, or a row —, and again when its parent's width changes,
 * when a web font comes, when a button comes or goes in it, and when `content` — what its words
 * are — changes.
 */
export function useBarFit(
  end: RefObject<HTMLElement | null>,
  content: string,
  fitNode: (node: HTMLElement) => Fit = fitBar,
): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again when the words change.
  useLayoutEffect(() => {
    const node = end.current;
    const bar = node?.parentElement;
    if (node == null || bar == null) return;
    fitNode(node);
    let width = bar.clientWidth;
    let frame = 0;
    let live = true;
    const refit = () => {
      if (bar.clientWidth === width) return;
      width = bar.clientWidth;
      fitNode(node);
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
    // A button that comes later, as the debug button once its code is loaded, fits the row anew.
    const buttons = new MutationObserver(() => fitNode(node));
    buttons.observe(node, { childList: true });
    void document.fonts?.ready.then(() => {
      if (live) fitNode(node);
    });
    return () => {
      live = false;
      window.removeEventListener("resize", refit);
      watch.disconnect();
      buttons.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [end, content, fitNode]);
}

/** Whether the button's caption is hidden, its bar's end fitted to its icons. */
function captionHidden(button: HTMLElement): boolean {
  const fit = button.closest<HTMLElement>("[data-fit]")?.dataset.fit;
  return fit !== undefined && fit !== "words";
}

/**
 * A button of a fitted bar or row: its icon and its caption, which the fit may hide to the eye. A
 * button that opens a panel says so by `expanded`, and gives itself by `buttonRef`.
 */
export function BarButton({
  icon,
  caption,
  onClick,
  className = "nt-glass nt-retake",
  expanded,
  buttonRef,
}: {
  readonly icon: IconValue;
  readonly caption: string;
  readonly onClick: () => void;
  readonly className?: string;
  readonly expanded?: boolean;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}) {
  const tooltip = useTooltip<HTMLButtonElement>(caption, { needed: captionHidden });
  const { host } = tooltip;
  const setButton = useHostRef(host, buttonRef);
  return tooltip.wrap(
    <button
      ref={setButton}
      type="button"
      className={className}
      {...(expanded === undefined ? {} : { "aria-expanded": expanded })}
      onClick={onClick}
      onFocus={tooltip.onFocus}
      onBlur={tooltip.onBlur}
    >
      <Icon value={icon} />
      <span className="nt-retake-words">{caption}</span>
    </button>,
  );
}
