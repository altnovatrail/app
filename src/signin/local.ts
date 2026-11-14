// The sign-in of the local build by api's development account (R44 in docs/decisions.md; section
// 3.7 of docs/architecture.md): when the development server hands out the Firebase custom token
// that api's `just dev-app` keeps in a volume of app's container (R67 api), the sign-in takes it by
// signInWithCustomToken instead of opening Google's window, so that the path of the first slice
// runs in a browser without the author. Only firebase.ts loads this module, under
// import.meta.env.DEV, which a release's build replaces with false: the build holds none of it.
import { type Auth, signInWithCustomToken } from "@firebase/auth";
import { LOCAL_TOKEN_PATH } from "./token-path.ts";

// A custom token is a JWT: three parts of base64url. Anything else — a page a server answers
// every path with, say — is no token.
const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/** The development server's token, or undefined: no such route, no token now, or not a token. */
export async function localToken(): Promise<string | undefined> {
  try {
    // Not from the cache: api writes a new token every half hour.
    const answer = await fetch(LOCAL_TOKEN_PATH, { cache: "no-store" });
    if (!answer.ok) return undefined;
    const token = (await answer.text()).trim();
    return JWT.test(token) ? token : undefined;
  } catch {
    return undefined;
  }
}

/** Signs in by the development server's token; false when it has none, and the window is the way. */
export async function signInLocally(auth: Auth): Promise<boolean> {
  const token = await localToken();
  if (token === undefined) return false;
  await signInWithCustomToken(auth, token);
  return true;
}
