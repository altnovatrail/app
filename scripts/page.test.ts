// The test of the built page (section 3.7 of docs/architecture.md; Д9 in RUN.md, in Chromium):
// `vite preview` serves build/ — ci-test builds it first — with app's own plugin, and Chrome
// Headless Shell, from the image the toolchain stage takes it from, opens it. A violation of
// either layer of the CSP fails the test, and so does any request before /deployment.json.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { type PreviewServer, preview } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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

describe("the built page", () => {
  it("has the lower layer first in <head>, and no deployment.json of its own", () => {
    expect(layerIsFirst(readFileSync("build/index.html", "utf8"))).toBe(true);
    expect(existsSync("build/deployment.json")).toBe(false);
    expect(existsSync("build/csp.json")).toBe(true);
    expect(readFileSync("build/deployment.schema.json", "utf8")).toBe(
      readFileSync("spec/deployment/schemas/deployment.schema.json", "utf8"),
    );
  });

  it("starts under both layers of the CSP with the file, and asks for it before anything else", async () => {
    writeFileSync(local, JSON.stringify(file(ORIGIN)));
    const { page, violations, requests } = await open();
    const response = await page.goto(`${ORIGIN}/`);
    expect(response?.headers()["content-security-policy"]).toContain(
      `connect-src 'self' ${ORIGIN}`,
    );
    await page.getByRole("heading", { name: "NovaTrail" }).waitFor();
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
