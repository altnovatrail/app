// The lesson player in the browser, with the canvas element itself (section 3.4 of
// docs/architecture.md; R06, R23): the path of the lesson of the format's example, gaps-and-posts —
// an explanation with its picture and list, a worked example and its demo, a task of the run and an
// explanation —, the place after a restart and on another device, the bar, the task left and begun
// again, and every end of a run — with api on connect-es's router and the storage on the device's
// memory. The lessons are synthetic, after the format's examples.
import "@altnovatrail/canvas";
import { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  type NextSchema,
  type SubmitWorkRequest,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  ChoiceKind,
  CloseReason,
  EndedSegmentsSchema,
  type Refusal,
  RefusalSchema,
  RunEndReason,
  RunEndSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  type CompleteLessonRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { CanvasElement, DemoState } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import { KeyHolder } from "../ownkey/holder.ts";
import { KeyHolderProvider } from "../ownkey/OwnKeyContext.tsx";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { Lesson } from "./Lesson.tsx";
import type { LessonOpen, RunRef } from "./LessonContext.tsx";

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const MANIFEST: open.Manifest = {
  module_format_version: "0.4",
  id: "example/with-lessons",
  version: "1.0.0",
  title: "With lessons",
  subject: "mathematics",
  audience: { age_categories: ["adult"] },
  languages: { explanation: "en" },
  authors: [{ name: "NovaTrail" }],
  license: "Apache-2.0",
};

const GAPS_ID = "example/with-lessons/lesson/gaps-and-posts";

/** The lesson of the format's example gaps-and-posts.yaml, shortened. */
const GAPS: open.Lesson = {
  id: "gaps-and-posts",
  title: "Gaps and posts",
  segments: [
    {
      explanation: [
        { text: "A fence has posts and gaps between them." },
        {
          picture: "fence-posts-and-gaps.png",
          alt: "A fence of four posts",
          width: 400,
          height: 100,
        },
        { numbered_list: ["Count the gaps.", "Add one for the posts."] },
      ],
    },
    {
      worked_example: {
        statement: [{ text: "A path is 20 m long, with a tree every 5 m. How many trees?" }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        demo: [
          { text: "20 ÷ 5 = 4 gaps." },
          { text: "One tree more than gaps." },
          { text: "5 trees." },
        ],
      },
    },
    { task: "gaps-ladder-1" },
    { explanation: [{ text: "Each time, count the gaps first." }] },
  ],
};

/** The lesson of remainders-on-a-workbook.yaml: a worked example on a workbook, then its task. */
const REMAINDERS: open.Lesson = {
  id: "remainders",
  title: "Remainders",
  segments: [
    {
      worked_example: {
        statement: [{ text: "Share 23 sweets among 4 children." }],
        canvas: { kind: "workbook" },
        lines: [
          {
            line: [
              { text: "23 ÷ 4 =" },
              { binding: "box", value: "5" },
              { text: "r" },
              { binding: "box", value: "3" },
            ],
          },
        ],
        demo: [
          { text: "4 × 5 = 20." },
          { fill: { line: 1, box: 1 } },
          { fill: { line: 1, box: 2 } },
        ],
      },
    },
    { task: "remainders-1" },
  ],
};

const TASK: open.Task = {
  id: "gaps-ladder-1",
  statement: [{ text: "A ladder has 5 rungs." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ text: "How many gaps?", answer_slots: [{ binding: "choice", options: ["4", "5"] }] }],
};

function refused(code: Code, cause: Cause, data?: Refusal["data"]): ConnectError {
  const refusal = create(RefusalSchema, { cause, ...(data === undefined ? {} : { data }) });
  return new ConnectError("refused", code, undefined, [{ desc: RefusalSchema, value: refusal }]);
}

const runEnded = (reason: RunEndReason) =>
  refused(Code.FailedPrecondition, Cause.RUN_ENDED, {
    case: "runEnd",
    value: create(RunEndSchema, { reason }),
  });

const endedSegments = (cause: Cause, places: number[]) =>
  refused(Code.FailedPrecondition, cause, {
    case: "endedSegments",
    value: create(EndedSegmentsSchema, { places }),
  });

interface Setup {
  readonly lesson?: open.Lesson;
  /** The task segments that ended, as api keeps them. */
  readonly ended?: number[];
  /** The open attempt of a task segment. */
  readonly openAttempt?: { attemptId: string; segment: number };
  /** Throws in place of the run, by the count of the reads before. */
  readonly run?: (reads: number) => void;
  /** What the player opens; the run r1 when left out. */
  readonly open?: LessonOpen;
  /** Throws in place of the attempt of a segment, once for each call it is given. */
  readonly begin?: (request: BeginAttemptRequest) => void;
  /** Throws in place of the open attempt; an attempt so refused is open no more. */
  readonly openTask?: (attemptId: string) => void;
  /** The beginning of a segment answers with no attempt. */
  readonly emptyBegin?: boolean;
  /** The package has no manifest api gives. */
  readonly noManifest?: boolean;
  /** "Lesson done" answers with no end. */
  readonly noEnd?: boolean;
  /** The engine's choice the end of the run gives. */
  readonly endChoice?: { choiceId: string; kind: ChoiceKind };
  /** The run comes without its lesson. */
  readonly noLesson?: boolean;
  /** What comes next once the task is right. */
  readonly next?: MessageInitShape<typeof NextSchema>;
  /** Throws in place of "lesson done", once for each call it is given. */
  readonly complete?: (request: CompleteLessonRequest) => void;
  readonly device?: Device;
  /** The state of the lesson the device keeps. */
  readonly kept?: { place: number; demo?: Record<number, unknown>; passageId?: string };
  readonly adult?: boolean;
  /** The profile's database does not open. */
  readonly noDatabase?: boolean;
  /** The owner's own key is held for p1 (R47). */
  readonly ownKey?: boolean;
}

const RUN: RunRef = { lessonRunId: "r1", lesson: GAPS_ID, packageDigest: D1 };

async function renderLesson(setup: Setup = {}) {
  const device = setup.device ?? memoryDevice().device;
  if (setup.device === undefined) await setAccount(device, "account-1");
  if (setup.noDatabase === true) {
    const connect = device.connect.bind(device);
    device.connect = (name, schema, create) =>
      name.startsWith("novatrail-profile-")
        ? Promise.resolve(undefined)
        : connect(name, schema, create);
  }
  const lesson = setup.lesson ?? GAPS;
  const id = `example/with-lessons/lesson/${lesson.id}`;
  if (setup.kept !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.saveLesson({
      lessonId: id,
      digest: D1,
      passageId: setup.kept.passageId ?? "r1",
      view: lesson,
      place: setup.kept.place,
      demo: (setup.kept.demo ?? {}) as Record<number, DemoState>,
    });
  }
  const ended = [...(setup.ended ?? [])];
  let openAttempt = setup.openAttempt;
  const asked: string[] = [];
  // The provider each request that may give a choice named, by the request: "" on platform AI.
  const providers: string[] = [];
  const begun: BeginAttemptRequest[] = [];
  const submitted: SubmitWorkRequest[] = [];
  let attempts = 0;
  let reads = 0;
  const runOf = () => ({
    lessonRunId: "r1",
    ...(setup.noLesson === true
      ? {}
      : { lesson: { json: encode(lesson), moduleFormatVersion: "0.4" } }),
    packageDigest: D1,
    endedSegments: [...ended],
    ...(openAttempt === undefined
      ? {}
      : {
          openAttempt: {
            attemptId: openAttempt.attemptId,
            segment: { lessonRunId: "r1", segment: openAttempt.segment },
          },
        }),
  });
  const segmentOf = new Map<string, number>();
  if (openAttempt !== undefined) segmentOf.set(openAttempt.attemptId, openAttempt.segment);
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, {
      getLessonRun(request) {
        asked.push(`run ${request.lessonRunId}`);
        providers.push(`run ${request.ownKeyProvider}`);
        setup.run?.(reads++);
        return { run: runOf() };
      },
      openLesson(request) {
        asked.push(`open lesson ${request.choiceId}`);
        providers.push(`open ${request.ownKeyProvider}`);
        setup.run?.(reads++);
        return { run: runOf() };
      },
      completeLesson(request) {
        asked.push("lesson done");
        providers.push(`done ${request.ownKeyProvider}`);
        setup.complete?.(request);
        return setup.noEnd === true
          ? {}
          : {
              end: {
                reason: RunEndReason.PASSED,
                ...(setup.endChoice === undefined ? {} : { choice: setup.endChoice }),
              },
            };
      },
      beginAttempt(request) {
        begun.push(request);
        providers.push(`begin ${request.ownKeyProvider}`);
        setup.begin?.(request);
        if (setup.emptyBegin === true) return {};
        const segment = request.start.case === "segment" ? request.start.value.segment : 0;
        attempts += 1;
        const attemptId = `a${attempts}`;
        segmentOf.set(attemptId, segment);
        openAttempt = { attemptId, segment };
        return {
          attempt: { attemptId, packageDigest: D1, segment: { lessonRunId: "r1", segment } },
        };
      },
      getOpenAttempt(request) {
        asked.push(`open ${request.attemptId}`);
        try {
          setup.openTask?.(request.attemptId);
        } catch (error) {
          if (openAttempt?.attemptId === request.attemptId) openAttempt = undefined;
          throw error;
        }
        return {
          attempt: {
            start: {
              attemptId: request.attemptId,
              task: { json: encode(TASK), moduleFormatVersion: "0.4" },
              packageDigest: D1,
              segment: { lessonRunId: "r1", segment: segmentOf.get(request.attemptId) ?? 0 },
            },
            wrongAnswers: 0,
          },
        };
      },
    });
    router.service(AttemptService, {
      submitWork(request) {
        submitted.push(request);
        const right = request.tappedChoices[0]?.value === "4";
        const verdict = right ? "correct" : "not_yet";
        const items = [
          {
            verdict,
            answerSlots: [
              {
                answerSlot: { item: 1, slot: 1 },
                verdict,
                value: request.tappedChoices[0]?.value ?? "",
              },
            ],
          },
        ];
        if (!right) return { items, wrongAnswers: 1 };
        const segment = segmentOf.get(request.attemptId) ?? 0;
        ended.push(segment);
        openAttempt = undefined;
        return {
          items,
          wrongAnswers: 0,
          solved: {
            solution: encode([{ text: "Five rungs, four gaps." }]),
            moduleFormatVersion: "0.4",
          },
          ...(setup.next === undefined
            ? { next: { next: { case: "segment", value: segment + 1 } } }
            : Object.keys(setup.next).length === 0
              ? {}
              : { next: setup.next }),
        };
      },
      showSolution(request) {
        const segment = segmentOf.get(request.attemptId) ?? 0;
        ended.push(segment);
        openAttempt = undefined;
        return {
          solved: {
            solution: encode([{ text: "Five rungs, four gaps." }]),
            moduleFormatVersion: "0.4",
          },
          next: { next: { case: "segment", value: segment + 1 } },
        };
      },
      getCorrectAnswerWords: () => ({ outcome: { cause: Cause.NOT_ADMITTED } }),
      getHint: () => ({}),
    });
    router.service(PackageService, {
      getManifest: () =>
        setup.noManifest === true
          ? {}
          : { manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } },
      getSolvingSteps: () => ({}),
      getTechniques: () => ({}),
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const check = vi.fn(async () => {});
  const picture = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: { check } as unknown as PackageChecks,
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn: () => {},
      fetch: async () => new Response(picture),
    }),
  };
  const began: RunRef[] = [];
  const endedRuns: string[] = [];
  const left = vi.fn();
  const holder = new KeyHolder({
    read: async () =>
      setup.ownKey === true
        ? { provider: "anthropic", name: "Anthropic", key: "sk-ant-synthetic-0000", last4: "0000" }
        : undefined,
    keep: async () => "saved",
    drop: async () => {},
  });
  await holder.open("p1");
  const rendered = render(
    inLanguage(
      <ApiProvider value={api}>
        <KeyHolderProvider holder={holder}>
          <PackagesProvider value={packages}>
            <Lesson
              profileId="p1"
              open={setup.open ?? { kind: "run", run: RUN }}
              device={device}
              defaultMode={Mode.SELF}
              adult={setup.adult ?? false}
              onBegan={(run) => began.push(run)}
              onEnded={(runId) => endedRuns.push(runId)}
              onAttempt={left}
            />
          </PackagesProvider>
        </KeyHolderProvider>
      </ApiProvider>,
    ),
  );
  /** The state of the lesson the device keeps now. */
  const kept = async () => {
    const profile = await openProfile(device, "p1");
    return profile?.readLesson(id, D1, "r1");
  };
  return {
    device,
    asked,
    providers,
    begun,
    submitted,
    check,
    began,
    endedRuns,
    left,
    kept,
    unmount: rendered.unmount,
  };
}

const bar = () => within(screen.getByRole("navigation", { name: "Segments of the lesson" }));
const chip = (n: number) => bar().getAllByRole("button")[n - 1] as HTMLButtonElement;
const continueButton = () => screen.findByRole("button", { name: "Continue" });
const canvas = () => document.querySelector("novatrail-canvas") as CanvasElement;

/** A button of the element's own row, by its label. */
async function canvasButton(label: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await waitFor(() => {
    const buttons = [...(canvas().shadowRoot?.querySelectorAll("button") ?? [])];
    found = buttons.find((button) => button.textContent?.trim() === label) as
      | HTMLButtonElement
      | undefined;
    expect(found).toBeDefined();
  });
  return found as HTMLButtonElement;
}

/** The task of the segment answered right. */
async function solve() {
  const gaps = await screen.findByRole("group", { name: "How many gaps?" });
  await userEvent.click(within(gaps).getByRole("radio", { name: "4" }));
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("Five rungs, four gaps.");
}

describe("the lesson player", () => {
  it("walks the lesson of section 3.4: explanation, worked example, task, explanation, lesson done", async () => {
    const { begun, kept, asked, endedRuns, began } = await renderLesson();
    const title = await screen.findByRole("heading", { level: 1, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toHaveAttribute("lang", "en");
    expect(began).toEqual([RUN]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");
    // The explanation: its paragraph, its picture by an address blob: and its numbered list.
    expect(
      screen.getByText("A fence has posts and gaps between them.").closest("[lang]"),
    ).toHaveAttribute("lang", "en");
    const picture = await screen.findByRole("img", { name: "A fence of four posts" });
    expect(picture.getAttribute("src")).toMatch(/^blob:/);
    const list = screen.getByText("Count the gaps.").closest("ol") as HTMLOListElement;
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Count the gaps.", "Add one for the posts."]);
    // The bar: the chip shown in bold and current, the others later, none passed yet.
    expect(bar().getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    expect(chip(1)).toHaveAccessibleName("1 Explanation");
    expect(chip(1)).toHaveAccessibleDescription("now");
    expect(chip(2)).toHaveAccessibleDescription("Not open yet");
    expect(chip(3)).toHaveAccessibleName("3 Task");
    expect(chip(3)).toHaveAttribute("aria-disabled", "true");
    expect((await kept())?.place).toBe(1);
    // The chip shown goes nowhere.
    await userEvent.click(chip(1));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");

    // The worked example: a new element, its demo from the beginning; Continue stands at once.
    await userEvent.click(await continueButton());
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Worked example · 2 of 4");
    expect(document.activeElement).toBe(heading);
    expect(chip(1)).toHaveAccessibleDescription("passed");
    expect(chip(2)).toHaveAccessibleDescription("now");
    expect((await kept())?.place).toBe(2);
    await waitFor(() => expect(canvas().workedExample).toBeDefined());
    expect(canvas().demoState).toEqual({ opened: 0, hidden: false });
    for (let i = 0; i < 3; i += 1) await userEvent.click(await canvasButton("Next"));
    await waitFor(async () =>
      expect((await kept())?.demo[2]).toEqual({ opened: 3, hidden: false }),
    );
    await userEvent.click(await canvasButton("Demo"));
    await waitFor(async () => expect((await kept())?.demo[2]).toEqual({ opened: 3, hidden: true }));
    // The state goes back to the element as the same object the event gave.
    expect(canvas().demoState).toEqual({ opened: 3, hidden: true });

    // The task: an attempt of the run's segment; Continue only once api said it ended.
    await userEvent.click(await continueButton());
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(begun).toHaveLength(1);
    expect(begun[0]?.start).toEqual({
      case: "segment",
      value: expect.objectContaining({ lessonRunId: "r1", segment: 3 }),
    });
    expect(begun[0]?.idempotencyKey).not.toBe("");
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 1, name: "Task" })).toBeNull();
    await solve();
    // The place moves at once, while the learner still sees the result: no "Try it again".
    await waitFor(async () => expect((await kept())?.place).toBe(4));
    expect(screen.queryByRole("button", { name: "Try it again" })).toBeNull();
    await userEvent.click(await continueButton());

    // The last explanation: the task passed does not open again, and says why.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");
    expect(chip(3)).toHaveAttribute("aria-disabled", "true");
    expect(chip(3)).toHaveAccessibleDescription("This task is over");
    chip(3).click();
    expect(await screen.findByText("3 Task: already over", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");
    // Back to the example: its demo as it was left; Continue leads to the place, past the task.
    await userEvent.click(chip(2));
    await waitFor(() => expect(canvas().demoState).toEqual({ opened: 3, hidden: true }));
    await userEvent.click(await continueButton());
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");

    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    expect(asked).toContain("lesson done");
    expect(await kept()).toBeUndefined();
    expect(endedRuns).toEqual(["r1"]);
    expect(screen.getByRole("button", { name: "Back to My subjects" })).toBeVisible();
  });

  it("opens after a restart at its place, with the attempt open and the demo as it was", async () => {
    const { asked } = await renderLesson({
      kept: { place: 3, demo: { 2: { opened: 3, hidden: true } } },
      openAttempt: { attemptId: "a7", segment: 3 },
    });
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(asked).toEqual(["run r1", "open a7"]);
    // Off to the example and back: the attempt goes on.
    await userEvent.click(chip(2));
    await waitFor(() => expect(canvas().demoState).toEqual({ opened: 3, hidden: true }));
    await userEvent.click(await continueButton());
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(asked).toEqual(["run r1", "open a7", "open a7"]);
  });

  it("opens on another device after the last task that ended, its demos from the beginning", async () => {
    const { kept } = await renderLesson({ ended: [3] });
    await screen.findByText("Each time, count the gaps first.");
    expect(chip(3)).toHaveAccessibleDescription("This task is over");
    await waitFor(async () => expect((await kept())?.place).toBe(4));
    await userEvent.click(chip(2));
    await waitFor(() => expect(canvas().demoState).toEqual({ opened: 0, hidden: false }));
  });

  it("drops the state of another run under the same key, and a demo the element would refuse", async () => {
    const other = await renderLesson({ kept: { place: 4, passageId: "r0" } });
    await screen.findByText("A fence has posts and gaps between them.");
    await waitFor(async () => expect((await other.kept())?.place).toBe(1));
    other.unmount();

    // A demo kept for a segment that is no example is no state of any element either.
    await renderLesson({
      kept: { place: 2, demo: { 1: { opened: 0, hidden: false }, 2: { opened: 9, hidden: true } } },
    });
    await waitFor(() => expect(canvas().workedExample).toBeDefined());
    expect(canvas().demoState).toEqual({ opened: 0, hidden: false });
  });

  it("ends the lesson on Continue after its last task, a worked example on a workbook before it", async () => {
    const { asked, kept } = await renderLesson({
      lesson: REMAINDERS,
      next: { next: { case: "segmentsEnded", value: true } },
    });
    await waitFor(() => expect(canvas().workedExample?.canvas.kind).toBe("workbook"));
    await userEvent.click(await canvasButton("Next"));
    await userEvent.click(await canvasButton("Next"));
    await waitFor(async () =>
      expect((await kept())?.demo[1]).toEqual({ opened: 2, hidden: false }),
    );
    await userEvent.click(await continueButton());
    await solve();
    expect((await kept())?.place).toBe(2);
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(asked.filter((a) => a === "lesson done")).toHaveLength(1);
  });

  it("names the own key's provider with every request of the run that may give a choice", async () => {
    for (const ownKey of [false, true]) {
      const { providers, unmount } = await renderLesson({
        lesson: REMAINDERS,
        next: { next: { case: "segmentsEnded", value: true } },
        open: { kind: "choice", choiceId: "c1" },
        ownKey,
      });
      await waitFor(() => expect(canvas().workedExample?.canvas.kind).toBe("workbook"));
      await userEvent.click(await canvasButton("Next"));
      await userEvent.click(await canvasButton("Next"));
      await userEvent.click(await continueButton());
      await solve();
      await userEvent.click(await continueButton());
      expect(await screen.findByText("Lesson complete")).toBeVisible();
      const named = ownKey ? "anthropic" : "";
      expect(providers).toContain(`open ${named}`);
      expect(providers).toContain(`begin ${named}`);
      expect(providers).toContain(`done ${named}`);
      expect(providers.every((each) => each.endsWith(` ${named}`))).toBe(true);
      unmount();
    }
  });

  it("asks the run again when api said nothing of what comes next", async () => {
    const { asked, kept } = await renderLesson({ kept: { place: 3 }, next: {} });
    await solve();
    await waitFor(() => expect(asked.filter((a) => a === "run r1")).toHaveLength(2));
    await waitFor(async () => expect((await kept())?.place).toBe(4));
    expect(await continueButton()).toBeVisible();
  });

  it("goes on with the solution shown, as with a correct answer", async () => {
    const { kept } = await renderLesson({ kept: { place: 3 }, adult: true });
    await screen.findByRole("group", { name: "How many gaps?" });
    await userEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    await screen.findAllByText("Solution shown");
    await waitFor(async () => expect((await kept())?.place).toBe(4));
    await userEvent.click(await continueButton());
    await screen.findByText("Each time, count the gaps first.");
  });

  it("begins a task left again, with a new attempt", async () => {
    const { begun } = await renderLesson({
      kept: { place: 3 },
      openAttempt: { attemptId: "a7", segment: 3 },
      openTask: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, {
          case: "closeReason",
          value: CloseReason.LEFT,
        });
      },
    });
    expect(await screen.findByText("Another task was begun")).toBeVisible();
    const again = await screen.findByRole("button", { name: "Begin the task again" });
    expect(begun).toHaveLength(0);
    await userEvent.click(again);
    await waitFor(() => expect(begun).toHaveLength(1));
  });

  it("takes the places a refused beginning tells, and keeps the run open on a refusal of AI", async () => {
    const moved = await renderLesson({
      kept: { place: 3 },
      begin: () => {
        throw endedSegments(Cause.SEGMENT_UNAVAILABLE, [3]);
      },
    });
    await screen.findByText("Each time, count the gaps first.");
    expect((await moved.kept())?.place).toBe(4);
    moved.unmount();

    let refusals = 1;
    const kept = await renderLesson({
      kept: { place: 3 },
      begin: () => {
        if (refusals-- > 0) throw refused(Code.FailedPrecondition, Cause.NOT_ADMITTED);
      },
    });
    expect(await screen.findByText("The tutor isn't available for this profile")).toBeVisible();
    expect(kept.endedRuns).toEqual([]);
    // The line is the task's: back at the example it is gone, and at the task again it stands.
    await userEvent.click(chip(2));
    expect(screen.queryByText("The tutor isn't available for this profile")).toBeNull();
    await userEvent.click(await continueButton());
    expect(await screen.findByText("The tutor isn't available for this profile")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Begin the task again" }));
    await screen.findByRole("group", { name: "How many gaps?" });
    // A refusal ended the action: the new one has its own key.
    expect(kept.begun[0]?.idempotencyKey).not.toBe(kept.begun[1]?.idempotencyKey);
    expect(kept.left).toHaveBeenCalledOnce();
  });

  it("says when the tutor comes back once the quota refuses the task segment, and keeps the run (R37)", async () => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const kept = await renderLesson({
      kept: { place: 3 },
      begin: () => {
        throw refused(Code.ResourceExhausted, Cause.QUOTA, {
          case: "nextFamilyDay",
          value: timestampFromDate(midnight),
        });
      },
    });
    const time = dateTimeFormat("en", { timeStyle: "short" }).format(midnight);
    expect(
      await screen.findByText(`Today's tutor time is used up. It comes back tomorrow at ${time}`),
    ).toBeVisible();
    expect(kept.endedRuns).toEqual([]);
    expect(screen.getByRole("button", { name: "Begin the task again" })).toBeVisible();
  });

  it("sends lesson done again after no answer, and goes to the task left when api refuses", async () => {
    let offline = true;
    const { asked } = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        if (offline) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("No connection")).toBeVisible();
    offline = false;
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(asked.filter((a) => a === "lesson done").length).toBeGreaterThan(1);
  });

  it("opens the first task not ended when lesson done is refused", async () => {
    await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw endedSegments(Cause.SEGMENTS_NOT_ENDED, []);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("The lesson has a task to finish")).toBeVisible();
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 3 of 4");
  });

  it.each([
    [RunEndReason.UNCHECKED, "This version of the module is no longer given", true],
    [RunEndReason.NOT_SUITABLE, "This lesson doesn't suit this profile any more", false],
    [RunEndReason.ABANDONED, "The lesson wasn't opened for 30 days", false],
    [RunEndReason.UNSPECIFIED, "This lesson is over", false],
  ])(
    "ends a run api ended, %s, with its words, and erases its state",
    async (reason, text, checks) => {
      const { check, kept, endedRuns } = await renderLesson({
        kept: { place: 2 },
        run: () => {
          throw runEnded(reason);
        },
      });
      expect(await screen.findByRole("heading", { level: 1, name: text })).toBeVisible();
      await waitFor(async () => expect(await kept()).toBeUndefined());
      expect(endedRuns).toEqual(["r1"]);
      expect(check).toHaveBeenCalledTimes(checks ? 1 : 0);
    },
  );

  it("ends a run api ended at lesson done, under the lesson's title", async () => {
    const { kept } = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw runEnded(RunEndReason.ABANDONED);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("The lesson wasn't opened for 30 days")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    expect(await kept()).toBeUndefined();
  });

  it("opens a run by an engine's choice, and names it by the lesson's full ID", async () => {
    const { asked, began } = await renderLesson({ open: { kind: "choice", choiceId: "c1" } });
    await screen.findByText("A fence has posts and gaps between them.");
    expect(asked[0]).toBe("open lesson c1");
    expect(began).toEqual([RUN]);
  });

  it("says why a segment not reached does not open", async () => {
    await renderLesson();
    await screen.findByText("A fence has posts and gaps between them.");
    chip(4).click();
    // The line names the chip pressed: under the heading of segment 1, not said of that one.
    expect(await screen.findByText("4 Explanation: not open yet", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");
  });

  it("leaves a run api does not know, and reads one again after a failure", async () => {
    window.location.hash = "#/lesson";
    const gone = await renderLesson({
      run: () => {
        throw refused(Code.NotFound, Cause.NOT_FOUND);
      },
    });
    await waitFor(() => expect(gone.endedRuns).toEqual(["r1"]));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
    gone.unmount();

    let failing = true;
    await renderLesson({
      run: () => {
        if (failing) throw new ConnectError("no", Code.Internal);
      },
    });
    const retry = await screen.findByRole("button", { name: "Try again" });
    failing = false;
    await userEvent.click(retry);
    await screen.findByText("A fence has posts and gaps between them.");
  });

  it("opens again after its last task ended on the task that ended, Continue lesson done", async () => {
    const { asked } = await renderLesson({ lesson: REMAINDERS, ended: [2], kept: { place: 2 } });
    expect(await screen.findByText("This task is over", { selector: "p" })).toBeVisible();
    expect(asked).not.toContain("open a1");
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
  });

  it("asks the run again of an attempt api closed, and ends the run api ended meanwhile", async () => {
    const solved = await renderLesson({
      kept: { place: 3 },
      openAttempt: { attemptId: "a7", segment: 3 },
      openTask: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, {
          case: "closeReason",
          value: CloseReason.CORRECT,
        });
      },
    });
    expect(await screen.findByText("It was answered correctly")).toBeVisible();
    await waitFor(() => expect(solved.asked.filter((a) => a === "run r1")).toHaveLength(2));
    solved.unmount();

    const { kept, endedRuns } = await renderLesson({
      kept: { place: 3 },
      openAttempt: { attemptId: "a7", segment: 3 },
      openTask: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, {
          case: "closeReason",
          value: CloseReason.NOT_SUITABLE,
        });
      },
      run: (reads) => {
        if (reads > 0) throw runEnded(RunEndReason.NOT_SUITABLE);
      },
    });
    expect(await screen.findByText("This lesson doesn't suit this profile any more")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    await waitFor(async () => expect(await kept()).toBeUndefined());
    expect(endedRuns).toEqual(["r1"]);
  });

  it("says why the run was not read again, and keeps the lesson open", async () => {
    await renderLesson({
      kept: { place: 3 },
      next: {},
      run: (reads) => {
        if (reads > 0) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await solve();
    expect(await screen.findByText("No connection", { selector: "p" })).toBeVisible();
  });

  it("reads the task of a segment again after a failure, under the lesson's header", async () => {
    let failing = true;
    await renderLesson({
      kept: { place: 3 },
      openAttempt: { attemptId: "a7", segment: 3 },
      openTask: () => {
        if (failing) throw new ConnectError("no", Code.Internal);
      },
    });
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    failing = false;
    await userEvent.click(retry);
    await screen.findByRole("group", { name: "How many gaps?" });
  });

  it("says when the device does not keep the lesson, and leaves it sending nothing", async () => {
    window.location.hash = "#/lesson";
    const { asked } = await renderLesson({ noDatabase: true });
    expect(await screen.findByText("Your work isn't saved on this device")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Leave the lesson" }));
    expect(window.location.hash).toBe("#/home");
    expect(asked).toEqual(["run r1"]);
    window.location.hash = "";
  });

  it("goes back to the task api has open when it refuses a later one", async () => {
    const two: open.Lesson = {
      id: "two-tasks",
      title: "Two tasks",
      segments: [
        { explanation: [{ text: "First." }] },
        { task: "gaps-ladder-1" },
        { explanation: [{ text: "Then." }] },
        { task: "gaps-ladder-1" },
      ],
    };
    let refusals = 1;
    const { begun, kept } = await renderLesson({
      lesson: two,
      kept: { place: 4 },
      begin: () => {
        if (refusals-- > 0) throw endedSegments(Cause.SEGMENT_UNAVAILABLE, []);
      },
    });
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 2 of 4");
    expect(begun.map((request) => request.start.value)).toEqual([
      expect.objectContaining({ segment: 4 }),
      expect.objectContaining({ segment: 2 }),
    ]);
    await waitFor(async () => expect((await kept())?.place).toBe(2));
  });

  it("asks the run when a refusal of lesson done says nothing of what ended", async () => {
    const { asked } = await renderLesson({
      kept: { place: 4 },
      complete: () => {
        throw refused(Code.FailedPrecondition, Cause.SEGMENTS_NOT_ENDED);
      },
    });
    await userEvent.click(await continueButton());
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 3 of 4");
    expect(asked.filter((a) => a === "run r1")).toHaveLength(2);
  });

  it("begins the task again when api no longer knows its attempt, and stays in the lesson", async () => {
    window.location.hash = "#/lesson";
    const { begun } = await renderLesson({
      kept: { place: 3 },
      openAttempt: { attemptId: "a7", segment: 3 },
      openTask: (attemptId) => {
        if (attemptId === "a7") throw refused(Code.NotFound, Cause.NOT_FOUND);
      },
    });
    await waitFor(() => expect(begun).toHaveLength(1));
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(window.location.hash).toBe("#/lesson");
    window.location.hash = "";
  });

  it("offers to begin again when api answers a beginning with no attempt", async () => {
    await renderLesson({ kept: { place: 3 }, emptyBegin: true });
    expect(await screen.findByRole("button", { name: "Begin the task again" })).toBeVisible();
    expect(screen.getByText("This version of the app doesn't know this yet")).toBeVisible();
  });

  it("keeps the state by the run's full ID when the manifest does not come, with no lang", async () => {
    const { kept } = await renderLesson({ noManifest: true });
    const title = await screen.findByRole("heading", { level: 1, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toBeNull();
    await userEvent.click(await continueButton());
    await waitFor(async () => expect((await kept())?.place).toBe(2));
  });

  it("says it keeps nothing of a run by a choice whose manifest does not come", async () => {
    await renderLesson({ open: { kind: "choice", choiceId: "c1" }, noManifest: true });
    expect(await screen.findByText("Your work isn't saved on this device")).toBeVisible();
  });

  it("ends a run by a choice api ended, and reads a run without its lesson as a failure", async () => {
    const ended = await renderLesson({
      open: { kind: "choice", choiceId: "c1" },
      run: () => {
        throw runEnded(RunEndReason.PASSED);
      },
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Lesson complete" })).toBeVisible();
    expect(ended.endedRuns).toEqual([]);
    ended.unmount();

    await renderLesson({ noLesson: true });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("ends the run when api refuses the task for its end, and asks CheckPackages if unchecked", async () => {
    const { check, kept } = await renderLesson({
      kept: { place: 3 },
      begin: () => {
        throw runEnded(RunEndReason.UNCHECKED);
      },
    });
    expect(await screen.findByText("This version of the module is no longer given")).toBeVisible();
    expect(check).toHaveBeenCalledOnce();
    await waitFor(async () => expect(await kept()).toBeUndefined());
  });

  it("begins a task again with the same key after no answer, and stops at a segment refused again", async () => {
    let offline = true;
    const same = await renderLesson({
      kept: { place: 3 },
      begin: () => {
        if (offline) throw new ConnectError("down", Code.Unavailable);
      },
    });
    expect(await screen.findByText("No connection", { selector: "p" })).toBeVisible();
    offline = false;
    await userEvent.click(screen.getByRole("button", { name: "Begin the task again" }));
    await screen.findByRole("group", { name: "How many gaps?" });
    expect(new Set(same.begun.map((request) => request.idempotencyKey)).size).toBe(1);
    same.unmount();

    // api says the same segment is the one to finish: the learner may only try again.
    await renderLesson({
      kept: { place: 3 },
      begin: () => {
        throw endedSegments(Cause.SEGMENT_UNAVAILABLE, []);
      },
    });
    expect(await screen.findByRole("button", { name: "Begin the task again" })).toBeVisible();
    expect(screen.getByText("Not open yet", { selector: "p" })).toBeVisible();
  });

  it("offers what the engine chose at the end, and asks for it when the end gave none", async () => {
    const chosen = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      endChoice: { choiceId: "c3", kind: ChoiceKind.LESSON },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByRole("button", { name: "Next lesson" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Back to My subjects" })).toHaveClass("nt-secondary");
    chosen.unmount();

    await renderLesson({
      kept: { place: 2 },
      run: () => {
        throw refused(Code.FailedPrecondition, Cause.RUN_ENDED, {
          case: "runEnd",
          value: create(RunEndSchema, {
            reason: RunEndReason.ABANDONED,
            choice: { choiceId: "c4", kind: ChoiceKind.TASK },
          }),
        });
      },
    });
    expect(await screen.findByRole("button", { name: "Next task" })).toBeVisible();
  });

  it("takes lesson done with no end for a lesson passed", async () => {
    await renderLesson({ kept: { place: 4 }, ended: [3], noEnd: true });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(screen.getByRole("button", { name: "What's next" })).toBeVisible();
  });
});
