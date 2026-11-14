// The adapter of Firebase Auth on mocks of its packages (section 3.7 of docs/architecture.md): the
// parameters of the file explicitly, indexedDBLocalPersistence alone and the popup resolver, Google's
// window, the language of the window, the tokens, and what each error of the window comes to; and,
// as Vitest runs it with import.meta.env.DEV, the local build's sign-in by the development token.
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  languageCode: null as string | null,
  currentUser: null as null | { getIdToken: (refresh: boolean) => Promise<string> },
  listener: undefined as undefined | ((user: { uid: string } | null) => void),
}));
const calls = vi.hoisted(() => ({
  app: [] as unknown[],
  auth: [] as unknown[],
  popup: 0,
  custom: [] as string[],
}));
const popup = vi.hoisted(() => ({ error: undefined as unknown }));
const custom = vi.hoisted(() => ({ error: undefined as unknown }));

vi.mock("@firebase/app", () => ({
  initializeApp: (options: unknown) => {
    calls.app.push(options);
    return { name: "[DEFAULT]" };
  },
}));
vi.mock("@firebase/auth", () => ({
  indexedDBLocalPersistence: { type: "LOCAL" },
  browserPopupRedirectResolver: { resolver: true },
  GoogleAuthProvider: class {
    readonly providerId = "google.com";
  },
  initializeAuth: (_app: unknown, deps: unknown) => {
    calls.auth.push(deps);
    return auth;
  },
  onAuthStateChanged: (_auth: unknown, listener: (user: { uid: string } | null) => void) => {
    auth.listener = listener;
    return () => {};
  },
  signInWithPopup: async (_auth: unknown, provider: { providerId: string }) => {
    calls.popup += 1;
    expect(provider.providerId).toBe("google.com");
    if (popup.error !== undefined) throw popup.error;
  },
  signInWithCustomToken: async (_auth: unknown, token: string) => {
    calls.custom.push(token);
    if (custom.error !== undefined) throw custom.error;
  },
  signOut: async () => {
    auth.listener?.(null);
  },
}));

// The development server: no token unless a test gives one.
const server = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.stubGlobal("fetch", async (path: string) =>
  path === "/__novatrail/custom-token" && server.token !== undefined
    ? new Response(server.token, { headers: { "Content-Type": "text/plain" } })
    : new Response(null, { status: 404 }),
);

const { firebaseSignIn, resultOf } = await import("./firebase.ts");

const SIGN_IN = {
  service: "firebase",
  apiKey: "synthetic-web-api-key",
  authDomain: "example-project.firebaseapp.com",
  projectId: "example-project",
  appId: "synthetic-web-app-id",
};

beforeEach(() => {
  calls.app.length = 0;
  calls.auth.length = 0;
  calls.custom.length = 0;
  calls.popup = 0;
  popup.error = undefined;
  custom.error = undefined;
  server.token = undefined;
  auth.currentUser = null;
});

describe("firebaseSignIn", () => {
  it("starts Firebase with the file's parameters, the persistence in IndexedDB and the popup", () => {
    firebaseSignIn(SIGN_IN);
    expect(calls.app).toEqual([
      {
        apiKey: "synthetic-web-api-key",
        authDomain: "example-project.firebaseapp.com",
        projectId: "example-project",
        appId: "synthetic-web-app-id",
      },
    ]);
    expect(calls.auth).toEqual([
      { persistence: [{ type: "LOCAL" }], popupRedirectResolver: { resolver: true } },
    ]);
  });

  it("tells who is signed in once Firebase has read its session, and of each change", async () => {
    const service = firebaseSignIn(SIGN_IN);
    const heard = vi.fn();
    const stop = service.subscribe(heard);
    expect(service.user()).toBeUndefined();
    auth.listener?.({ uid: "uid-1" });
    auth.listener?.({ uid: "uid-1" });
    expect(service.user()).toBe("uid-1");
    expect(heard).toHaveBeenCalledOnce();
    await service.signOut();
    expect(service.user()).toBeNull();
    stop();
    auth.listener?.({ uid: "uid-2" });
    expect(heard).toHaveBeenCalledTimes(2);
  });

  it("gives the token of the user, refreshed when asked, and none without one or when it fails", async () => {
    const service = firebaseSignIn(SIGN_IN);
    expect(await service.token(false)).toBeUndefined();
    const asked: boolean[] = [];
    auth.currentUser = {
      getIdToken: async (refresh) => {
        asked.push(refresh);
        return refresh ? "fresh" : "token";
      },
    };
    expect(await service.token(false)).toBe("token");
    expect(await service.token(true)).toBe("fresh");
    expect(asked).toEqual([false, true]);
    auth.currentUser = {
      getIdToken: async () => {
        throw new Error("network");
      },
    };
    expect(await service.token(true)).toBeUndefined();
  });

  it("opens Google's window in the language of the screen", async () => {
    const service = firebaseSignIn(SIGN_IN);
    service.setLanguage("ru");
    expect(auth.languageCode).toBe("ru");
    expect(await service.signIn()).toEqual({ kind: "done" });
    popup.error = { code: "auth/popup-blocked" };
    expect(await service.signIn()).toEqual({ kind: "blocked" });
    expect(calls.custom).toEqual([]);
  });

  it("in the local build, signs in by the development server's token, without the window", async () => {
    const service = firebaseSignIn(SIGN_IN);
    server.token = "header.payload.signature\n";
    expect(await service.signIn()).toEqual({ kind: "done" });
    expect(calls.custom).toEqual(["header.payload.signature"]);
    expect(calls.popup).toBe(0);
    custom.error = { code: "auth/network-request-failed" };
    expect(await service.signIn()).toEqual({ kind: "offline" });
    expect(calls.popup).toBe(0);
  });
});

describe("resultOf", () => {
  it("reads each error of the window by its code", () => {
    expect(resultOf({ code: "auth/popup-closed-by-user" })).toEqual({ kind: "closed" });
    expect(resultOf({ code: "auth/cancelled-popup-request" })).toEqual({ kind: "closed" });
    expect(resultOf({ code: "auth/user-cancelled" })).toEqual({ kind: "closed" });
    expect(resultOf({ code: "auth/network-request-failed" })).toEqual({ kind: "offline" });
    expect(resultOf({ code: "auth/unauthorized-domain" })).toEqual({
      kind: "unconfigured",
      code: "unauthorized-domain",
    });
    expect(resultOf({ code: "auth/invalid-api-key" }).kind).toBe("unconfigured");
    expect(resultOf({ code: "auth/operation-not-allowed" }).kind).toBe("unconfigured");
    expect(resultOf({ code: "auth/internal-error" })).toEqual({
      kind: "unknown",
      code: "internal-error",
    });
    expect(resultOf({ code: "auth/toString" })).toEqual({ kind: "unknown", code: "toString" });
    expect(resultOf(new Error("no code"))).toEqual({ kind: "unknown", code: "unknown" });
    expect(resultOf(null)).toEqual({ kind: "unknown", code: "unknown" });
  });
});
