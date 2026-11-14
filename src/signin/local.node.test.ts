// The local build's reading of the development token (R44 in docs/decisions.md): what the
// development server answers and what of it is a token.
import { afterEach, describe, expect, it, vi } from "vitest";

const signed = vi.hoisted(() => [] as string[]);
vi.mock("@firebase/auth", () => ({
  signInWithCustomToken: async (_auth: unknown, token: string) => {
    signed.push(token);
  },
}));

const { localToken, signInLocally } = await import("./local.ts");
const { LOCAL_TOKEN_PATH } = await import("./token-path.ts");

const asked: { path: string; init: RequestInit | undefined }[] = [];
function answer(make: () => Promise<Response>) {
  vi.stubGlobal("fetch", (path: string, init?: RequestInit) => {
    asked.push({ path, init });
    return make();
  });
}

afterEach(() => {
  asked.length = 0;
  signed.length = 0;
  vi.unstubAllGlobals();
});

describe("localToken", () => {
  it("asks the development server for the token, past the cache, and trims it", async () => {
    answer(async () => new Response("  aa.bb-_.cc\n"));
    expect(await localToken()).toBe("aa.bb-_.cc");
    expect(asked).toEqual([{ path: LOCAL_TOKEN_PATH, init: { cache: "no-store" } }]);
  });

  it("has none when the server has none, answers anything but a token, or cannot be reached", async () => {
    answer(async () => new Response(null, { status: 404 }));
    expect(await localToken()).toBeUndefined();
    answer(async () => new Response("<!doctype html><html></html>"));
    expect(await localToken()).toBeUndefined();
    answer(async () => new Response(""));
    expect(await localToken()).toBeUndefined();
    answer(() => Promise.reject(new TypeError("Failed to fetch")));
    expect(await localToken()).toBeUndefined();
  });
});

describe("signInLocally", () => {
  it("signs in by the token, and leaves the window to the caller without one", async () => {
    answer(async () => new Response("aa.bb.cc"));
    expect(await signInLocally({} as never)).toBe(true);
    expect(signed).toEqual(["aa.bb.cc"]);
    answer(async () => new Response(null, { status: 404 }));
    expect(await signInLocally({} as never)).toBe(false);
    expect(signed).toEqual(["aa.bb.cc"]);
  });
});
