// The screen of a task from paper in the browser (R71): with no camera the photos are the way in;
// the photo goes to FindTasks once, a JPEG encoded anew; its frames come picked, a tap leaves one
// out, and Start begins the picked ones with BeginPaperAttempts; two taps frame a task the AI
// missed; a refusal that shuts AI shuts Start; each task begun is a sheet under its crop, the list
// goes from one to another and back to the page, and Check sends the two crops and shows the
// verdict by the task's key, or "Couldn't check this one" with none; the tutor's panel on the page
// finds it anew by the learner's request, and Undo brings the frames back — with api on
// connect-es's router.
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
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { routedApi } from "../test/api.ts";
import { inLanguage } from "../test/language.tsx";
import { PaperProvider } from "./PaperContext.tsx";
import { PaperScreen } from "./PaperScreen.tsx";

interface Setup {
  readonly found?: (request: FindTasksRequest) => MessageInitShape<typeof FindTasksResponseSchema>;
  /** The answer to each Check, by how many came before it; none refuses it. */
  readonly checked?: (n: number) => MessageInitShape<typeof SubmitWorkResponseSchema>;
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

async function renderPaper(setup: Setup = {}) {
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
    });
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
        <PaperProvider>
          <PaperScreen profileId="p1" />
        </PaperProvider>
      </ApiProvider>,
    ),
  );
  // No camera here: the photos are the way in.
  await screen.findByText("The camera isn't available here. Choose a photo of the page instead");
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error("no picker");
  await userEvent.upload(input, await pagePhoto());
  return { finds, begins, submits };
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
    t: 10,
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
  await screen.findByRole("heading", { name: "Task 1" });
  return setup;
}

/** A tap at a place of the photo, in thousandths. */
function tap(x: number, y: number) {
  const surface = document.querySelector<HTMLElement>(".nt-page-draw");
  if (surface === null) throw new Error("no page");
  const box = surface.getBoundingClientRect();
  const at = {
    bubbles: true,
    pointerId: 1,
    button: 0,
    clientX: box.left + (box.width * x) / 1000,
    clientY: box.top + (box.height * y) / 1000,
  };
  surface.dispatchEvent(new PointerEvent("pointerdown", at));
  surface.dispatchEvent(new PointerEvent("pointerup", at));
}

beforeEach(() => {
  vi.spyOn(navigator.mediaDevices, "getUserMedia").mockRejectedValue(
    new DOMException("no camera", "NotFoundError"),
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("reminds to keep names out of the photo", async () => {
  await renderPaper();
  expect(screen.getByText("Keep names out of the photo")).toBeVisible();
});

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
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
  expect(screen.getByText("1 of 1 · from your page")).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(begins[0]?.tasks).toBe(1);
  expect(begins[0]?.profileId).toBe("p1");
  expect(begins[0]?.ownKeyProvider).toBe("");
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
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 2 of 2" }));
  await userEvent.click(await screen.findByRole("button", { name: /Task 1/ }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(sheet().history).toHaveLength(1);
});

it("goes back to the page by Add, and Start begins only the tasks not begun", async () => {
  const { begins } = await solving();
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 1 of 2" }));
  await userEvent.click(await screen.findByRole("button", { name: "Add" }));
  expect(await screen.findByRole("heading", { name: "Your page" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(sheet().history).toHaveLength(1);
});

it("asks for a solution before Check, then sends the task's crop and the work's", async () => {
  const { submits } = await solving();
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(await screen.findByText("Write your solution first")).toBeVisible();
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
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  expect(submits).toHaveLength(2);
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 1 of 2" }));
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
  expect(await screen.findByText("Not yet · 2 of 3 correct")).toBeVisible();
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
  tap(900, 300);
  await screen.findByRole("button", { name: /your frame/ });
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
  expect(screen.getByRole("button", { name: /your frame/ })).toBeVisible();
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

it("retakes: the page goes, and the camera comes back", async () => {
  await renderPaper();
  await screen.findByRole("button", { name: "Deselect task 1" });
  await userEvent.click(screen.getByRole("button", { name: "Retake" }));
  expect(await screen.findByRole("heading", { name: "Photo of a page" })).toBeVisible();
});
