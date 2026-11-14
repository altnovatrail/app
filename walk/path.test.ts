// The path of the first slice in a browser, without the author (R44 in docs/decisions.md; section
// 3.7 of docs/architecture.md; R146 spec): the development server of vite.config.ts on port 5173,
// with deployment.local.json, its proxy to the local api — `http://api:8080` unless NOVATRAIL_API
// names another —, and api's development token, which the local build's sign-in takes instead of
// Google's window (R67 api).
// The path runs in each engine NOVATRAIL_WALK_ENGINES names, each in a new context: the sign-in,
// the choice of the learner with the next versions of the legal texts api gives and the page of
// each (R46), the learner, My subjects with the line of the tutor's time, a lesson with a reload in
// it and its task answered in handwriting — a square, a column and a row of strokes, which api's
// stub of tutor reads as can't read this, wrong and right (R66 api) — with the tutor's words, a
// task outside a lesson continued after a reload, the section for adults, the sign-out that erases
// the account's data, and the erasure of everything. It asks no host but the origin and those
// section 3.7 names for the sign-in, and nothing on the way logs an error. Its AI calls are api's
// stub's alone.

import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GetLegalTextsResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { fromBinary } from "@bufbuild/protobuf";
import {
  type Browser,
  type BrowserContext,
  type BrowserType,
  chromium,
  firefox,
  type Locator,
  type Page,
  webkit,
} from "playwright";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it, onTestFailed } from "vitest";
import { TOKEN_FILE } from "../scripts/local-token.ts";
import { isPageText } from "../src/legal/texts.ts";

const ORIGIN = "http://127.0.0.1:5173";
const ENGINES: Readonly<Record<string, BrowserType>> = { chromium, webkit, firefox };
const NAMED = (process.env.NOVATRAIL_WALK_ENGINES ?? "chromium webkit firefox")
  .split(/\s+/)
  .filter((name) => name !== "");
/**
 * What the sign-in may ask besides the origin (section 3.7): Firebase Auth's two hosts, and in
 * WebKit, whose user agent the SDK takes for Safari's, gapi and the hidden iframe at every start —
 * whose own code then asks www.googleapis.com for the project's configuration (measurements 3).
 */
const SIGN_IN_HOSTS = new Set([
  "identitytoolkit.googleapis.com",
  "securetoken.googleapis.com",
  "apis.google.com",
  "novatrail-api-dev.firebaseapp.com",
  "www.googleapis.com",
]);
/** The questions api's stub of tutor words a step with, in English (R66 api). */
const STUB_WORDS =
  /Which step of your work would you check first\?|What does the task ask you to find\?|What is given in the task, in your own words\?/;
/** The databases of the account that the sign-out erases (section 3.2). */
const ACCOUNT_DATABASES = /^novatrail-(profile-.+|registry|cache)$/;

let server: ViteDevServer;

beforeAll(async () => {
  for (const name of NAMED) {
    if (!Object.hasOwn(ENGINES, name)) throw new Error(`walk: no engine ${name}`);
  }
  if (!existsSync("deployment.local.json")) {
    throw new Error("walk: no deployment.local.json: make it from deployment.example.json");
  }
  if (!existsSync(TOKEN_FILE)) {
    throw new Error(`walk: no ${TOKEN_FILE}: run just dev-app in api's container`);
  }
  server = await createServer({ configFile: "vite.config.ts", logLevel: "warn" });
  await server.listen();
});

afterAll(async () => {
  await server?.close();
});

/** A new context of the engine, with what its pages ask and what they log as errors. */
async function open(browser: Browser) {
  const context: BrowserContext = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1280, height: 1200 },
  });
  const foreign: string[] = [];
  const errors: string[] = [];
  context.on("request", (request) => {
    const url = new URL(request.url());
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (url.origin !== ORIGIN && !SIGN_IN_HOSTS.has(url.host)) foreign.push(request.url());
  });
  const watch = (page: Page) => {
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${page.url()}: ${message.text()}`);
    });
    page.on("pageerror", (error) => errors.push(`${page.url()}: ${String(error)}`));
  };
  context.on("page", watch);
  const page = await context.newPage();
  return { context, page, foreign, errors };
}

/** The databases of the origin, read where no script of the app runs. */
async function databases(context: BrowserContext): Promise<string[]> {
  const page = await context.newPage();
  try {
    await page.goto(`${ORIGIN}/deployment.json`);
    const names: string[] = await page.evaluate(
      "indexedDB.databases().then((all) => all.map((database) => database.name ?? ''))",
    );
    return names.sort();
  } finally {
    await page.close();
  }
}

/** "Who is learning?" after a sign-in or a reload, and the learner Dev of api's dev-app. */
async function chooseDev(page: Page) {
  await page.getByRole("heading", { name: "Who is learning?" }).waitFor();
  await page.getByRole("button", { name: "Dev", exact: true }).click();
}

async function home(page: Page) {
  await page.getByRole("heading", { name: "My subjects", exact: true }).waitFor();
}

/** The sheet of the screen, scrolled into view, and its size of a sheet unit in px (1000 wide). */
async function sheet(page: Page) {
  const ink = page.locator("novatrail-canvas canvas").last();
  await ink.scrollIntoViewIfNeeded();
  const box = await ink.boundingBox();
  if (box === null) throw new Error("the sheet has no box");
  return { box, unit: box.width / 1000 };
}

/**
 * Short upright strokes of 25 units each, which the crop takes for writing, not lines: one is a
 * square crop, eight under one another a crop taller than wide, eight side by side one wider than
 * tall (the crop's rule, @altnovatrail/canvas lib/core/crop.js; R66 api).
 */
async function write(page: Page, shape: "square" | "column" | "row") {
  const { box, unit } = await sheet(page);
  const left = box.x + 150 * unit;
  const top = box.y + Math.min(300, box.height / 4);
  const count = shape === "square" ? 1 : 8;
  for (let n = 0; n < count; n++) {
    const x = left + (shape === "row" ? n * 50 * unit : 0);
    const y = top + (shape === "column" ? n * 50 * unit : 0);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) {
      await page.mouse.move(x + i * 0.3, y + ((25 * unit) / 6) * i);
      await page.waitForTimeout(10);
    }
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}

/** The strokes written on the screen's sheet since it was last cleared. */
async function strokes(page: Page): Promise<number> {
  return page.evaluate(`(() => {
    const sheets = document.querySelectorAll("novatrail-canvas");
    let shown = 0;
    for (const event of sheets[sheets.length - 1].history) {
      if (event.kind === "write") shown += 1;
      if (event.kind === "clear") shown = 0;
    }
    return shown;
  })()`);
}

async function clear(page: Page) {
  await page
    .locator("novatrail-canvas")
    .last()
    .getByRole("button", { name: "Clear", exact: true })
    .click();
}

async function check(page: Page) {
  await page.getByRole("button", { name: "Check", exact: true }).click();
}

/** The words of the tutor's block once they came, after "The tutor is writing…". */
async function tutorWords(page: Page): Promise<string> {
  const tutor = page.getByRole("region", { name: "Tutor" });
  const words = tutor.getByText(STUB_WORDS).last();
  await words.waitFor({ timeout: 60_000 });
  return (await words.textContent()) ?? "";
}

/**
 * A task in handwriting answered as the stub reads it: a square — Can't read this; a column — not
 * right yet, the tutor's words and Explain differently; a row — Correct.
 */
async function answerInHandwriting(page: Page) {
  await write(page, "square");
  await check(page);
  await page
    .getByText(/Can't read this/)
    .first()
    .waitFor({ timeout: 60_000 });
  await clear(page);
  await write(page, "column");
  expect(await strokes(page)).toBe(8);
  await check(page);
  await page
    .getByText(/Not right yet: 1 item of 1/)
    .first()
    .waitFor({ timeout: 60_000 });
  const first = await tutorWords(page);
  await page.getByRole("button", { name: "Explain differently" }).click();
  await expect.poll(() => tutorWords(page), { timeout: 60_000 }).not.toBe(first);
  await clear(page);
  await write(page, "row");
  await check(page);
  await page.getByText("Correct", { exact: true }).first().waitFor({ timeout: 60_000 });
}

/** A task by its radios: each option in turn until Correct. */
async function answerByTap(page: Page) {
  const options = page.getByRole("radio");
  const count = await options.count();
  for (let n = 0; n < count; n++) {
    await options.nth(n).check();
    await check(page);
    const outcome = page
      .getByText("Correct", { exact: true })
      .first()
      .or(page.getByText(/Not right yet/).first());
    await outcome.waitFor({ timeout: 60_000 });
    if (await page.getByText("Correct", { exact: true }).first().isVisible()) return;
  }
  throw new Error("no option of the task came back Correct");
}

/** A task answered: by its radios, or in handwriting by the stub's three readings. */
async function answer(page: Page): Promise<"tap" | "handwriting"> {
  // The task's answer comes once its attempt has begun: a sheet, or the radios of a task by tap,
  // which has no sheet — the steps' panel beside a sheet has buttons of its own.
  await page.locator("novatrail-canvas").or(page.getByRole("radio")).first().waitFor();
  if ((await page.locator("novatrail-canvas").count()) === 0) {
    await answerByTap(page);
    return "tap";
  }
  await answerInHandwriting(page);
  return "handwriting";
}

/**
 * A task ended by its solution, which an adult learner may see at once and which calls no AI: the
 * walk spends the profile's quota of the day (R55 api) on the stub's three readings alone.
 */
async function showSolution(page: Page) {
  await page.locator("novatrail-canvas").or(page.getByRole("radio")).first().waitFor();
  await page.getByRole("button", { name: "Show the solution" }).click();
  await page.getByRole("button", { name: "Show it", exact: true }).click();
  await page.getByRole("region", { name: "Solution" }).waitFor();
}

/** The heading of the lesson's segment, "{kind} · {n} of {total}". */
function segment(page: Page): Locator {
  return page.getByRole("heading", { level: 2, name: / · \d+ of \d+$/ });
}

/** Where the lesson is now, without waiting: its segment's heading, or "end" on its last screen. */
async function place(page: Page): Promise<string> {
  if (await page.getByText("Lesson complete").isVisible()) return "end";
  return (await segment(page).allTextContents())[0] ?? "";
}

describe.each(NAMED)("the path in %s", (name) => {
  let browser: Browser;
  let walk: Awaited<ReturnType<typeof open>>;
  let lessonTitle = "";
  const note = (text: string) => console.log(`walk ${name}: ${text}`);

  beforeAll(async () => {
    browser = await (ENGINES[name] as BrowserType).launch();
    walk = await open(browser);
  });

  afterAll(async () => {
    await walk?.context.close();
    await browser?.close();
  });

  const shoot = () =>
    onTestFailed(async () => {
      const path = join(tmpdir(), `walk-${name}-${Date.now()}.png`);
      await walk.page.screenshot({ path, fullPage: true }).catch(() => undefined);
      console.error(`walk: the page at the failure is ${path}`);
      console.error(`walk: errors so far: ${JSON.stringify(walk.errors, null, 1)}`);
      console.error(`walk: at ${walk.page.url()}`);
    });

  it("signs in by the development token and comes to My subjects, with the tutor's time today", async () => {
    shoot();
    const { page } = walk;
    await page.goto(`${ORIGIN}/`);
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    // The choice of the learner reads the legal texts: what api gives, the screen tells of (R46).
    const legal = page.waitForResponse((response) => response.url().includes("/GetLegalTexts"));
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await page.getByRole("heading", { name: "Who is learning?" }).waitFor();
    const given = fromBinary(GetLegalTextsResponseSchema, await (await legal).body());
    // The notice tells of the texts that are legal pages; a family's waits for its screens, E4.
    const pages = given.nextTexts.filter((text) => isPageText(text.id));
    const policy = pages.find((text) => text.id === "privacy-policy");
    const notice = page.getByRole("heading", { name: "New versions of the texts" });
    if (pages.length === 0) {
      note("api gives no next version of a legal page's text");
      // Nothing to tell, once the answer has been read and the screen drawn twice after it.
      await (await legal).finished();
      await page.evaluate(
        "new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))",
      );
      expect(await notice.count()).toBe(0);
    } else {
      note(`api gives ${pages.map((text) => `${text.id} ${text.version}`).join(", ")}`);
      await notice.waitFor();
    }
    if (policy !== undefined) {
      const { version, inForceSince } = policy;
      note(`the privacy policy's version ${version} applies from ${inForceSince}`);
      const read = `Read Privacy Policy, version ${version}`;
      await page.getByRole("button", { name: read, exact: true }).click();
      await page.getByRole("heading", { name: "Privacy Policy: the next version" }).waitFor();
      await page.getByText(new RegExp(`^Version ${version}, applies from `)).waitFor();
      await page.getByRole("button", { name: "Close", exact: true }).click();
    }
    await chooseDev(page);
    await home(page);
    // The platform AI quota share of the profile today (R40; Д20).
    const share = page.getByText(/Tutor time today: \d+\s?% used|Today's tutor time is used up/);
    await share.waitFor({ timeout: 30_000 });
    const used = (await share.textContent()) ?? "";
    note(used);
    // With the day's quota spent, api gives no lesson and begins no task in handwriting (R59 api).
    expect(
      used,
      "walk: the profile of dev-app has spent its tutor time of today: wait for the next day, or run api's just dev-app with API_DEV_APP_UID set to an account of its own (R67 api)",
    ).toMatch(/Tutor time today: \d+\s?% used/);
    const connected = page.getByRole("region", { name: "Connected" });
    if ((await connected.getByRole("article").count()) === 0) {
      await page
        .getByRole("region", { name: "Catalog" })
        .getByRole("button", { name: "Connect", exact: true })
        .first()
        .click();
      await connected.getByRole("article").first().waitFor();
    }
    expect(await connected.getByRole("article").count()).toBeGreaterThan(0);
  });

  it("walks a lesson: Continue, back by its bar, a reload in it, and its task", async () => {
    shoot();
    const { page } = walk;
    // What's next may give a task first: it is answered, and the engine asked again.
    for (let tries = 0; ; tries++) {
      if (tries === 4) throw new Error("What's next gave no lesson");
      // While a task of an earlier walk is open, the button is Something else, which asks first.
      await page.getByRole("button", { name: /^(What's next|Something else)$/ }).click();
      const goOn = page.getByRole("button", { name: "Go on", exact: true });
      await goOn.or(page.locator("h1")).first().waitFor();
      if (await goOn.isVisible()) await goOn.click();
      await page.waitForURL(/#\/(lesson|task)$/, { timeout: 30_000 });
      if (page.url().endsWith("#/lesson")) break;
      await showSolution(page);
      note("What's next gave a task, ended by its solution");
      await page.getByRole("button", { name: "Back to My subjects" }).click();
      await home(page);
    }
    lessonTitle = (await page.getByRole("heading", { level: 1 }).textContent()) ?? "";
    expect(lessonTitle).not.toBe("");
    await segment(page).waitFor();
    const first = await place(page);
    note(`the lesson "${lessonTitle}" opens at "${first}"`);
    const bar = page.getByRole("navigation", { name: "Segments of the lesson" });
    if (!/^Task · /.test(first)) {
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect.poll(() => place(page)).not.toBe(first);
      // Back by the bar to the first segment, then on again.
      await bar.getByRole("button").first().click();
      await expect.poll(() => place(page)).toBe(first);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await expect.poll(() => place(page)).not.toBe(first);
    }
    // A reload in the lesson: the run is in memory, so the way back is Continue the lesson.
    const kept = await place(page);
    await page.reload();
    await chooseDev(page);
    await home(page);
    await page.getByRole("heading", { name: "A lesson in progress" }).first().waitFor();
    // Earlier walks leave their lessons open too: this one is by its title.
    await page
      .locator("section, article, li, div")
      .filter({ has: page.getByRole("heading", { name: lessonTitle, exact: true }) })
      .last()
      .getByRole("button", { name: "Continue the lesson" })
      .click();
    await expect.poll(() => place(page)).toBe(kept);
    // On to the task, answer it, and on to the end.
    for (let steps = 0; ; steps++) {
      if (steps === 30) throw new Error("the lesson did not end");
      const now = await place(page);
      if (now === "end") break;
      const onward = page.getByRole("button", { name: "Continue", exact: true });
      if (/^Task · /.test(now) && !(await onward.isVisible())) {
        await showSolution(page);
        note(`the lesson's task at "${now}", ended by its solution`);
        await onward.waitFor();
      }
      await onward.click();
      await expect.poll(() => place(page)).not.toBe(now);
    }
    await page.getByRole("button", { name: "Back to My subjects" }).click();
    await home(page);
  });

  it("answers a task outside a lesson as the stub reads it, and continues it after a reload", async () => {
    shoot();
    const { page } = walk;
    await page.getByRole("button", { name: "Skill map", exact: true }).click();
    await page.getByRole("button", { name: "Open the map" }).first().click();
    await page.getByRole("heading", { level: 1, name: /^Skill map: / }).waitFor();
    const map = page.locator("novatrail-skill-map");
    await map.getByRole("button").first().waitFor();
    const skills = map.getByRole("button");
    for (let n = 0; ; n++) {
      if (n === (await skills.count())) throw new Error("no skill of the map gives Practise");
      await skills.nth(n).click();
      const practise = map.getByRole("button", { name: "Practise" });
      if (await practise.isVisible()) {
        await practise.click();
        break;
      }
    }
    await page.waitForURL(/#\/task$/, { timeout: 30_000 });
    await page.getByRole("heading", { level: 1, name: "Task" }).waitFor();
    // Can't read this, not right yet with the tutor's words and Explain differently, Correct.
    const kind = await answer(page);
    note(`the skill map's task, answered ${kind}`);
    await page.getByRole("region", { name: "Solution" }).waitFor();
    // Try it again opens a new attempt of the task.
    await page.getByRole("button", { name: "Try it again" }).click();
    await page.getByRole("button", { name: "Check", exact: true }).waitFor();
    if (kind === "tap") return;
    await expect.poll(() => strokes(page)).toBe(0);
    await write(page, "row");
    await expect.poll(() => strokes(page)).toBe(8);
    // Its strokes are on the device: after a reload the task comes back with them (Д14).
    await page.reload();
    await chooseDev(page);
    await page.getByRole("heading", { level: 1, name: "Task" }).waitFor();
    await expect.poll(() => strokes(page)).toBe(8);
    // From My subjects, the same task by Continue the task (Д14).
    await page.goto(`${ORIGIN}/#/home`);
    await home(page);
    await page.getByRole("heading", { name: "There is a task in progress" }).waitFor();
    await page.getByRole("button", { name: "Continue the task" }).click();
    await page.getByRole("heading", { level: 1, name: "Task" }).waitFor();
    await expect.poll(() => strokes(page)).toBe(8);
    // Left unfinished for the sign-out's list, with no check: each check spends the quota.
  });

  it("shows the adults the tutor's time and the progress, with the lesson's name", async () => {
    shoot();
    const { page } = walk;
    await page.goto(`${ORIGIN}/#/home`);
    await home(page);
    await page.getByRole("button", { name: "For grown-ups" }).click();
    await page.getByRole("button", { name: "Profile: Dev" }).click();
    await page.getByRole("heading", { level: 1, name: "Profile: Dev" }).waitFor();
    // The quota share of the profile and of the account (R40; Д20).
    const time = page.getByRole("region", { name: "Tutor time" });
    await time
      .getByText(/This profile: \d+\s?% used|The platform's AI has no tutor time/)
      .waitFor({ timeout: 30_000 });
    await page.getByRole("button", { name: "See the progress" }).click();
    await page.getByRole("heading", { level: 1, name: "Progress: Dev" }).waitFor();
    // The lesson's attempt by the lesson's name, not its local ID (R40; Д20).
    const lesson = page.getByRole("definition").filter({ hasText: lessonTitle });
    await lesson.first().waitFor();
    expect(await lesson.count()).toBeGreaterThan(0);
    await page.getByRole("term").filter({ hasText: "Skills" }).first().waitFor();
    await page.getByRole("button", { name: "Back to the section" }).click();
    await page.getByRole("button", { name: "See what is on this device" }).click();
    await page
      .getByRole("region", { name: "Profile: Dev" })
      .getByText(/1 unfinished task/)
      .waitFor();
    await page.getByRole("button", { name: "Close the section" }).click();
    await home(page);
  });

  it("signs out with the list of unfinished work, and erases the account's data", async () => {
    shoot();
    const { page, context } = walk;
    expect((await databases(context)).filter((db) => ACCOUNT_DATABASES.test(db))).not.toEqual([]);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.getByRole("heading", { level: 1, name: "Sign out?" }).waitFor();
    await page.getByRole("listitem").filter({ hasText: "Dev: 1 unfinished task" }).waitFor();
    await page.getByRole("button", { name: "Sign out and erase" }).click();
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    expect(await page.getByText(/Not all of it was erased/).count()).toBe(0);
    expect((await databases(context)).filter((db) => ACCOUNT_DATABASES.test(db))).toEqual([]);
  });

  it("erases everything on this device, and the heartbeats once the tab is closed (Д13)", async () => {
    shoot();
    const { page, context } = walk;
    await page.getByRole("button", { name: "Sign in with Google" }).click();
    await chooseDev(page);
    await home(page);
    await page.getByRole("button", { name: "For grown-ups" }).click();
    await page.getByRole("button", { name: "See what is on this device" }).click();
    await page.getByRole("button", { name: "Erase everything on this device" }).click();
    await page
      .getByRole("group", { name: /^Everything the app keeps on this device is lost/ })
      .getByRole("button", { name: "Erase", exact: true })
      .click();
    await page.getByRole("heading", { name: "Sign in" }).waitFor();
    // The SDK's connection holds the heartbeats' database until the tab goes.
    await page.close();
    const closed = Date.now();
    await expect
      .poll(() => databases(context), { timeout: 60_000 })
      .not.toContain("firebase-heartbeat-database");
    note(`the heartbeats were gone ${((Date.now() - closed) / 1000).toFixed(1)} s after the tab`);
    const left = await databases(context);
    expect(left.filter((db) => ACCOUNT_DATABASES.test(db) || db === "novatrail-settings")).toEqual(
      [],
    );
    walk.page = await context.newPage();
  });

  it("asked no host but those of the sign-in, and logged no error on the way", () => {
    expect(walk.foreign).toEqual([]);
    expect(walk.errors).toEqual([]);
  });
});
