// The task screen of a workbook in the browser, with the canvas element itself (R21, R54): the
// steps of school maths of grade 3, Check closed until each box holds an answer, SubmitWork with
// the crop of each filled box and its place and nothing of the draft, the verdict of each line and
// of each of its boxes with what was read, the summary by lines and the tutor's mark on a box —
// with api on connect-es's router and the storage on the device's memory.
import "@altnovatrail/canvas";
import { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  MarkKind,
  type SubmitWorkRequest,
  type SubmitWorkResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { LearningService } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type { ConnectRouter } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { Task } from "./Task.tsx";

// The tablet's layout, where the row stands beside the open panel: on a phone its sheet hides the row
// (R67), which the tests of the sheet show.
beforeEach(async () => {
  await page.viewport(1194, 834);
});

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const PNG = [0x89, 0x50, 0x4e, 0x47];

const MANIFEST = {
  module_format_version: "0.4",
  id: "example/school-math-grade-3",
  version: "1.0.0",
  title: "School maths, grade 3",
  languages: { explanation: "en" },
};

/** The steps of the format's example of school maths of grade 3. */
const STEPS: readonly open.Step[] = [
  { title: "Fill in the boxes", exit_condition: "answer_slots_filled" },
  { title: "Check each line", gives: ["techniques"], exit_condition: "none" },
];

/** The open view of the format's example workbook-page.yaml: its checks stay on the server. */
const WORKBOOK: open.Task = {
  id: "tables-and-division-1",
  statement: [{ text: "Write the missing numbers, and the sign <, > or = between two numbers." }],
  canvas: { kind: "workbook" },
  items: [
    { line: [{ text: "7 ×" }, { binding: "box" }, { text: "= 56" }] },
    { line: [{ binding: "box" }, { text: "÷ 8 = 4" }] },
    { line: [{ text: "56" }, { binding: "box" }, { text: "65" }] },
    {
      line: [
        { text: "Tom has 3 bags of 4 apples. He has" },
        { binding: "box" },
        { text: "apples." },
      ],
    },
    { line: [{ text: "47 ÷ 6 =" }, { binding: "box" }, { text: "r" }, { binding: "box" }] },
  ],
};

/**
 * The middle of each box of the page, by its item and slot: the page the format's vector
 * `format/vectors/pages/workbook-page.yaml` lays out, in page units, the sheet's.
 */
const BOXES: readonly { item: number; slot: number; x: number; y: number }[] = [
  { item: 1, slot: 1, x: 203, y: 90 },
  { item: 2, slot: 1, x: 626, y: 90 },
  { item: 3, slot: 1, x: 194, y: 222 },
  { item: 4, slot: 1, x: 615, y: 354 },
  { item: 5, slot: 1, x: 267, y: 486 },
  { item: 5, slot: 2, x: 409, y: 486 },
];

/** A stroke the sheet could have written, about a point: points apart, in time, off the grid. */
function stroke(id: number, x: number, y: number): HistoryEvent {
  const t = id * 5000;
  const points = [0, 1, 2, 3].map((i) => ({
    x: x - 11 + i * 7.3333,
    y: y - 5 + i * 3.1111,
    t: t + i * 16,
    p: 0.5,
  }));
  return { kind: "write", t: t + 48, stroke: { id, kind: "mouse", points } };
}

/** A stroke in each box, in the task's order. */
const IN_BOXES = BOXES.map((box, i) => stroke(i + 1, box.x, box.y));
/** A stroke that falls in no box: the draft, low on the page. */
const DRAFT = stroke(BOXES.length + 1, 500, 1000);

/** The verdict of a box, and what was read in it. */
interface Judged {
  readonly item: number;
  readonly slot: number;
  readonly verdict: string;
  readonly value: string;
}

/** Each box right but the remainder of line 5: 11 for 5. */
const ANSWERED: readonly Judged[] = [
  { item: 1, slot: 1, verdict: "correct", value: "8" },
  { item: 2, slot: 1, verdict: "correct", value: "32" },
  { item: 3, slot: 1, verdict: "correct", value: "<" },
  { item: 4, slot: 1, verdict: "correct", value: "12" },
  { item: 5, slot: 1, verdict: "correct", value: "7" },
  { item: 5, slot: 2, verdict: "not_yet", value: "11" },
];

/** The answer to a submission: each line's verdict made of its boxes'. */
function answerOf(boxes: readonly Judged[]): MessageInitShape<typeof SubmitWorkResponseSchema> {
  return {
    items: WORKBOOK.items.map((_, i) => {
      const own = boxes.filter((box) => box.item === i + 1);
      return {
        verdict: own.every((box) => box.verdict === "correct") ? "correct" : "not_yet",
        answerSlots: own.map((box) => ({
          answerSlot: { item: box.item, slot: box.slot },
          verdict: box.verdict,
          value: box.value,
        })),
      };
    }),
    wrongAnswers: boxes.every((box) => box.verdict === "correct") ? 0 : 1,
  };
}

interface Setup {
  /** The history this device keeps; none, and the page is blank. */
  readonly history?: readonly HistoryEvent[];
  readonly mode?: Mode;
}

async function renderWorkbook(setup: Setup = {}) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  if (setup.history !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: D1, task: WORKBOOK });
    await profile?.replaceHistory("a1", setup.history);
  }
  const submitted: SubmitWorkRequest[] = [];
  const asked: string[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, {
      getOpenAttempt: (request) => ({
        attempt: {
          start: {
            attemptId: request.attemptId,
            task: { json: encode(WORKBOOK), moduleFormatVersion: "0.4" },
            packageDigest: D1,
          },
        },
      }),
    });
    router.service(AttemptService, {
      submitWork(request) {
        submitted.push(request);
        return answerOf(ANSWERED);
      },
      getRungWords: (request) => ({
        rung: request.wrongAnswers ?? 1,
        words: "Multiply your answer back.",
        outcome: { cause: Cause.NOT_ADMITTED },
        marks: [
          { kind: MarkKind.FRAME, place: { case: "answerSlot", value: { item: 5, slot: 2 } } },
        ],
      }),
      beginStep(request) {
        asked.push(`step ${request.step}`);
        // The example's tasks have no techniques: the step shows only its title.
        return { techniques: { techniqueIds: [] } };
      },
    });
    router.service(PackageService, {
      getManifest: () => ({ manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } }),
      getSolvingSteps: () => ({
        solvingSteps: { json: encode({ steps: STEPS }), moduleFormatVersion: "0.4" },
      }),
      getTechniques: () => ({
        techniques: { json: encode({ techniques: {} }), moduleFormatVersion: "0.4" },
      }),
    });
  };
  const api = routedApi(routes);
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: { check: vi.fn(async () => {}) } as unknown as PackageChecks,
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn: () => {},
      fetch: async () => new Response(new Blob([new Uint8Array(PNG)], { type: "image/png" })),
    }),
  };
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <Task
            profileId="p1"
            attemptId="a1"
            defaultMode={setup.mode ?? Mode.SELF}
            device={device}
            adult={true}
            onAttempt={() => {}}
          />
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return { submitted, asked };
}

const check = () => screen.getByRole("button", { name: "Check" });
const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const found = async () => within(await screen.findByRole("complementary", { name: "Tutor" }));
const canvas = () => document.querySelector("novatrail-canvas") as CanvasElement;

/** The boxes a submission sends, by their places, and the bytes of each crop. */
function boxesOf(request: SubmitWorkRequest | undefined) {
  if (request?.work?.surface.case !== "workbook") throw new Error("no boxes of a workbook");
  return request.work.surface.value.boxes.map((box) => ({
    item: box.answerSlot?.item,
    slot: box.answerSlot?.slot,
    crop: [...box.crop],
  }));
}

/** Checks the work the history holds, once Check is open, and gives what went to api. */
async function checked(history: readonly HistoryEvent[]) {
  const shown = await renderWorkbook({ history });
  // On my own the rung's words, and their marks, come only while the tutor's panel is open (R67).
  await userEvent.click(await screen.findByRole("button", { name: "Tutor" }));
  await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
  await userEvent.click(check());
  await vi.waitFor(() => expect(shown.submitted).toHaveLength(1));
  return shown;
}

describe("the task screen of a workbook", () => {
  it("keeps Check closed while a box is empty, and says to write in each", async () => {
    const { submitted } = await renderWorkbook({ history: [...IN_BOXES.slice(0, -1), DRAFT] });
    await vi.waitFor(() => expect(canvas().filled?.[4]).toEqual([true, false]));
    expect(check()).toHaveAttribute("aria-disabled", "true");
    expect(check()).toHaveAccessibleDescription("Write an answer in each box");
    // A press the browser lets through, as a screen reader's would: nothing goes to api.
    check().click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(submitted).toEqual([]);
    expect(screen.queryByText(/Not right yet/)).toBeNull();
  });

  it("sends the crop of each filled box with its place, and shows each line's and box's verdict", async () => {
    const { submitted } = await checked([...IN_BOXES, DRAFT]);
    const sent = boxesOf(submitted[0]);
    expect(sent.map(({ item, slot }) => [item, slot])).toEqual(
      BOXES.map(({ item, slot }) => [item, slot]),
    );
    for (const box of sent) expect(box.crop.slice(0, 4)).toEqual(PNG);
    expect(submitted[0]?.tappedChoices).toEqual([]);
    expect(submitted[0]?.clockOffsetMinutes).toBeDefined();
    // The summary counts lines, and each line has its verdict, made of its boxes'.
    expect(
      await screen.findByText("Not right yet: 1 line of 5", { selector: ".nt-card-line" }),
    ).toBeVisible();
    const lines = screen.getAllByRole("list").find((list) => list.classList.contains("nt-lines"));
    if (lines === undefined) throw new Error("no lines below the canvas");
    const [first, , , , fifth] = within(lines).getAllByRole("listitem", { name: "" });
    expect(first).toHaveTextContent("Line 1 ✓ CorrectRead: 8");
    // A line of two boxes gives each box's verdict and what was read in it (R56 spec; R54).
    expect(fifth?.textContent?.startsWith("Line 5 • Not yet")).toBe(true);
    const boxes = within(fifth as HTMLElement).getAllByRole("listitem");
    expect(boxes.map((box) => box.textContent)).toEqual([
      "Box 1 ✓ CorrectRead: 7",
      "Box 2 • Not yetRead: 11",
    ]);
    // The rung's mark frames its box, named by its line and box.
    await vi.waitFor(() =>
      expect(canvas().marks?.marks[0]).toMatchObject({
        at: { cell: { item: 5, slot: 2 } },
        name: "Tutor's mark 1 of 1: line 5, box 2",
      }),
    );
  });

  it("sends nothing of the draft: the crops are the same with it and without it", async () => {
    const without = boxesOf((await checked(IN_BOXES)).submitted[0]);
    cleanup();
    const withDraft = boxesOf((await checked([...IN_BOXES, DRAFT])).submitted[0]);
    expect(withDraft).toEqual(without);
  });

  it("goes by the steps of school maths: Step done opens once each box holds an answer", async () => {
    await renderWorkbook({ history: IN_BOXES.slice(0, -1), mode: Mode.BY_STEPS });
    await (await found()).findByRole("heading", { name: "Fill in the boxes", level: 2 });
    const done = panel().getByRole("button", { name: "Step done" });
    await vi.waitFor(() => expect(canvas().filled?.[4]).toEqual([true, false]));
    expect(done).toHaveAttribute("aria-disabled", "true");
    // The step names the boxes, as Check does (R54).
    expect(done).toHaveAccessibleDescription("Write an answer in each box");
    cleanup();
    const { asked } = await renderWorkbook({ history: IN_BOXES, mode: Mode.BY_STEPS });
    await (await found()).findByRole("heading", { name: "Fill in the boxes", level: 2 });
    const open = panel().getByRole("button", { name: "Step done" });
    await vi.waitFor(() => expect(open).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(open);
    await panel().findByRole("heading", { name: "Check each line", level: 2 });
    // The task has no techniques: api is asked once, and the step has no cards.
    await vi.waitFor(() => expect(asked).toEqual(["step 2"]));
    expect(check()).toHaveAttribute("aria-disabled", "false");
  });
});
