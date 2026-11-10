// The failure screens (sections 3.2 and 3.7 of docs/architecture.md): static, from the build itself, in the
// language of the device, before any profile or sign-in. Each is a page of its own, with its
// heading (section 3.9).
import type { Language } from "./language.ts";
import { operatorLine, WORDS } from "./words.ts";

interface ScreenProps {
  readonly language: Language;
}

/** app open in a frame of another page: nothing of the interface and no data. */
export function Framed({ language }: ScreenProps) {
  return (
    <main lang={language}>
      <h1>{WORDS[language].framed}</h1>
    </main>
  );
}

/** The file did not come: the network, or a hosting that answered 5xx. */
export function Offline({ language, onRetry }: ScreenProps & { readonly onRetry: () => void }) {
  const words = WORDS[language];
  return (
    <main lang={language}>
      <h1>{words.offline}</h1>
      <button type="button" onClick={onRetry}>
        {words.retry}
      </button>
    </main>
  );
}

/** No file, or not the right one: a grown-up's help, and below what whoever deployed it needs. */
export function Unconfigured({ language, detail }: ScreenProps & { readonly detail: string }) {
  const words = WORDS[language];
  return (
    <main lang={language}>
      <h1>{words.unconfigured}</h1>
      <p>{words.grownUp}</p>
      <p lang="en" data-operator="">
        {operatorLine(detail)}
      </p>
    </main>
  );
}

/**
 * The storage taken away while app was open (section 3.2): the browser erased this origin's data,
 * or the data is there but could not be read, and nothing of it was erased.
 */
export function StorageGone({
  language,
  trouble,
}: ScreenProps & { readonly trouble: "erased" | "unreadable" }) {
  return (
    <main lang={language}>
      <h1>{WORDS[language][trouble]}</h1>
      <ReloadButton language={language} />
    </main>
  );
}

function ReloadButton({ language }: ScreenProps) {
  return (
    <button type="button" onClick={() => window.location.reload()}>
      {WORDS[language].reload}
    </button>
  );
}

/** The offer to reload, over the screen: app never reloads by itself. */
export function ReloadOffer({ language }: ScreenProps) {
  const words = WORDS[language];
  return (
    <div role="status" lang={language}>
      <p>{words.newVersion}</p>
      <ReloadButton language={language} />
    </div>
  );
}
