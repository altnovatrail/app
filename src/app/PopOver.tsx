// A pop-over (the mockup's README, «Pop-overs, not panels»; section 3.9 of docs/architecture.md): a
// list or a choice behind a small button, opened over the screen. From 600 CSS px it hangs from its
// button and grows from the button's corner; below 600 it is a sheet from the bottom with a button
// "Close", ×, which shows its icon alone (R60). It is a modal <dialog>: the rest of the page is inert while it is open, Escape and a tap
// outside it close it, the focus goes into it, and comes back to its button when it closes.
import {
  type ReactNode,
  type RefObject,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { hang } from "./hang.ts";
import { type Captionless, IconButton } from "./IconButton.tsx";

/** What takes the focus in a pop-over that opens: the first of these, or the pop-over itself. */
const FOCUSABLE =
  "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export interface PopOverProps {
  /** The words of the button, which name the pop-over too, as the mockup's do. */
  readonly label: string;
  /**
   * What the button shows in place of the label, whose text is then its name: a row of a form with
   * its field's name and value, as the owner's country.
   */
  readonly caption?: ReactNode;
  /**
   * The button's name, where its caption is not all of it: the profile's pill, whose name says what
   * it opens beside the pseudonym it shows.
   */
  readonly buttonLabel?: string;
  /**
   * A button of the closed list in place of the words (R60): its icon alone, filled while the
   * pop-over is open, and its caption its name — Help.
   */
  readonly icon?: Captionless;
  /** The button's class, as `nt-secondary`. */
  readonly className?: string;
  /** The button, for a form that puts the focus on it. */
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
  /** What describes the button: the ID of a hint or an error. */
  readonly describedBy?: string | undefined;
  /** Hung below the middle of its button, from 600 CSS px, not from its edge. */
  readonly centred?: boolean;
  /**
   * Between the button and the pop-over hung from it, CSS px, where it is not GAP of hang.ts: the
   * home's pop-overs hang 6 below its bar, as the mockup's do (R63).
   */
  readonly gap?: number;
  /**
   * What it hangs from in place of its button, from 600 CSS px: the closest ancestor of the button
   * this selector finds — a lesson's segments hang from the bar's pill, as the mockup's (R64).
   */
  readonly anchor?: string;
  /** The pop-over's own class, beside `nt-pop`: a look of its own, as the avatars'. */
  readonly popClassName?: string;
  /**
   * Nothing closes it while this holds — not Escape, ×, a tap outside nor its own content —: a
   * report under way, whose failure the pop-over has to show.
   */
  readonly holds?: boolean;
  /** Told when it closes, by whatever closed it. */
  readonly onClosed?: () => void;
  /** What the pop-over holds; given `close`, a choice can close it once it is made. */
  readonly children: ReactNode | ((close: () => void) => ReactNode);
}

export function PopOver({
  label,
  caption,
  buttonLabel,
  icon,
  className,
  buttonRef,
  describedBy,
  centred = false,
  gap,
  anchor,
  popClassName,
  holds = false,
  onClosed,
  children,
}: PopOverProps) {
  const [open, setOpen] = useState(false);
  const own = useRef<HTMLButtonElement>(null);
  const button = buttonRef ?? own;
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const held = useRef(holds);
  held.current = holds;
  const closed = useRef(onClosed);
  closed.current = onClosed;
  const close = useCallback(() => {
    if (held.current) return;
    setOpen(false);
    closed.current?.();
  }, []);

  useLayoutEffect(() => {
    const shown = dialog.current;
    if (!open || shown === null) return;
    shown.showModal();
    // Placed again when the window or what holds the button moves, not when the pop-over scrolls.
    const place = (event?: Event) => {
      const own = button.current;
      if (own === null || (event?.target instanceof Node && shown.contains(event.target))) return;
      const from = (anchor === undefined ? null : own.closest(anchor)) ?? own;
      const at = hang(
        from.getBoundingClientRect(),
        shown.offsetWidth,
        shown.offsetHeight,
        {
          width: document.documentElement.clientWidth,
          height: document.documentElement.clientHeight,
        },
        centred,
        gap,
      );
      shown.style.setProperty("--nt-pop-left", `${at.left}px`);
      shown.style.setProperty("--nt-pop-top", `${at.top}px`);
      shown.style.setProperty("--nt-pop-origin", at.origin);
    };
    place();
    // A tap outside is a press and a release both outside the dialog's box, on its backdrop: not a
    // drag from inside that ends outside, nor a press on its own edge or scroll bar. The keyboard
    // closes it by Escape, the dialog's own cancel.
    const beyond = (event: MouseEvent) => {
      const box = shown.getBoundingClientRect();
      return (
        event.target === shown &&
        (event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom)
      );
    };
    let pressed = false;
    const press = (event: PointerEvent) => {
      pressed = beyond(event);
    };
    const outside = (event: MouseEvent) => {
      if (pressed && beyond(event)) close();
      pressed = false;
    };
    shown.addEventListener("pointerdown", press);
    shown.addEventListener("click", outside);
    const inside = content.current;
    (inside?.querySelector<HTMLElement>(FOCUSABLE) ?? inside)?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      shown.removeEventListener("pointerdown", press);
      shown.removeEventListener("click", outside);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      shown.close();
      // Safari does not focus a button on a click, so the dialog has no focus of its own to give
      // back: the button takes it, while it is still on the page.
      if (button.current?.isConnected === true) button.current.focus();
    };
  }, [open, close, centred, gap, anchor, button]);

  const opens = {
    className,
    "aria-describedby": describedBy,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    onClick: () => setOpen((was) => !was),
  } as const;
  return (
    <>
      {icon === undefined ? (
        <button ref={button} type="button" aria-label={buttonLabel} {...opens}>
          {caption ?? label}
        </button>
      ) : (
        <IconButton ref={button} value={icon} chosen={open} {...opens} />
      )}
      {open ? (
        <dialog
          ref={dialog}
          className={`nt-pop nt-glass nt-glass-panel${popClassName === undefined ? "" : ` ${popClassName}`}`}
          aria-label={label}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={() => {
            // A browser may close a modal dialog on a second Escape whatever its cancel says.
            if (held.current) dialog.current?.showModal();
            else close();
          }}
        >
          <div className="nt-pop-body">
            <IconButton value="close" className="nt-pop-close" onClick={close} />
            <div ref={content} className="nt-pop-content" tabIndex={-1}>
              {typeof children === "function" ? children(close) : children}
            </div>
          </div>
        </dialog>
      ) : null}
    </>
  );
}
