// The failure screens (sections 3.2 and 3.7 of docs/architecture.md): static, from the build itself,
// in the language of the device, before any profile or sign-in. Each is a screen of its own, with
// its heading (section 3.9); their words are the dictionaries' (section 3.8), and the line for
// whoever deployed the copy is English on every screen (the 2026-11-02 amendment to R09). A read of
// a learner's screen that did not answer is one of them too: no connection, or what it came to. The
// mockup draws none, so they are drawn by its rules of style (R69): a white card in the window's
// middle, its heading at 22 bold, and what to do the primary button of its width.
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { HomeButton } from "../app/HomeButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The line for whoever deployed the copy, in English, with what is wrong. */
export function operatorLine(detail: string): string {
  return `For whoever deployed this copy: ${detail}.`;
}

/** app open in a frame of another page: nothing of the interface and no data. */
export function Framed() {
  const { words } = useLanguage();
  return <Screen title={words.text("boot.framed")} layout="failure" />;
}

/** Try again, and on a learner's screen that is not the home the way back to it (R57). */
function Retry({ onRetry, home }: { readonly onRetry: () => void; readonly home: boolean }) {
  const { words } = useLanguage();
  return (
    <div className="nt-buttons">
      <button type="button" className="nt-main" onClick={onRetry}>
        {words.text("boot.retry")}
      </button>
      {home ? <HomeButton /> : null}
    </div>
  );
}

/** The file did not come: the network, or a hosting that answered 5xx. */
export function Offline({
  onRetry,
  home = false,
}: {
  readonly onRetry: () => void;
  readonly home?: boolean;
}) {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("boot.offline")} layout="failure">
      <Retry onRetry={onRetry} home={home} />
    </Screen>
  );
}

/**
 * A screen's read did not answer: no connection, or the words of what it came to, and Try again —
 * with the way back to My subjects on a screen that is not the home itself.
 */
export function ReadFailed({
  failure,
  onRetry,
  home = false,
}: {
  readonly failure: Failure;
  readonly onRetry: () => void;
  readonly home?: boolean;
}) {
  const { words } = useLanguage();
  if (failure.kind === "offline") return <Offline onRetry={onRetry} home={home} />;
  return (
    <Screen title={failureText(failure, words)} layout="failure">
      <Retry onRetry={onRetry} home={home} />
    </Screen>
  );
}

/** No file, or not the right one: a grown-up's help, and below what whoever deployed it needs. */
export function Unconfigured({ detail }: { readonly detail: string }) {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("boot.unconfigured")} layout="failure">
      <p>{words.text("boot.grown-up")}</p>
      <p lang="en" data-operator="">
        {operatorLine(detail)}
      </p>
    </Screen>
  );
}

/**
 * The storage taken away while app was open (section 3.2): the browser erased this origin's data,
 * or the data is there but could not be read, and nothing of it was erased.
 */
export function StorageGone({ trouble }: { readonly trouble: "erased" | "unreadable" }) {
  const { words } = useLanguage();
  return (
    <Screen
      title={words.text(trouble === "erased" ? "boot.erased" : "boot.unreadable")}
      layout="failure"
    >
      <ReloadButton main />
    </Screen>
  );
}

/** Reload, the primary button of a failure screen when `main`. */
function ReloadButton({ main = false }: { readonly main?: boolean }) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      {...(main ? { className: "nt-main" } : {})}
      onClick={() => window.location.reload()}
    >
      {words.text("boot.reload")}
    </button>
  );
}

/** The offer to reload, over the screen: app never reloads by itself. */
export function ReloadOffer() {
  const { language, words } = useLanguage();
  return (
    <div role="status" lang={language} className="nt-offer">
      <p>{words.text("boot.new-version")}</p>
      <ReloadButton />
    </div>
  );
}

/**
 * Another tab holds Firebase Auth's database of the copy's previous project, which this start could
 * not erase: no sign-in starts in this tab until that tab is closed (section 3.7).
 */
export function OtherTab() {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("signin.other-tab")} layout="failure">
      <ReloadButton main />
    </Screen>
  );
}
