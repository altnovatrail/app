// The sign-in by Firebase Auth (R09 and R19 in docs/decisions.md; section 3.7 of
// docs/architecture.md): `initializeApp` with the parameters of /deployment.json, explicitly, and
// `initializeAuth` with indexedDBLocalPersistence alone and the popup resolver — never `getAuth`,
// which looks for parameters and an emulator in the environment. The sign-in is Google's window,
// in the language of the screen. Nothing of it asks the network before the sign-in window on a
// computer: the script of gapi and the hidden iframe come with the window (section 4). The local
// build signs in by api's development token instead, when the development server has one (R44).
import { initializeApp } from "@firebase/app";
import {
  type Auth,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  indexedDBLocalPersistence,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "@firebase/auth";
import type { Deployment } from "../config/deployment.ts";
import type { SignInResult, SignInService } from "./service.ts";

/** The codes of Firebase Auth's errors of the window, without their `auth/`, and what they come to. */
const RESULTS: Readonly<Record<string, SignInResult["kind"]>> = {
  "popup-closed-by-user": "closed",
  "cancelled-popup-request": "closed",
  "user-cancelled": "closed",
  "popup-blocked": "blocked",
  "network-request-failed": "offline",
  // The project does not take this copy: its domain is not authorized, its key is not the
  // project's, or Google is not a provider of it. Whoever deployed it fixes that.
  "unauthorized-domain": "unconfigured",
  "invalid-api-key": "unconfigured",
  "operation-not-allowed": "unconfigured",
};

/** What an error of the sign-in window comes to. */
export function resultOf(error: unknown): SignInResult {
  const raw = (error as { code?: unknown } | null)?.code;
  const code = typeof raw === "string" ? raw.replace(/^auth\//, "") : "unknown";
  const kind = Object.hasOwn(RESULTS, code) ? RESULTS[code] : undefined;
  switch (kind) {
    case "closed":
    case "blocked":
    case "offline":
      return { kind };
    case "unconfigured":
      return { kind, code };
    default:
      return { kind: "unknown", code };
  }
}

/** The sign-in service of a deployment's Firebase project. Made once for a page. */
export function firebaseSignIn(signIn: Deployment["signIn"]): SignInService {
  const app = initializeApp({
    apiKey: signIn.apiKey,
    authDomain: signIn.authDomain,
    projectId: signIn.projectId,
    appId: signIn.appId,
  });
  const auth: Auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence],
    popupRedirectResolver: browserPopupRedirectResolver,
  });
  let user: string | null | undefined;
  const listeners = new Set<() => void>();
  const tell = (id: string | null) => {
    if (id === user) return;
    user = id;
    for (const listener of [...listeners]) listener();
  };
  onAuthStateChanged(auth, (next) => tell(next?.uid ?? null));
  return {
    user: () => user,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async signIn() {
      try {
        // A release's build has import.meta.env.DEV false: the branch and its module drop out, and
        // the window opens with nothing awaited before it.
        if (import.meta.env.DEV) {
          const { signInLocally } = await import("./local.ts");
          if (await signInLocally(auth)) return { kind: "done" };
        }
        await signInWithPopup(auth, new GoogleAuthProvider());
        return { kind: "done" };
      } catch (error) {
        return resultOf(error);
      }
    },
    async signOut() {
      await signOut(auth);
      // Signed out is nobody now, whenever Firebase tells its listeners.
      tell(null);
    },
    async token(refresh) {
      // A token that cannot be had is none: api answers unauthenticated (R18).
      return (await auth.currentUser?.getIdToken(refresh).catch(() => undefined)) ?? undefined;
    },
    setLanguage(language) {
      auth.languageCode = language;
    },
  };
}
