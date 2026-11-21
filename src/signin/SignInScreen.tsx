// The sign-in screen (R17, R19, R61): the mockup's `signin`, in the frame of the way in, in the
// language of the device, whose pill is in its corner, and Google's window on a press, the button
// Google's own — its light theme and its "G", as Google's rules ask (R12 spec) — saying so while
// the window is open. What came of the last window is a line below its button; a project that does
// not take this copy has the line for whoever deployed it. Below, the line that accounts are for
// grown-ups alone, and at the card's foot the way to the legal pages, by a button that holds the
// word "privacy" (R31).
import { useState } from "react";
import { Spark } from "../app/Brand.tsx";
import { operatorLine } from "../boot/Screens.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LanguagePill } from "../i18n/LanguagePill.tsx";
import type { Words } from "../i18n/words.ts";
import googleG from "./google-g.svg";
import type { SignInResult } from "./service.ts";
import { WelcomeScreen } from "./Welcome.tsx";

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
    <WelcomeScreen
      title={words.text("signin.title")}
      first
      lead={
        <span className="nt-welcome-mark" aria-hidden="true">
          <Spark />
        </span>
      }
      corner={<LanguagePill />}
      onLegal={onLegal}
    >
      <p className="nt-lead">{words.text("signin.intro")}</p>
      {left ? <p role="status">{words.text("signout.left")}</p> : null}
      <button
        type="button"
        className="nt-main nt-google"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void onSignIn().finally(() => setPending(false));
        }}
      >
        {pending ? (
          <>
            <span className="nt-spin" aria-hidden="true" />
            {words.text("signin.signing")}
          </>
        ) : (
          <>
            <img src={googleG} alt="" width="20" height="20" />
            {words.text("signin.google")}
          </>
        )}
      </button>
      {line === undefined ? null : (
        <div role="alert" className="nt-welcome-alert">
          <p className="nt-error">{line}</p>
          {result?.kind === "unconfigured" ? (
            <p lang="en" data-operator="">
              {operatorLine(`the sign-in service refused this copy: auth/${result.code}`)}
            </p>
          ) : null}
        </div>
      )}
      <p className="nt-note">
        <span className="nt-note-age" aria-hidden="true">
          18
        </span>
        <span>{words.text("signin.grown-ups")}</span>
      </p>
    </WelcomeScreen>
  );
}
