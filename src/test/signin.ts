// A sign-in service for the tests, in place of Firebase Auth: who is signed in is set by hand, and
// the window answers as the test says.
import type { SignInResult, SignInService } from "../signin/service.ts";

export interface FakeSignIn extends SignInService {
  /** Signs a user in, or out with `null`, as the service would tell. */
  set(user: string | null | undefined): void;
  /** What the next sign-in window comes to; `done` signs in `signInAs`. */
  answer: SignInResult;
  signInAs: string;
  /** The languages the window was set to, in order. */
  readonly languages: string[];
  /** How often each was called. */
  readonly calls: { signIn: number; signOut: number; refresh: number };
}

export function fakeSignIn(user: string | null | undefined = null, token = "t"): FakeSignIn {
  let current: string | null | undefined = user;
  const listeners = new Set<() => void>();
  const set = (next: string | null | undefined) => {
    if (next === current) return;
    current = next;
    for (const listener of [...listeners]) listener();
  };
  const fake: FakeSignIn = {
    answer: { kind: "done" },
    signInAs: "uid-1",
    languages: [],
    calls: { signIn: 0, signOut: 0, refresh: 0 },
    set,
    user: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      fake.calls.signIn += 1;
      if (fake.answer.kind === "done") set(fake.signInAs);
      return fake.answer;
    },
    async signOut() {
      fake.calls.signOut += 1;
      set(null);
    },
    async token(refresh) {
      if (refresh) fake.calls.refresh += 1;
      return current ? token : undefined;
    },
    setLanguage(language) {
      fake.languages.push(language);
    },
  };
  return fake;
}
