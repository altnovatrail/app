// A button that shows its icon alone (R60): only the buttons of the closed list of R90 spec, each
// with its caption as its accessible name and a tooltip of the same words. The tooltip is app's
// own, white on an opaque #1d1d1f (R148 spec), and holds WCAG 1.4.13: it comes on pointer hover and
// on keyboard focus, stays while the pointer is over it, and Escape dismisses it without moving the
// pointer or the focus. It sits in the top layer, so that no box or dialog
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
 * The closed list (R90 spec): each button that shows no caption, its icon — none for the grabber,
 * which draws a bar — and the caption that names it. A button joins the list only by a change of
 * R90 spec, and then of R60.
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
  // The buttons of a task from paper (R71): the camera's shutter and its way to the photos, and the
  // cross and the corner of a frame drawn by hand.
  "take-photo": { icon: "camera", word: "icon.take-photo" },
  "choose-photos": { icon: "photos", word: "icon.choose-photos" },
  "remove-frame": { icon: "close", word: "icon.remove-frame" },
  "resize-frame": { icon: "resize", word: "icon.resize-frame" },
} as const satisfies Record<string, { icon: IconValue | undefined; word: Key }>;

/** A button of the closed list. */
export type Captionless = keyof typeof CAPTIONLESS;

/**
 * The captions a button of the list takes in place of its own, each for its button alone, where they
 * name where it goes: back in a lesson is "Leave the lesson", as the mockup's (R64), back from a
 * task "Back to My subjects", the one way home of R57 (R65), the section for adults' back and
 * close "Back to the section" and "Close the section" (R68), and a legal page's back "Back to the
 * list" (R69).
 */
export const INSTEAD = {
  "lesson.leave": "back",
  "task.home": "back",
  "adults.back": "back",
  "adults.close": "close",
  "legal.back": "back",
} as const satisfies Partial<Record<Key, Captionless>>;

/** A caption of INSTEAD. */
export type Instead = keyof typeof INSTEAD;

/** The captions of INSTEAD that the button `V` takes. */
export type InsteadOf<V extends Captionless> = {
  [K in Instead]: (typeof INSTEAD)[K] extends V ? K : never;
}[Instead];

/** How long the pointer or the focus stays before the tooltip comes, as the mockup's `.tip`. */
export const TIP_DELAY_MS = 300;

export interface IconButtonProps<V extends Captionless = Captionless>
  extends Omit<ComponentProps<"button">, "children" | "type" | "ref"> {
  /** Which button of the list it is: its icon and its name. */
  readonly value: V;
  /** Whether what it stands for is chosen, on or open: then its icon is the fill, where it has one. */
  readonly chosen?: boolean;
  /** The button itself, for what opens from it: a pop-over that gives the focus back to it. */
  readonly ref?: Ref<HTMLButtonElement>;
  /** Its caption in place of the list's, one of INSTEAD for this button. */
  readonly caption?: InsteadOf<V>;
}

export function IconButton<V extends Captionless>({
  value,
  chosen = false,
  caption: named,
  className,
  onFocus,
  onBlur,
  ref,
  ...button
}: IconButtonProps<V>) {
  const { words } = useLanguage();
  const { icon, word } = CAPTIONLESS[value];
  const caption = words.text((named as Instead | undefined) ?? word);
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

  // Not while what the button opens is open: a tooltip in the top layer would stand over its dialog.
  const expanded = button["aria-expanded"] === true || button["aria-expanded"] === "true";
  const visible = shown && !dismissed && !expanded;

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
