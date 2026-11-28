// A task of a module the engine gave, on the sheet of a task from paper in the browser, with the
// canvas element itself: its text and picture drawn as the statement, its options on the tracing
// paper and the one tapped chosen, Check with the strokes and the option, Check with none chosen,
// "You chose" and Try again, Correct and Next task by the engine, the pill of the task skill, the
// module's own hint, no question field but in grown-up mode, and grown-up mode on its attempt; an
// essay on a lined sheet, its strokes by SubmitEssay, its feedback in the panel, Done with the
// criteria of its rubric and Next task — with api on connect-es's router and the storage on the
// device's memory.
import "@altnovatrail/canvas";
import { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  type AskGrownUpRequest,
  AttemptService,
  type DoneRequest,
  type GetCorrectAnswerWordsRequest,
  type GetRungWordsRequest,
  SubmissionEnd,
  type SubmitEssayRequest,
  type SubmitEssayResponseSchema,
  type SubmitWorkRequest,
  type SubmitWorkResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { ChoiceKind } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  type ChooseNextRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { ProgressService } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { WorkService } from "@altnovatrail/contracts/novatrail/api/v1/work_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { setAccount } from "../storage/registry.ts";
import { Task } from "../task/Task.tsx";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { statementPicture, statementPictureOf } from "./statement.ts";

beforeEach(async () => {
  await page.viewport(1194, 834);
});
afterEach(() => cleanup());

const D1 = `sha256:${"1".repeat(64)}`;
const MODULE = "example/olympiad";
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const SLOW = { timeout: 15_000 };

const MANIFEST = {
  module_format_version: "0.4",
  id: MODULE,
  version: "1.0.0",
  title: "Olympiad",
  subject: "mathematics",
  audience: { age_categories: ["under_13"], grades: [1, 2, 3] },
  languages: { explanation: "en" },
  authors: [{ name: "The NovaTrail authors" }],
  license: "Apache-2.0",
};

const TEXT = "The year begins in January. Which month comes after November?";

/** A task answered by an option alone, with a picture under its text. */
const CHOICE: open.Task = {
  id: "months",
  statement: [{ text: TEXT }, { picture: "calendar.png", alt: "A calendar", width: 120 }],
  canvas: { kind: "handwriting_sheet" },
  givens: ["The year begins in January"],
  unknown: "The month after November",
  items: [{ answer_slots: [{ binding: "choice", options: ["October", "December", "January"] }] }],
};

/** A task of a workbook, whose answer is written. */
const WRITTEN: open.Task = {
  id: "sum",
  statement: [{ text: "Fill in the missing number." }],
  canvas: { kind: "workbook" },
  items: [{ line: [{ text: "14 + 28 =" }, { binding: "box" }] }],
};

const SKILLS = {
  skills: {
    counting: { title: "Counting", assessability: "verdict" },
    months: { title: "Months", assessability: "verdict" },
  },
};

/** A short essay with a rubric: its answer slot bound `sheet`. */
const ESSAY: open.Task = {
  id: "umbrella",
  statement: [{ text: "A shop sells an umbrella that can talk. Write three first sentences." }],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

const FEEDBACK = "The first sentence makes a reader want to go on.";

interface Setup {
  readonly task?: open.Task;
  /** How many submissions of the essay api counts as the attempt opens. */
  readonly submissions?: number;
  /** The answer to a submission of an essay. */
  readonly essay?: () => MessageInitShape<typeof SubmitEssayResponseSchema>;
  readonly adult?: boolean;
  /** The answer to a Check. */
  readonly answer?: (
    request: SubmitWorkRequest,
  ) => MessageInitShape<typeof SubmitWorkResponseSchema>;
}

/** A PNG of a calendar, 60 × 30, as the module's media gives it. */
async function calendarPng(): Promise<Blob> {
  const canvas = new OffscreenCanvas(60, 30);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2D context");
  context.fillStyle = "#336699";
  context.fillRect(0, 0, 60, 30);
  return canvas.convertToBlob({ type: "image/png" });
}

async function renderSheet(setup: Setup = {}) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  const task = setup.task ?? CHOICE;
  const submitted: SubmitWorkRequest[] = [];
  const begun: BeginAttemptRequest[] = [];
  const chosen: ChooseNextRequest[] = [];
  const rungs: GetRungWordsRequest[] = [];
  const corrects: GetCorrectAnswerWordsRequest[] = [];
  const grown: AskGrownUpRequest[] = [];
  const essays: SubmitEssayRequest[] = [];
  const dones: DoneRequest[] = [];
  const skills: string[] = [];
  const fetched: string[] = [];
  let taskSkill = "";
  let wrong = 0;
  const api = routedApi((router) => {
    router.service(WorkService, {
      putWork: (request) => ({ work: { attemptId: request.work?.attemptId ?? "" } }),
    });
    router.service(LearningService, {
      getOpenAttempt: (request) => ({
        attempt: {
          start: {
            attemptId: request.attemptId,
            task: { json: encode(task), moduleFormatVersion: "0.4" },
            packageDigest: D1,
          },
          wrongAnswers: 0,
          essaySubmissions: Array.from({ length: setup.submissions ?? 0 }, () => ({
            end: SubmissionEnd.FEEDBACK,
          })),
        },
      }),
      beginAttempt(request) {
        begun.push(request);
        return { attempt: { attemptId: `a${begun.length + 1}`, packageDigest: D1 } };
      },
      chooseNext(request) {
        chosen.push(request);
        return { choice: { kind: ChoiceKind.NOTHING } };
      },
    });
    router.service(AttemptService, {
      submitWork(request) {
        submitted.push(request);
        if (setup.answer !== undefined) {
          const given = setup.answer(request);
          wrong = given.wrongAnswers ?? wrong;
          return given;
        }
        const value = request.tappedChoices[0]?.value;
        const right = value === "December";
        if (!right) wrong += 1;
        const verdict = right ? "correct" : "not_yet";
        return {
          items: [
            {
              verdict,
              answerSlots: [
                { answerSlot: { item: 1, slot: 1 }, verdict, ...(value ? { value } : {}) },
              ],
            },
          ],
          wrongAnswers: wrong,
          ...(right
            ? {
                solved: {},
                next: {
                  next: {
                    case: "choice",
                    value: { kind: ChoiceKind.TASK, choiceId: "choice-2" },
                  },
                },
              }
            : {}),
        };
      },
      submitEssay(request) {
        essays.push(request);
        return setup.essay?.() ?? { end: SubmissionEnd.FEEDBACK, feedback: FEEDBACK };
      },
      done(request) {
        dones.push(request);
        return {
          solved: { criteria: ["Three different first sentences", "One sentence is ringed"] },
          next: { next: { case: "choice", value: { kind: ChoiceKind.TASK, choiceId: "essay-2" } } },
        };
      },
      getRungWords(request) {
        rungs.push(request);
        return { rung: request.wrongAnswers ?? 1, words: "Count the months from January." };
      },
      getCorrectAnswerWords(request) {
        corrects.push(request);
        return { words: "Well done: December closes the year." };
      },
      getHint: () => ({
        hint: { case: "techniques", value: { techniqueIds: ["count-on"] } },
        leadingQuestion: "Which month is the last one?",
      }),
      async askGrownUp(request) {
        grown.push(request);
        return { words: "Done: the answer is circled.", strokes: [], erase: [] };
      },
    });
    router.service(ModuleService, {
      listConnectedModules: () => ({
        modules: [{ moduleId: MODULE, packageDigest: D1, ...(taskSkill ? { taskSkill } : {}) }],
      }),
      setTaskSkill(request) {
        skills.push(request.skill);
        taskSkill = request.skill;
        return { modules: [{ moduleId: MODULE, packageDigest: D1, taskSkill }] };
      },
    });
    router.service(ProgressService, {
      getSkillMap: () => ({
        packageDigest: D1,
        skills: [{ skill: "counting" }, { skill: "months" }],
      }),
    });
    router.service(PackageService, {
      getManifest: () => ({ manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } }),
      getSolvingSteps: () => ({}),
      getTechniques: () => ({
        techniques: {
          json: encode({
            techniques: { "count-on": { title: "Count on", description: "One by one." } },
          }),
          moduleFormatVersion: "0.4",
        },
      }),
      getSkillGraph: () => ({
        skillGraph: { json: encode(SKILLS), moduleFormatVersion: "0.4" },
        skillTiers: { counting: 1, months: 1 },
      }),
    });
  });
  const picture = await calendarPng();
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: { check: vi.fn(async () => {}) } as unknown as PackageChecks,
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn: () => {},
      fetch: async (url) => {
        fetched.push(String(url));
        return new Response(picture);
      },
    }),
  };
  const attempts: (string | undefined)[] = [];
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <Task
            profileId="p1"
            attemptId="a1"
            defaultMode={Mode.BY_STEPS}
            device={device}
            adult={setup.adult ?? false}
            onAttempt={(id) => attempts.push(id)}
            sheet
          />
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  await screen.findByRole("heading", { name: "Task of the module" }, SLOW);
  return {
    submitted,
    begun,
    chosen,
    rungs,
    corrects,
    grown,
    skills,
    fetched,
    attempts,
    essays,
    dones,
  };
}

/** The sheet shown. */
function sheet(): CanvasElement {
  const element = document.querySelector<CanvasElement>("novatrail-canvas");
  if (element === null) throw new Error("no sheet");
  return element;
}

/** A tap on an option of the tracing paper, as the element tells one. */
function tap(option: number) {
  sheet().dispatchEvent(
    new CustomEvent("optiontap", { detail: { option }, bubbles: true, composed: true }),
  );
}

/** A stroke on the sheet, given to it and told as the element tells one. */
function writeOn(element: CanvasElement) {
  const write: HistoryEvent = {
    kind: "write",
    t: 30,
    stroke: {
      id: 1,
      kind: "pen",
      points: [
        { x: 300, y: 900, t: 10, p: 0.5 },
        { x: 340, y: 960, t: 30, p: 0.5 },
      ],
    },
  };
  element.history = [write];
  element.dispatchEvent(
    new CustomEvent("historychange", { detail: { from: 0, events: [write] }, bubbles: true }),
  );
}

const row = () => within(document.querySelector<HTMLElement>(".nt-task-row") as HTMLElement);
const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));

it("opens a module's task on the sheet: its text and picture drawn, its options on the tracing paper", async () => {
  const { fetched } = await renderSheet();
  const paper = sheet().paper;
  expect(paper?.source).toBe("module");
  expect(paper?.options).toEqual(["October", "December", "January"]);
  expect(sheet().chosen).toBeUndefined();
  expect(sheet().reading).toBeUndefined();
  expect(fetched.some((url) => url.endsWith("media/calendar.png"))).toBe(true);
  // The picture of the text and the calendar is taller than the text's alone.
  const drawn = await createImageBitmap(paper?.statement as Blob);
  const text = await createImageBitmap(await statementPicture(TEXT));
  expect(drawn.width).toBe(text.width);
  expect(drawn.height).toBeGreaterThan(text.height);
  // No counter of a page's tasks: the pill of the task skill in its place.
  expect(screen.queryByRole("button", { name: /^Tasks, / })).toBeNull();
});

it("draws a picture that does not decode as nothing, and the text alone as before", async () => {
  const lost = new Blob(["not a picture"], { type: "image/png" });
  const alone = await createImageBitmap(await statementPictureOf([{ text: TEXT }]));
  const withLost = await createImageBitmap(
    await statementPictureOf([{ text: TEXT }, { picture: lost }]),
  );
  expect(withLost.height).toBe(alone.height);
  const wide = await createImageBitmap(
    await statementPictureOf([{ text: TEXT }, { picture: await calendarPng() }]),
  );
  expect(wide.height).toBeGreaterThan(alone.height);
});

it("chooses the option tapped, and Check sends it with the strokes", async () => {
  const { submitted } = await renderSheet();
  tap(1);
  await waitFor(() => expect(sheet().chosen).toBe(1));
  // The same option again changes nothing; another takes its place.
  tap(1);
  tap(2);
  await waitFor(() => expect(sheet().chosen).toBe(2));
  tap(1);
  await waitFor(() => expect(sheet().chosen).toBe(1));
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  await expect.poll(() => submitted.length).toBe(1);
  const sent = submitted[0];
  expect(sent?.tappedChoices.map((t) => [t.answerSlot?.item, t.answerSlot?.slot, t.value])).toEqual(
    [[1, 1, "December"]],
  );
  expect(sent?.work?.surface.case).toBe("sheet");
  const crop = sent?.work?.surface.case === "sheet" ? sent.work.surface.value.crop : undefined;
  expect([...(crop ?? []).slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  expect(await screen.findByText("Correct")).toBeVisible();
  expect(screen.getByText("You chose December")).toBeVisible();
});

it("says to choose an answer first on Check with no option chosen, and sends nothing", async () => {
  const { submitted } = await renderSheet();
  // Open all the same, as the mockup draws it: its press says what is missing.
  const check = row().getByRole("button", { name: "Check" });
  expect(check).toHaveAttribute("aria-disabled", "false");
  await userEvent.click(check);
  const card = await screen.findByText("Tap one of the answers on the task, then Check.");
  expect(
    within(card.parentElement as HTMLElement).getByText("Choose an answer first"),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.queryByText("Tap one of the answers on the task, then Check.")).toBeNull();
  // An option alone, with no stroke, goes with no work.
  tap(0);
  await waitFor(() => expect(sheet().chosen).toBe(0));
  await userEvent.click(check);
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0]?.work).toBeUndefined();
  expect(submitted[0]?.tappedChoices[0]?.value).toBe("October");
  expect(await screen.findByText("Not yet")).toBeVisible();
  expect(screen.getByText("You chose October")).toBeVisible();
  // Try again puts the card away; the option stays chosen.
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.queryByText("Not yet")).toBeNull();
  expect(sheet().chosen).toBe(0);
});

it("says to write first on a task whose answer is written", async () => {
  const { submitted } = await renderSheet({
    task: WRITTEN,
    answer: () => ({
      items: [
        {
          verdict: "not_yet",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "32" }],
        },
      ],
      wrongAnswers: 1,
    }),
  });
  expect(sheet().paper?.options).toBeUndefined();
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  const card = await screen.findByText(
    "Write it with the pen on the sheet or on the task, then Check.",
  );
  expect(
    within(card.parentElement as HTMLElement).getByText("Write your solution first"),
  ).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0]?.tappedChoices).toEqual([]);
  expect(submitted[0]?.work?.surface.case).toBe("sheet");
  expect(await screen.findByText("Read: 32")).toBeVisible();
});

it("asks the rung's words with the work once the panel opens, and the words after Correct", async () => {
  const { rungs, corrects } = await renderSheet();
  tap(0);
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Not yet")).toBeVisible();
  expect(rungs).toHaveLength(0);
  await userEvent.click(row().getByRole("button", { name: "Ask" }));
  expect(await panel().findByText("Count the months from January.")).toBeVisible();
  expect(rungs[0]?.wrongAnswers).toBe(1);
  expect(rungs[0]?.work?.surface.case).toBe("sheet");
  tap(1);
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await panel().findByText("Well done: December closes the year.")).toBeVisible();
  expect(corrects).toHaveLength(1);
  expect(corrects[0]?.attemptId).toBe("a1");
  expect(corrects[0]?.work?.surface.case).toBe("sheet");
});

it("goes on to the task the answer named on Next task, or asks the engine in the task skill", async () => {
  const { begun, chosen, attempts } = await renderSheet();
  tap(1);
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Correct")).toBeVisible();
  await waitFor(() => expect(attempts).toEqual([undefined]));
  await userEvent.click(row().getByRole("button", { name: "Next task" }));
  await expect.poll(() => begun.length).toBe(1);
  expect(begun[0]?.start).toEqual({ case: "choiceId", value: "choice-2" });
  expect(chosen).toHaveLength(0);
});

it("asks the engine among the module's tasks when the answer named none, and says it gave nothing", async () => {
  const { chosen, begun } = await renderSheet({
    answer: () => ({
      solved: {},
      items: [
        {
          verdict: "correct",
          answerSlots: [
            { answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "December" },
          ],
        },
      ],
    }),
  });
  tap(1);
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Correct")).toBeVisible();
  await userEvent.click(row().getByRole("button", { name: "Next task" }));
  await expect.poll(() => chosen.length).toBe(1);
  expect(chosen[0]?.moduleId).toBe(MODULE);
  expect(await screen.findByText(/^There is nothing more to offer for now/)).toBeVisible();
  expect(begun).toHaveLength(0);
});

it("begins the task anew on the same sheet on a Check after Correct", async () => {
  const { begun, submitted, attempts } = await renderSheet();
  tap(1);
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Correct")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  await expect.poll(() => submitted.length).toBe(2);
  expect(begun[0]?.start).toEqual({ case: "previousAttemptId", value: "a1" });
  expect(submitted[1]?.attemptId).toBe("a2");
  expect(attempts).toContain("a2");
  expect(sheet().chosen).toBe(1);
});

it("names the task skill in a pill that opens the choice of it", async () => {
  const { skills } = await renderSheet();
  const pill = await screen.findByRole(
    "button",
    { description: "Choose which tasks to solve" },
    SLOW,
  );
  expect(pill).toHaveTextContent("The tutor picks");
  expect(pill.querySelector(".nt-skill-sign")).toHaveAttribute("data-own", "false");
  await userEvent.click(pill);
  const pick = within(screen.getByRole("dialog", { name: "Which tasks to solve?" }));
  await userEvent.click(pick.getAllByRole("button", { name: "Months" })[0] as HTMLElement);
  await waitFor(() => expect(skills).toEqual([`${MODULE}/skill/months`]));
  await waitFor(() => expect(pill).toHaveTextContent("Months"));
  expect(pill.querySelector(".nt-skill-sign")).toHaveAttribute("data-own", "true");
});

it("gives the module's own hint, and no question field on its task", async () => {
  await renderSheet();
  await userEvent.click(row().getByRole("button", { name: "Hint" }));
  expect(await panel().findByText("Which month is the last one?")).toBeVisible();
  expect(panel().getByText("Count on")).toBeVisible();
  expect(panel().getByText("The year begins in January")).toBeVisible();
  expect(
    panel().getByText(
      "Take a hint: the tutor answers with a question, never with the answer. A program checks every answer.",
    ),
  ).toBeVisible();
  expect(panel().queryByRole("textbox", { name: "Your question about the task" })).toBeNull();
  expect(panel().queryByRole("button", { name: /Show the solution/ })).toBeNull();
});

it("opens the field in grown-up mode, which asks on the module's attempt with the paper's work", async () => {
  const { grown } = await renderSheet({ adult: true });
  const element = sheet();
  Object.assign(element, {
    cropStrokes: vi.fn(() => [{ id: 1, points: [300, 900, 340, 960] }]),
    drawTutor: vi.fn(() => Promise.resolve()),
  });
  writeOn(element);
  await userEvent.click(row().getByRole("button", { name: "Ask" }));
  expect(panel().queryByRole("textbox", { name: "Your question about the task" })).toBeNull();
  await userEvent.click(panel().getByRole("button", { name: "Grown-up mode" }));
  const pad = within(await screen.findByRole("dialog", { name: "Grown-up mode" }));
  for (const digit of "5555") await userEvent.click(pad.getByRole("button", { name: digit }));
  const field = await panel().findByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Circle the answer{Enter}");
  expect(await panel().findByText("Done: the answer is circled.")).toBeVisible();
  expect(grown[0]?.attemptId).toBe("a1");
  const work = grown[0]?.work?.surface;
  if (work?.case !== "paper") throw new Error("no work of the paper");
  expect(work.value.statement).toEqual(
    new Uint8Array(await (sheet().paper as { statement: Blob }).statement.arrayBuffer()),
  );
  expect(work.value.crop.length).toBeGreaterThan(0);
});

it("opens an essay on a lined sheet, its topic on the tracing paper, Done locked between Hint and Check", async () => {
  const { essays } = await renderSheet({ task: ESSAY });
  expect(sheet().grid).toBe("lines");
  expect(sheet().paper?.source).toBe("module");
  expect(sheet().paper?.options).toBeUndefined();
  const names = row()
    .getAllByRole("button")
    .map((button) => button.textContent);
  expect(names.slice(-3)).toEqual(["Hint", "Done", "Check"]);
  // Check first, which a press of Done right after the sheet opens could not come before.
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Write your essay first")).toBeVisible();
  expect(screen.getByText("Write it here with the pen, then Check.")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  const done = row().getByRole("button", { name: "Done" });
  expect(done).toHaveAttribute("aria-disabled", "true");
  expect(done).toHaveAccessibleDescription("Done opens once the essay has been sent");
  // Playwright takes aria-disabled for disabled: the press as the learner's, which the screen takes.
  done.click();
  expect(await screen.findByText("Write the essay, then send it with Check.")).toBeVisible();
  expect(essays).toHaveLength(0);
});

it("sends an essay's strokes by SubmitEssay on Check, and its feedback stands in the panel", async () => {
  const { essays, submitted } = await renderSheet({ task: ESSAY });
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Feedback")).toBeVisible();
  expect(
    screen.getByText("The feedback is in the tutor's panel. Write again, or tap Done."),
  ).toBeVisible();
  expect(essays).toHaveLength(1);
  expect(submitted).toHaveLength(0);
  expect(essays[0]?.attemptId).toBe("a1");
  expect([...(essays[0]?.crop ?? []).slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  // The words are the panel's, marked feedback; the panel has no question field.
  expect(screen.queryByText(FEEDBACK)).toBeNull();
  expect(row().getByRole("button", { name: "Done" })).toHaveAttribute("aria-disabled", "false");
  await userEvent.click(row().getByRole("button", { name: "Ask" }));
  const words = await panel().findByText(FEEDBACK);
  expect(within(words.parentElement as HTMLElement).getByText("Feedback")).toBeVisible();
  expect(
    panel().getByText(
      "Take a hint, or Check: the tutor gives feedback by the essay's criteria, and never writes it for you.",
    ),
  ).toBeVisible();
  expect(panel().queryByRole("textbox", { name: "Your question about the task" })).toBeNull();
  // Check again is another submission, with a key of its own.
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  await expect.poll(() => essays.length).toBe(2);
  expect(essays[1]?.idempotencyKey).not.toBe(essays[0]?.idempotencyKey);
});

it("says why an essay gave no feedback, on its card", async () => {
  await renderSheet({
    task: ESSAY,
    essay: () => ({ end: SubmissionEnd.UNREADABLE, reason: "illegible" }),
  });
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Can't read this")).toBeVisible();
  expect(screen.getByText("It can't be made out")).toBeVisible();
  expect(row().getByRole("button", { name: "Done" })).toHaveAttribute("aria-disabled", "false");
});

it("ends an essay by Done: the criteria of its rubric in the panel, then Next task by the engine", async () => {
  const { dones, begun, attempts } = await renderSheet({ task: ESSAY });
  writeOn(sheet());
  await userEvent.click(row().getByRole("button", { name: "Check" }));
  const card = (await screen.findByText("Feedback")).closest(".nt-card-verdict") as HTMLElement;
  await userEvent.click(within(card).getByRole("button", { name: "Done" }));
  await expect.poll(() => dones.length).toBe(1);
  expect(dones[0]?.attemptId).toBe("a1");
  expect(await panel().findByText("It was finished with Done")).toBeVisible();
  const criteria = panel().getByRole("region", { name: "What the feedback looked at" });
  expect(
    within(criteria)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Three different first sentences", "One sentence is ringed"]);
  // The feedback stays in the panel; the card and Done go, and Next task comes.
  expect(panel().getByText(FEEDBACK)).toBeVisible();
  expect(document.querySelector(".nt-card-verdict")).toBeNull();
  expect(row().queryByRole("button", { name: "Done" })).toBeNull();
  await waitFor(() => expect(attempts).toEqual([undefined]));
  await userEvent.click(panel().getByRole("button", { name: "Next task" }));
  await expect.poll(() => begun.length).toBe(1);
  expect(begun[0]?.start).toEqual({ case: "choiceId", value: "essay-2" });
});

it("opens Done at once on an essay api has a submission of", async () => {
  const { dones } = await renderSheet({ task: ESSAY, submissions: 1 });
  const done = row().getByRole("button", { name: "Done" });
  expect(done).toHaveAttribute("aria-disabled", "false");
  await userEvent.click(done);
  await expect.poll(() => dones.length).toBe(1);
});
