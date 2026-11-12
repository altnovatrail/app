// The test of the built page (section 3.7 of docs/architecture.md; Д8 and Д9 in RUN.md, in
// Chromium): `vite preview` serves build/ — ci-test builds it first — with app's own plugin, and
// Chrome Headless Shell, from the image the toolchain stage takes it from, opens it. A violation of
// either layer of the CSP fails the test, and so does any request before /deployment.json. The
// sign-in window goes under the header too, with what Google would answer stubbed, and a request to
// a host section 3.7 does not name fails it.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { type PreviewServer, preview } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { deploymentPart, partText } from "./archive.ts";
import { deployment, layerIsFirst } from "./deployment-plugin.ts";

const HOST = "127.0.0.1";
/** Ports of their own, beside the 5173 of `just dev` and `just preview`. */
const PORT = 5181;
const BARE_PORT = 5182;
const ORIGIN = `http://${HOST}:${PORT}`;
const BARE_ORIGIN = `http://${HOST}:${BARE_PORT}`;

const folder = mkdtempSync(join(tmpdir(), "page-"));
const local = join(folder, "deployment.local.json");
const bareLocal = join(folder, "bare.local.json");

function file(api: string, extra: object = {}) {
  return {
    format: 1,
    api,
    signIn: {
      service: "firebase",
      apiKey: "synthetic-web-api-key",
      authDomain: "example-project.firebaseapp.com",
      projectId: "example-project",
      appId: "synthetic-web-app-id",
      ...extra,
    },
  };
}

function serve(port: number, path: string, previewHeader: boolean): Promise<PreviewServer> {
  return preview({
    configFile: false,
    logLevel: "silent",
    appType: "mpa",
    build: { outDir: "build" },
    plugins: [deployment({ local: path, previewHeader })],
    preview: { host: HOST, port, strictPort: true },
  });
}

let browser: Browser;
let server: PreviewServer;
let bare: PreviewServer;

beforeAll(async () => {
  server = await serve(PORT, local, true);
  bare = await serve(BARE_PORT, bareLocal, false);
  browser = await chromium.launch({ headless: true });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  await bare?.close();
  rmSync(folder, { recursive: true, force: true });
});

/** A page that records every violation of the CSP and every request, in their order. */
async function open(locale = "en-US"): Promise<{
  page: Page;
  violations: string[];
  requests: string[];
}> {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  const violations: string[] = [];
  const requests: string[] = [];
  await page.exposeFunction("reportViolation", (line: string) => violations.push(line));
  // The page's own script, as text: this program of tsc sees Node, not the DOM.
  await page.addInitScript(`document.addEventListener("securitypolicyviolation", (event) => {
    window.reportViolation(event.effectiveDirective + " " + event.blockedURI);
  });`);
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  return { page, violations, requests };
}

/** The hosts of Google that section 3.7 names for the sign-in, beside app's own origin. */
const GOOGLE: ReadonlySet<string> = new Set([
  "apis.google.com",
  "example-project.firebaseapp.com",
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
]);

/**
 * The script of gapi in place of Google's, which is closed to reading: it gives the SDK what it
 * calls — the loader, and a context that puts the hidden iframe of the sign-in pages in the page
 * and says it is there once it has loaded — and calls the SDK back by the name in its address.
 */
const GAPI = `(() => {
  const frames = {
    CROSS_ORIGIN_IFRAMES_FILTER: {},
    Iframe: function Iframe() {},
    getContext: () => ({
      open(options, ready) {
        const frame = document.createElement("iframe");
        frame.src = options.url;
        frame.setAttribute("aria-hidden", "true");
        const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
        options.where.appendChild(frame);
        return ready({
          restyle: async () => {},
          ping: () => loaded,
          register() {},
          send() {},
        });
      },
    }),
  };
  window.gapi = { load: (_, options) => options.callback(), iframes: frames };
  const onload = new URL(document.currentScript.src).searchParams.get("onload");
  if (onload) window[onload]();
})();`;

describe("the built page", () => {
  it("has the lower layer first in <head>, and no deployment.json of its own", () => {
    expect(layerIsFirst(readFileSync("build/index.html", "utf8"))).toBe(true);
    expect(existsSync("build/deployment.json")).toBe(false);
    expect(existsSync("build/csp.json")).toBe(true);
    expect(readFileSync("build/deployment.schema.json", "utf8")).toBe(
      partText(deploymentPart(), "schemas/deployment.schema.json"),
    );
  });

  it("starts under both layers of the CSP with the file, and asks for it before anything else", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, violations, requests } = await open();
    const response = await page.goto(`${ORIGIN}/`);
    expect(response?.headers()["content-security-policy"]).toContain(
      `connect-src 'self' ${ORIGIN}`,
    );
    // Nobody has signed in: the first screen is the sign-in's.
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
    expect(own).toEqual(["/deployment.json"]);
    // The theme came with the build, under the lower layer's style-src 'self' (section 3.9).
    expect(
      await page.evaluate(
        "getComputedStyle(document.documentElement).getPropertyValue('--nt-primary').trim()",
      ),
    ).toBe("#1d4ed8");
    // The storage started without making a database of its own: nobody has signed in (section
    // 3.2). The two there are Firebase's: Auth's persistence, which it opens to see that it can,
    // and the heartbeats of @firebase/app — its versions and the day, sent in X-Firebase-Client
    // with the requests to Firebase Auth (section 3.7).
    expect(
      await page.evaluate("indexedDB.databases().then((all) => all.map((db) => db.name).sort())"),
    ).toEqual(["firebase-heartbeat-database", "firebaseLocalStorageDb"]);
    expect(violations).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("opens the sign-in window under the header, asking only the hosts section 3.7 names (Д8)", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, violations } = await open();
    // Every request off app's origin, page and window alike, by its host, in its order.
    const google: string[] = [];
    await page.context().route(
      (url) => url.origin !== ORIGIN,
      async (route) => {
        const url = new URL(route.request().url());
        google.push(url.host);
        if (url.host === "apis.google.com") {
          await route.fulfill({ contentType: "text/javascript", body: GAPI });
        } else if (url.host === "identitytoolkit.googleapis.com") {
          await route.fulfill({
            contentType: "application/json",
            headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
            body: JSON.stringify({ projectId: "example-project", authorizedDomains: [HOST] }),
          });
        } else {
          await route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><title>auth</title>",
          });
        }
      },
    );
    await page.goto(`${ORIGIN}/`);
    const button = page.getByRole("button", { name: "Sign in with Google" });
    await button.waitFor();
    // On a computer the SDK asks Google nothing before the window (section 4).
    expect(google).toEqual([]);
    const opened = page.waitForEvent("popup");
    await button.click();
    const popup = await opened;
    expect(new URL(popup.url()).origin + new URL(popup.url()).pathname).toBe(
      "https://example-project.firebaseapp.com/__/auth/handler",
    );
    // The hidden iframe of the sign-in pages is in the page, under frame-src.
    await page
      .locator('iframe[src^="https://example-project.firebaseapp.com/__/auth/iframe"]')
      .waitFor({ state: "attached" });
    // Hosts compared whole: each request's URL was parsed, and its host is one of the list or not.
    await expect
      .poll(() => google.some((host) => host === "identitytoolkit.googleapis.com"))
      .toBe(true);
    expect(
      google.every((host) => GOOGLE.has(host)),
      google.join(", "),
    ).toBe(true);
    expect(google.slice(0, 2)).toEqual(["apis.google.com", "example-project.firebaseapp.com"]);
    expect(violations).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("takes the canvas element under the header: its styles, a picture by blob: and a stroke (Д9)", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, violations } = await open();
    await page.goto(`${ORIGIN}/`);
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    // The build registered the element before its first render (section 3.1); the test puts one on
    // the page as the task screen does, with a task whose statement has a picture from media.
    await page.evaluate(`(async () => {
      const sheet = document.createElement("novatrail-canvas");
      sheet.lang = "en";
      sheet.style.blockSize = "30rem";
      sheet.style.inlineSize = "30rem";
      document.body.append(sheet);
      const drawn = new OffscreenCanvas(2, 2);
      drawn.getContext("2d").fillRect(0, 0, 2, 2);
      const picture = await drawn.convertToBlob({ type: "image/png" });
      sheet.manifest = {
        module_format_version: "0.4",
        id: "example/probe",
        version: "1.0.0",
        title: "Probe",
        languages: { explanation: "en" },
      };
      sheet.media = async () => picture;
      sheet.task = {
        id: "probe",
        statement: [{ text: "Count." }, { picture: "probe.png", alt: "Dots", width: 40, height: 40 }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        items: [{ answer_slots: [{ binding: "anywhere" }] }],
      };
    })()`);
    const sheet = page.locator("novatrail-canvas");
    await sheet.locator("img[src^='blob:']").waitFor();
    expect(
      await page.evaluate(
        `document.querySelector("novatrail-canvas").shadowRoot.adoptedStyleSheets.length`,
      ),
    ).toBeGreaterThan(0);
    // Below the sign-in screen: in sight first, for the mouse writes only where it can reach.
    const ink = sheet.locator("canvas");
    await ink.scrollIntoViewIfNeeded();
    const box = await ink.boundingBox();
    if (box === null) throw new Error("the sheet has no box");
    // Below the element's own row of buttons, which stands over the top of the sheet.
    const y = Math.max(box.y, 0) + 300;
    await page.mouse.move(box.x + 40, y);
    await page.mouse.down();
    for (let i = 1; i <= 5; i++) await page.mouse.move(box.x + 40 + i * 10, y + i * 5);
    await page.mouse.up();
    expect(await page.evaluate(`document.querySelector("novatrail-canvas").history.length`)).toBe(
      1,
    );
    // The page's zoom of the sheet, by the element's own button, lays the sheet out by a custom
    // property it sets through the CSSOM, which style-src leaves be: on an element narrower than
    // the sheet's cap, twice as wide, and scrolled across in a region of its own (T36). The zoom
    // has four steps above its fit.
    const larger = sheet.getByRole("button", { name: "Zoom in" });
    for (let i = 0; i < 8 && (await larger.getAttribute("aria-disabled")) !== "true"; i++) {
      await larger.click();
    }
    expect(await larger.getAttribute("aria-disabled")).toBe("true");
    const across = sheet.getByRole("region", { name: "Sheet" });
    await across.waitFor();
    await expect
      .poll(() => across.evaluate((element) => element.scrollWidth / element.clientWidth))
      .toBeCloseTo(2, 1);
    expect(violations).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("measures the history of writing an answer by mouse (Д4)", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, violations } = await open();
    await page.goto(`${ORIGIN}/`);
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    await page.evaluate(`(() => {
      const sheet = document.createElement("novatrail-canvas");
      sheet.lang = "en";
      sheet.style.blockSize = "40rem";
      document.body.append(sheet);
      sheet.task = {
        id: "rungs",
        statement: [{ text: "How many rungs?" }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        items: [{ answer_slots: [{ binding: "anywhere" }] }],
      };
    })()`);
    const ink = page.locator("novatrail-canvas").locator("canvas");
    await ink.scrollIntoViewIfNeeded();
    const box = await ink.boundingBox();
    if (box === null) throw new Error("the sheet has no box");
    // "180 : 30 = 6, 6 + 1 = 7": twenty strokes of a digit's size, at the pace of a hand — a move
    // every 8 ms, about 40 px a stroke —, two lines of it.
    const top = Math.max(box.y, 0) + 200;
    for (let n = 0; n < 20; n++) {
      const x = box.x + 40 + (n % 10) * 60;
      const y = top + Math.floor(n / 10) * 80;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let i = 1; i <= 16; i++) {
        await page.mouse.move(x + Math.sin(i / 3) * 12 + i, y + i * 2.5);
        await page.waitForTimeout(8);
      }
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
    const measured = JSON.parse(
      await page.evaluate(`(() => {
        const history = document.querySelector("novatrail-canvas").history;
        const strokes = history.filter((event) => event.kind === "write");
        const points = strokes.reduce((sum, event) => sum + event.stroke.points.length, 0);
        return JSON.stringify({ bytes: JSON.stringify(history).length, strokes: strokes.length, points });
      })()`),
    ) as { bytes: number; strokes: number; points: number };
    // Measured 2026-11-10: 20 strokes, 360 points, 23 199 bytes of JSON — about 64 bytes a point,
    // within the estimate of section 3.2. The bounds leave room for the hand's pace.
    expect(measured.strokes).toBe(20);
    expect(measured.points).toBeGreaterThan(20 * 4);
    expect(measured.bytes / measured.points).toBeLessThan(100);
    expect(measured.bytes).toBeLessThan(60_000);
    expect(violations).toEqual([]);
    await page.context().close();
  }, 120_000);

  it("says the app is not set up without the file, in the device's language", async () => {
    rmSync(local, { force: true });
    const { page, violations } = await open("ru-RU");
    await page.goto(`${ORIGIN}/`);
    await page.getByRole("heading", { name: "Приложение не настроено" }).waitFor();
    expect(await page.locator("html").getAttribute("lang")).toBe("ru");
    expect(await page.locator("[data-operator]").textContent()).toBe(
      "For whoever deployed this copy: /deployment.json answered 404.",
    );
    expect(violations).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("names the field of a wrong file", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN, { measurementId: "G-SYNTHETIC" })));
    const { page, violations } = await open();
    await page.goto(`${ORIGIN}/`);
    await page.getByRole("heading", { name: "This app isn't set up" }).waitFor();
    expect(await page.locator("[data-operator]").textContent()).toBe(
      "For whoever deployed this copy: /deployment.json is refused by schema: signIn.measurementId.",
    );
    expect(violations).toEqual([]);
    await page.context().close();
  }, 60_000);

  it("refuses a local file whose api is not the origin of its server, or no JSON, and sends no header from it", async () => {
    const { page } = await open();
    for (const text of [JSON.stringify(file("http://127.0.0.1:8080")), "{"]) {
      writeFileSync(local, text);
      expect((await page.request.get(`${ORIGIN}/deployment.json`)).status()).toBe(404);
      const index = await page.request.get(`${ORIGIN}/`);
      expect(index.status()).toBe(200);
      expect(index.headers()["content-security-policy"]).toBeUndefined();
    }
    await page.context().close();
  }, 60_000);

  it("in a frame of another page shows its own screen and asks for no file, where no header guards it", async () => {
    writeFileSync(bareLocal, JSON.stringify(file(BARE_ORIGIN)));
    const { page, requests } = await open();
    await page.setContent(`<iframe src="${BARE_ORIGIN}/" title="app"></iframe>`);
    const frame = page.frameLocator("iframe");
    await frame.getByRole("heading", { name: "This app opens only in a tab of its own" }).waitFor();
    expect(requests).not.toContain("/deployment.json");
    await page.context().close();
  }, 60_000);

  it("is not shown in a frame at all where the header has frame-ancestors 'none'", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, requests } = await open();
    const answered = page.waitForResponse(`${ORIGIN}/`);
    await page.setContent(`<iframe src="${ORIGIN}/" title="app"></iframe>`);
    await answered;
    await page.waitForLoadState("load");
    // Chrome puts its own error page in the frame in place of app.
    expect(page.frames().map((frame) => frame.url())).toEqual([
      "about:blank",
      "chrome-error://chromewebdata/",
    ]);
    expect(requests).not.toContain("/deployment.json");
    await page.context().close();
  }, 60_000);
});
