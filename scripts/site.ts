// The check of a deployed site against the release of app it serves (section 3.7 of
// docs/architecture.md; R42 in docs/decisions.md). `just site-check <origin> <version>` downloads
// the release's archive, has spec's release-verify accept it, and runs this on it. infra's rollout
// checks its own release of the site (R06 in infra); this is app's own look, the same for the
// platform and for a self-hosted copy, and it reads only what the site serves to anyone:
// - every file of the archive at its path, byte for byte: the build, its csp.json and schema, and
//   NOTICE and LICENSE (R25);
// - /deployment.json, as app's own code reads it at the start;
// - the headers section 3.7 asks of the hosting: at the page, the CSP header that csp.json of the
//   build gives with the file's values, frame-ancestors 'none' with it, and no-cache; nowhere
//   Cross-Origin-Opener-Policy: same-origin, which breaks the sign-in window;
// - the page in Chromium, under the site's own header and with Google's own script: no violation
//   of the CSP, nothing but app's origin asked before the tap of "Sign in with Google", after it
//   no host section 3.7 does not name, and the window opened on the sign-in pages of authDomain,
//   whose project lets the site's host sign in. The window is then closed: nobody signs in.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import type { Deployment } from "@altnovatrail/spec/deploymentv1";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { loadDeployment } from "../src/config/load.ts";
import { tarFiles } from "./archive.ts";
import { header, type Template, templateProblems } from "./csp.ts";

/** An answer of the site, read whole. */
export interface Answer {
  readonly status: number;
  readonly headers: Headers;
  readonly body: Buffer;
}

/** Asks the site for a path from its root. */
export type Ask = (path: string) => Promise<Answer>;

/** What a header has to be: exactly this string, or matching this pattern. */
type Want = string | RegExp;

/** How long the page has for each step in the browser. */
const STEP_MS = 30_000;

/** The files of a release's archive, by their paths in the build: `index.html`, `assets/…`. */
export function releaseFiles(archive: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const [path, body] of tarFiles(gunzipSync(archive))) {
    files.set(path.replace(/^\.\//, ""), body);
  }
  return files;
}

/** What is wrong with one answer: its status, its bytes, its headers; empty when nothing is. */
export function answerProblems(
  path: string,
  answer: Answer,
  want: {
    readonly status?: number;
    readonly body?: Buffer;
    readonly headers?: Record<string, Want>;
  },
): string[] {
  const status = want.status ?? 200;
  if (answer.status !== status) return [`${path} answered ${answer.status}, not ${status}`];
  const problems: string[] = [];
  if (want.body !== undefined && !answer.body.equals(want.body)) {
    problems.push(`${path} is not the bytes of the release`);
  }
  for (const [name, value] of Object.entries(want.headers ?? {})) {
    const got = answer.headers.get(name);
    if (typeof value === "string" ? got !== value : got === null || !value.test(got)) {
      problems.push(`${path} sent ${name}: ${got ?? "nothing"}, not ${value}`);
    }
  }
  // same-origin-allow-popups keeps the window's reference; same-origin alone breaks it.
  const opener = answer.headers.get("cross-origin-opener-policy");
  if (opener !== null && /^\s*same-origin\s*(;|$)/.test(opener)) {
    problems.push(
      `${path} sent Cross-Origin-Opener-Policy: ${opener}, which breaks the sign-in window`,
    );
  }
  return problems;
}

/** The CSP header the site has to send: csp.json of the build, with the file's values. */
export function expectedHeader(files: ReadonlyMap<string, Buffer>, deployment: Deployment): string {
  const body = files.get("csp.json");
  if (body === undefined) throw new Error("the archive holds no csp.json");
  const template: unknown = JSON.parse(body.toString("utf8"));
  const problems = templateProblems(template);
  if (problems.length > 0) throw new Error(`csp.json of the archive: ${problems.join("; ")}`);
  return header(template as Template, {
    api: deployment.api,
    authDomain: deployment.signIn.authDomain,
  });
}

/**
 * What the site serves against the release: each file of the archive at its path, byte for byte,
 * and at / and /index.html the headers of section 3.7.
 */
export async function siteProblems(
  files: ReadonlyMap<string, Buffer>,
  deployment: Deployment,
  ask: Ask,
): Promise<string[]> {
  const csp = expectedHeader(files, deployment);
  const problems: string[] = [];
  const index = files.get("index.html");
  const page = { "content-security-policy": csp, "cache-control": /(^|,)\s*no-cache\s*(,|$)/ };
  for (const path of ["/", "/index.html"]) {
    problems.push(...answerProblems(path, await ask(path), { body: index, headers: page }));
  }
  for (const [path, body] of files) {
    if (path === "index.html") continue;
    problems.push(...answerProblems(`/${path}`, await ask(`/${path}`), { body }));
  }
  return problems;
}

/** Asks a site by fetch, as a new opening would: not from a cache, and no redirect followed. */
export function fetchAsk(origin: string, fetcher: typeof fetch = fetch): Ask {
  return async (path) => {
    const response = await fetcher(new URL(path, origin), {
      cache: "no-cache",
      redirect: "manual",
    });
    return {
      status: response.status,
      headers: response.headers,
      body: Buffer.from(await response.arrayBuffer()),
    };
  };
}

/** The hosts section 3.7 lets the page ask, beside the site's own. */
export function allowedHosts(origin: string, deployment: Deployment): ReadonlySet<string> {
  return new Set([
    new URL(origin).host,
    "apis.google.com",
    deployment.signIn.authDomain,
    "identitytoolkit.googleapis.com",
    "securetoken.googleapis.com",
  ]);
}

/**
 * Whether the project's authorized domains let a host sign in, as the SDK decides it: an IP address
 * only by an exact match, a name also by a domain it lies within, in any case (section 3.7).
 */
export function authorizes(domains: unknown, hostname: string): boolean {
  if (!Array.isArray(domains)) return false;
  const host = hostname.toLowerCase();
  const ip = /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
  return domains.some((domain) => {
    if (typeof domain !== "string") return false;
    const name = domain.toLowerCase();
    return ip ? host === name : host === name || host.endsWith(`.${name}`);
  });
}

/**
 * The page in the browser, under the site's header: the start, then the tap of "Sign in with
 * Google", the window and the hidden iframe of the sign-in pages; then the window is closed before
 * anyone signs in. What the window itself asks is Google's sign-in pages, under their own policy,
 * not app's. `open` makes the context the page opens in; the test's own gives it Google's answers
 * as stand-ins. The label of the button is the tree's, not the release's: a release whose label
 * changed is checked by the tree of that change.
 */
export async function browserProblems(
  origin: string,
  deployment: Deployment,
  open: () => Promise<BrowserContext>,
): Promise<string[]> {
  const context = await open();
  try {
    const page = await context.newPage();
    const violations: string[] = [];
    const requests: URL[] = [];
    await page.exposeFunction("reportViolation", (line: string) => violations.push(line));
    // The page's own script, as text: this program of tsc sees Node, not the DOM.
    await page.addInitScript(`document.addEventListener("securitypolicyviolation", (event) => {
      window.reportViolation(event.effectiveDirective + " " + event.blockedURI);
    });`);
    page.on("console", (message) => {
      if (message.text().includes("Content Security Policy")) violations.push(message.text());
    });
    // Every request of the page and of its frames; the window is a page of its own.
    page.on("request", (request) => requests.push(new URL(request.url())));
    const problems: string[] = [];

    await page.goto(`${origin}/`);
    const button = page.getByRole("button", { name: "Sign in with Google" });
    await button.waitFor({ timeout: STEP_MS });
    const before = requests.filter((url) => url.origin !== origin);
    if (before.length > 0) {
      problems.push(`before the tap the page asked ${before.map((url) => url.host).join(", ")}`);
    }
    const own = requests
      .filter((url) => url.origin === origin)
      .map((url) => url.pathname)
      .filter((path) => path !== "/" && !path.startsWith("/assets/"));
    if (own[0] !== "/deployment.json") {
      problems.push(`the page asked ${own[0] ?? "nothing"} first, not /deployment.json`);
    }

    // The SDK asks the project which domains may sign in, and only then opens the window.
    const config = page.waitForResponse(
      (response) => response.url().startsWith("https://identitytoolkit.googleapis.com/v1/projects"),
      { timeout: STEP_MS },
    );
    // Handled here too: when the window fails to open, nobody awaits it before the context closes.
    config.catch(() => undefined);
    const opened = page.waitForEvent("popup", { timeout: STEP_MS });
    await button.click();
    const window = await opened;
    const where = new URL(window.url());
    const handler = `https://${deployment.signIn.authDomain}/__/auth/handler`;
    if (where.origin + where.pathname !== handler) {
      problems.push(`the window opened on ${where.origin}${where.pathname}, not ${handler}`);
    }
    const domains: unknown = ((await (await config).json()) as { authorizedDomains?: unknown })
      .authorizedDomains;
    const host = new URL(origin).hostname;
    if (!authorizes(domains, host)) {
      problems.push(`the project's authorized domains do not hold ${host}`);
    }
    // The hidden iframe goes under frame-src: the window is closed only once it is in the page.
    await page
      .locator(`iframe[src^="https://${deployment.signIn.authDomain}/__/auth/iframe"]`)
      .waitFor({ state: "attached", timeout: STEP_MS });
    await window.close();

    const allowed = allowedHosts(origin, deployment);
    const other = [...new Set(requests.map((url) => url.host))].filter((h) => !allowed.has(h));
    if (other.length > 0)
      problems.push(`the page asked ${other.join(", ")}, which section 3.7 does not name`);
    problems.push(...violations.map((line) => `a violation of the CSP: ${line}`));
    return problems;
  } catch (error) {
    return [`the page in the browser: ${error instanceof Error ? error.message : String(error)}`];
  } finally {
    await context.close();
  }
}

/** What a test gives the check in place of the network: its fetch, and the context of the page. */
export interface Options {
  readonly fetcher?: typeof fetch;
  readonly open?: (browser: Browser) => Promise<BrowserContext>;
}

/** What is wrong with an origin as the command takes it; undefined when nothing is. */
export function originProblem(origin: string): string | undefined {
  if (URL.canParse(origin) && new URL(origin).origin === origin) return undefined;
  return `${origin} is no origin: a scheme and a host, with no path`;
}

/** The whole check of a site against an archive: the lines of what holds, and the problems. */
export async function check(
  origin: string,
  archive: Buffer,
  browser: Browser,
  options: Options = {},
): Promise<{ lines: string[]; problems: string[] }> {
  const wrong = originProblem(origin);
  if (wrong !== undefined) return { lines: [], problems: [wrong] };
  const fetcher = options.fetcher ?? fetch;
  const files = releaseFiles(archive);
  const loaded = await loadDeployment(origin, (input, init) =>
    fetcher(new URL(String(input), origin), init),
  );
  if (loaded.kind !== "ready") {
    const why = loaded.kind === "offline" ? "cannot be read" : loaded.detail;
    return { lines: [], problems: [`/deployment.json: ${why}`] };
  }
  const { deployment } = loaded;
  const problems = await siteProblems(files, deployment, fetchAsk(origin, fetcher));
  const open = () => options.open?.(browser) ?? browser.newContext({ locale: "en-US" });
  problems.push(...(await browserProblems(origin, deployment, open)));
  const assets = [...files.keys()].filter((path) => path.startsWith("assets/")).length;
  const lines = [
    `/deployment.json: app reads it; api ${deployment.api}, sign-in ${deployment.signIn.authDomain}`,
    `/ and /index.html: index.html of the release, with no-cache and the CSP header of csp.json`,
    `${files.size - 1} more files of the archive at their paths, ${assets} of them in assets/: the bytes of the release`,
    `the page: no violation of the CSP, only /deployment.json and the build before the tap, the window on https://${deployment.signIn.authDomain}/__/auth/handler, and no host section 3.7 does not name`,
  ];
  return { lines, problems };
}

/**
 * `site.ts <origin> <archive>`: the check, a line for each thing that holds and the code 0, or a
 * line for each problem and the code 1.
 */
export async function run(
  origin: string | undefined,
  archivePath: string | undefined,
  options: Options = {},
): Promise<number> {
  if (origin === undefined || archivePath === undefined) {
    console.error("site-check: site.ts <origin> <the release's archive>");
    return 1;
  }
  const wrong = originProblem(origin);
  if (wrong !== undefined) {
    console.error(`site-check: ${wrong}`);
    return 1;
  }
  let browser: Browser | undefined;
  try {
    const archive = readFileSync(archivePath);
    browser = await chromium.launch({ headless: true });
    const { lines, problems } = await check(origin, archive, browser, options);
    if (problems.length > 0) {
      for (const problem of problems) console.error(`site-check: ${problem}`);
      return 1;
    }
    for (const line of lines) console.log(`site-check: ${line}`);
    console.log(`site-check: ${origin} serves the release, as section 3.7 has it`);
    return 0;
  } catch (error) {
    console.error(`site-check: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await browser?.close();
  }
}

if (import.meta.main) process.exit(await run(process.argv[2], process.argv[3]));
