// The screen of a task from paper in the browser: with no camera the photos are the way in;
// the photo goes to FindTasks once, a JPEG encoded anew; its frames come picked, a tap leaves one
// out, and Start begins the picked ones with BeginPaperAttempts; two taps frame a task the AI
// missed; a refusal that shuts AI shuts Start; each task begun is a sheet under its crop, the list
// goes from one to another and back to the page, and Check sends the crops, the instruction's with
// a found task that has one, and shows the Check's verdict — So far correct with no answer yet, or
// "Couldn't check this one" when nothing was read — and its words a bubble an adult may report; the
// tutor's panel on the page finds it anew by the learner's request, and Undo brings the frames back;
// on the screen of solving the tutor's panel opens by its button and by Hint, whose opening question
// goes with the work, with the verdict and the hint in it, the rung's words after Not yet, with no
// work and the wavy line, and "Explain differently" once on a rung, and on a
// phone hides the canvas's bar of tools; a task api closed is only to be looked at; a repeat of
// FindTasks finds again, and a Start that failed says why; a photo whose tasks were found on it
// turned upright is turned so on the page, and the page goes on with it; a camera that answers too late is
// stopped; with the device, the page and its work are the profile's history, which "Your pages"
// opens again; the tutor's button and debug's stand in the bottom bars of both screens, debug's only
// for an account with the debug right; the top bar of each holds Back alone, the screen's name its
// heading unseen, clear of the sheet's popovers; grown-up mode behind the grown-ups' PIN, its
// request with the strokes of the crop, and the act drawn on the sheet before its words — with api on
// connect-es's router.
import { AccountService } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  type AskGrownUpRequest,
  type AskGrownUpResponseSchema,
  type AskTutorRequest,
  type AskTutorResponseSchema,
  AttemptService,
  type ExplainDifferentlyResponseSchema,
  type GetHintResponseSchema,
  type GetOpeningWordsRequest,
  type GetRungWordsRequest,
  type GetRungWordsResponseSchema,
  MarkKind,
  type ReadStatementRequest,
  type ReadStatementResponseSchema,
  type ReportProblemRequest,
  type SubmitWorkRequest,
  type SubmitWorkResponseSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { DebugService } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import {
  type BeginPaperAttemptsRequest,
  type BeginPaperAttemptsResponseSchema,
  type FindTasksRequest,
  type FindTasksResponseSchema,
  PaperService,
} from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, server, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { reset as resetDebug } from "../debug/debug.ts";
import type { Language } from "../i18n/language.ts";
import { WORDS } from "../i18n/words.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile, Profile } from "../storage/profile.ts";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { changePens } from "../test/pens.ts";
import { listening, withRecognition } from "../test/recognition.ts";
import { PaperProvider } from "./PaperContext.tsx";
import { PaperScreen } from "./PaperScreen.tsx";
import { MAX_TASKS } from "./page.ts";
import { YourPages } from "./YourPages.tsx";

interface Setup {
  readonly found?: (
    request: FindTasksRequest,
  ) =>
    | MessageInitShape<typeof FindTasksResponseSchema>
    | Promise<MessageInitShape<typeof FindTasksResponseSchema>>;
  /** The answer to each Check, by how many came before it; none refuses it. */
  readonly checked?: (n: number) => MessageInitShape<typeof SubmitWorkResponseSchema>;
  /** The opening question of a Hint before the first wrong answer, by GetOpeningWords. */
  readonly hinted?: string;
  /** The answer to Hint; none, and a task from paper has no techniques yet. */
  readonly hint?: () => MessageInitShape<typeof GetHintResponseSchema>;
  /** The words of each rung asked, by how many came before; none, and api has no GetRungWords. */
  readonly rung?: (n: number) => MessageInitShape<typeof GetRungWordsResponseSchema>;
  /** Each "Explain differently", by how many came before; none, and api has no ExplainDifferently. */
  readonly explained?: (n: number) => MessageInitShape<typeof ExplainDifferentlyResponseSchema>;
  /** Each reading of a statement by Recognise, by how many came before; none, and it is refused. */
  readonly read?: (n: number) => MessageInitShape<typeof ReadStatementResponseSchema>;
  /** The answer to Start; none, an attempt for each task. */
  readonly began?: (tasks: number) => MessageInitShape<typeof BeginPaperAttemptsResponseSchema>;
  /** The learner's share of the quota, in percent; none, and api has no `GetQuota`. */
  readonly quota?: number;
  /** The device that keeps the profile's history, and "Your pages" beside the screen; none keeps nothing. */
  readonly device?: Device;
  /** The camera's stream, or what it comes by; none, and there is no camera. */
  readonly camera?: MediaStream | Promise<MediaStream>;
  /** The account has the debug right; none, and api has no DebugService. */
  readonly debug?: boolean;
  /** The screen's language; none, English. */
  readonly language?: Language;
  /** The learner is of the category adult; none, an adult. */
  readonly adult?: boolean;
  /**
   * The answer to each question, by how many came before; an error fails it; none refuses it; a
   * promise is an answer still awaited.
   */
  readonly asked?: (
    n: number,
  ) =>
    | MessageInitShape<typeof AskTutorResponseSchema>
    | Error
    | Promise<MessageInitShape<typeof AskTutorResponseSchema>>;
  /** The answer to each request in grown-up mode, by how many came before; none refuses it. */
  readonly grown?: (
    n: number,
  ) =>
    | MessageInitShape<typeof AskGrownUpResponseSchema>
    | Error
    | Promise<MessageInitShape<typeof AskGrownUpResponseSchema>>;
}

/** A synthetic photo of a page: a white PNG of 600 × 800 px with two grey stripes. */
async function pagePhoto(): Promise<File> {
  const canvas = new OffscreenCanvas(600, 800);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 600, 800);
  context.fillStyle = "#888888";
  context.fillRect(40, 60, 520, 120);
  context.fillRect(40, 400, 520, 120);
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return new File([blob], "page.png", { type: "image/png" });
}

/**
 * The wait for what a photo or a crop takes to come: each is drawn and encoded anew in the browser,
 * seconds on a busy runner.
 */
const SLOW = { timeout: 15_000 };

/** The screen on its camera; with none, the photos are the way in. */
async function renderCamera(setup: Setup = {}) {
  const camera = setup.camera;
  if (camera !== undefined)
    vi.mocked(navigator.mediaDevices.getUserMedia).mockImplementation(() =>
      Promise.resolve(camera),
    );
  const finds: FindTasksRequest[] = [];
  const begins: BeginPaperAttemptsRequest[] = [];
  const submits: SubmitWorkRequest[] = [];
  const rungs: GetRungWordsRequest[] = [];
  const reads: ReadStatementRequest[] = [];
  const opens: GetOpeningWordsRequest[] = [];
  const reports: ReportProblemRequest[] = [];
  const asks: AskTutorRequest[] = [];
  const grownAsks: AskGrownUpRequest[] = [];
  let explains = 0;
  let attempts = 0;
  const api = routedApi((router) => {
    router.service(AttemptService, {
      submitWork(request) {
        submits.push(request);
        const answer = setup.checked?.(submits.length - 1);
        if (answer === undefined) throw new ConnectError("a refusal", Code.InvalidArgument);
        return answer;
      },
      // Before the first wrong answer a task from paper has no techniques: the opening question.
      getHint() {
        return setup.hint?.() ?? { hint: { case: "techniques", value: {} } };
      },
      readStatement(request) {
        reads.push(request);
        const answer = setup.read?.(reads.length - 1);
        if (answer === undefined) throw new ConnectError("a refusal", Code.InvalidArgument);
        return answer;
      },
      getOpeningWords(request) {
        opens.push(request);
        return { words: setup.hinted ?? "" };
      },
      async askTutor(request) {
        asks.push(request);
        const answer = await setup.asked?.(asks.length - 1);
        if (answer === undefined) throw new ConnectError("a refusal", Code.InvalidArgument);
        if (answer instanceof Error) throw answer;
        return answer;
      },
      async askGrownUp(request) {
        grownAsks.push(request);
        const answer = await setup.grown?.(grownAsks.length - 1);
        if (answer === undefined) throw new ConnectError("a refusal", Code.InvalidArgument);
        if (answer instanceof Error) throw answer;
        return answer;
      },
      reportProblem(request) {
        reports.push(request);
        return { reportId: "r1", reviewBy: timestampFromDate(new Date("2026-11-20T12:00:00Z")) };
      },
      ...(setup.rung === undefined
        ? {}
        : {
            getRungWords(request: GetRungWordsRequest) {
              rungs.push(request);
              return setup.rung?.(rungs.length - 1) ?? {};
            },
          }),
      ...(setup.explained === undefined
        ? {}
        : {
            explainDifferently() {
              explains += 1;
              return setup.explained?.(explains - 1) ?? {};
            },
          }),
    });
    const quota = setup.quota;
    if (quota !== undefined) {
      router.service(AccountService, {
        getQuota: () => ({ share: { profilePercent: quota } }),
      });
    }
    if (setup.debug === true) {
      router.service(DebugService, { getDebug: () => ({}), takeDebugCalls: () => ({}) });
    }
    router.service(PaperService, {
      findTasks(request) {
        finds.push(request);
        return (
          setup.found?.(request) ?? {
            frames: [
              { box: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 } },
              {
                box: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 },
                instruction: { ymin: 20, xmin: 50, ymax: 70, xmax: 950 },
              },
            ],
          }
        );
      },
      beginPaperAttempts(request) {
        begins.push(request);
        const began = setup.began?.(request.tasks);
        if (began !== undefined) return began;
        return {
          attemptIds: Array.from({ length: request.tasks }, () => {
            attempts += 1;
            return `a${attempts}`;
          }),
        };
      },
    });
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        {setup.device === undefined ? (
          <PaperProvider>
            <PaperScreen profileId="p1" adult={setup.adult ?? true} />
          </PaperProvider>
        ) : (
          <PaperProvider profileId="p1" device={setup.device}>
            <YourPages profileId="p1" device={setup.device} />
            <PaperScreen profileId="p1" adult />
          </PaperProvider>
        )}
      </ApiProvider>,
      setup.language,
    ),
  );
  if (setup.camera === undefined)
    await screen.findByText(WORDS[setup.language ?? "en"].text("paper.no-camera"));
  return { finds, begins, submits, rungs, reads, opens, reports, asks, grownAsks };
}

/** A refusal of api for a cause. */
function refusal(cause: Cause, code = Code.FailedPrecondition): ConnectError {
  return new ConnectError("a refusal", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

/** A Check of one task answered Not yet, its wrong answers so many. */
function notYet(wrongAnswers = 1): MessageInitShape<typeof SubmitWorkResponseSchema> {
  return {
    items: [
      {
        verdict: "not_yet",
        answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "84" }],
      },
    ],
    wrongAnswers,
  };
}

/** A synthetic camera: the stream of a white canvas of 600 × 800 px. */
function cameraStream(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 800;
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 600, 800);
  return canvas.captureStream(10);
}

/** The screen given a photo of the page, by the picker. */
async function renderPaper(setup: Setup = {}) {
  const sent = await renderCamera(setup);
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("no picker");
  await userEvent.upload(input, await pagePhoto());
  const title = WORDS[setup.language ?? "en"].text("paper.title");
  await screen.findByRole("heading", { level: 1, name: title }, SLOW);
  return sent;
}

/** The sheet of the task shown. */
function sheet(): CanvasElement {
  const element = document.querySelector<CanvasElement>("novatrail-canvas");
  if (element === null) throw new Error("no sheet");
  return element;
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

/** The page's two tasks begun, the first shown. */
async function solving(given: Setup = {}) {
  const setup = await renderPaper(given);
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  return setup;
}

/** The photo's surface, which takes a frame drawn. */
function drawing(): HTMLElement {
  const surface = document.querySelector<HTMLElement>(".nt-page-draw");
  if (surface === null) throw new Error("no page");
  return surface;
}

/**
 * A pointer pressed on an element at the first place of the photo, moved through the others and
 * lifted at the last, each in thousandths of the photo.
 */
function stroke(target: HTMLElement, points: readonly (readonly [number, number])[]) {
  // A synthetic pointer is no active one, and Firefox, whose mouse is 0, will not capture it.
  target.setPointerCapture = () => {};
  const box = drawing().getBoundingClientRect();
  const at = ([x, y]: readonly [number, number]) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.left + (box.width * x) / 1000,
    clientY: box.top + (box.height * y) / 1000,
  });
  const [first, ...rest] = points;
  if (first === undefined) return;
  target.dispatchEvent(new PointerEvent("pointerdown", at(first)));
  for (const point of rest) target.dispatchEvent(new PointerEvent("pointermove", at(point)));
  target.dispatchEvent(new PointerEvent("pointerup", at(points.at(-1) ?? first)));
}

/** A tap at a place of the photo, in thousandths. */
function tap(x: number, y: number) {
  stroke(drawing(), [[x, y]]);
}

beforeEach(() => {
  vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
    new DOMException("no camera", "NotFoundError"),
  );
});

afterEach(async () => {
  cleanup();
  resetDebug();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await page.viewport(1024, 768);
});

/** The tutor's panel, open. */
function tutorPanel() {
  return within(screen.getByRole("complementary", { name: "Tutor" }));
}

it("reminds to keep names out of the photo", async () => {
  await renderCamera();
  expect(screen.getByText("Keep names out of the photo")).toBeVisible();
});

// WebKit's headless video gives a canvas's stream no size: its viewfinder never takes a photo.
it.skipIf(server.browser === "webkit")(
  "takes the photo by the shutter once the camera is live, and stops the camera when it goes",
  async () => {
    const camera = cameraStream();
    const { finds } = await renderCamera({ camera });
    const video = document.querySelector("video");
    await waitFor(() => expect(video?.videoWidth).toBeGreaterThan(0), SLOW);
    await userEvent.click(screen.getByRole("button", { name: "Take photo" }));
    await screen.findByRole("heading", { level: 1, name: "Your page" }, SLOW);
    await waitFor(() => expect(finds).toHaveLength(1));
    expect(camera.getTracks().map((track) => track.readyState)).toEqual(["ended"]);
  },
);

it("takes photos alone where the browser has no camera to give", async () => {
  vi.spyOn(navigator, "mediaDevices", "get").mockReturnValue(undefined as unknown as MediaDevices);
  await renderCamera();
  expect(screen.queryByRole("button", { name: "Take photo" })).toBeNull();
});

it("stops a camera that answers once the screen is gone, and minds no refusal then", async () => {
  let give: (stream: MediaStream) => void = () => {};
  await renderCamera({ camera: new Promise((done) => (give = done)) });
  cleanup();
  const camera = cameraStream();
  give(camera);
  await waitFor(() =>
    expect(camera.getTracks().map((track) => track.readyState)).toEqual(["ended"]),
  );
  let refuse: (reason: unknown) => void = () => {};
  await renderCamera({ camera: new Promise((_, no) => (refuse = no)) });
  cleanup();
  refuse(new DOMException("no camera", "NotAllowedError"));
});

it("opens the device's photos by its button, and says a picture it cannot read can't be read", async () => {
  const { finds } = await renderCamera();
  const picked = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
  await userEvent.click(screen.getByRole("button", { name: "Choose from photos" }));
  expect(picked).toHaveBeenCalledOnce();
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("no picker");
  // A change with no file picked is none.
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await userEvent.upload(input, new File(["not a picture"], "page.png", { type: "image/png" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "This picture can't be read. Take another photo, or choose one",
  );
  expect(finds).toHaveLength(0);
});

/** The bar's count, its numbers in bold: "{count} of {total} selected" whole. */
/** The card of what the page says above the bar, by its words whole. */
function card(text: string) {
  return screen.findByText(
    (_, element) =>
      element?.classList.contains("nt-page-say") === true && element.textContent === text,
  );
}

function noneCard() {
  return card("No tasks were found. Drag a frame round each task you want to solve");
}

function picks(text: string) {
  return screen.getByText(
    (_, element) =>
      element?.classList.contains("nt-page-count") === true && element.textContent === text,
  );
}

it("sends the photo once, a JPEG encoded anew, and picks the tasks found in the order of the page", async () => {
  const { finds } = await renderPaper();
  const first = await screen.findByRole("button", { name: "Deselect task 1" });
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Deselect task 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("2 tasks found")).toBeVisible();
  expect(picks("2 of 2 selected")).toBeVisible();
  expect(finds).toHaveLength(1);
  const photo = finds[0]?.photo ?? new Uint8Array();
  expect([photo[0], photo[1]]).toEqual([0xff, 0xd8]);
  expect(finds[0]?.idempotencyKey).not.toBe("");
  expect(finds[0]?.clockOffsetMinutes).toBeTypeOf("number");
});

it("removes a task the AI found by its cross", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  const crosses = screen.getAllByRole("button", { name: "Remove the frame" });
  expect(crosses).toHaveLength(2);
  await userEvent.click(crosses[0] as HTMLElement);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Deselect task 2" })).toBeNull());
  expect(screen.getByText("1 task found")).toBeVisible();
  expect(picks("1 of 1 selected")).toBeVisible();
});

it("removes every frame at once, for frames of the learner's own", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Remove all frames" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Remove the frame" })).toBeNull(),
  );
  expect(picks("0 of 0 selected")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Remove all frames" })).toBeNull();
});

it("begins the tasks picked, each a sheet under its crop", async () => {
  const { begins } = await renderPaper();
  await userEvent.click(await screen.findByRole("button", { name: "Deselect task 1" }));
  expect(screen.getByRole("button", { name: "Select task 1" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(picks("1 of 2 selected")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("heading", { name: "Task 2" }, SLOW)).toBeVisible();
  expect(screen.getByRole("button", { name: "Tasks, 1 / 1" })).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(begins[0]?.tasks).toBe(1);
  expect(begins[0]?.profileId).toBe("p1");
  expect(begins[0]?.ownKeyProvider).toBe("");
  // The page's ID, by which api closes the open tasks of another page alone.
  expect(begins[0]?.pageId).toMatch(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/);
  expect(sheet().paper?.statement).toBeInstanceOf(Blob);
  expect(sheet().tracing).toEqual({ at: [180, 60], hidden: false, scale: 1 });
});

it("goes from task to task by ‹, › and the list, each with its own work", async () => {
  await solving();
  expect(screen.getByRole("button", { name: "Previous task" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
  expect(sheet().history).toEqual([]);
  await userEvent.click(screen.getByRole("button", { name: "Previous task" }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 2 / 2" }));
  expect(await screen.findByText("0 of 2 done")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: /Task 1/ }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(sheet().history).toHaveLength(1);
});

it("gives the next task's sheet the pen and the eraser the learner set on the one before", async () => {
  await solving();
  const first = sheet();
  const chosen = changePens(first);
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(sheet()).not.toBe(first);
  await expect.poll(() => sheet().pens).toEqual(chosen);
});

it("goes back to the page by Add, and Start begins only the tasks not begun", async () => {
  const { begins } = await solving();
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 1 / 2" }));
  await userEvent.click(await screen.findByRole("button", { name: "Add" }));
  expect(await screen.findByRole("heading", { name: "Your page" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(sheet().history).toHaveLength(1);
});

it("asks for a solution before Check, then sends the task's crop, the instruction's and the work's", async () => {
  const { submits } = await solving();
  // Only marked disabled while nothing is written, and Playwright would wait for it to be enabled.
  await userEvent.click(screen.getByRole("button", { name: "Check" }), { force: true });
  // The card's line: its title is the hidden description of Check too.
  expect(
    await screen.findByText("Write it with the pen on the sheet or on the task, then Check."),
  ).toBeVisible();
  expect(submits).toHaveLength(0);
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByRole("alert");
  expect(submits).toHaveLength(1);
  const work = submits[0]?.work?.surface;
  if (work?.case !== "paper") throw new Error("no work of a task from paper");
  expect([work.value.statement[1], work.value.crop[1]]).toEqual([0x50, 0x50]);
  // The instruction found above the task, a crop of its own.
  expect(work.value.instruction?.[1]).toBe(0x50);
  expect(submits[0]?.attemptId).toBe("a1");
  // The words come in the language of the screens, which voices them too.
  expect(submits[0]?.wordsLanguage).toBe("en");
  // The second task, found with no instruction, sends none.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await waitFor(() => expect(submits).toHaveLength(2));
  const second = submits[1]?.work?.surface;
  if (second?.case !== "paper") throw new Error("no work of a task from paper");
  expect(second.value.instruction).toHaveLength(0);
});

it("shows the Check's verdict: Not yet, then Correct, which takes no Check again", async () => {
  const verdict = (v: string, value: string) => ({
    items: [{ verdict: v, answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: v, value }] }],
  });
  const { submits } = await solving({
    checked: (n) =>
      n === 0
        ? { ...verdict("not_yet", "84"), wrongAnswers: 1 }
        : { ...verdict("correct", "85"), solved: {} },
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Not yet")).toBeVisible();
  expect(screen.getByText("Read: 84")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(screen.queryByText("Not yet")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Read: 85")).toBeVisible();
  // Told to a screen reader alone: the card shows it.
  const told = screen
    .getAllByRole("status")
    .find((each) => each.textContent === "Correct. Read: 85");
  expect(told).toHaveClass("nt-hidden-label");
  // Marked disabled once solved, and pressed all the same.
  await userEvent.click(screen.getByRole("button", { name: "Check" }), { force: true });
  expect(submits).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 1 / 2" }));
  expect(await screen.findByRole("button", { name: /^Task 1 ?Solved$/ })).toBeVisible();
});

it("checks a frame of several tasks each, with the count and a tick or a cross by each answer", async () => {
  const slot = (item: number, verdict: string) => ({
    verdict,
    answerSlots: [
      {
        answerSlot: { item, slot: 1 },
        verdict,
        value: "85",
        cropBox: { ymin: (item - 1) * 300, xmin: 600, ymax: (item - 1) * 300 + 250, xmax: 900 },
      },
    ],
  });
  await solving({
    checked: () => ({ items: [slot(1, "correct"), slot(2, "not_yet"), slot(3, "correct")] }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  // The card's, beside the screen reader's line of the same words.
  await waitFor(() => {
    const card = document.querySelector<HTMLElement>(".nt-card-verdict");
    if (card === null) throw new Error("no card");
    expect(within(card).getByText("Not yet · 2 of 3 correct")).toBeVisible();
  });
  const marks = sheet().shadowRoot?.querySelectorAll(".marks g[role=img]") ?? [];
  expect([...marks].map((mark) => mark.getAttribute("aria-label"))).toEqual([
    "Task 1: correct",
    "Task 2: not yet",
    "Task 3: correct",
  ]);
  // Try again puts the card away, and the marks with it.
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(sheet().shadowRoot?.querySelectorAll(".marks g[role=img]")).toHaveLength(0);
});

it("says nothing could be read to check, with Hint, Next task and Check again", async () => {
  await solving({
    checked: () => ({
      items: [
        {
          verdict: "unchecked",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "unchecked" }],
        },
      ],
      outcome: { cause: Cause.NO_KEY },
    }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Couldn't check this one")).toBeVisible();
  expect(
    screen.getByText(
      "No solution could be read here. Write it out, then Check again. Hints still work.",
    ),
  ).toBeVisible();
  // Only this Check's outcome: the next one checks again.
  expect(screen.getByRole("button", { name: "Check" })).toHaveAttribute("aria-disabled", "false");
  // The card's Hint, beside the row's.
  expect(screen.getAllByRole("button", { name: "Hint" })).toHaveLength(2);
  const next = screen.getAllByRole("button", { name: "Next task" });
  await userEvent.click(next[next.length - 1] as HTMLElement);
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
});

it("checks the same work anew after a failure of AI, with a new key, and again with a verdict", async () => {
  const { submits } = await solving({
    checked: (n) =>
      n === 0
        ? { outcome: { cause: Cause.AI_FAILURE } }
        : {
            items: [
              {
                verdict: "not_yet",
                answerSlots: [
                  { answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "84" },
                ],
              },
            ],
            wrongAnswers: 1,
          },
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Not checked")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Not yet")).toBeVisible();
  // A verdict is kept: the same work pressed again repeats it.
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await waitFor(() => expect(submits).toHaveLength(3));
  const keys = submits.map((each) => each.idempotencyKey);
  expect(keys[1]).not.toBe(keys[0]);
  expect(keys[2]).toBe(keys[1]);
});

it("opens the tutor's panel by its button: the verdict a line in it, and a card again once it closes", async () => {
  await solving({
    checked: () => ({
      items: [
        {
          verdict: "not_yet",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "84" }],
        },
      ],
      wrongAnswers: 1,
    }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  // A verdict does not open the panel: it is the card.
  expect(await screen.findByText("Read: 84")).toBeVisible();
  expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
  expect(document.querySelector(".nt-card-verdict")).not.toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(document.activeElement).toBe(tutorPanel().getByRole("heading", { name: "Tutor" }));
  expect(tutorPanel().getByText("Read: 84")).toBeVisible();
  expect(document.querySelector(".nt-card-verdict")).toBeNull();
  // Not yet: Hint in the row, which the panel does not repeat at this width, and no way on yet.
  expect(tutorPanel().queryByRole("button", { name: "Hint" })).toBeNull();
  expect(screen.getByRole("button", { name: "Hint" })).toBeVisible();
  expect(tutorPanel().queryByRole("button", { name: "Next task" })).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  const tutor = screen.getByRole("button", { name: "Ask" });
  expect(document.activeElement).toBe(tutor);
  expect(document.querySelector(".nt-card-verdict")).not.toBeNull();
});

it("asks for the tutor's words in the language of the screens, which voices them", async () => {
  const ru = WORDS.ru;
  const { opens } = await renderPaper({ language: "ru", hinted: "Что осталось найти?" });
  await screen.findByRole("button", { name: ru.text("paper.deselect", { n: 1 }) });
  await userEvent.click(screen.getByRole("button", { name: ru.text("paper.start") }));
  await screen.findByRole("heading", { name: ru.text("paper.task", { n: 1 }) }, SLOW);
  await userEvent.click(
    screen.getAllByRole("button", { name: ru.text("task.hint") })[0] as HTMLElement,
  );
  expect(await screen.findByText("Что осталось найти?")).toBeVisible();
  expect(opens.map((each) => each.wordsLanguage)).toEqual(["ru"]);
});

it("opens the panel by the row's Hint, its words a bubble there that strokes do not take away", async () => {
  const { opens } = await solving({ hinted: "What is left to find?" });
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(await tutorPanel().findByText("What is left to find?")).toBeVisible();
  // The opening question asks the Check with the work as it stands: with nothing written, the crop.
  expect(opens).toHaveLength(1);
  expect(opens[0]?.attemptId).toBe("a1");
  expect(opens[0]?.wordsLanguage).toBe("en");
  const asked = opens[0]?.work?.surface;
  if (asked?.case !== "paper") throw new Error("no work of a task from paper");
  expect([asked.value.statement[1], asked.value.crop[1], asked.value.instruction?.[1]]).toEqual([
    0x50, 0x50, 0x50,
  ]);
  expect(tutorPanel().getByText("Hint", { selector: ".nt-bubble-label" })).toBeVisible();
  writeOn(sheet());
  // Once the stroke is drawn again, Check opens, and the hint stands.
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Check" })).toHaveAttribute("aria-disabled", "false"),
  );
  expect(tutorPanel().getByText("What is left to find?")).toBeVisible();
  // Another task, by the top bar's ›, is another conversation; the panel stays open.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(tutorPanel().queryByText("What is left to find?")).toBeNull();
});

it("shows a task with no answer yet and no mistake as So far correct, with no answer read", async () => {
  await solving({
    checked: () => ({
      items: [
        {
          verdict: "so_far_correct",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "so_far_correct" }],
        },
      ],
    }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await waitFor(() => {
    const card = document.querySelector<HTMLElement>(".nt-card-verdict");
    if (card === null) throw new Error("no card");
    expect(card).toHaveAttribute("data-kind", "so-far");
    expect(within(card).getByText("So far correct")).toBeVisible();
  });
  expect(screen.getByText("No mistake yet. Go on to the answer, then Check.")).toBeVisible();
  expect(screen.queryByText(/^Read:/)).toBeNull();
  expect(sheet().marks).toBeUndefined();
  // Not over: the next Check checks again.
  expect(screen.getByRole("button", { name: "Check" })).toHaveAttribute("aria-disabled", "false");
});

it("brings the Check's words as a bubble of the open panel, which an adult may report", async () => {
  const { reports } = await solving({
    checked: () => ({ ...notYet(2), tutorWords: "Count the tens once more." }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await tutorPanel().findByText("Count the tens once more.")).toBeVisible();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Report a problem" }));
  await userEvent.click(screen.getByRole("radio", { name: /Wrong/ }));
  // The report's Send, not the panel's field's.
  const report = within(screen.getByRole("form", { name: "Report a problem with these words" }));
  await userEvent.click(report.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(reports).toHaveLength(1));
  expect(reports[0]?.reply).toBe(TutorReply.RUNG);
  expect(reports[0]?.rung).toBe(2);
  expect(reports[0]?.words).toBe("Count the tens once more.");
  // Another task is another conversation: its words go.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(tutorPanel().queryByText("Count the tens once more.")).toBeNull();
});

it("shows no bubble for a Check that has no words", async () => {
  await solving({ checked: () => notYet() });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await tutorPanel().findByText("Read: 84")).toBeVisible();
  expect(tutorPanel().queryByRole("button", { name: "Report a problem" })).toBeNull();
});

it("brings the rung's words with the wavy line in the open panel, which the paper moved takes away", async () => {
  const { rungs } = await solving({
    checked: () => notYet(),
    rung: () => ({
      rung: 1,
      words: "Look at the tens.",
      marks: [
        {
          kind: MarkKind.WAVY_LINE,
          place: { case: "cropBox", value: { ymin: 100, xmin: 100, ymax: 300, xmax: 600 } },
        },
      ],
    }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await tutorPanel().findByText("Look at the tens.")).toBeVisible();
  expect(rungs).toHaveLength(1);
  expect(rungs[0]?.wrongAnswers).toBe(1);
  // A rung of the ladder the Check kept: no work goes with it.
  expect(rungs[0]?.work).toBeUndefined();
  const kinds = () => sheet().marks?.marks.map((mark) => mark.kind);
  await waitFor(() => expect(kinds()).toContain("wavy_line"));
  sheet().dispatchEvent(
    new CustomEvent("tracingchange", { detail: { at: [200, 90], hidden: false }, bubbles: true }),
  );
  // The canvas puts its marks away with the paper moved: the verdict's context is gone with them.
  await waitFor(() => expect(sheet().marks).toBeUndefined());
  expect(sheet().tracing).toEqual({ at: [200, 90], hidden: false, scale: 1 });
});

it("words the rung anew once by Explain differently, and says when there are no other words", async () => {
  await solving({
    checked: (n) => notYet(n + 1),
    rung: (n) => ({ rung: n + 1, words: `Rung ${n + 1}.` }),
    explained: (n) =>
      n === 0 ? { words: "Count the tens again." } : { outcome: { cause: Cause.NO_OTHER_WORDS } },
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await tutorPanel().findByText("Rung 1.");
  await userEvent.click(tutorPanel().getByRole("button", { name: "Explain differently" }));
  expect(await tutorPanel().findByText("Count the tens again.")).toBeVisible();
  // Once on a rung.
  expect(tutorPanel().queryByRole("button", { name: "Explain differently" })).toBeNull();
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await tutorPanel().findByText("Rung 2.");
  await userEvent.click(tutorPanel().getByRole("button", { name: "Explain differently" }));
  expect(await tutorPanel().findByText("The tutor has no other words for this")).toBeVisible();
  expect(tutorPanel().getByText("Rung 2.")).toBeVisible();
});

it("asks Explain differently again after a failure, and spends it on a refusal that says it was asked", async () => {
  await solving({
    checked: () => notYet(),
    rung: () => ({ rung: 1, words: "Look at the tens." }),
    explained: (n) => {
      if (n === 0) throw new ConnectError("down", Code.Internal);
      if (n === 1) throw refusal(Cause.QUOTA, Code.ResourceExhausted);
      throw refusal(Cause.ALREADY_ASKED);
    },
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await tutorPanel().findByText("Look at the tens.");
  const explain = () => tutorPanel().getByRole("button", { name: "Explain differently" });
  await userEvent.click(explain());
  expect(
    await tutorPanel().findByText("This version of the app doesn't know this yet"),
  ).toBeVisible();
  await userEvent.click(explain());
  expect(await tutorPanel().findByText("The tutor can't answer right now")).toBeVisible();
  await userEvent.click(explain());
  await waitFor(() =>
    expect(tutorPanel().queryByRole("button", { name: "Explain differently" })).toBeNull(),
  );
  expect(tutorPanel().getByText("Look at the tens.")).toBeVisible();
});

it("asks the rung's words the closed panel left by Hint, and says nothing of a rung with none", async () => {
  const { rungs } = await solving({
    checked: (n) => notYet(n + 1),
    rung: (n) => {
      if (n === 0) return { rung: 1, words: "Look at the tens.", outcome: { cause: Cause.QUOTA } };
      throw refusal(Cause.NO_RUNG);
    },
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("Not yet");
  expect(rungs).toHaveLength(0);
  const [hint] = screen.getAllByRole("button", { name: "Hint" });
  await userEvent.click(hint as HTMLElement);
  expect(await tutorPanel().findByText("Look at the tens.")).toBeVisible();
  // The words came by platform AI's fallback, its quota spent: why stands beside them.
  expect(tutorPanel().getByText("The tutor can't answer right now")).toBeVisible();
  expect(rungs).toHaveLength(1);
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await waitFor(() => expect(rungs).toHaveLength(2));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Hint" })).toHaveAttribute("aria-disabled", "false"),
  );
  expect(tutorPanel().queryByText("Look at the tens.")).toBeNull();
  expect(tutorPanel().queryByRole("alert")).toBeNull();
});

it("gives a rung's words again by Hint, and makes a task api closed one only to be looked at", async () => {
  let closed = false;
  await solving({
    hint: () => {
      if (closed) throw refusal(Cause.ATTEMPT_CLOSED);
      return { hint: { case: "rung", value: { rung: 2, words: "Again: the tens." } } };
    },
  });
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(await tutorPanel().findByText("Again: the tens.")).toBeVisible();
  closed = true;
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(await tutorPanel().findByText("This task is already over")).toBeVisible();
  await waitFor(() => expect(screen.queryByRole("button", { name: "Hint" })).toBeNull());
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  // The failure of Hint at the foot, and Check's own line beside it.
  expect(screen.getAllByRole("alert")).toHaveLength(1);
  await userEvent.click(screen.getByRole("button", { name: "Check" }), { force: true });
  await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
  for (const alert of screen.getAllByRole("alert"))
    expect(alert).toHaveTextContent("This task is already over");
});

it("reads the statement into its text by Recognise, a reading for its task alone", async () => {
  const { reads } = await solving({ read: () => ({ statements: ["□ + 1 = 3"] }) });
  expect(sheet().reading).toEqual({ state: "ready" });
  const recognise = () =>
    sheet().dispatchEvent(new CustomEvent("tracingread", { detail: null, bubbles: true }));
  recognise();
  await waitFor(() =>
    expect(sheet().reading).toEqual({ state: "done", statements: ["□ + 1 = 3"] }),
  );
  expect(reads).toHaveLength(1);
  expect(reads[0]?.attemptId).toBe("a1");
  expect(reads[0]?.statement.length).toBeGreaterThan(0);
  // The next task has a reading of its own, which api refuses here.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(sheet().reading).toEqual({ state: "ready" });
});

it("gives the paper Recognise again when api refuses the reading, and says why", async () => {
  const { reads } = await solving();
  const key = () => reads.map((each) => each.idempotencyKey);
  // A round trip to the browser: the screen has settled on the task it shows.
  await userEvent.hover(screen.getByRole("button", { name: "Tasks, 1 / 2" }));
  sheet().dispatchEvent(new CustomEvent("tracingread", { detail: null, bubbles: true }));
  expect(await screen.findByRole("alert")).toBeVisible();
  await waitFor(() => expect(sheet().reading).toEqual({ state: "ready" }));
  // A press again repeats the reading by its key.
  sheet().dispatchEvent(new CustomEvent("tracingread", { detail: null, bubbles: true }));
  await waitFor(() => expect(reads).toHaveLength(2));
  expect(new Set(key()).size).toBe(1);
});

it("asks for a solution again when the sheet gives no work at the press", async () => {
  const { submits } = await solving();
  writeOn(sheet());
  vi.spyOn(sheet(), "exportWork").mockResolvedValue(null);
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(
    await screen.findByText("Write it with the pen on the sheet or on the task, then Check."),
  ).toBeVisible();
  expect(submits).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(
    screen.queryByText("Write it with the pen on the sheet or on the task, then Check."),
  ).toBeNull();
});

it("puts away by OK the card of a work that could not be read", async () => {
  await solving({
    checked: () => ({
      items: [
        {
          verdict: "unreadable",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "unreadable" }],
        },
      ],
    }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  const card = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(
      '.nt-card-verdict:not([data-kind="reading"])',
    );
    if (found === null) throw new Error("no card");
    return found;
  });
  await userEvent.click(within(card).getByRole("button", { name: "OK" }));
  await waitFor(() => expect(document.querySelector(".nt-card-verdict")).toBeNull());
});

it("shows the share of the quota in the panel's head, and the next task at its foot once solved", async () => {
  await solving({
    quota: 20,
    checked: () => ({
      items: [
        {
          verdict: "correct",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "85" }],
        },
      ],
      solved: {},
    }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(await tutorPanel().findByText("Tutor time today: 20% used")).toBeVisible();
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await tutorPanel().findByText("Read: 85")).toBeVisible();
  // Solved: no Hint, in the panel or in the row, and the way on in the panel.
  expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Next task" }));
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
});

it("hides the canvas's bar of tools on a phone while the panel is open, its Hint at the panel's foot", async () => {
  await page.viewport(390, 844);
  await solving();
  expect(sheet().hasAttribute("tools-hidden")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await waitFor(() => expect(sheet().hasAttribute("tools-hidden")).toBe(true));
  // The panel hides the row here, so the panel gives Hint itself.
  expect(tutorPanel().getByRole("button", { name: "Hint" })).toBeVisible();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  await waitFor(() => expect(sheet().hasAttribute("tools-hidden")).toBe(false));
});

it("frames a task the AI missed by two taps, and removes it by its cross", async () => {
  await renderPaper({ found: () => ({ frames: [] }) });
  const none = await noneCard();
  expect(none).toBeVisible();
  // A card of its own just above the bar, which keeps its size.
  const bar = document.querySelector(".nt-page-bar");
  expect(none.parentElement?.nextElementSibling).toBe(bar);
  expect(bar?.querySelector(".nt-page-say")).toBeNull();
  expect(none.getBoundingClientRect().bottom).toBeLessThan(bar?.getBoundingClientRect().top ?? 0);
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  tap(100, 100);
  // The corner's card takes the place of no task found's.
  expect(await card("Now tap the opposite corner of the task.")).toBeVisible();
  expect(document.querySelectorAll(".nt-page-say")).toHaveLength(1);
  tap(800, 300);
  const drawn = await screen.findByRole("button", { name: "Deselect your frame, task 1" });
  expect(drawn).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("0 tasks found · 1 framed by you")).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  expect(document.querySelector(".nt-page-say")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Remove the frame" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /your frame/ })).toBeNull());
  expect(await noneCard()).toBeVisible();
});

const DEBUG = "Debug: the models and their answers";

/** The names of the buttons in an element, in the order of the page, which Tab follows. */
function buttonNames(within: Element): string[] {
  return [...within.querySelectorAll("button")].map(
    (button) => button.getAttribute("aria-label") ?? button.textContent ?? "",
  );
}

/** The element the selector finds, or a failure that names it. */
function found(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`no ${selector}`);
  return element;
}

/** Whether a button is a circle of 44 CSS px. */
function round(button: HTMLElement) {
  const box = button.getBoundingClientRect();
  expect(box.width).toBeCloseTo(44, 0);
  expect(box.height).toBeCloseTo(44, 0);
  const radius = getComputedStyle(button).borderRadius;
  expect(radius === "50%" || Number.parseFloat(radius) >= 22).toBe(true);
}

const middle = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.top + box.height / 2;
};

it("puts debug's button and the tutor's at the start of the page's bar, before a line, as the solving's bar has them", async () => {
  await renderPaper({ debug: true });
  const debug = await screen.findByRole("button", { name: DEBUG });
  const tutor = screen.getByRole("button", { name: "Tutor" });
  const bar = found(".nt-page-bar");
  expect(buttonNames(bar)).toEqual([
    DEBUG,
    "Tutor",
    "Select none",
    expect.stringContaining("Start"),
  ]);
  // Nothing stands at the right edge any more.
  expect(document.querySelector(".nt-tutor-call")).toBeNull();
  expect(tutor.getBoundingClientRect().right).toBeLessThan(window.innerWidth / 2);
  // The chat's sign in the accent's words on its tint, the bug in orange on a light orange.
  round(tutor);
  round(debug);
  expect(getComputedStyle(tutor).backgroundColor).toBe("rgba(0, 113, 227, 0.1)");
  expect(getComputedStyle(tutor).color).toBe("rgb(0, 102, 204)");
  expect(getComputedStyle(debug).backgroundColor).toBe("rgb(255, 243, 224)");
  expect(getComputedStyle(debug).color).toBe("rgb(194, 84, 0)");
  // The line between the pair and "Select none", in one row with them.
  const line = found(".nt-page-row > .nt-row-line");
  const none = screen.getByRole("button", { name: "Select none" });
  expect(debug.getBoundingClientRect().right).toBeLessThanOrEqual(
    tutor.getBoundingClientRect().left,
  );
  expect(line.getBoundingClientRect().left).toBeGreaterThan(tutor.getBoundingClientRect().right);
  expect(line.getBoundingClientRect().right).toBeLessThan(none.getBoundingClientRect().left);
  expect(middle(tutor)).toBeCloseTo(middle(none), 0);
  // Tab goes along the bar.
  debug.focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(tutor);
  await userEvent.tab();
  expect(document.activeElement).toBe(none);
  // The debug window opens as before, at the right of the window, not inside the bar's glass.
  await userEvent.click(debug);
  const window_ = screen.getByRole("dialog", { name: "Debug" });
  expect(window_.parentElement).toBe(document.body);
  expect(window_.getBoundingClientRect().right).toBeGreaterThan(window.innerWidth - 20);
  await userEvent.keyboard("{Escape}");
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: DEBUG })),
  );
  // The tutor's panel takes the pair and its line away while it is open, and gives the focus back.
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  expect(document.activeElement).toBe(tutorPanel().getByRole("heading", { name: "Tutor" }));
  expect(screen.queryByRole("button", { name: "Tutor" })).toBeNull();
  expect(screen.queryByRole("button", { name: DEBUG })).toBeNull();
  expect(document.querySelector(".nt-page-row > .nt-row-line")).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Tutor" }));
  expect(await screen.findByRole("button", { name: DEBUG })).toBeVisible();
});

it("keeps the tutor's button and its line in the page's bar without debug, and no debug button", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await new Promise((done) => setTimeout(done, 50));
  const bar = found(".nt-page-bar");
  expect(buttonNames(bar)).toEqual(["Tutor", "Select none", expect.stringContaining("Start")]);
  expect(bar.querySelectorAll(".nt-row-line")).toHaveLength(1);
});

it("keeps the page's bar inside a phone's width, wrapped below its buttons", async () => {
  await page.viewport(360, 780);
  await renderPaper({ debug: true });
  await screen.findByRole("button", { name: "Deselect task 1" });
  await screen.findByRole("button", { name: DEBUG });
  const bar = found(".nt-page-bar");
  expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);
  expect(bar.getBoundingClientRect().right).toBeLessThanOrEqual(360);
  for (const name of ["Tutor", DEBUG, "Select none"])
    expect(screen.getByRole("button", { name }).getBoundingClientRect().right).toBeLessThanOrEqual(
      360,
    );
});

/** The row of the screen of solving. */
function row(): HTMLElement {
  return found(".nt-task-row");
}

it("puts debug, a line, Ask, Hint, a line and Check in the row of solving", async () => {
  await solving({ debug: true });
  const debug = await screen.findByRole("button", { name: DEBUG });
  const ask = screen.getByRole("button", { name: "Ask" });
  expect(buttonNames(row())).toEqual([DEBUG, "Ask", "Hint", "Check"]);
  expect(
    [
      ...row().querySelectorAll(
        ".nt-debug-button, .nt-row-line, .nt-ask, .nt-row-button, .nt-check-button",
      ),
    ].map((part) => part.className.split(" ").find((name) => name !== "nt-icon-button")),
  ).toEqual([
    "nt-debug-button",
    "nt-row-line",
    "nt-ask",
    "nt-row-button",
    "nt-row-line",
    "nt-check-button",
  ]);
  expect(document.querySelector(".nt-tutor-call")).toBeNull();
  expect(row().dataset.fit).toBe("words");
  // Ask: the chat's sign and its word, in the accent's words on its tint; the bug round in orange.
  expect(ask).toHaveAttribute("aria-expanded", "false");
  expect(ask.textContent).toBe("Ask");
  expect(ask.querySelector("svg")).not.toBeNull();
  expect(getComputedStyle(ask).backgroundColor).toBe("rgba(0, 113, 227, 0.1)");
  expect(getComputedStyle(ask).color).toBe("rgb(0, 102, 204)");
  expect(ask.getBoundingClientRect().height).toBeCloseTo(44, 0);
  round(debug);
  for (const button of row().querySelectorAll("button"))
    expect(middle(button)).toBeCloseTo(middle(ask), 0);
  // Tab goes along the row.
  debug.focus();
  await userEvent.tab();
  expect(document.activeElement).toBe(ask);
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hint" }));
  await userEvent.tab();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Check" }));
  // Ask opens the panel and leaves the row with debug's button, the line before Check staying.
  await userEvent.click(ask);
  expect(document.activeElement).toBe(tutorPanel().getByRole("heading", { name: "Tutor" }));
  expect(buttonNames(row())).toEqual(["Hint", "Check"]);
  expect(row().querySelectorAll(".nt-row-line")).toHaveLength(1);
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Ask" }));
});

it("starts the row of solving with Ask where the account has no debug, one line before Check", async () => {
  await solving();
  await new Promise((done) => setTimeout(done, 50));
  expect(buttonNames(row())).toEqual(["Ask", "Hint", "Check"]);
  expect(row().querySelectorAll(".nt-row-line")).toHaveLength(1);
});

it.each([
  [false, "words"],
  [true, "icons"],
])(
  "keeps the row of solving in one line on a phone of 320, debug %s: Ask with its %s",
  async (debug, fit) => {
    await page.viewport(320, 700);
    await solving({ debug });
    if (debug) await screen.findByRole("button", { name: DEBUG });
    await waitFor(() => expect(row().dataset.fit).toBe(fit));
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(row().scrollWidth).toBeLessThanOrEqual(row().clientWidth + 1);
    expect(row().getBoundingClientRect().right).toBeLessThanOrEqual(320);
    for (const button of row().querySelectorAll("button"))
      expect(middle(button)).toBeCloseTo(middle(ask), 0);
    const words = ask.querySelector(".nt-retake-words");
    if (fit === "words") {
      expect(words?.getBoundingClientRect().width).toBeGreaterThan(20);
      return;
    }
    // Its icon alone, its word still its name and now a tooltip too.
    round(ask);
    expect(words?.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    await userEvent.hover(ask);
    await waitFor(() => expect(document.querySelector(".nt-tooltip")?.textContent).toBe("Ask"));
  },
);

it("frames a task by a rectangle dragged corner to corner, after a tap, and resizes it by its corner", async () => {
  await renderPaper({ found: () => ({ frames: [] }) });
  await noneCard();
  tap(100, 100);
  await screen.findByText("Now tap the opposite corner of the task.");
  // Past the corner and back: the frame is where the pointer is lifted, not the farthest it went.
  stroke(drawing(), [
    [200, 200],
    [200.5, 200],
    [800, 700],
    [600, 500],
  ]);
  const drawn = await screen.findByRole("button", { name: "Deselect your frame, task 1" });
  expect(screen.queryByText("Now tap the opposite corner of the task.")).toBeNull();
  const photo = drawing().getBoundingClientRect();
  const box = drawn.getBoundingClientRect();
  expect(box.left - photo.left).toBeCloseTo(photo.width * 0.2, 0);
  expect(box.top - photo.top).toBeCloseTo(photo.height * 0.2, 0);
  expect(box.width).toBeCloseTo(photo.width * 0.4, 0);
  expect(box.height).toBeCloseTo(photo.height * 0.3, 0);
  const width = box.width;

  const corner = screen.getByRole("button", { name: "Resize the frame" });
  // Another pointer's moves are not the corner's.
  corner.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7 }));
  stroke(corner, [
    [600, 500],
    [900, 700],
  ]);
  await waitFor(() => expect(drawn.getBoundingClientRect().width).toBeGreaterThan(width + 10));
  corner.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
});

it("moves a frame the AI found by its middle and resizes it by its corner, and a tap still picks it", async () => {
  await renderPaper({
    found: () => ({ frames: [{ box: { ymin: 100, xmin: 100, ymax: 300, xmax: 500 } }] }),
  });
  const frame = await screen.findByRole("button", { name: "Deselect task 1" });
  const photo = drawing().getBoundingClientRect();
  const before = frame.getBoundingClientRect();
  // A press that stays within the slop moves nothing.
  stroke(frame, [
    [300, 200],
    [300.5, 200.5],
  ]);
  expect(frame.getBoundingClientRect().left).toBeCloseTo(before.left, 1);
  // Dragged by its middle it moves, its size kept, and the click after the drag picks nothing.
  stroke(frame, [
    [300, 200],
    [310, 200],
    [400, 250],
  ]);
  await waitFor(() =>
    expect(frame.getBoundingClientRect().left - before.left).toBeCloseTo(photo.width * 0.1, 0),
  );
  expect(frame.getBoundingClientRect().top - before.top).toBeCloseTo(photo.height * 0.05, 0);
  expect(frame.getBoundingClientRect().width).toBeCloseTo(before.width, 0);
  frame.click();
  expect(frame).toHaveAttribute("aria-pressed", "true");
  // Its corner resizes it, as a frame drawn by hand.
  const corner = screen.getByRole("button", { name: "Resize the frame" });
  stroke(corner, [
    [600, 350],
    [800, 500],
  ]);
  await waitFor(() =>
    expect(frame.getBoundingClientRect().width).toBeCloseTo(photo.width * 0.6, 0),
  );
  expect(frame.getBoundingClientRect().height).toBeCloseTo(photo.height * 0.35, 0);
  // A tap picks it or leaves it out, as before.
  await userEvent.click(frame);
  expect(await screen.findByRole("button", { name: "Select task 1" })).toBe(frame);
});

it("finds the page anew by the learner's request, its own frame staying, and Undo brings the frames back", async () => {
  const column = (n: number) => ({
    box: { ymin: 20 + n * 300, xmin: 20, ymax: 290 + n * 300, xmax: 240 },
  });
  const { finds } = await renderPaper({
    found: (request) =>
      request.request === ""
        ? { frames: [{ box: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 } }] }
        : { frames: [column(0), column(1), column(2)] },
  });
  await screen.findByRole("button", { name: "Deselect task 1" });
  tap(500, 100);
  await screen.findByText("Now tap the opposite corner of the task.");
  tap(900, 300);
  await screen.findByRole("button", { name: /^Deselect your frame/ });
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  const field = await screen.findByRole("textbox", { name: "Your request about the page" });
  // No reminder of names above the field.
  expect(field).not.toHaveAttribute("aria-describedby");
  await userEvent.type(field, "only the first column, each task apart{Enter}");
  expect(await screen.findByText("Found 3 tasks")).toBeVisible();
  expect(screen.getByText("only the first column, each task apart")).toBeVisible();
  const asked = finds[1];
  expect(asked?.request).toBe("only the first column, each task apart");
  expect(asked?.found.map((f) => f.box?.ymax)).toEqual([1000]);
  expect(asked?.drawn).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: /^Deselect task/ })).toHaveLength(3);
  expect(screen.getByRole("button", { name: /^Deselect your frame/ })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(await screen.findByText("The frames are back as they were")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Deselect task/ })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

it("stops a request about the page while its frames are found: the frames as they were, the request back in the field, said so", async () => {
  withRecognition(false);
  let stopped = false;
  const { finds } = await renderPaper({
    found: (request) => {
      if (request.request === "")
        return { frames: [{ box: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 } }] };
      if (!stopped) return never();
      return { frames: [{ box: { ymin: 0, xmin: 0, ymax: 500, xmax: 500 } }] };
    },
  });
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  const field = await screen.findByRole("textbox", { name: "Your request about the page" });
  expect(tutorPanel().queryByRole("button", { name: "Stop" })).toBeNull();
  await userEvent.type(field, "the first half{Enter}");
  const stop = await tutorPanel().findByRole("button", { name: "Stop" });
  expect(tutorPanel().queryByRole("button", { name: "Send" })).toBeNull();
  expect(tutorPanel().getByText("the first half")).toBeVisible();
  stopped = true;
  await userEvent.click(stop);
  await waitFor(() => expect(field).toHaveValue("the first half"));
  const said = "Stopped: your question is back in the field — change it and send it again.";
  expect(tutorPanel().getByText(said)).toBeVisible();
  expect(tutorPanel().queryByText("the first half", { selector: "p" })).toBeNull();
  expect(tutorPanel().queryByRole("button", { name: "Stop" })).toBeNull();
  // The frames as they were, and no Undo: nothing was found.
  expect(screen.getAllByRole("button", { name: /^Deselect task/ })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  await userEvent.type(field, "{Enter}");
  expect(await screen.findByText("Found 1 task")).toBeVisible();
  expect(finds).toHaveLength(3);
  expect(finds[2]?.idempotencyKey).not.toBe(finds[1]?.idempotencyKey);
});

it("turns the photo upright as its tasks were found, and goes on with it turned", async () => {
  const half = { box: { ymin: 0, xmin: 0, ymax: 500, xmax: 500 } };
  const { finds } = await renderPaper({
    found: (request) =>
      request.request === "" ? { frames: [half], turnDegrees: 30 } : { frames: [half] },
  });
  await screen.findByRole("button", { name: "Deselect task 1" }, SLOW);
  // 600 × 800 px turned 30°: 600·cos 30° + 800·sin 30° = 919.6, 600·sin 30° + 800·cos 30° = 992.8.
  const sizeOf = async (picture: Blob) => {
    const bitmap = await createImageBitmap(picture);
    return [bitmap.width, bitmap.height];
  };
  const shown = document.querySelector<HTMLImageElement>(".nt-page-photo img");
  await waitFor(() => expect([shown?.naturalWidth, shown?.naturalHeight]).toEqual([920, 993]));
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  const field = await screen.findByRole("textbox", { name: "Your request about the page" });
  await userEvent.type(field, "the first task{Enter}");
  expect(await screen.findByText("Found 1 task")).toBeVisible();
  const sent = new Blob([(finds[1]?.photo ?? new Uint8Array()) as BlobPart], {
    type: "image/jpeg",
  });
  expect(await sizeOf(sent)).toEqual([920, 993]);
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  // The crop is cut from the photo turned: half of it across and down.
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  const crop = sheet().paper?.statement;
  expect(crop && (await sizeOf(crop))).toEqual([460, 497]);
});

it("finds the page again after a repeat that held no frames, a frame drawn meanwhile staying", async () => {
  let n = 0;
  const { finds } = await renderPaper({
    found: () => {
      n += 1;
      return n === 1
        ? { repeated: true }
        : { frames: [{ box: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 } }] };
    },
  });
  const again = await screen.findByRole("button", { name: "Find the tasks again" });
  expect(screen.getByRole("alert").textContent).toMatch(/^No connection/);
  // A card in red above the bar, its way on at its end.
  expect(screen.getByRole("alert")).toHaveClass("nt-page-say");
  expect(screen.getByRole("alert")).toContainElement(again);
  tap(100, 100);
  await screen.findByText("Now tap the opposite corner of the task.");
  tap(800, 300);
  await screen.findByRole("button", { name: /^Deselect your frame/ });
  await userEvent.click(screen.getByRole("button", { name: "Find the tasks again" }));
  expect(await screen.findByRole("button", { name: /^Deselect task/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /^Deselect your frame/ })).toBeVisible();
  // Each try is an action of its own.
  expect(finds.map((find) => find.idempotencyKey)).toHaveLength(2);
  expect(finds[0]?.idempotencyKey).not.toBe(finds[1]?.idempotencyKey);
});

it("says what AI came to when it found nothing, and that no tasks were found", async () => {
  await renderPaper({ found: () => ({ outcome: { cause: Cause.AI_FAILURE } }) });
  // One card in red: what AI came to, and the way on.
  expect(
    await card("The tutor can't answer right now. Drag a frame round each task you want to solve"),
  ).toBeVisible();
  expect(screen.getByRole("alert")).toHaveClass("nt-page-say");
  expect(document.querySelectorAll(".nt-page-say")).toHaveLength(1);
  expect(screen.queryByText("Without the AI a task from paper can't be checked.")).toBeNull();
});

it("leaves the frames, and no Undo, when the learner's request finds nothing; the panel closes", async () => {
  const { finds } = await renderPaper({
    found: (request) =>
      request.request === ""
        ? { frames: [{ box: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 } }] }
        : { frames: [] },
  });
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  const field = await screen.findByRole("textbox", { name: "Your request about the page" });
  // An empty request is none.
  await userEvent.type(field, "{Enter}");
  expect(finds).toHaveLength(1);
  await userEvent.type(field, "the second column{Enter}");
  expect(await screen.findByText("No tasks found for that")).toBeVisible();
  expect(screen.getByText("The frames stay as they were.")).toBeVisible();
  expect(screen.getAllByRole("button", { name: /^Deselect task/ })).toHaveLength(1);
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
});

it("says why Start failed, repeats it with its key, and shuts it on a refusal that shuts AI", async () => {
  let n = 0;
  const { begins } = await renderPaper({
    began: () => {
      n += 1;
      if (n === 1) return { attemptIds: ["a1"] };
      throw refusal(Cause.QUOTA, Code.ResourceExhausted);
    },
  });
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  // api began one attempt of the two tasks picked.
  expect(await screen.findByRole("alert", {}, SLOW)).toHaveTextContent(
    "This version of the app doesn't know this yet.",
  );
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(
    await screen.findByText("Without the AI a task from paper can't be checked.", {}, SLOW),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  expect(begins.map((begin) => begin.idempotencyKey)).toEqual([
    begins[0]?.idempotencyKey,
    begins[0]?.idempotencyKey,
  ]);
});

it("says a page found as many tasks as start at once may hold more, and when too many are picked", async () => {
  const frames = Array.from({ length: MAX_TASKS }, (_, n) => ({
    box: { ymin: n * 45, xmin: 50, ymax: n * 45 + 40, xmax: 500 },
  }));
  await renderPaper({ found: () => ({ frames }) });
  const most = new RegExp(`^${MAX_TASKS} tasks is the most at once`);
  expect(await screen.findByText(most)).toBeVisible();
  // A card above the bar, which keeps its size.
  expect(document.querySelector(".nt-page-bar .nt-page-say")).toBeNull();
  tap(600, 100);
  await screen.findByText("Now tap the opposite corner of the task.");
  tap(900, 300);
  expect(await screen.findByText(`At most ${MAX_TASKS} tasks start at once.`)).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Select none" }));
  expect(picks(`0 of ${MAX_TASKS + 1} selected`)).toBeVisible();
  expect(screen.getByText(most)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Select all" }));
  expect(picks(`${MAX_TASKS + 1} of ${MAX_TASKS + 1} selected`)).toBeVisible();
});

it("draws the frame as it is dragged, none for a tap, and drops it when the pointer is cancelled", async () => {
  await renderPaper({ found: () => ({ frames: [] }) });
  await noneCard();
  const surface = drawing();
  surface.setPointerCapture = () => {};
  const box = surface.getBoundingClientRect();
  const at = (x: number, y: number) => ({
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.left + (box.width * x) / 1000,
    clientY: box.top + (box.height * y) / 1000,
  });
  surface.dispatchEvent(new PointerEvent("pointerdown", at(200, 200)));
  // Still the size of a tap: no rectangle yet.
  surface.dispatchEvent(new PointerEvent("pointermove", at(201, 201)));
  expect(document.querySelector(".nt-page-live")).toBeNull();
  surface.dispatchEvent(new PointerEvent("pointermove", at(600, 500)));
  const live = await waitFor(() => {
    const found = document.querySelector<HTMLElement>(".nt-page-live");
    if (found === null) throw new Error("no frame being dragged");
    return found;
  });
  expect(live.style.left).toBe("20%");
  expect(live.style.width).toBe("40%");
  // It follows the pointer back.
  surface.dispatchEvent(new PointerEvent("pointermove", at(400, 400)));
  await waitFor(() => expect(live.style.width).toBe("20%"));
  surface.dispatchEvent(new PointerEvent("pointercancel", at(400, 400)));
  await waitFor(() => expect(document.querySelector(".nt-page-live")).toBeNull());
  // A lift after the cancel makes no frame.
  surface.dispatchEvent(new PointerEvent("pointerup", at(600, 500)));
  expect(screen.queryByRole("button", { name: /your frame/ })).toBeNull();
});

it("goes back to Home from the page, and the page goes with it", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Back to Home" }));
  expect(await screen.findByRole("heading", { name: "Photo of a page" })).toBeVisible();
  history.replaceState(null, "", location.pathname);
});

/**
 * The top bar's way back on a screen of a task from paper: its icon alone, 44 at least, named and
 * with a tooltip of its name, its pill no wider than its glass round it, and the screen's name the
 * heading unseen and the document's title.
 */
async function backAlone(title: string) {
  const back = screen.getByRole("button", { name: "Back to Home" });
  expect(back.textContent?.trim()).toBe("");
  const box = back.getBoundingClientRect();
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  const pill = back.closest(".nt-top-pill") as HTMLElement;
  expect(pill.getBoundingClientRect().width).toBeLessThanOrEqual(48.5);
  const heading = screen.getByRole("heading", { level: 1, name: title });
  expect(heading.getBoundingClientRect().width).toBeLessThanOrEqual(1);
  await waitFor(() => expect(document.title).toBe(`${title} — NovaTrail`));
  // The pointer may stand there already, from a press on the way back of the test before.
  await userEvent.unhover(back);
  await userEvent.hover(back);
  await waitFor(() =>
    expect(document.querySelector(".nt-tooltip")?.textContent).toBe("Back to Home"),
  );
  await userEvent.unhover(back);
}

for (const [device, w, h] of [
  ["an iPad in landscape", 1194, 834],
  ["an iPad in portrait", 820, 1180],
  ["a phone", 390, 844],
] as const) {
  it(`shows Back alone on the page and on the screen of solving, the name unseen, on ${device}`, async () => {
    await page.viewport(w, h);
    await renderPaper();
    await screen.findByRole("button", { name: "Deselect task 1" });
    await backAlone("Your page");
    await userEvent.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByRole("heading", { name: "Task 1" }, SLOW);
    await backAlone("Task 1");
  });
}

/** The sheet's own button, by its name, once the sheet has drawn its bar. */
async function sheetButton(name: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await waitFor(() => {
    found = [...(sheet().shadowRoot?.querySelectorAll("button") ?? [])].find(
      (button) => (button.getAttribute("aria-label") ?? button.textContent?.trim()) === name,
    );
    expect(found).toBeDefined();
  });
  return found as HTMLButtonElement;
}

for (const [device, w, h] of [
  ["landscape", 1180, 820],
  ["portrait", 820, 1180],
] as const) {
  it(`keeps Back clear of the popovers of the pen and the eraser on an iPad in ${device}`, async () => {
    await page.viewport(w, h);
    await solving();
    const back = (
      screen.getByRole("button", { name: "Back to Home" }).closest(".nt-top-pill") as HTMLElement
    ).getBoundingClientRect();
    for (const tool of ["Pen", "Eraser"]) {
      const button = await sheetButton(tool);
      const shown = () => sheet().shadowRoot?.querySelector<HTMLElement>(".pop:not([hidden])");
      await userEvent.click(button);
      if (shown() == null) await userEvent.click(button);
      await waitFor(() => expect(shown()).toBeTruthy());
      const pop = (shown() as HTMLElement).getBoundingClientRect();
      const apart =
        pop.left >= back.right ||
        pop.right <= back.left ||
        pop.top >= back.bottom ||
        pop.bottom <= back.top;
      expect(apart).toBe(true);
      await userEvent.keyboard("{Escape}");
    }
  });
}

it("shuts Start when the quota is spent", async () => {
  await renderPaper({
    found: () => {
      throw new ConnectError("quota", Code.ResourceExhausted, undefined, [
        { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.QUOTA }) },
      ]);
    },
  });
  expect(
    await screen.findByText("Without the AI a task from paper can't be checked."),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Find the tasks again" })).toBeNull();
});

it("keeps the page and its work in the profile's history, and opens it again from Your pages", async () => {
  const { device } = memoryDevice();
  await addProfile(device, "p1");
  await solving({ device });
  writeOn(sheet());
  sheet().dispatchEvent(
    new CustomEvent("tracingchange", { detail: { at: [200, 90], hidden: true }, bubbles: true }),
  );
  // The work is written a moment after it changes, and at once when the tab is hidden.
  const profile = await openProfile(device, "p1");
  await waitFor(async () => {
    const [kept] = (await profile?.pages()) ?? [];
    expect(kept?.tasks).toBe(2);
  });
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(async () => {
    const [kept] = (await profile?.pages()) ?? [];
    const tasks = (await profile?.page(kept?.pageId ?? ""))?.tasks ?? [];
    expect(tasks.map((task) => task.history.length)).toEqual([1, 0]);
    expect(tasks[0]?.tracing).toEqual({ at: [200, 90], hidden: true });
  });
  cleanup();

  await renderCamera({ device });
  await userEvent.click(await screen.findByRole("button", { name: "Your pages" }));
  await userEvent.click(screen.getByRole("button", { name: /· 2 tasks$/ }));
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  await waitFor(() => expect(sheet().history).toHaveLength(1));
  expect(sheet().tracing).toEqual({ at: [200, 90], hidden: true, scale: 1 });
  expect(screen.queryByRole("dialog")).toBeNull();
  history.replaceState(null, "", location.pathname);
});

it("marks a task solved in the list of a page opened again, its verdict put away", async () => {
  const { device } = memoryDevice();
  await addProfile(device, "p1");
  await solving({
    device,
    checked: () => ({
      items: [
        {
          verdict: "correct",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "85" }],
        },
      ],
      solved: {},
    }),
  });
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Read: 85")).toBeVisible();
  const profile = await openProfile(device, "p1");
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(async () => {
    const [kept] = (await profile?.pages()) ?? [];
    const tasks = (await profile?.page(kept?.pageId ?? ""))?.tasks ?? [];
    expect(tasks.map((task) => task.solved)).toEqual([true, undefined]);
  });
  cleanup();

  await renderCamera({ device });
  await userEvent.click(await screen.findByRole("button", { name: "Your pages" }));
  await userEvent.click(screen.getByRole("button", { name: /· 2 tasks$/ }));
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  expect(screen.queryByText("Read: 85")).toBeNull();
  const counter = screen.getByRole("button", { name: "Tasks, 1 / 2" });
  await userEvent.click(counter);
  expect(counter).toHaveAttribute("aria-expanded", "true");
  // The head counts the tasks solved; each row says its state under its name.
  expect(await screen.findByText("1 of 2 done")).toBeVisible();
  expect(screen.getByRole("button", { name: /^Task 1 ?Solved$/ })).toBeVisible();
  expect(screen.getByRole("button", { name: /^Task 2 ?Not checked yet$/ })).toBeVisible();
  history.replaceState(null, "", location.pathname);
});

it("says a page of the history is gone when the device keeps it no more, and lists it no more", async () => {
  const { device } = memoryDevice();
  await addProfile(device, "p1");
  await solving({ device });
  cleanup();
  const profile = await openProfile(device, "p1");
  await waitFor(async () => expect(await profile?.pages()).toHaveLength(1));

  vi.spyOn(Profile.prototype, "page").mockResolvedValue(undefined);
  await renderCamera({ device });
  await userEvent.click(await screen.findByRole("button", { name: "Your pages" }));
  await userEvent.click(screen.getByRole("button", { name: /· 2 tasks$/ }));
  expect(await screen.findByRole("alert")).toBeVisible();
  expect(screen.getByText("This page isn't on this device any more")).toBeVisible();
  expect(screen.queryByRole("button", { name: /· 2 tasks$/ })).toBeNull();
});

it("retakes: the page goes, and the camera comes back", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Retake" }));
  expect(await screen.findByRole("heading", { name: "Photo of a page" })).toBeVisible();
});

it("keeps the page's bar and its Start inside a narrow tablet's width, in Russian with debug", async () => {
  await page.viewport(600, 800);
  await renderPaper({ debug: true, language: "ru" });
  await screen.findByRole("button", { name: WORDS.ru.text("paper.deselect", { n: 1 }) });
  await screen.findByRole("button", { name: DEBUG });
  const bar = found(".nt-page-bar");
  expect(bar.scrollWidth).toBeLessThanOrEqual(bar.clientWidth + 1);
  const start = screen.getByRole("button", { name: WORDS.ru.text("paper.start") });
  expect(start.getBoundingClientRect().right).toBeLessThanOrEqual(
    bar.getBoundingClientRect().right,
  );
});

it("sends a request about the page by voice, which the microphone put in the field, for frames", async () => {
  withRecognition(true);
  const { finds } = await renderPaper({
    found: (request) =>
      request.request === ""
        ? { frames: [{ box: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 } }] }
        : { frames: [{ box: { ymin: 0, xmin: 0, ymax: 500, xmax: 1000 } }] },
  });
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  await userEvent.click(tutorPanel().getByRole("button", { name: "Dictate" }));
  await waitFor(() => expect(listening().started).toBe(true));
  expect(listening().lang).toBe("en");
  listening().hear("the first task");
  await userEvent.click(tutorPanel().getByRole("button", { name: "Stop" }));
  await tutorPanel().findByText("From your voice: read it, correct it, then send.");
  await userEvent.click(tutorPanel().getByRole("button", { name: "Send" }));
  expect(await screen.findByText("Found 1 task")).toBeVisible();
  expect(finds[1]?.request).toBe("the first task");
  expect(tutorPanel().getByText("By voice")).toBeVisible();
});

/** The learner's lines of the open panel. */
const questions = () =>
  [...document.querySelectorAll(".nt-tutor-panel p.nt-bubble[data-who='learner']")].map(
    (line) => line.textContent,
  );

it("asks the tutor about the task in the panel's field, with the turns before and the work, and shows the answer", async () => {
  withRecognition(false);
  const { asks } = await solving({
    hinted: "What do you see in the first row?",
    asked: (n) => ({ words: n === 0 ? "What does each row add?" : "Count them once more." }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(await tutorPanel().findByText("What do you see in the first row?")).toBeVisible();
  expect(
    tutorPanel().getByText(
      "Ask about this task by text or voice, or take a hint: the tutor answers with a question, never with the answer. A program checks every answer.",
    ),
  ).toBeVisible();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Why rows?{Shift>}{Enter}{/Shift}Not columns?{Enter}");
  expect(await tutorPanel().findByText("What does each row add?")).toBeVisible();
  expect(questions()).toEqual(["Why rows?\nNot columns?"]);
  const first = asks[0];
  expect(first?.profileId).toBe("p1");
  expect(first?.attemptId).toBe("a1");
  expect(first?.question).toBe("Why rows?\nNot columns?");
  expect(first?.wordsLanguage).toBe("en");
  expect(first?.idempotencyKey).not.toBe("");
  expect(first?.turns.map((turn) => [turn.learner, turn.text])).toEqual([
    [false, "What do you see in the first row?"],
  ]);
  // The work as it stands: nothing written, the task's crop in the place of the work's.
  expect(first?.work?.surface.case).toBe("paper");
  await userEvent.type(field, "And then?{Enter}");
  expect(await tutorPanel().findByText("Count them once more.")).toBeVisible();
  expect(asks[1]?.turns.map((turn) => [turn.learner, turn.text])).toEqual([
    [false, "What do you see in the first row?"],
    [true, "Why rows?\nNot columns?"],
    [false, "What does each row add?"],
  ]);
  expect(asks[1]?.idempotencyKey).not.toBe(first?.idempotencyKey);
  // Another task is another conversation; back on this one, it is as it was.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(questions()).toEqual([]);
  await userEvent.click(screen.getByRole("button", { name: "Previous task" }));
  await screen.findByRole("heading", { name: "Task 1" });
  expect(questions()).toEqual(["Why rows?\nNot columns?", "And then?"]);
});

it("lets an adult report a problem with the tutor's answer to a question", async () => {
  withRecognition(false);
  const { reports } = await solving({ asked: () => ({ words: "Look at the tens." }) });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Where do I start?{Enter}");
  expect(await tutorPanel().findByText("Look at the tens.")).toBeVisible();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Report a problem" }));
  await userEvent.click(screen.getByRole("radio", { name: /Unclear/ }));
  const report = within(screen.getByRole("form", { name: "Report a problem with these words" }));
  await userEvent.click(report.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(reports).toHaveLength(1));
  expect(reports[0]?.reply).toBe(TutorReply.ANSWER);
  expect(reports[0]?.rung).toBe(0);
  expect(reports[0]?.words).toBe("Look at the tens.");
});

it("puts a question that brought no answer back in the field, and sends it again with its key", async () => {
  withRecognition(false);
  const { asks } = await solving({
    asked: (n) =>
      // Past its deadline: no repeat of the client brings it back.
      n === 0 ? new ConnectError("late", Code.DeadlineExceeded) : { words: "Look at the tens." },
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Why tens?{Enter}");
  expect(await tutorPanel().findByText(/^No connection/)).toBeVisible();
  await waitFor(() => expect(field).toHaveValue("Why tens?"));
  expect(questions()).toEqual([]);
  await userEvent.type(field, "{Enter}");
  expect(await tutorPanel().findByText("Look at the tens.")).toBeVisible();
  expect(questions()).toEqual(["Why tens?"]);
  expect(asks).toHaveLength(2);
  expect(asks[1]?.idempotencyKey).toBe(asks[0]?.idempotencyKey);
});

/** An answer that never comes: a request still awaited till Stop calls it off. */
const never = <T,>() => new Promise<T>(() => {});

it("stops a question whose answer is awaited: it goes back to the field, said so, and again under a new key", async () => {
  withRecognition(false);
  const { asks } = await solving({
    asked: (n) => (n === 0 ? never() : { words: "Look at the tens." }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  expect(tutorPanel().queryByRole("button", { name: "Stop" })).toBeNull();
  await userEvent.type(field, "Why tens?{Enter}");
  const stop = await tutorPanel().findByRole("button", { name: "Stop" });
  // Stop stands in place of Send while the answer is awaited.
  expect(tutorPanel().queryByRole("button", { name: "Send" })).toBeNull();
  expect(questions()).toEqual(["Why tens?"]);
  await userEvent.click(stop);
  await waitFor(() => expect(field).toHaveValue("Why tens?"));
  expect(questions()).toEqual([]);
  const said = "Stopped: your question is back in the field — change it and send it again.";
  expect(tutorPanel().getByText(said)).toBeVisible();
  expect(tutorPanel().queryByRole("button", { name: "Stop" })).toBeNull();
  await userEvent.type(field, "{Enter}");
  expect(await tutorPanel().findByText("Look at the tens.")).toBeVisible();
  expect(tutorPanel().queryByText(said)).toBeNull();
  expect(questions()).toEqual(["Why tens?"]);
  expect(asks).toHaveLength(2);
  expect(asks[1]?.idempotencyKey).not.toBe(asks[0]?.idempotencyKey);
});

it("lets an adult ask by voice, and gives a child no microphone", async () => {
  withRecognition(true);
  const { asks } = await solving({ asked: () => ({ words: "What is ten and ten?" }) });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await userEvent.click(tutorPanel().getByRole("button", { name: "Dictate" }));
  await waitFor(() => expect(listening().started).toBe(true));
  listening().hear("why twenty");
  await userEvent.click(tutorPanel().getByRole("button", { name: "Stop" }));
  await userEvent.click(tutorPanel().getByRole("button", { name: "Send" }));
  expect(await tutorPanel().findByText("What is ten and ten?")).toBeVisible();
  expect(asks[0]?.question).toBe("why twenty");
  expect(tutorPanel().getByText("By voice")).toBeVisible();
  cleanup();
  await solving({ adult: false });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  expect(tutorPanel().getByRole("textbox", { name: "Your question about the task" })).toBeVisible();
  expect(tutorPanel().queryByRole("button", { name: "Dictate" })).toBeNull();
});

/** The canvas's methods of grown-up mode on the sheet shown, as the tests give them. */
function grownSheet(draw: () => Promise<void> = () => Promise.resolve()) {
  const element = sheet();
  const cropStrokes = vi.fn((_context: unknown) => [{ id: 1, points: [300, 900, 340, 960] }]);
  const drawTutor = vi.fn((_context: unknown, _act: unknown) => draw());
  Object.assign(element, { cropStrokes, drawTutor });
  return { cropStrokes, drawTutor };
}

/** Grown-up mode turned on in the open panel by its key and the grown-ups' PIN. */
async function grownOn() {
  await userEvent.click(tutorPanel().getByRole("button", { name: "Grown-up mode" }));
  const pad = within(await screen.findByRole("dialog", { name: "Grown-up mode" }));
  for (const digit of "5555") await userEvent.click(pad.getByRole("button", { name: digit }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Grown-up mode" })).toBeNull());
}

it("turns grown-up mode on behind the grown-ups' PIN, for this task alone, and off again", async () => {
  await solving();
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  const key = tutorPanel().getByRole("button", { name: "Grown-up mode" });
  expect(key).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(key);
  const dialog = await screen.findByRole("dialog", { name: "Grown-up mode" });
  const pad = within(dialog);
  expect(pad.getByText("Enter your PIN to lift the tutor's limits on this task.")).toBeVisible();
  expect(pad.getByText("The PIN is 5555 for now.")).toBeVisible();
  expect(pad.getByRole("img", { name: "0 of 4 digits" })).toBeVisible();
  expect(
    pad
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent),
  ).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "Cancel", "0", "Delete"]);
  // A wrong PIN clears the dots and says so; a digit taken back by the delete key.
  for (const digit of "123") await userEvent.click(pad.getByRole("button", { name: digit }));
  expect(pad.getByRole("img", { name: "3 of 4 digits" })).toBeVisible();
  await userEvent.click(pad.getByRole("button", { name: "Delete" }));
  expect(pad.getByRole("img", { name: "2 of 4 digits" })).toBeVisible();
  for (const digit of "34") await userEvent.click(pad.getByRole("button", { name: digit }));
  expect(pad.getByRole("alert")).toHaveTextContent("Wrong PIN. Try again.");
  expect(pad.getByRole("img", { name: "0 of 4 digits" })).toBeVisible();
  // Cancel leaves the mode off, and so does Escape.
  await userEvent.click(pad.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(key).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(key);
  await screen.findByRole("dialog", { name: "Grown-up mode" });
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).toBeNull();
  // The digits come by the keyboard too, and the right PIN turns the mode on.
  await userEvent.click(key);
  await screen.findByRole("dialog", { name: "Grown-up mode" });
  await userEvent.keyboard("12{Backspace}");
  expect(screen.getByRole("img", { name: "1 of 4 digits" })).toBeVisible();
  await userEvent.keyboard("{Backspace}5555");
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(key).toHaveAttribute("aria-pressed", "true");
  expect(key).toHaveFocus();
  expect(
    tutorPanel().getByText(
      "No limits, up to the full solution. Turn it off before the child goes on.",
    ),
  ).toBeVisible();
  expect(tutorPanel().getByText("Grown-up mode on")).toBeVisible();
  expect(
    tutorPanel().getByText("The tutor does what the grown-up asks, up to the full solution."),
  ).toBeVisible();
  expect(
    tutorPanel().getByRole("textbox", { name: "Your question about the task" }),
  ).toHaveAttribute("placeholder", "Ask for anything, up to the full solution…");
  // Another task has it off, and so has this one, come back to.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  expect(tutorPanel().getByRole("button", { name: "Grown-up mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await userEvent.click(screen.getByRole("button", { name: "Previous task" }));
  await screen.findByRole("heading", { name: "Task 1" });
  expect(tutorPanel().getByRole("button", { name: "Grown-up mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(
    tutorPanel().queryByText(
      "No limits, up to the full solution. Turn it off before the child goes on.",
    ),
  ).toBeNull();
  // Turn off of the band, and the key pressed while it is on.
  await grownOn();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Turn off" }));
  expect(tutorPanel().getByText("Grown-up mode off")).toBeVisible();
  expect(
    tutorPanel().getByText("The tutor's limits are back: hints and questions, never the answer."),
  ).toBeVisible();
  expect(
    tutorPanel().getByRole("textbox", { name: "Your question about the task" }),
  ).toHaveAttribute("placeholder", "Ask about this task…");
  await grownOn();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Grown-up mode" }));
  expect(tutorPanel().getAllByText("Grown-up mode off")).toHaveLength(2);
});

it("sends a request in grown-up mode with the work and its strokes, draws the act, then says it", async () => {
  withRecognition(false);
  const { grownAsks, asks, reports } = await solving({
    grown: (n) =>
      n === 0
        ? {
            words: "Done: line 1 struck out in red.",
            strokes: [{ points: [290, 930, 350, 930], color: "#e5322d", width: 3.4 }],
            erase: [],
          }
        : { words: "Done: line 1 erased.", erase: [1] },
    asked: () => ({ words: "What do you see now?" }),
  });
  writeOn(sheet());
  let finish = () => {};
  const { cropStrokes, drawTutor } = grownSheet(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await grownOn();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Cross out the first line in red{Enter}");
  await waitFor(() => expect(drawTutor).toHaveBeenCalledOnce());
  // While the act is drawn the head says so, and the tutor's words wait for it.
  expect(tutorPanel().getByText("Writing on the sheet…")).toBeVisible();
  expect(tutorPanel().getByText("The tutor is writing…")).toBeVisible();
  expect(tutorPanel().queryByText("Done: line 1 struck out in red.")).toBeNull();
  const context = cropStrokes.mock.calls[0]?.[0];
  expect(context).toHaveProperty("digest");
  expect(drawTutor.mock.calls[0]).toEqual([
    context,
    {
      strokes: [{ points: [290, 930, 350, 930], color: "#e5322d", width: expect.closeTo(3.4, 5) }],
      erase: [],
    },
  ]);
  finish();
  const said = await tutorPanel().findByText("Done: line 1 struck out in red.");
  expect(said.closest(".nt-bubble")).toHaveAttribute("data-grown", "true");
  expect(
    within(said.closest(".nt-bubble") as HTMLElement).getByText("Grown-up mode"),
  ).toBeVisible();
  expect(tutorPanel().queryByText("Writing on the sheet…")).toBeNull();
  const first = grownAsks[0];
  expect(first?.profileId).toBe("p1");
  expect(first?.attemptId).toBe("a1");
  expect(first?.question).toBe("Cross out the first line in red");
  expect(first?.wordsLanguage).toBe("en");
  expect(first?.idempotencyKey).not.toBe("");
  expect(first?.turns).toEqual([]);
  expect(first?.work?.surface.case).toBe("paper");
  expect(first?.strokes.map(({ id, points }) => [id, [...points]])).toEqual([
    [1, [300, 900, 340, 960]],
  ]);
  expect(asks).toHaveLength(0);
  // The next request carries the conversation before it, the grown-up's turns among it.
  await userEvent.type(field, "Erase it{Enter}");
  await waitFor(() => expect(drawTutor).toHaveBeenCalledTimes(2));
  finish();
  expect(await tutorPanel().findByText("Done: line 1 erased.")).toBeVisible();
  expect(drawTutor.mock.calls[1]?.[1]).toEqual({ strokes: [], erase: [1] });
  expect(grownAsks[1]?.turns.map((turn) => [turn.learner, turn.text])).toEqual([
    [true, "Cross out the first line in red"],
    [false, "Done: line 1 struck out in red."],
  ]);
  // An adult reports the words as an answer of the tutor's.
  const reportLast = tutorPanel().getAllByRole("button", { name: "Report a problem" }).at(-1);
  if (reportLast === undefined) throw new Error("no report");
  await userEvent.click(reportLast);
  await userEvent.click(screen.getByRole("radio", { name: /Unclear/ }));
  const report = within(screen.getByRole("form", { name: "Report a problem with these words" }));
  await userEvent.click(report.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(reports).toHaveLength(1));
  expect(reports[0]?.reply).toBe(TutorReply.ANSWER);
  expect(reports[0]?.words).toBe("Done: line 1 erased.");
  // Off again, the field asks the tutor with its limits, the grown-up's turns before it.
  await userEvent.click(tutorPanel().getByRole("button", { name: "Turn off" }));
  await userEvent.type(field, "What now?{Enter}");
  expect(await tutorPanel().findByText("What do you see now?")).toBeVisible();
  expect(grownAsks).toHaveLength(2);
  expect(asks[0]?.turns.map((turn) => turn.text)).toEqual([
    "Cross out the first line in red",
    "Done: line 1 struck out in red.",
    "Erase it",
    "Done: line 1 erased.",
  ]);
});

it("stops a request in grown-up mode while it is awaited, and draws nothing of it", async () => {
  withRecognition(false);
  const { grownAsks } = await solving({
    grown: (n) => (n === 0 ? never() : { words: "Done.", erase: [] }),
  });
  writeOn(sheet());
  const { drawTutor } = grownSheet();
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await grownOn();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Write the whole solution{Enter}");
  await userEvent.click(await tutorPanel().findByRole("button", { name: "Stop" }));
  await waitFor(() => expect(field).toHaveValue("Write the whole solution"));
  expect(
    tutorPanel().getByText(
      "Stopped: your question is back in the field — change it and send it again.",
    ),
  ).toBeVisible();
  expect(drawTutor).not.toHaveBeenCalled();
  await userEvent.type(field, "{Enter}");
  expect(await tutorPanel().findByText("Done.")).toBeVisible();
  expect(grownAsks).toHaveLength(2);
  expect(grownAsks[1]?.idempotencyKey).not.toBe(grownAsks[0]?.idempotencyKey);
});

it("puts a request in grown-up mode back in the field when no act comes or the sheet takes none", async () => {
  withRecognition(false);
  const { grownAsks } = await solving({
    grown: (n) =>
      [
        { outcome: { cause: Cause.AI_FAILURE } },
        { words: "Done.", strokes: [{ points: [1, 1, 2, 2], color: "#e5322d", width: 3 }] },
        { repeated: true },
        { words: "Done: line 1 erased.", erase: [1] },
      ][n] ?? new ConnectError("no more", Code.InvalidArgument),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await grownOn();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  writeOn(sheet());
  const { drawTutor } = grownSheet();
  // A call of AI that gave no act says what it came to.
  await userEvent.type(field, "Write the solution{Enter}");
  expect(await tutorPanel().findByText("The tutor can't answer right now")).toBeVisible();
  await waitFor(() => expect(field).toHaveValue("Write the solution"));
  expect(drawTutor).not.toHaveBeenCalled();
  // An act the sheet cannot take, as on a stroke erased meanwhile, is none.
  drawTutor.mockImplementationOnce(() => Promise.reject(new TypeError("no stroke 7")));
  await userEvent.type(field, "{Enter}");
  await waitFor(() => expect(drawTutor).toHaveBeenCalledOnce());
  await waitFor(() => expect(field).toHaveValue("Write the solution"));
  expect(tutorPanel().queryByText("Done.")).toBeNull();
  expect(tutorPanel().getByText("The tutor can't answer right now")).toBeVisible();
  // A repeat holds nothing; the request sent once more is a new one.
  await userEvent.type(field, "{Enter}");
  await waitFor(() => expect(grownAsks).toHaveLength(3));
  await waitFor(() => expect(field).toHaveValue("Write the solution"));
  expect(questions()).toEqual([]);
  await userEvent.type(field, "{Enter}");
  expect(await tutorPanel().findByText("Done: line 1 erased.")).toBeVisible();
  expect(questions()).toEqual(["Write the solution"]);
  expect(new Set(grownAsks.map((ask) => ask.idempotencyKey)).size).toBe(4);
});

it("puts the tutor's act on the sheet by canvas's own drawing, one action of the task's history", async () => {
  withRecognition(false);
  const { grownAsks } = await solving({
    grown: () => ({
      words: "Done: line 1 struck out in red.",
      strokes: [{ points: [10, 10, 60, 12], color: "#e5322d", width: 3 }],
      erase: [1],
    }),
  });
  // A stroke in sight, under the task, where the drawing's crop takes it.
  const write: HistoryEvent = {
    kind: "write",
    t: 30,
    stroke: {
      id: 1,
      kind: "pen",
      points: [
        { x: 200, y: 300, t: 10, p: 0.5 },
        { x: 260, y: 320, t: 30, p: 0.5 },
      ],
    },
  };
  sheet().history = [write];
  sheet().dispatchEvent(
    new CustomEvent("historychange", { detail: { from: 0, events: [write] }, bubbles: true }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await grownOn();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Strike out the first line{Enter}");
  expect(await tutorPanel().findByText("Done: line 1 struck out in red.", {}, SLOW)).toBeVisible();
  expect(grownAsks[0]?.strokes.map((stroke) => stroke.id)).toEqual([1]);
  expect(grownAsks[0]?.pixelsPerMm).toBeGreaterThan(0);
  const last = sheet().history.at(-1);
  expect(last?.kind).toBe("tutor");
  if (last?.kind !== "tutor") throw new Error("no act of the tutor");
  expect(last.ids).toEqual([1]);
  expect(last.strokes).toHaveLength(1);
  // The page keeps the act with the task's work: back on the task, it is on the sheet.
  await userEvent.click(screen.getByRole("button", { name: "Next task" }));
  await screen.findByRole("heading", { name: "Task 2" });
  await userEvent.click(screen.getByRole("button", { name: "Previous task" }));
  await screen.findByRole("heading", { name: "Task 1" });
  expect(sheet().history.at(-1)?.kind).toBe("tutor");
});

it("acts on a blank sheet too: the part in sight goes with no strokes, and the act is drawn", async () => {
  withRecognition(false);
  const { grownAsks } = await solving({
    grown: () => ({
      words: "Done: the solution is under the task.",
      strokes: [{ points: [20, 20, 80, 22], color: "#1d1d1f", width: 2 }],
    }),
  });
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  await grownOn();
  const field = tutorPanel().getByRole("textbox", { name: "Your question about the task" });
  await userEvent.type(field, "Write the whole solution{Enter}");
  expect(
    await tutorPanel().findByText("Done: the solution is under the task.", {}, SLOW),
  ).toBeVisible();
  expect(grownAsks[0]?.strokes).toEqual([]);
  const work = grownAsks[0]?.work?.surface;
  if (work?.case !== "paper") throw new Error("no work of a task from paper");
  // PNGs: the sheet in sight, and the task's crop.
  expect([work.value.crop[1], work.value.statement[1]]).toEqual([0x50, 0x50]);
  const last = sheet().history.at(-1);
  if (last?.kind !== "tutor") throw new Error("no act of the tutor");
  expect(last.strokes).toHaveLength(1);
  expect(last.ids).toEqual([]);
});
