// A button that shows its icon alone (R60 in docs/decisions.md; section 3.9 of
// docs/architecture.md): only the buttons of the closed list of R90 in spec, each with its caption
// as its accessible name and a tooltip of the same words. The tooltip is app's own, white on an
// opaque #1d1d1f (the third 2026-11-17 amendment to R148 in spec), and holds WCAG 1.4.13: it comes
// on pointer hover and on keyboard focus, stays while the pointer is over it, and Escape dismisses
// it without moving the pointer or the focus. It sits in the top layer, so that no box or dialog
// around the button clips it, and it hides no content but while it is wanted.
import {
  type ComponentProps,
  type FocusEvent,
  type PointerEvent,
  type Ref,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Key } from "../i18n/words.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { tipAt } from "./tip.ts";

/**
 * The closed list (the 2026-11-14 amendments to R90 in spec): each button that shows no caption,
 * its icon — none for the grabber, which draws a bar — and the caption that names it. A button
 * joins the list only by an amendment to R90 in spec, and then to R60 here.
 */
export const CAPTIONLESS = {
  back: { icon: "back", word: "icon.back" },
  close: { icon: "close", word: "common.close" },
  "previous-task": { icon: "previous-task", word: "icon.previous-task" },
  "next-task": { icon: "next-task", word: "icon.next-task" },
  "read-aloud": { icon: "read-aloud", word: "voice.read" },
  voicing: { icon: "voicing", word: "voice.toggle" },
  help: { icon: "help", word: "icon.help" },
  tutor: { icon: "tutor", word: "icon.tutor" },
  // The grabber of the tutor's sheet on a phone, 88 × 44, named by what it does next.
  "full-screen": { icon: undefined, word: "icon.full-screen" },
  "half-screen": { icon: undefined, word: "icon.half-screen" },
} as const satisfies Record<string, { icon: IconValue | undefined; word: Key }>;

/** A button of the closed list. */
export type Captionless = keyof typeof CAPTIONLESS;

/** How long the pointer or the focus stays before the tooltip comes, as the mockup's `.tip`. */
export const TIP_DELAY_MS = 300;

export interface IconButtonProps
  extends Omit<ComponentProps<"button">, "children" | "type" | "ref"> {
  /** Which button of the list it is: its icon and its name. */
  readonly value: Captionless;
  /** Whether what it stands for is chosen, on or open: then its icon is the fill, where it has one. */
  readonly chosen?: boolean;
  /** The button itself, for what opens from it: a pop-over that gives the focus back to it. */
  readonly ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  value,
  chosen = false,
  className,
  onFocus,
  onBlur,
  ref,
  ...button
}: IconButtonProps) {
  const { words } = useLanguage();
  const { icon, word } = CAPTIONLESS[value];
  const caption = words.text(word);
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const host = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const wanted = hover || focus;
  // The tooltip's own ref and the one given, on the same button.
  const setButton = useCallback(
    (node: HTMLButtonElement | null) => {
      host.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref != null) ref.current = node;
    },
    [ref],
  );

  // It comes once the pointer or the focus has stayed; it goes, and Escape's dismissal is over,
  // once neither is on the button or on it.
  useEffect(() => {
    if (!wanted) {
      setShown(false);
      setDismissed(false);
      return;
    }
    const timer = setTimeout(() => setShown(true), TIP_DELAY_MS);
    return () => clearTimeout(timer);
  }, [wanted]);

  const visible = shown && !dismissed;

  useLayoutEffect(() => {
    const drawn = tip.current;
    const from = host.current;
    if (!visible || drawn === null || from === null) return;
    // The top layer, where the engine has it: a pop-over's dialog or a scrolling box does not clip it.
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
    // Escape dismisses the tooltip; with the focus on the button, it alone, not the dialog the
    // button may stand in. With the focus elsewhere, under a tooltip of hover, Escape goes on there.
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.activeElement === from) {
        event.preventDefault();
        event.stopPropagation();
      }
      setDismissed(true);
    };
    // Placed again when its words or the button's box change size, as with a new language.
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

  return (
    // The pointer that leaves the button for its tooltip leaves neither: the tooltip is inside.
    <span
      className="nt-tip-host"
      onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => {
        // A finger has no hover: a tap shows no tooltip, which would only flash.
        if (event.pointerType !== "touch") setHover(true);
      }}
      onPointerLeave={() => setHover(false)}
    >
      <button
        ref={setButton}
        type="button"
        className={["nt-icon-only", icon === undefined ? "nt-grabber" : undefined, className]
          .filter(Boolean)
          .join(" ")}
        aria-label={caption}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          // The keyboard's focus, not a click's: a click has the pointer's hover already. A new
          // focus brings back a tooltip that Escape dismissed, under the pointer too.
          if (event.currentTarget.matches(":focus-visible")) {
            setFocus(true);
            setDismissed(false);
          }
          onFocus?.(event);
        }}
        onBlur={(event: FocusEvent<HTMLButtonElement>) => {
          setFocus(false);
          onBlur?.(event);
        }}
        {...button}
      >
        {icon === undefined ? (
          <span className="nt-grabber-bar" aria-hidden="true" />
        ) : (
          <Icon value={icon} chosen={chosen} />
        )}
      </button>
      {visible ? (
        // The same words as the name, which the button carries: the tooltip is not read again.
        <span ref={tip} className="nt-tooltip" popover="manual" aria-hidden="true">
          <span>{caption}</span>
        </span>
      ) : null}
    </span>
  );
}
