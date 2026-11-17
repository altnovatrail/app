// A pop-over (the mockup's README, «Pop-overs, not panels»; section 3.9 of docs/architecture.md): a
// list or a choice behind a small button, opened over the screen. From 600 CSS px it hangs from its
// button and grows from the button's corner; below 600 it is a sheet from the bottom with a button
// "Close", ×, which shows its icon alone (R60). It is a modal <dialog>: the rest of the page is inert while it is open, Escape and a tap
// outside it close it, the focus goes into it, and comes back to its button when it closes.
import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { hang } from "./hang.ts";
import { IconButton } from "./IconButton.tsx";

/** What takes the focus in a pop-over that opens: the first of these, or the pop-over itself. */
const FOCUSABLE =
  "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

export interface PopOverProps {
  /** The words of the button, which name the pop-over too, as the mockup's do. */
  readonly label: string;
  /** The button's class, as `nt-secondary`. */
  readonly className?: string;
  /** What the pop-over holds; given `close`, a choice can close it once it is made. */
  readonly children: ReactNode | ((close: () => void) => ReactNode);
}

export function PopOver({ label, className, children }: PopOverProps) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

  useLayoutEffect(() => {
    const shown = dialog.current;
    if (!open || shown === null) return;
    shown.showModal();
    // Placed again when the window or what holds the button moves, not when the pop-over scrolls.
    const place = (event?: Event) => {
      const from = button.current;
      if (from === null || (event?.target instanceof Node && shown.contains(event.target))) return;
      const at = hang(from.getBoundingClientRect(), shown.offsetWidth, shown.offsetHeight, {
        width: document.documentElement.clientWidth,
        height: document.documentElement.clientHeight,
      });
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
  }, [open, close]);

  return (
    <>
      <button
        ref={button}
        type="button"
        className={className}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
      >
        {label}
      </button>
      {open ? (
        <dialog
          ref={dialog}
          className="nt-pop nt-glass nt-glass-panel"
          aria-label={label}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClose={close}
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
