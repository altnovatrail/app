// The test of the site check (scripts/site.ts; section 3.7 of docs/architecture.md; R42): each rule
// on answers made up here, and the whole check, with no network, against a server of the test's own
// that serves the archive of build/ — ci-test builds it first — with the headers infra's rollout
// sets, and Google's answers as stand-ins, as the built page test has them.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { Deployment } from "@altnovatrail/spec/deploymentv1";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { tar } from "./archive.ts";
import { header, type Template } from "./csp.ts";
import { standInForGoogle } from "./google-stub.ts";
import { pack, repositoryNotices } from "./release.ts";
import {
  type Answer,
  allowedHosts,
  answerProblems,
  authorizes,
  check,
  expectedHeader,
  fetchAsk,
  originProblem,
  releaseFiles,
  run,
  siteProblems,
} from "./site.ts";

const HOST = "127.0.0.1";
/** A port of its own, beside the 5173 of `just dev` and the 5181 and 5182 of the page test. */
const PORT = 5183;
const ORIGIN = `http://${HOST}:${PORT}`;
const AUTH_DOMAIN = "example-project.firebaseapp.com";

const deployment: Deployment = {
  format: 1,
  api: ORIGIN,
  signIn: {
    service: "firebase",
    apiKey: "synthetic-web-api-key",
    authDomain: AUTH_DOMAIN,
    projectId: "example-project",
    appId: "synthetic-web-app-id",
  },
};

function answer(status: number, headers: Record<string, string> = {}, body = ""): Answer {
  return { status, headers: new Headers(headers), body: Buffer.from(body) };
}

const TEMPLATE: Template = { "default-src": "'none'", "connect-src": "'self' {api}" };
const CSP = header(TEMPLATE, { api: ORIGIN, authDomain: AUTH_DOMAIN });

/** A small release: a page, one file of assets/, csp.json and the notices. */
function smallFiles(): Map<string, Buffer> {
  return new Map([
    ["index.html", Buffer.from("<!doctype html>")],
    ["assets/a.js", Buffer.from("export {}")],
    ["csp.json", Buffer.from(JSON.stringify(TEMPLATE))],
    ["NOTICE", Buffer.from("notice")],
    ["LICENSE", Buffer.from("license")],
  ]);
}

describe("the rules of the site check", () => {
  it("reads the files of an archive by their paths in the build", () => {
    const archive = gzipSync(
      tar([{ path: "./" }, { path: "./index.html", body: Buffer.from("page") }]),
    );
    expect([...releaseFiles(archive)]).toEqual([["index.html", Buffer.from("page")]]);
  });

  it("says what is wrong with an answer: its status, its bytes, its headers", () => {
    expect(answerProblems("/", answer(404), {})).toEqual(["/ answered 404, not 200"]);
    expect(answerProblems("/gone", answer(404), { status: 404 })).toEqual([]);
    expect(answerProblems("/", answer(200, {}, "other"), { body: Buffer.from("page") })).toEqual([
      "/ is not the bytes of the release",
    ]);
    const headers = { "content-security-policy": CSP, "cache-control": /no-cache/ };
    expect(
      answerProblems("/", answer(200, { "cache-control": "max-age=60" }), { headers }),
    ).toEqual([
      `/ sent content-security-policy: nothing, not ${CSP}`,
      "/ sent cache-control: max-age=60, not /no-cache/",
    ]);
    expect(
      answerProblems("/", answer(200, { "content-security-policy": CSP }), { headers }),
    ).toEqual(["/ sent cache-control: nothing, not /no-cache/"]);
  });

  it("refuses Cross-Origin-Opener-Policy: same-origin, and only it", () => {
    for (const value of ["same-origin", ' same-origin; report-to="a"']) {
      expect(
        answerProblems("/", answer(200, { "cross-origin-opener-policy": value }), {}),
      ).toHaveLength(1);
    }
    for (const value of ["same-origin-allow-popups", "unsafe-none"]) {
      expect(answerProblems("/", answer(200, { "cross-origin-opener-policy": value }), {})).toEqual(
        [],
      );
    }
  });

  it("builds the header the site has to send from csp.json of the archive", () => {
    expect(expectedHeader(smallFiles(), deployment)).toBe(
      `default-src 'none'; connect-src 'self' ${ORIGIN}; frame-ancestors 'none'`,
    );
    const none = smallFiles();
    none.delete("csp.json");
    expect(() => expectedHeader(none, deployment)).toThrow("the archive holds no csp.json");
    const wrong = smallFiles();
    wrong.set("csp.json", Buffer.from(JSON.stringify({ "default-src": "{nowhere}" })));
    expect(() => expectedHeader(wrong, deployment)).toThrow("csp.json of the archive");
  });

  it("asks for the page, every file of assets/ and the notices, and says each one wrong", async () => {
    const files = smallFiles();
    const asked: string[] = [];
    const page = { "content-security-policy": CSP, "cache-control": "no-cache" };
    const site: Record<string, Answer> = {
      "/": answer(200, page, "<!doctype html>"),
      "/index.html": answer(
        200,
        { ...page, "cache-control": "public, max-age=3600" },
        "<!doctype html>",
      ),
      "/assets/a.js": answer(200, {}, "export {}"),
      "/csp.json": answer(200, {}, JSON.stringify(TEMPLATE)),
      "/NOTICE": answer(200, {}, "notice"),
      "/LICENSE": answer(200, {}, "a licence of someone else"),
    };
    const problems = await siteProblems(files, deployment, async (path) => {
      asked.push(path);
      return site[path] ?? answer(404);
    });
    expect(asked).toEqual(["/", "/index.html", "/assets/a.js", "/csp.json", "/NOTICE", "/LICENSE"]);
    expect(problems).toEqual([
      "/index.html sent cache-control: public, max-age=3600, not /(^|,)\\s*no-cache\\s*(,|$)/",
      "/LICENSE is not the bytes of the release",
    ]);
  });

  it("asks the site by fetch from its root, from no cache, and follows no redirect", async () => {
    const fetcher = vi.fn(async () => new Response("body", { status: 200, headers: { a: "b" } }));
    const got = await fetchAsk("https://example.org", fetcher)("/NOTICE");
    expect(fetcher).toHaveBeenCalledWith(new URL("https://example.org/NOTICE"), {
      cache: "no-cache",
      redirect: "manual",
    });
    expect(got.status).toBe(200);
    expect(got.headers.get("a")).toBe("b");
    expect(got.body.toString()).toBe("body");
  });

  it("lets a host sign in as the SDK does: a name within an authorized domain, an IP exactly", () => {
    expect(authorizes(["example.org"], "example.org")).toBe(true);
    expect(authorizes(["Example.org"], "app.EXAMPLE.org")).toBe(true);
    expect(authorizes(["example.org"], "badexample.org")).toBe(false);
    expect(authorizes(["127.0.0.1"], "127.0.0.1")).toBe(true);
    expect(authorizes(["0.0.1"], "127.0.0.1")).toBe(false);
    expect(authorizes([7, "example.org"], "example.org")).toBe(true);
    expect(authorizes(undefined, "example.org")).toBe(false);
  });

  it("takes an origin alone: a scheme and a host, with no path", () => {
    expect(originProblem("https://example.org")).toBeUndefined();
    expect(originProblem("https://example.org/")).toBe(
      "https://example.org/ is no origin: a scheme and a host, with no path",
    );
    expect(originProblem("example.org")).toBeDefined();
  });

  it("lets the page ask its own host, Google's script, authDomain and Firebase Auth", () => {
    expect([...allowedHosts("https://example.org", deployment)]).toEqual([
      "example.org",
      "apis.google.com",
      AUTH_DOMAIN,
      "identitytoolkit.googleapis.com",
      "securetoken.googleapis.com",
    ]);
  });
});

describe("the whole check", () => {
  const folder = mkdtempSync(join(tmpdir(), "site-"));
  const archivePath = join(folder, "app_v0.0.0.tar.gz");
  const archive = pack("build", repositoryNotices());
  const files = releaseFiles(archive);
  const csp = header(JSON.parse(files.get("csp.json")?.toString("utf8") ?? "{}"), {
    api: ORIGIN,
    authDomain: AUTH_DOMAIN,
  });
  /** What the server adds to or puts in place of its headers, by the test. */
  let extra: Record<string, string> = {};
  /** The domains the project of the stand-in lets sign in. */
  let authorized = [HOST];
  let server: Server;
  let browser: Browser;

  beforeAll(async () => {
    writeFileSync(archivePath, archive);
    // As infra's rollout serves the build (R06 in infra): outside /assets/ the CSP header and
    // no-cache, under it immutable; deployment.json the rollout's own; nosniff on all.
    server = createServer((request, response) => {
      const path = new URL(request.url ?? "/", ORIGIN).pathname;
      const name = path === "/" ? "index.html" : path.slice(1);
      const body =
        name === "deployment.json" ? Buffer.from(JSON.stringify(deployment)) : files.get(name);
      const assets = path.startsWith("/assets/");
      const type = name.endsWith(".js")
        ? "text/javascript"
        : name.endsWith(".css")
          ? "text/css"
          : name.endsWith(".json")
            ? "application/json"
            : name.endsWith(".html")
              ? "text/html; charset=utf-8"
              : "text/plain";
      response.writeHead(body === undefined ? 404 : 200, {
        "content-type": type,
        "x-content-type-options": "nosniff",
        ...(assets
          ? { "cache-control": "public, max-age=31536000, immutable" }
          : { "content-security-policy": csp, "cache-control": "no-cache" }),
        ...extra,
      });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(PORT, HOST, resolve));
    browser = await chromium.launch({ headless: true });
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
    await new Promise((resolve) => server?.close(resolve));
    rmSync(folder, { recursive: true, force: true });
  });

  /** A context whose every request off the site gets Google's answers as stand-ins. */
  async function open(given: Browser): Promise<BrowserContext> {
    const context = await given.newContext({ locale: "en-US" });
    await standInForGoogle(context, ORIGIN, () => authorized);
    return context;
  }

  it("passes a site that serves the release as section 3.7 has it", async () => {
    extra = {};
    authorized = [HOST];
    const { lines, problems } = await check(ORIGIN, archive, browser, { open });
    expect(problems).toEqual([]);
    expect(lines[0]).toBe(`/deployment.json: app reads it; api ${ORIGIN}, sign-in ${AUTH_DOMAIN}`);
  }, 60_000);

  it("prints what holds and ends with 0, by the command's own browser", async () => {
    extra = {};
    authorized = [HOST];
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      expect(await run(ORIGIN, archivePath, { open })).toBe(0);
      expect(log).toHaveBeenLastCalledWith(
        `site-check: ${ORIGIN} serves the release, as section 3.7 has it`,
      );
    } finally {
      log.mockRestore();
    }
  }, 60_000);

  it("fails a site that breaks the sign-in window, or whose project does not let it in", async () => {
    extra = { "cross-origin-opener-policy": "same-origin" };
    authorized = ["example.org"];
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await run(ORIGIN, archivePath, { open })).toBe(1);
      const said = error.mock.calls.map(([line]) => line);
      expect(said).toContain(
        "site-check: / sent Cross-Origin-Opener-Policy: same-origin, which breaks the sign-in window",
      );
      expect(said).toContain(`site-check: the project's authorized domains do not hold ${HOST}`);
    } finally {
      error.mockRestore();
    }
  }, 60_000);

  it("fails a page whose header is not that of csp.json, and its violations", async () => {
    extra = { "content-security-policy": "default-src 'none'" };
    authorized = [HOST];
    const { problems } = await check(ORIGIN, archive, browser, { open });
    expect(problems[0]).toBe(`/ sent content-security-policy: default-src 'none', not ${csp}`);
    // Under default-src 'none' the build's own script does not run: no button to tap.
    expect(
      problems.some(
        (line) =>
          line.startsWith("a violation of the CSP") || line.startsWith("the page in the browser"),
      ),
    ).toBe(true);
  }, 90_000);

  it("stops at what is not an origin, or a deployment.json app does not read", async () => {
    expect((await check(`${ORIGIN}/path`, archive, browser)).problems).toEqual([
      `${ORIGIN}/path is no origin: a scheme and a host, with no path`,
    ]);
    expect((await check("nothing", archive, browser)).problems).toHaveLength(1);
    const missing = async () => new Response("", { status: 404 });
    expect((await check(ORIGIN, archive, browser, { fetcher: missing })).problems).toEqual([
      "/deployment.json: /deployment.json answered 404",
    ]);
    const down = async (): Promise<Response> => {
      throw new TypeError("fetch failed");
    };
    expect((await check(ORIGIN, archive, browser, { fetcher: down })).problems).toEqual([
      "/deployment.json: cannot be read",
    ]);
  });

  it("says how it is run, and fails an archive it cannot read", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(await run(undefined, undefined)).toBe(1);
      expect(await run(`${ORIGIN}/`, archivePath)).toBe(1);
      expect(await run(ORIGIN, join(folder, "none.tar.gz"))).toBe(1);
      expect(error.mock.calls.at(-1)?.[0]).toMatch(/^site-check: ENOENT/);
    } finally {
      error.mockRestore();
    }
  }, 60_000);
});
