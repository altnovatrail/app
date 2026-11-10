// The sign-in service as app needs it (section 3.7 of docs/architecture.md; R19 in
// docs/decisions.md): who is signed in, the sign-in window, the sign-out, the ID tokens of the
// client of api (R18) and the language of the window. Firebase Auth gives it in the browser
// (firebase.ts); the tests give one of their own. No DOM.
import type { Tokens } from "../api/tokens.ts";

/** What came of the sign-in window. */
export type SignInResult =
  /** Signed in. */
  | { readonly kind: "done" }
  /** The window was closed, or another took its place: nothing to say. */
  | { readonly kind: "closed" }
  /** The browser did not open the window. */
  | { readonly kind: "blocked" }
  /** The network did not answer. */
  | { readonly kind: "offline" }
  /** The project of the sign-in service does not take this copy; `code` is its error. */
  | { readonly kind: "unconfigured"; readonly code: string }
  /** Anything else, by its code. */
  | { readonly kind: "unknown"; readonly code: string };

export interface SignInService extends Tokens {
  /**
   * The user signed in, by the sign-in service's own ID: `null` when nobody is, `undefined` until
   * the service has read its session.
   */
  user(): string | null | undefined;
  /** Calls `listener` when `user()` changes; gives what stops it. */
  subscribe(listener: () => void): () => void;
  /** Opens the sign-in window of Google, on a press. */
  signIn(): Promise<SignInResult>;
  /** The language of the sign-in window: the screen's. */
  setLanguage(language: string): void;
}
