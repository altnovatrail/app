// The tooltip of a control whose words do not show: a button of the closed list,
// and a place of the row of places while it shows its icon alone. The tooltip is app's own, white
// on an opaque #1d1d1f, and holds WCAG 1.4.13: it comes on pointer hover and on
// keyboard focus, stays while the pointer is over it, and Escape dismisses it without moving the
// pointer or the focus. It sits in the top layer, so that no box or dialog around the control
// clips it, and it hides no content but while it is wanted.
import {
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { tipAt } from "./tip.ts";

/** How long the pointer or the focus stays before the tooltip comes, as the mockup's `.tip`. */
export const TIP_DELAY_MS = 300;

export interface Tooltip<E extends HTMLElement> {
  /** The control the tooltip names. */
  readonly host: RefObject<E | null>;
  /** The control's focus and blur, which bring the tooltip and take it away. */
  readonly onFocus: (event: FocusEvent<E>) => void;
  readonly onBlur: () => void;
  /** The control in the host that the pointer hovers, with the tooltip inside it. */
  readonly wrap: (control: ReactNode) => ReactNode;
}

/**
 * The tooltip of `words` for a control. Not while what the control opens is `open`: a tooltip in
 * the top layer would stand over its dialog; nor where `needed` says the control shows its words.
 */
export function useTooltip<E extends HTMLElement>(
  words: string,
  {
    open = false,
    needed,
  }: { readonly open?: boolean; readonly needed?: (control: E) => boolean } = {},
): Tooltip<E> {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const host = useRef<E>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const wanted = hover || focus;
  const ask = useRef(needed);
  ask.current = needed;

  // It comes once the pointer or the focus has stayed; it goes, and Escape's dismissal is over,
  // once neither is on the control or on it.
  useEffect(() => {
    if (!wanted) {
      setShown(false);
      setDismissed(false);
      return;
    }
    const timer = setTimeout(() => {
      const control = host.current;
      setShown(control !== null && (ask.current?.(control) ?? true));
    }, TIP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [wanted]);

  const visible = shown && !dismissed && !open;

  useLayoutEffect(() => {
    const drawn = tip.current;
    const from = host.current;
    if (!visible || drawn === null || from === null) return;
    // The top layer, where the engine has it: a pop-over's dialog or a scrolling box does not clip
    // it.
    const layered = typeof drawn.showPopover === "function";
    if (layered && !drawn.matches(":popover-open")) drawn.showPopover();
    const place = () => {
      const at = tipAt(from.getBoundingClientRect(), drawn.offsetWidth, drawn.offsetHeight, {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });
      drawn.style.left = `${at.left}px`;
      drawn.style.top = `${at.top}px`;
      drawn.dataset.side = at.below ? "below" : "above";
    };
    place();
    // Escape dismisses the tooltip; with the focus on the control, it alone, not the dialog the
    // control may stand in. With the focus elsewhere, under a tooltip of hover, Escape goes on
    // there.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.activeElement === from) {
        event.preventDefault();
        event.stopPropagation();
      }
      setDismissed(true);
    };
    // Placed again when its words or the control's box change size, as with a new language.
    const resized = new ResizeObserver(() => place());
    resized.observe(drawn);
    resized.observe(from);
    window.addEventListener("keydown", dismiss, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      resized.disconnect();
      window.removeEventListener("keydown", dismiss, true);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      if (layered && drawn.matches(":popover-open")) drawn.hidePopover();
    };
  }, [visible]);

  return {
    host,
    onFocus: (event) => {
      // The keyboard's focus, not a click's: a click has the pointer's hover already. A new focus
      // brings back a tooltip that Escape dismissed, under the pointer too.
      if (event.currentTarget.matches(":focus-visible")) {
        setFocus(true);
        setDismissed(false);
      }
    },
    onBlur: () => setFocus(false),
    wrap: (control) => (
      // The pointer that leaves the control for its tooltip leaves neither: the tooltip is inside.
      <span
        className="nt-tip-host"
        onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => {
          // A finger has no hover: a tap shows no tooltip, which would only flash.
          if (event.pointerType !== "touch") setHover(true);
        }}
        onPointerLeave={() => setHover(false)}
      >
        {control}
        {visible ? (
          // The same words as the name, which the control carries: the tooltip is not read again.
          <span ref={tip} className="nt-tooltip" popover="manual" aria-hidden="true">
            <span>{words}</span>
          </span>
        ) : null}
      </span>
    ),
  };
}
