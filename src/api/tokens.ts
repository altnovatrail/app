// The ID tokens of the sign-in service, as the client of the contract needs them: one for
// each request, a fresh one when api says the one sent has expired, and the sign-out when the
// account is no more. The sign-in by Firebase Auth gives them. No DOM.

export interface Tokens {
  /** The ID token, refreshed when asked; `undefined` when nobody is signed in or it cannot be had. */
  token(refresh: boolean): Promise<string | undefined>;
  /** Signs out of the sign-in service. */
  signOut(): Promise<void>;
}

/** Nobody signed in: no token, and nothing to sign out of. */
export const NO_TOKENS: Tokens = {
  token: async () => undefined,
  signOut: async () => {},
};
