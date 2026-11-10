import { describe, expect, it, vi } from "vitest";
import { loadDeployment, MAX_BYTES, PATH } from "./load.ts";

const ORIGIN = "https://app.example.org";
const FILE = {
  format: 1,
  api: "https://api.example.org",
  signIn: {
    service: "firebase",
    apiKey: "synthetic-web-api-key",
    authDomain: "example-project.firebaseapp.com",
    projectId: "example-project",
    appId: "synthetic-web-app-id",
  },
};

/** A fetch that answers once with a response, and remembers what it was asked. */
function answering(response: Response | Error) {
  return vi.fn<typeof fetch>(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
}

function json(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { headers: { "content-type": "application/json" }, ...init });
}

describe("loadDeployment", () => {
  it("asks for the file alone, from the root, past the cache, and reads it", async () => {
    const fetcher = answering(
      json(JSON.stringify(FILE), {
        headers: { "content-type": "application/json; charset=utf-8" },
      }),
    );
    expect(await loadDeployment(ORIGIN, fetcher)).toEqual({ kind: "ready", deployment: FILE });
    expect(fetcher.mock.calls).toEqual([[PATH, { cache: "no-cache" }]]);
  });

  it("is offline when the request fails, the hosting answers 5xx or the body breaks off", async () => {
    expect(await loadDeployment(ORIGIN, answering(new TypeError("failed")))).toEqual({
      kind: "offline",
    });
    for (const status of [408, 429, 500, 503, 599]) {
      expect(await loadDeployment(ORIGIN, answering(json("{}", { status })))).toEqual({
        kind: "offline",
      });
    }
    const broken = new ReadableStream({
      start(controller) {
        controller.error(new TypeError("network"));
      },
    });
    const cut = new Response(broken, { headers: { "content-type": "application/json" } });
    expect(await loadDeployment(ORIGIN, answering(cut))).toEqual({ kind: "offline" });
  });

  it("is unconfigured for an answer that is not the file, and says why in English", async () => {
    const cases: [Response, string][] = [
      [json("{}", { status: 404 }), "/deployment.json answered 404"],
      [
        new Response("<!doctype html>", { headers: { "content-type": "text/html" } }),
        "/deployment.json is text/html, not application/json",
      ],
      [new Response("{}"), "/deployment.json is text/plain, not application/json"],
      [json("x".repeat(MAX_BYTES + 1)), `/deployment.json is larger than ${MAX_BYTES} bytes`],
      [json("{"), "/deployment.json is not JSON"],
      [
        json(new Uint8Array([0x7b, 0xff, 0x7d]) as unknown as string),
        "/deployment.json is not JSON",
      ],
      [
        json(JSON.stringify({ ...FILE, measurementId: "G-1" })),
        "/deployment.json is refused by schema: measurementId",
      ],
      [json("[]"), "/deployment.json is refused by schema: the file itself"],
      [
        json(JSON.stringify({ ...FILE, api: "http://127.0.0.1:8080" })),
        "/deployment.json is refused by deployment.loopback: api",
      ],
    ];
    for (const [response, detail] of cases) {
      expect(await loadDeployment(ORIGIN, answering(response))).toEqual({
        kind: "unconfigured",
        detail,
      });
    }
  });

  it("takes a body of exactly the most allowed", async () => {
    const padded = JSON.stringify(FILE).padEnd(MAX_BYTES, " ");
    expect((await loadDeployment(ORIGIN, answering(json(padded)))).kind).toBe("ready");
  });

  it("refuses an answer that came by a redirect, and one of no type", async () => {
    const redirected = json(JSON.stringify(FILE));
    Object.defineProperty(redirected, "redirected", { value: true });
    Object.defineProperty(redirected, "url", { value: "https://elsewhere.example.org/" });
    expect(await loadDeployment(ORIGIN, answering(redirected))).toEqual({
      kind: "unconfigured",
      detail: "/deployment.json was redirected to https://elsewhere.example.org/",
    });
    const untyped = new Response(null);
    untyped.headers.delete("content-type");
    expect(await loadDeployment(ORIGIN, answering(untyped))).toEqual({
      kind: "unconfigured",
      detail: "/deployment.json is of no type, not application/json",
    });
  });

  it("reads a body that is not there as empty, which is no JSON", async () => {
    const empty = new Response(null, { headers: { "content-type": "application/json" } });
    expect(await loadDeployment(ORIGIN, answering(empty))).toEqual({
      kind: "unconfigured",
      detail: "/deployment.json is not JSON",
    });
  });
});
