// The sign-in screen (sections 3.7 and 3.8 of docs/architecture.md): in the language of the device,
// whose buttons are here, and Google's window on a press. What came of the last window is a line
// below its button; a project that does not take this copy has the line for whoever deployed it.
// Below, the way to the legal pages, by a button that holds the word "privacy" (R31).
import { useState } from "react";
import { Screen } from "../app/Screen.tsx";
import { operatorLine } from "../boot/Screens.tsx";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Words } from "../i18n/words.ts";
import type { SignInResult } from "./service.ts";

export interface SignInScreenProps {
  /** Opens the window; the screen stays until the account comes. */
  readonly onSignIn: () => Promise<SignInResult>;
  /** What came of the last window. */
  readonly result?: SignInResult;
  /** The last sign-out did not erase all of the account. */
  readonly left?: boolean;
  /** Opens the legal pages. */
  readonly onLegal: () => void;
}

function resultText(result: SignInResult, words: Words): string | undefined {
  switch (result.kind) {
    case "blocked":
      return words.text("signin.blocked");
    case "offline":
      return words.text("boot.offline");
    case "unconfigured":
      return words.text("boot.unconfigured");
    case "unknown":
      return words.text("signin.failed");
    default:
      return undefined;
  }
}

export function SignInScreen({ onSignIn, result, left = false, onLegal }: SignInScreenProps) {
  const { words } = useLanguage();
  const [pending, setPending] = useState(false);
  const line = result === undefined ? undefined : resultText(result, words);
  return (
    <Screen title={words.text("signin.title")}>
      <LanguageButtons />
      {left ? <p role="status">{words.text("signout.left")}</p> : null}
      <p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void onSignIn().finally(() => setPending(false));
          }}
        >
          {words.text("signin.google")}
        </button>
      </p>
      {line === undefined ? null : (
        <div role="alert">
          <p>{line}</p>
          {result?.kind === "unconfigured" ? (
            <p lang="en" data-operator="">
              {operatorLine(`the sign-in service refused this copy: auth/${result.code}`)}
            </p>
          ) : null}
        </div>
      )}
      <div className="nt-buttons">
        <button type="button" className="nt-secondary" onClick={onLegal}>
          {words.text("legal.title")}
        </button>
      </div>
    </Screen>
  );
}
