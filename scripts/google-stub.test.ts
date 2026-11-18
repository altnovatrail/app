// The stand-ins for Google in Node, with a context and routes of its own: what each host gets, and
// an answer the closing of the context cut off, which fails no test.
import type { BrowserContext, Route } from "playwright";
import { describe, expect, it } from "vitest";
import { closedMeanwhile, GAPI, standInForGoogle } from "./google-stub.ts";

/** The error Playwright gives a route's answer once its page, context or browser closed. */
function closedError(): Error {
  const error = new Error("route.fulfill: Target page, context or browser has been closed");
  error.name = "TargetClosedError";
  return error;
}

/** A context that keeps the handler of its one route, and a route of an address it answers. */
async function stoodIn(seen: string[] = []) {
  let handler: ((route: Route) => Promise<void>) | undefined;
  let matcher: ((url: URL) => boolean) | undefined;
  const context = {
    route: async (match: (url: URL) => boolean, handle: (route: Route) => Promise<void>) => {
      matcher = match;
      handler = handle;
    },
  } as unknown as BrowserContext;
  await standInForGoogle(context, "http://127.0.0.1:4173", () => ["127.0.0.1"], seen);
  const request = async (address: string, fails?: Error) => {
    const answers: { contentType?: string; body?: string }[] = [];
    const route = {
      request: () => ({ url: () => address }),
      fulfill: async (given: { contentType?: string; body?: string }) => {
        if (fails !== undefined) throw fails;
        answers.push(given);
      },
    } as unknown as Route;
    await handler?.(route);
    return answers;
  };
  return { matches: (address: string) => matcher?.(new URL(address)), request };
}

describe("the stand-ins for Google", () => {
  it("answers each request off the origin by its host, and names each host", async () => {
    const seen: string[] = [];
    const { matches, request } = await stoodIn(seen);
    expect(matches("http://127.0.0.1:4173/")).toBe(false);
    expect(matches("https://apis.google.com/js/api.js")).toBe(true);
    expect((await request("https://apis.google.com/js/api.js"))[0]?.body).toBe(GAPI);
    const config = await request("https://identitytoolkit.googleapis.com/v1/projects");
    expect(JSON.parse(config[0]?.body ?? "")).toEqual({
      projectId: "example-project",
      authorizedDomains: ["127.0.0.1"],
    });
    const page = await request("https://example-project.firebaseapp.com/__/auth/iframe");
    expect(page[0]?.contentType).toBe("text/html");
    expect(seen).toEqual([
      "apis.google.com",
      "identitytoolkit.googleapis.com",
      "example-project.firebaseapp.com",
    ]);
  });

  it("takes an answer cut off by the context's closing as none, and any other failure as one", async () => {
    const { request } = await stoodIn();
    const address = "https://example-project.firebaseapp.com/__/auth/iframe";
    await expect(request(address, closedError())).resolves.toEqual([]);
    await expect(request(address, new Error("route.fulfill: no body"))).rejects.toThrow("no body");
    expect(closedMeanwhile(closedError())).toBe(true);
    // The words alone are no closing: another error that says them is a failure all the same.
    expect(closedMeanwhile(new Error(closedError().message))).toBe(false);
  });
});
