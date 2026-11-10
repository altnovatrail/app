// The failure screens (sections 3.2 and 3.7 of docs/architecture.md): static, from the build itself,
// in the language of the device, before any profile or sign-in. Each is a screen of its own, with
// its heading (section 3.9); their words are the dictionaries' (section 3.8), and the line for
// whoever deployed the copy is English on every screen (the 2026-11-02 amendment to R09).
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** The line for whoever deployed the copy, in English, with what is wrong. */
export function operatorLine(detail: string): string {
  return `For whoever deployed this copy: ${detail}.`;
}

/** app open in a frame of another page: nothing of the interface and no data. */
export function Framed() {
  const { words } = useLanguage();
  return <Screen title={words.text("boot.framed")} />;
}

/** The file did not come: the network, or a hosting that answered 5xx. */
export function Offline({ onRetry }: { readonly onRetry: () => void }) {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("boot.offline")}>
      <button type="button" onClick={onRetry}>
        {words.text("boot.retry")}
      </button>
    </Screen>
  );
}

/** No file, or not the right one: a grown-up's help, and below what whoever deployed it needs. */
export function Unconfigured({ detail }: { readonly detail: string }) {
  const { words } = useLanguage();
  return (
    <Screen title={words.text("boot.unconfigured")}>
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
    <Screen title={words.text(trouble === "erased" ? "boot.erased" : "boot.unreadable")}>
      <ReloadButton />
    </Screen>
  );
}

function ReloadButton() {
  const { words } = useLanguage();
  return (
    <button type="button" onClick={() => window.location.reload()}>
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
    <Screen title={words.text("signin.other-tab")}>
      <ReloadButton />
    </Screen>
  );
}
