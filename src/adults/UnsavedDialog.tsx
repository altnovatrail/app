// The question a profile's page asks when a press would leave it with changes not saved: a modal
// <dialog> over the dimmed screen, as the grown-ups' PIN is drawn — its question, its line, and
// Save, Don't Save and Cancel. The screen under it is inert; Escape is Cancel, and Cancel brings
// the focus back to what was pressed.
import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useLanguage } from "../i18n/LanguageContext.tsx";

export function UnsavedDialog({
  line,
  onSave,
  onDrop,
  onCancel,
}: {
  /** What is not saved, in words. */
  readonly line: string;
  readonly onSave: () => void;
  readonly onDrop: () => void;
  readonly onCancel: () => void;
}) {
  const { words } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useId();
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
  return createPortal(
    <dialog
      ref={dialog}
      className="nt-pin nt-unsaved"
      role="alertdialog"
      aria-labelledby={title}
      aria-describedby={`${title}-line`}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={title} className="nt-pin-title">
        {words.text("adults.unsaved-title")}
      </h2>
      <p id={`${title}-line`} className="nt-pin-line">
        {line}
      </p>
      <div className="nt-unsaved-actions">
        <button type="button" className="nt-unsaved-save" onClick={onSave}>
          {words.text("adults.save")}
        </button>
        <button type="button" className="nt-unsaved-drop" onClick={onDrop}>
          {words.text("adults.unsaved-drop")}
        </button>
        <button type="button" className="nt-unsaved-cancel" onClick={onCancel}>
          {words.text("common.cancel")}
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
