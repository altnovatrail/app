// The screen of a task from paper in the browser (R71): with no camera the photos are the way in;
// the photo goes to FindTasks once, a JPEG encoded anew; its frames come picked, a tap leaves one
// out, and Start begins the picked ones with BeginPaperAttempts; two taps frame a task the AI
// missed; a refusal that shuts AI shuts Start — with api on connect-es's router.
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginPaperAttemptsRequest,
  type FindTasksRequest,
  type FindTasksResponseSchema,
  PaperService,
} from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
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
  readonly found?: () => MessageInitShape<typeof FindTasksResponseSchema>;
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
  const api = routedApi((router) => {
    router.service(PaperService, {
      findTasks(request) {
        finds.push(request);
        return (
          setup.found?.() ?? {
            frames: [
              { box: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 } },
              { box: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 } },
            ],
          }
        );
      },
      beginPaperAttempts(request) {
        begins.push(request);
        return { attemptIds: Array.from({ length: request.tasks }, (_, i) => `a${i + 1}`) };
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
  return { finds, begins };
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

it("begins the tasks picked, and shows their crops", async () => {
  const { begins } = await renderPaper();
  await userEvent.click(await screen.findByRole("button", { name: "Deselect task 1" }));
  expect(screen.getByRole("button", { name: "Select task 1" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(screen.getByText("1 of 2 selected")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Start" }));
  expect(await screen.findByRole("heading", { name: "1 task begun" })).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(begins[0]?.tasks).toBe(1);
  expect(begins[0]?.profileId).toBe("p1");
  expect(begins[0]?.ownKeyProvider).toBe("");
  expect(await screen.findByRole("img", { name: "Task 1" })).toBeVisible();
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
  await userEvent.click(screen.getByRole("button", { name: "Remove your frame" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /your frame/ })).toBeNull());
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
