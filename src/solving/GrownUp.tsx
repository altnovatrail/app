// Grown-up mode of the tutor on a task from paper, as the mockup's `solve-grown-*`: the grown-ups'
// PIN it asks first, a modal <dialog> over the dimmed screen — the padlock, its name, its line,
// four dots and a keypad of 3 × 4 with Cancel and the delete key —, and the band under the panel's
// head while the mode is on, with Turn off. The screen under the dialog is inert, Escape and Cancel
// close it, the digits come by the keyboard too, and the focus goes back to the key that opened
// it. A wrong PIN clears the dots and says so in red; the right one turns the mode on.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/**
 * The grown-ups' PIN of grown-up mode, the same for everyone and checked on the device alone: it
 * keeps a child from lifting the tutor's limits by a tap, and is no secret. A page of all the
 * settings will set each account's own PIN, and this one goes then.
 */
export const GROWN_UP_PIN = "5555";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

/** The dialog of the grown-ups' PIN: `onRight` once the PIN is entered, `onCancel` on Cancel. */
export function PinDialog({
  onRight,
  onCancel,
}: {
  readonly onRight: () => void;
  readonly onCancel: () => void;
}) {
  const { words } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [pin, setPin] = useState("");
  const [wrong, setWrong] = useState(false);
  // The digits as they are between two renders: keys pressed fast each see the one before.
  const entered = useRef("");
  const done = useRef({ onRight, onCancel });
  done.current = { onRight, onCancel };
  const opener = useRef<Element | null>(null);
  useLayoutEffect(() => {
    opener.current = document.activeElement;
    const shown = dialog.current;
    if (shown === null) return;
    shown.showModal();
    return () => shown.close();
  }, []);
  useEffect(
    () => () => {
      const back = opener.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    },
    [],
  );
  const set = (next: string) => {
    entered.current = next;
    setPin(next);
  };
  const press = (digit: string) => {
    const next = entered.current + digit;
    if (next.length < GROWN_UP_PIN.length) {
      set(next);
      setWrong(false);
    } else if (next === GROWN_UP_PIN) {
      set("");
      done.current.onRight();
    } else {
      set("");
      setWrong(true);
    }
  };
  const back = () => set(entered.current.slice(0, -1));
  return createPortal(
    <dialog
      ref={dialog}
      className="nt-pin"
      aria-labelledby={title}
      onCancel={(event) => {
        event.preventDefault();
        done.current.onCancel();
      }}
      onKeyDown={(event) => {
        if (/^[0-9]$/.test(event.key)) {
          event.preventDefault();
          press(event.key);
        } else if (event.key === "Backspace") {
          event.preventDefault();
          back();
        }
      }}
    >
      <span className="nt-pin-lock" aria-hidden="true">
        <Icon value="pin-lock" />
      </span>
      <h2 id={title} className="nt-pin-title">
        {words.text("grown.mode")}
      </h2>
      {wrong ? (
        <p className="nt-pin-line" data-wrong="true" role="alert">
          {words.text("grown.pin-wrong")}
        </p>
      ) : (
        <p className="nt-pin-line">{words.text("grown.pin-line")}</p>
      )}
      <span
        className="nt-pin-dots"
        role="img"
        aria-label={words.text("grown.pin-dots", { n: pin.length })}
      >
        {[...GROWN_UP_PIN].map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the dots are the PIN's places.
          <span key={i} data-on={i < pin.length} />
        ))}
      </span>
      <div className="nt-pin-keys">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            className="nt-pin-key nt-pin-digit"
            onClick={() => press(digit)}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          className="nt-pin-key nt-pin-cancel"
          onClick={() => done.current.onCancel()}
        >
          {words.text("grown.pin-cancel")}
        </button>
        <button type="button" className="nt-pin-key nt-pin-digit" onClick={() => press("0")}>
          0
        </button>
        <IconButton value="pin-delete" className="nt-pin-key nt-pin-delete" onClick={back} />
      </div>
      <p className="nt-pin-note">{words.text("grown.pin-note")}</p>
    </dialog>,
    document.body,
  );
}

/** The band under the panel's head while grown-up mode is on: what it lifts, and Turn off. */
export function GrownBand({ onOff }: { readonly onOff: () => void }) {
  const { words } = useLanguage();
  return (
    <div className="nt-grown-band" role="status">
      <span className="nt-grown-band-sign">
        <Icon value="grown-up" />
      </span>
      <span className="nt-grown-band-words">
        <span className="nt-grown-band-title">{words.text("grown.mode")}</span>
        <span>{words.text("grown.band-line")}</span>
      </span>
      <button type="button" className="nt-grown-off" onClick={onOff}>
        {words.text("grown.off")}
      </button>
    </div>
  );
}
