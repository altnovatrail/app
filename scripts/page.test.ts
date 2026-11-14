// The test of the built page (section 3.7 of docs/architecture.md; Д8 and Д9 in DEBT.md): `vite
// preview` serves build/ — ci-test builds it first — with app's own plugin, and Chrome Headless
// Shell, WebKit and Firefox, from the image the toolchain stage takes them from, open it, each in
// turn (R45). A violation of either layer of the CSP fails the test, and so does any request
// before /deployment.json. The sign-in window goes under the header too, with what Google would
// answer stubbed, and a request to a host section 3.7 does not name fails it. So do a module's
// license and its files from api (R32), and the skill map's element (R34). No file of the build
// names the route to api's development token, which the local build's sign-in takes (R44).
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GetManifestResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { Deployment } from "@altnovatrail/spec/deploymentv1";
import { create, toBinary } from "@bufbuild/protobuf";
import { type Browser, type BrowserType, chromium, firefox, type Page, webkit } from "playwright";
import { type PreviewServer, preview } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LOCAL_TOKEN_PATH } from "../src/signin/token-path.ts";
import { deploymentPart, partText } from "./archive.ts";
import { deployment, layerIsFirst } from "./deployment-plugin.ts";
import { standInForGoogle } from "./google-stub.ts";
import { allowedHosts, hostsAtStart } from "./site.ts";

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
}, 60_000);

afterAll(async () => {
  await server?.close();
  await bare?.close();
  rmSync(folder, { recursive: true, force: true });
});

/**
 * A page that records every violation of the CSP, every request to app's own origins by its path,
 * and the host of every other request, in their order. Apart: WebKit, whose user agent names
 * Safari, has the SDK load gapi and the hidden iframe at every start (section 3.7).
 */
async function open(locale = "en-US"): Promise<{
  page: Page;
  violations: string[];
  requests: string[];
  others: string[];
}> {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  const violations: string[] = [];
  const requests: string[] = [];
  const others: string[] = [];
  await page.exposeFunction("reportViolation", (line: string) => violations.push(line));
  // The page's own script, as text: this program of tsc sees Node, not the DOM.
  await page.addInitScript(`document.addEventListener("securitypolicyviolation", (event) => {
    window.reportViolation(event.effectiveDirective + " " + event.blockedURI);
  });`);
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) violations.push(message.text());
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin === ORIGIN || url.origin === BARE_ORIGIN) requests.push(url.pathname);
    else if (url.protocol === "http:" || url.protocol === "https:") others.push(url.host);
  });
  return { page, violations, requests, others };
}

describe("the build", () => {
  it("has the lower layer first in <head>, and no deployment.json of its own", () => {
    expect(layerIsFirst(readFileSync("build/index.html", "utf8"))).toBe(true);
    expect(existsSync("build/deployment.json")).toBe(false);
    expect(existsSync("build/csp.json")).toBe(true);
    expect(readFileSync("build/deployment.schema.json", "utf8")).toBe(
      partText(deploymentPart(), "schemas/deployment.schema.json"),
    );
  });

  it("holds nothing of the local build's sign-in by the development token (R44)", () => {
    const files = readdirSync("build", { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => join(entry.parentPath, entry.name));
    expect(files.length).toBeGreaterThan(3);
    const naming = files.filter((path) => readFileSync(path).includes(LOCAL_TOKEN_PATH));
    expect(naming).toEqual([]);
  });
});

/** The three engines the page is opened in, each in turn (R45). */
const ENGINES: readonly BrowserType[] = [chromium, webkit, firefox];

describe.each(ENGINES.map((type) => [type.name(), type] as const))(
  "the built page in %s",
  (engine, type) => {
    /** What the page may ask before the tap, and the hosts section 3.7 names, as the site check has them. */
    const early = hostsAtStart(engine, file(ORIGIN) as Deployment);
    const named = allowedHosts(ORIGIN, file(ORIGIN) as Deployment, engine);

    beforeAll(async () => {
      browser = await type.launch({ headless: true });
    }, 60_000);

    afterAll(async () => {
      await browser?.close();
    });

    it("starts under both layers of the CSP with the file, and asks for it before anything else", async () => {
      writeFileSync(local, JSON.stringify(file(ORIGIN)));
      const { page, violations, requests, others } = await open();
      const response = await page.goto(`${ORIGIN}/`);
      expect(response?.headers()["content-security-policy"]).toContain(
        `connect-src 'self' ${ORIGIN}`,
      );
      // Nobody has signed in: the first screen is the sign-in's.
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
      expect(own).toEqual(["/deployment.json"]);
      // Off the origin, nothing but what the SDK loads at the start for Safari, in WebKit.
      expect(
        others.every((host) => early.has(host)),
        others.join(", "),
      ).toBe(true);
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
      await standInForGoogle(page.context(), ORIGIN, () => [HOST], google);
      await page.goto(`${ORIGIN}/`);
      const button = page.getByRole("button", { name: "Sign in with Google" });
      await button.waitFor();
      // On a computer the SDK asks Google nothing before the window (section 4); where it takes the
      // browser for Safari, as in WebKit, it loads gapi and the hidden iframe at the start.
      if (early.size > 0) {
        await expect
          .poll(() => google.some((host) => host === "example-project.firebaseapp.com"))
          .toBe(true);
      }
      expect(
        google.every((host) => early.has(host)),
        google.join(", "),
      ).toBe(true);
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
        google.every((host) => named.has(host)),
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

    it("shows the legal pages before signing in, under the header, reading nothing but api (R31)", async () => {
      writeFileSync(local, JSON.stringify(file(ORIGIN)));
      const { page, violations, requests } = await open();
      await page.goto(`${ORIGIN}/`);
      await page.getByRole("button", { name: "Privacy and legal information" }).click();
      await page.getByRole("button", { name: "Licenses and third-party notices" }).click();
      // NOTICE and LICENSE came with the build, not from the hosting's /NOTICE and /LICENSE.
      const files = page.locator("pre");
      await files.first().waitFor();
      expect(await files.allTextContents()).toEqual([
        readFileSync("NOTICE", "utf8"),
        readFileSync("LICENSE", "utf8"),
      ]);
      await page.getByRole("button", { name: "Back to the list" }).click();
      await page.getByRole("button", { name: "Accessibility" }).click();
      await page.getByRole("heading", { name: "Answering in handwriting" }).waitFor();
      await page.getByRole("button", { name: "Open the privacy policy" }).click();
      // vite preview has no api on its origin: its 404 is no LegalService, so no text in force.
      await page.getByText("This copy of the app has no version of this text in force").waitFor();
      expect(await page.locator("a").count()).toBe(0);
      const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
      expect(own).toEqual(["/deployment.json", "/novatrail.api.v1.LegalService/GetLegalTexts"]);
      expect(violations).toEqual([]);
      await page.context().close();
    }, 60_000);

    it("shows a module's license by its address, under the header, asking only api for it (R32)", async () => {
      writeFileSync(local, JSON.stringify(file(ORIGIN)));
      const { page, violations, requests } = await open();
      const hex = "1".repeat(64);
      const license = "Apache License\n                           Version 2.0, January 2004\n";
      const notice = "Olympiad maths\nCopyright 2026 The NovaTrail authors\n";
      // api is this origin: vite preview has none, so the test answers for it.
      await page.route(`${ORIGIN}/packages/**`, async (route) => {
        const path = new URL(route.request().url()).pathname;
        const body = path.endsWith("/device/LICENSE") ? license : notice;
        await route.fulfill({ contentType: "text/plain; charset=utf-8", body });
      });
      const manifest = new TextEncoder().encode(
        JSON.stringify({
          module_format_version: "0.4",
          id: "novatrail/olympiad-math",
          version: "1.2.0",
          title: "Olympiad maths",
          languages: { explanation: "en" },
          license: "Apache-2.0",
        }),
      );
      await page.route(
        `${ORIGIN}/novatrail.api.v1.PackageService/GetManifest?**`,
        async (route) => {
          const answer = create(GetManifestResponseSchema, {
            manifest: { json: manifest, moduleFormatVersion: "0.4" },
          });
          await route.fulfill({
            contentType: "application/proto",
            body: Buffer.from(toBinary(GetManifestResponseSchema, answer)),
          });
        },
      );
      await page.goto(`${ORIGIN}/#/license/sha256%3A${hex}`);
      const files = page.locator("pre");
      await files.nth(1).waitFor();
      expect(await files.allTextContents()).toEqual([license, notice]);
      await page.getByText("Olympiad maths", { exact: true }).waitFor();
      expect(await page.locator("a").count()).toBe(0);
      const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
      expect(own.sort()).toEqual(
        [
          "/deployment.json",
          "/novatrail.api.v1.PackageService/GetManifest",
          `/packages/sha256-${hex}/device/LICENSE`,
          `/packages/sha256-${hex}/device/NOTICE`,
        ].sort(),
      );
      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      expect(violations).toEqual([]);
      await page.context().close();
    }, 60_000);

    it("shows the page on the AI tutor by its address, under the header, asking api nothing (R33)", async () => {
      writeFileSync(local, JSON.stringify(file(ORIGIN)));
      const { page, violations, requests } = await open();
      await page.goto(`${ORIGIN}/#/tutor`);
      await page
        .getByRole("heading", { level: 1, name: "How to use the AI tutor safely" })
        .waitFor();
      await page.getByRole("heading", { name: "The tutor is an AI" }).waitFor();
      expect(await page.locator("a").count()).toBe(0);
      const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
      expect(own).toEqual(["/deployment.json"]);
      await page.getByRole("button", { name: "Close" }).click();
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      expect(violations).toEqual([]);
      await page.context().close();
    }, 60_000);

    it("takes the skill map's element under the header: its styles, its lines and Practise (R34)", async () => {
      writeFileSync(local, JSON.stringify(file(ORIGIN)));
      const { page, violations, requests } = await open();
      await page.goto(`${ORIGIN}/`);
      await page.getByRole("heading", { name: "Sign in" }).waitFor();
      // The build registered the element before its first render (section 3.1); the test puts one on
      // the page as the map's screen does, with the learner's view and a state, and keeps what
      // Practise sends.
      await page.evaluate(`(() => {
      const map = document.createElement("novatrail-skill-map");
      map.setAttribute("view", "learner");
      map.setAttribute("lang", "en");
      map.addEventListener("skillchoose", (event) => { window.chosen = event.detail.skill; });
      document.body.append(map);
      map.graph = {
        skills: {
          counting: { title: "Counting", assessability: "verdict" },
          halves: { title: "Halves", assessability: "verdict", prerequisites: ["counting"] },
        },
      };
      map.tiers = { counting: 1, halves: 2 };
      map.manifest = {
        module_format_version: "0.4",
        id: "example/probe",
        version: "1.0.0",
        title: "Probe",
        languages: { explanation: "en" },
      };
      map.skillMap = { packageDigest: "", skills: [], anchorSkills: [] };
    })()`);
      const map = page.locator("novatrail-skill-map");
      await map.getByRole("button", { name: /^Counting/ }).click();
      expect(
        await page.evaluate(
          `document.querySelector("novatrail-skill-map").shadowRoot.adoptedStyleSheets.length`,
        ),
      ).toBeGreaterThan(0);
      // The lines of the skill opened are SVG the element builds in the DOM, which no directive bars.
      await expect
        .poll(() =>
          page.evaluate(
            `document.querySelector("novatrail-skill-map").shadowRoot.querySelectorAll("svg.lines path").length`,
          ),
        )
        .toBeGreaterThan(0);
      await map.getByRole("button", { name: "Practise" }).click();
      expect(await page.evaluate("window.chosen")).toBe("example/probe/skill/counting");
      const own = requests.filter((path) => !path.startsWith("/assets/") && path !== "/");
      expect(own).toEqual(["/deployment.json"]);
      expect(violations).toEqual([]);
      await page.context().close();
    }, 60_000);

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
      await frame
        .getByRole("heading", { name: "This app opens only in a tab of its own" })
        .waitFor();
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
      // Each engine leaves its own trace of the document it refused: Chrome its error page, WebKit
      // app's address with nothing run, Firefox no address (measurements 4). app asks for no file.
      const refused: Readonly<Record<string, string>> = {
        chromium: "chrome-error://chromewebdata/",
        webkit: `${ORIGIN}/`,
        firefox: "",
      };
      expect(Object.hasOwn(refused, engine)).toBe(true);
      expect(page.frames().map((frame) => frame.url())).toEqual(["about:blank", refused[engine]]);
      expect(requests).not.toContain("/deployment.json");
      await page.context().close();
    }, 60_000);
  },
);
