// A legal text's gist over the screen it is opened from, as the mockup's legal text (`legal-terms`,
// `legal-privacy`; R69): its heading, the chip of its version, the gist below its caption, the next
// version in a note with the way to its page (R46), and at its foot the line that the English text
// is in force, on a screen in another language (R27), and "Read the full text", which opens the
// text's page (R31) — or, with no version in force, the list of the legal pages. It opens at once,
// the shapes of its chip and its gist standing while its text is read (R168 spec), and is a modal
// <dialog>: the screen under it is inert, Escape, × and a tap outside close it, and the focus comes
// back to what opened it. The way in opens it from its steps, the adult's Help from its pop-over; it
// stands in the page's body, not in the screen, whose own colours, as the sky's, are not its.
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { RequestState } from "../api/ApiContext.tsx";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { LEGAL, type Route } from "../app/router.ts";
import { Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { legalPage, nextPage, useVersions } from "./LegalPages.tsx";
import { LegalLoading } from "./LegalText.tsx";
import { dayText, type PageText, type Versions } from "./texts.ts";

export interface LegalSheetProps {
  readonly id: PageText;
  /** The text's versions as their read stands. */
  readonly versions: RequestState<Versions> & { readonly retry: () => void };
  readonly onClose: () => void;
  /** Opens a page of the text — the whole of it, or its next version — in place of the screen. */
  readonly onPage: (page: Route) => void;
}

export function LegalSheet({ id, versions, onClose, onPage }: LegalSheetProps) {
  const { language, words } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const caption = useId();
  const hint = useId();
  const closed = useRef(onClose);
  closed.current = onClose;
  // What opened the sheet, which the focus goes back to: the link pressed, or the button of the
  // pop-over it was opened from, which has the focus back once the pop-over is gone.
  const opener = useRef<Element | null>(null);
  useLayoutEffect(() => {
    opener.current = document.activeElement;
  }, []);

  useLayoutEffect(() => {
    const shown = dialog.current;
    if (shown === null) return;
    shown.showModal();
    // A tap outside is a press and a release both on the backdrop, as a pop-over's (R59).
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
      if (pressed && beyond(event)) closed.current();
      pressed = false;
    };
    shown.addEventListener("pointerdown", press);
    shown.addEventListener("click", outside);
    return () => {
      shown.removeEventListener("pointerdown", press);
      shown.removeEventListener("click", outside);
      shown.close();
    };
  }, []);
  useEffect(
    () => () => {
      const back = opener.current;
      if (back instanceof HTMLElement && back.isConnected) back.focus();
    },
    [],
  );

  const title = words.text(`legal.${id}`);
  let chip: ReactNode = null;
  let shown: ReactNode;
  if (versions.status === "loading") {
    chip = <Sk width="11rem" height="1.5rem" radius="999px" />;
    shown = <LegalLoading body={false} />;
  } else if (versions.status === "failed") {
    shown = <ReadFailure failure={versions.failure} onRetry={versions.retry} />;
  } else {
    const { current, next } = versions.value;
    if (current !== undefined) {
      chip = (
        <p className="nt-version-chip">
          {words.text("legal.version", {
            version: String(current.version),
            date: dayText(language, current.inForceSince),
          })}
        </p>
      );
    }
    shown = (
      <>
        {current === undefined ? (
          <p>{words.text("legal.none")}</p>
        ) : (
          <>
            <p id={caption} className="nt-sheet-caption">
              {words.text("legal.gist")}
            </p>
            <section className="nt-legal-gist" aria-labelledby={caption}>
              <p lang={current.summaryLanguage === "" ? "en" : current.summaryLanguage}>
                {current.summary}
              </p>
            </section>
          </>
        )}
        {next === undefined ? null : (
          <div className="nt-sheet-note">
            <p id={hint}>
              {words.text("legal.next-coming", {
                version: String(next.version),
                date: dayText(language, next.inForceSince),
              })}
            </p>
            <button
              type="button"
              className="nt-link"
              aria-describedby={hint}
              onClick={() => onPage(nextPage(id))}
            >
              {words.text("legal.next-read", { version: String(next.version) })}
            </button>
          </div>
        )}
        {current === undefined ? (
          // No text to read in full: the way to the other legal pages, which the sheet stands for.
          <div className="nt-legal-foot">
            <button type="button" className="nt-link" onClick={() => onPage(LEGAL)}>
              {words.text("legal.title")}
            </button>
          </div>
        ) : (
          <div className="nt-legal-foot">
            {language === "en" ? null : (
              <p className="nt-in-force">{words.text("legal.english-in-force")}</p>
            )}
            <button type="button" className="nt-link" onClick={() => onPage(legalPage(id))}>
              {words.text("legal.full")}
            </button>
          </div>
        )}
      </>
    );
  }
  return createPortal(
    <dialog
      ref={dialog}
      className="nt-legal-sheet"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Only a close the browser made itself, as on a second Escape: the close of an unmount — and
      // of React's second mount in development, after which the sheet is open again — is not one.
      onClose={() => {
        if (dialog.current?.open !== true) onClose();
      }}
    >
      <div className="nt-legal-body">
        <div className="nt-sheet-head">
          <div className="nt-sheet-title">
            <h2>{title}</h2>
            {chip}
          </div>
          <IconButton value="close" className="nt-sheet-close" onClick={onClose} />
        </div>
        {shown}
      </div>
    </dialog>,
    document.body,
  );
}

/** The sheet of a text the screen under it has not read: it reads the text itself. */
export function ReadLegalSheet(props: Omit<LegalSheetProps, "versions">) {
  const versions = useVersions(props.id);
  return <LegalSheet {...props} versions={versions} />;
}
