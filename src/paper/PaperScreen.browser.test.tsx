// The screen of a task from paper in the browser (R71): with no camera the photos are the way in;
// the photo goes to FindTasks once, a JPEG encoded anew; its frames come picked, a tap leaves one
// out, and Start begins the picked ones with BeginPaperAttempts; two taps frame a task the AI
// missed; a refusal that shuts AI shuts Start; each task begun is a sheet under its crop, the list
// goes from one to another and back to the page, and Check sends the two crops and shows the
// verdict by the task's key, or "Couldn't check this one" with none; the tutor's panel on the page
// finds it anew by the learner's request, and Undo brings the frames back; on the screen of solving
// the tutor's panel opens by its button and by Hint, with the verdict and the hint in it, and on a
// phone hides the canvas's bar of tools; with the device, the page and its work are the profile's
// history, which "Your pages" opens again — with api on connect-es's router.
import { AccountService } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  type SubmitWorkRequest,
  type SubmitWorkResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginPaperAttemptsRequest,
  type FindTasksRequest,
  type FindTasksResponseSchema,
  PaperService,
} from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page, server, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile, Profile } from "../storage/profile.ts";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { PaperProvider } from "./PaperContext.tsx";
import { PaperScreen } from "./PaperScreen.tsx";
import { YourPages } from "./YourPages.tsx";

interface Setup {
  readonly found?: (request: FindTasksRequest) => MessageInitShape<typeof FindTasksResponseSchema>;
  /** The answer to each Check, by how many came before it; none refuses it. */
  readonly checked?: (n: number) => MessageInitShape<typeof SubmitWorkResponseSchema>;
  /** The opening question of a Hint before the first wrong answer, by GetOpeningWords. */
  readonly hinted?: string;
  /** The learner's share of the quota, in percent; none, and api has no `GetQuota`. */
  readonly quota?: number;
  /** The device that keeps the profile's history, and "Your pages" beside the screen; none keeps nothing. */
  readonly device?: Device;
  /** The camera's stream; none, and there is no camera. */
  readonly camera?: MediaStream;
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
  if (setup.camera !== undefined)
    vi.mocked(navigator.mediaDevices.getUserMedia).mockResolvedValue(setup.camera);
  const finds: FindTasksRequest[] = [];
  const begins: BeginPaperAttemptsRequest[] = [];
  const submits: SubmitWorkRequest[] = [];
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
        return { hint: { case: "techniques", value: {} } };
      },
      getOpeningWords() {
        return { words: setup.hinted ?? "" };
      },
    });
    const quota = setup.quota;
    if (quota !== undefined) {
      router.service(AccountService, {
        getQuota: () => ({ share: { profilePercent: quota } }),
      });
    }
    router.service(PaperService, {
      findTasks(request) {
        finds.push(request);
        return (
          setup.found?.(request) ?? {
            frames: [
              { box: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 } },
              { box: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 } },
            ],
          }
        );
      },
      beginPaperAttempts(request) {
        begins.push(request);
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
            <PaperScreen profileId="p1" adult />
          </PaperProvider>
        ) : (
          <PaperProvider profileId="p1" device={setup.device}>
            <YourPages profileId="p1" device={setup.device} />
            <PaperScreen profileId="p1" adult />
          </PaperProvider>
        )}
      </ApiProvider>,
    ),
  );
  if (setup.camera === undefined)
    await screen.findByText("The camera isn't available here. Choose a photo of the page instead");
  return { finds, begins, submits };
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
  await screen.findByRole("heading", { level: 1, name: "Your page" }, SLOW);
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
  vi.restoreAllMocks();
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

it("sends the photo once, a JPEG encoded anew, and picks the tasks found in the order of the page", async () => {
  const { finds } = await renderPaper();
  const first = await screen.findByRole("button", { name: "Deselect task 1" });
  expect(first).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Deselect task 2" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(screen.getByText("2 tasks found · tap one to leave it out")).toBeVisible();
  expect(screen.getByText("2 of 2 selected")).toBeVisible();
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
  expect(screen.getByText("1 task found · tap one to leave it out")).toBeVisible();
  expect(screen.getByText("1 of 1 selected")).toBeVisible();
});

it("removes every frame at once, for frames of the learner's own", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Remove all frames" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Remove the frame" })).toBeNull(),
  );
  expect(screen.getByText("0 of 0 selected")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Remove all frames" })).toBeNull();
});

it("begins the tasks picked, each a sheet under its crop", async () => {
  const { begins } = await renderPaper();
  await userEvent.click(await screen.findByRole("button", { name: "Deselect task 1" }));
  expect(screen.getByRole("button", { name: "Select task 1" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByText("1 of 2 selected")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("heading", { name: "Task 2" }, SLOW)).toBeVisible();
  expect(screen.getByText("1 of 1 · from your page")).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(begins[0]?.tasks).toBe(1);
  expect(begins[0]?.profileId).toBe("p1");
  expect(begins[0]?.ownKeyProvider).toBe("");
  // The page's ID, by which api closes the open tasks of another page alone (R77).
  expect(begins[0]?.pageId).toMatch(/^[A-Za-z0-9_-][A-Za-z0-9._-]{0,199}$/);
  expect(sheet().paper?.statement).toBeInstanceOf(Blob);
  expect(sheet().tracing).toEqual({ at: [180, 60], hidden: false });
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
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 2 / 2" }));
  await userEvent.click(await screen.findByRole("button", { name: /Task 1/ }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(sheet().history).toHaveLength(1);
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

it("asks for a solution before Check, then sends the task's crop and the work's", async () => {
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
  expect(submits[0]?.attemptId).toBe("a1");
});

it("shows the verdict by the key: Not yet, then Correct, which takes no Check again", async () => {
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
  expect(await screen.findByRole("button", { name: /Task 1.*Correct/ })).toBeVisible();
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

it("says a task with no key could not be checked, with Hint and Next task", async () => {
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
  // The card's Hint, beside the row's.
  expect(screen.getAllByRole("button", { name: "Hint" })).toHaveLength(2);
  const next = screen.getAllByRole("button", { name: "Next task" });
  await userEvent.click(next[next.length - 1] as HTMLElement);
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
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
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  expect(document.activeElement).toBe(tutorPanel().getByRole("heading", { name: "Tutor" }));
  expect(tutorPanel().getByText("The tutor is an AI, not a person")).toBeVisible();
  expect(tutorPanel().getByText("Read: 84")).toBeVisible();
  expect(document.querySelector(".nt-card-verdict")).toBeNull();
  // Not yet: Hint at the panel's foot, and no way on yet.
  expect(tutorPanel().getByRole("button", { name: "Hint" })).toBeVisible();
  expect(tutorPanel().queryByRole("button", { name: "Next task" })).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  const tutor = screen.getByRole("button", { name: "Tutor" });
  expect(document.activeElement).toBe(tutor);
  expect(document.querySelector(".nt-card-verdict")).not.toBeNull();
});

it("opens the panel by the row's Hint, its words a bubble there that strokes do not take away", async () => {
  await solving({ hinted: "What is left to find?" });
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  expect(await tutorPanel().findByText("What is left to find?")).toBeVisible();
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
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  expect(await tutorPanel().findByText("Tutor time today: 20% used")).toBeVisible();
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await tutorPanel().findByText("Read: 85")).toBeVisible();
  // Solved: no Hint, in the panel or in the row, and the way on in the panel.
  expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
  await userEvent.click(tutorPanel().getByRole("button", { name: "Next task" }));
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
});

it("hides the canvas's bar of tools on a phone while the panel is open", async () => {
  await page.viewport(390, 844);
  await solving();
  expect(sheet().hasAttribute("tools-hidden")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  await waitFor(() => expect(sheet().hasAttribute("tools-hidden")).toBe(true));
  await userEvent.click(tutorPanel().getByRole("button", { name: "Close" }));
  await waitFor(() => expect(sheet().hasAttribute("tools-hidden")).toBe(false));
});

it("frames a task the AI missed by two taps, and removes it by its cross", async () => {
  await renderPaper({ found: () => ({ frames: [] }) });
  expect(
    await screen.findByText("No tasks were found. Draw round each task you want to solve"),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  tap(100, 100);
  expect(await screen.findByText("Now tap the opposite corner of the task")).toBeVisible();
  tap(800, 300);
  const drawn = await screen.findByRole("button", { name: "Deselect your frame, task 1" });
  expect(drawn).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByText("0 tasks found · 1 framed by you · tap one to leave it out"),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  await userEvent.click(screen.getByRole("button", { name: "Remove the frame" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /your frame/ })).toBeNull());
});

it("frames a task by a loop drawn round it, after a tap, and resizes it by its corner", async () => {
  await renderPaper({ found: () => ({ frames: [] }) });
  await screen.findByText("No tasks were found. Draw round each task you want to solve");
  tap(100, 100);
  await screen.findByText("Now tap the opposite corner of the task");
  stroke(drawing(), [
    [200, 200],
    [200.5, 200],
    [600, 200],
    [600, 500],
    [200, 500],
    [200, 210],
  ]);
  const drawn = await screen.findByRole("button", { name: "Deselect your frame, task 1" });
  expect(screen.queryByText("Now tap the opposite corner of the task")).toBeNull();
  const width = drawn.getBoundingClientRect().width;

  const corner = screen.getByRole("button", { name: "Resize your frame" });
  // Another pointer's moves are not the corner's.
  corner.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7 }));
  stroke(corner, [
    [600, 500],
    [900, 700],
  ]);
  await waitFor(() => expect(drawn.getBoundingClientRect().width).toBeGreaterThan(width + 10));
  corner.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: 1 }));
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
  await screen.findByText("Now tap the opposite corner of the task");
  tap(900, 300);
  await screen.findByRole("button", { name: /^Deselect your frame/ });
  await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
  const field = await screen.findByRole("textbox", { name: "Your request about the page" });
  expect(field).toHaveAccessibleDescription(
    "Don't write your name or the real names of people you know",
  );
  expect(screen.getByRole("button", { name: "Voice comes later" })).toBeDisabled();
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

it("shuts Start when the quota is spent", async () => {
  await renderPaper({
    found: () => {
      throw new ConnectError("quota", Code.ResourceExhausted, undefined, [
        { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.QUOTA }) },
      ]);
    },
  });
  expect(
    await screen.findByText("Without the AI a task from paper can't be checked"),
  ).toBeVisible();
  expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Find the tasks again" })).toBeNull();
});

it("keeps the page and its work in the profile's history, and opens it again from Your pages", async () => {
  const { device } = memoryDevice();
  await addProfile(device, "p1");
  await solving({ device });
  writeOn(sheet());
  // The work is written a moment after it changes.
  const profile = await openProfile(device, "p1");
  await waitFor(async () => {
    const [kept] = (await profile?.pages()) ?? [];
    expect(kept?.tasks).toBe(2);
    const tasks = (await profile?.page(kept?.pageId ?? ""))?.tasks ?? [];
    expect(tasks.map((task) => task.history.length)).toEqual([1, 0]);
  });
  cleanup();

  await renderCamera({ device });
  await userEvent.click(await screen.findByRole("button", { name: "Your pages" }));
  await userEvent.click(screen.getByRole("button", { name: /· 2 tasks$/ }));
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  await waitFor(() => expect(sheet().history).toHaveLength(1));
  expect(screen.queryByRole("dialog")).toBeNull();
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
