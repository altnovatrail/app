// The task screen in Chromium, with the canvas element itself (sections 3.2 and 3.3 of
// docs/architecture.md; R05, R20): the steps, the chips and the technique api gives once, the mode,
// the options tapped and Check from the keyboard, "Not yet" and "Correct" with the solution, one
// idempotency key for a check and its repeat, an attempt api closed meanwhile, the history of writing
// in the profile's database, and a write that did not land — with api on connect-es's router and
// the storage on the device's memory.
import "@altnovatrail/canvas";
import { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  type SubmitWorkRequest,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { Task } from "./Task.tsx";

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const MANIFEST = {
  module_format_version: "0.4",
  id: "example/choices",
  version: "1.0.0",
  title: "Choices",
  languages: { explanation: "en" },
};

/** The steps of the format's example of olympiad maths. */
const STEPS: readonly open.Step[] = [
  {
    title: "Understand the task",
    description: "Read the task again, and tick what is known and what you are to find.",
    gives: ["givens"],
    exit_condition: "givens_ticked",
  },
  { title: "Make a plan", gives: ["techniques"], exit_condition: "none" },
  { title: "Solve it", exit_condition: "answer_slots_filled" },
  { title: "Check the answer", exit_condition: "none" },
];

const TASK: open.Task = {
  id: "fruit",
  statement: [{ text: "Two apples and three pears are in a bowl." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  givens: ["Two apples", "Three pears"],
  unknown: "How many fruits",
  items: [
    { text: "How many fruits?", answer_slots: [{ binding: "choice", options: ["4", "5"] }] },
    { text: "More pears?", answer_slots: [{ binding: "choice", options: ["Yes", "No"] }] },
  ],
};

const KEY: Readonly<Record<string, string>> = { "1.1": "5", "2.1": "Yes" };
const SOLUTION = [
  { text: "Two and three make five." },
  { picture: "fruit.png", alt: "Five fruits", width: 40, height: 20 },
];

function refused(code: Code, cause: Cause, closeReason?: CloseReason): ConnectError {
  const refusal = create(RefusalSchema, {
    cause,
    ...(closeReason === undefined ? {} : { data: { case: "closeReason", value: closeReason } }),
  });
  return new ConnectError("refused", code, undefined, [{ desc: RefusalSchema, value: refusal }]);
}

interface Setup {
  /** Throws in place of the open attempt. */
  open?: () => void;
  /** What api keeps of the attempt: the verdicts of its last submission and the like. */
  items?: { item: number; slot: number; verdict: string; value: string }[];
  wrongAnswers?: number;
  stepTechniqueIds?: string[];
  /** Throws in place of the techniques of a step. */
  step?: () => void;
  /** Throws in place of the verdict, once for each call it is given. */
  submit?: (request: SubmitWorkRequest) => void;
  steps?: readonly open.Step[];
  mode?: Mode;
  /** The device of a screen before, to open again. */
  device?: Device;
  /** The profile's database does not open. */
  noDatabase?: boolean;
}

/** The verdicts of the options tapped, against the key. */
function judged(request: SubmitWorkRequest) {
  return TASK.items.map((_, i) => {
    const tap = request.tappedChoices.find((t) => t.answerSlot?.item === i + 1);
    const verdict = tap?.value === KEY[`${i + 1}.1`] ? "correct" : "not_yet";
    return {
      verdict,
      answerSlots: [
        { answerSlot: { item: i + 1, slot: 1 }, verdict, ...(tap ? { value: tap.value } : {}) },
      ],
    };
  });
}

async function renderTask(setup: Setup = {}) {
  const device = setup.device ?? memoryDevice().device;
  if (setup.device === undefined) await setAccount(device, "account-1");
  if (setup.noDatabase === true) {
    const connect = device.connect.bind(device);
    device.connect = (name, schema, create) =>
      name.startsWith("novatrail-profile-")
        ? Promise.resolve(undefined)
        : connect(name, schema, create);
  }
  const asked: string[] = [];
  const keys: string[] = [];
  const begun: BeginAttemptRequest[] = [];
  let wrong = setup.wrongAnswers ?? 0;
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, {
      getOpenAttempt(request) {
        asked.push(`open ${request.attemptId}`);
        setup.open?.();
        return {
          attempt: {
            start: {
              attemptId: request.attemptId,
              task: { json: encode(TASK), moduleFormatVersion: "0.4" },
              packageDigest: D1,
            },
            items: (setup.items ?? []).map((v) => ({
              verdict: v.verdict,
              answerSlots: [
                { answerSlot: { item: v.item, slot: v.slot }, verdict: v.verdict, value: v.value },
              ],
            })),
            wrongAnswers: wrong,
            stepTechniqueIds: setup.stepTechniqueIds ?? [],
          },
        };
      },
      beginAttempt(request) {
        begun.push(request);
        return { attempt: { attemptId: "a2", packageDigest: D1 } };
      },
    });
    router.service(AttemptService, {
      submitWork(request) {
        keys.push(request.idempotencyKey);
        setup.submit?.(request);
        const items = judged(request);
        const right = items.every((item) => item.verdict === "correct");
        if (!right) wrong += 1;
        return {
          items,
          wrongAnswers: wrong,
          ...(right ? { solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" } } : {}),
        };
      },
      beginStep(request) {
        asked.push(`step ${request.step}`);
        setup.step?.();
        return { techniques: { techniqueIds: ["draw"] } };
      },
    });
    router.service(PackageService, {
      getManifest: () => ({ manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } }),
      getSolvingSteps: () => ({
        solvingSteps: { json: encode({ steps: setup.steps ?? STEPS }), moduleFormatVersion: "0.4" },
      }),
      getTechniques: () => ({
        techniques: {
          json: encode({
            techniques: { draw: { title: "Draw the problem", description: "A picture helps." } },
          }),
          moduleFormatVersion: "0.4",
        },
      }),
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
  const attempts: (string | undefined)[] = [];
  const rendered = render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <Task
            profileId="p1"
            attemptId="a1"
            defaultMode={setup.mode ?? Mode.BY_STEPS}
            device={device}
            onAttempt={(id) => attempts.push(id)}
          />
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return { device, asked, keys, begun, check, attempts, unmount: rendered.unmount };
}

const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const check = () => screen.getByRole("button", { name: "Check" });

afterEach(() => {
  vi.useRealTimers();
});

describe("the task screen", () => {
  it("leads by steps: the chips open Step done, the plan asks api for the technique once", async () => {
    const { asked } = await renderTask();
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    expect(panel().getByText(/tick what is known/)).toHaveAttribute("lang", "en");
    const done = panel().getByRole("button", { name: "Step done" });
    expect(done).toHaveAttribute("aria-disabled", "true");
    expect(done).toHaveAccessibleDescription("Mark what we know and what to find");
    // A press the browser lets through, as a screen reader's would: aria-disabled does not stop it.
    done.click();
    expect(panel().getByRole("heading", { level: 2 })).toHaveTextContent("Understand the task");
    for (const chip of ["Two apples", "Three pears", "How many fruits"]) {
      await userEvent.click(panel().getByRole("button", { name: chip }));
    }
    expect(panel().getByRole("button", { name: "Two apples" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(done).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(done);
    const plan = await panel().findByRole("heading", { name: "Make a plan", level: 2 });
    expect(document.activeElement).toBe(plan);
    expect(await panel().findByText("Draw the problem")).toBeVisible();
    // Back to the first step and on again: nothing is reset, nothing asked again.
    await userEvent.click(panel().getByRole("button", { name: /Understand the task/ }));
    expect(panel().getByRole("button", { name: "Three pears" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(panel().getByRole("button", { name: /Make a plan/ }));
    await panel().findByText("Draw the problem");
    expect(asked).toEqual(["open a1", "step 2"]);
    const bar = panel().getByRole("list", { name: "Steps" });
    expect(within(bar).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");
    expect(within(bar).getAllByRole("listitem")[2]).toHaveTextContent("3. Solve it (later)");
  });

  it("takes the options and Check from the keyboard, and gives Not yet, then Correct", async () => {
    const { keys, device } = await renderTask({ mode: Mode.SELF });
    const fruits = await screen.findByRole("group", { name: "How many fruits?" });
    expect(check()).toHaveAttribute("aria-disabled", "true");
    expect(check()).toHaveAccessibleDescription("Choose an answer in each item");
    // On my own, the tutor answers only when called: no panel until the task is solved.
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Step done" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    // The screen has taken the focus on its heading by now: the keyboard goes on from here.
    within(fruits).getByRole("radio", { name: "4" }).focus();
    await userEvent.keyboard(" ");
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    check().focus();
    await userEvent.keyboard("{Enter}");
    await screen.findByText("Not right yet: 2 items of 2");
    // On the item and on the option tapped, which it describes.
    expect(within(fruits).getAllByText("Not yet").length).toBe(2);
    expect(within(fruits).getByRole("radio", { name: "4" })).toHaveAccessibleDescription("Not yet");
    // Another option drops its slot's verdict: it was the verdict of another answer.
    await userEvent.click(within(fruits).getByRole("radio", { name: "5" }));
    expect(within(fruits).queryByText("Not yet")).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    expect(await panel().findByText("Correct")).toBeVisible();
    // The summary tells a screen reader, as a status does.
    expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain("Correct");
    expect(within(fruits).getByRole("radio", { name: "5" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    const solution = panel().getByRole("region", { name: "Solution" });
    expect(within(solution).getByText("Two and three make five.")).toBeVisible();
    const image = await within(solution).findByRole("img", { name: "Five fruits" });
    expect(image.getAttribute("src")).toMatch(/^blob:/);
    // The sheet still takes strokes, but the attempt is over: no write, and no word of one unsaved.
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    sheet.history = [
      {
        kind: "write",
        t: 48,
        stroke: {
          id: 1,
          kind: "mouse",
          points: [0, 1, 2, 3].map((i) => ({ x: 100 + i * 7.3333, y: 100, t: i * 16, p: 0.5 })),
        },
      },
    ];
    expect(sheet.undo()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Your work isn't saved on this device")).toBeNull();
    expect(new Set(keys).size).toBe(2);
    // The attempt is over: its work on the device went with it.
    const profile = await addProfile(device, "p1");
    expect(await profile?.readAttempt("a1")).toBeUndefined();
  });

  it("sends a check again with the same key, and a new option with a new one", async () => {
    // Down for every repeat the client makes of the first check, and up for the learner's own.
    let down = true;
    const { keys } = await renderTask({
      mode: Mode.SELF,
      submit: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    down = false;
    await userEvent.click(check());
    await screen.findByText("Not right yet: 2 items of 2");
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await screen.findByText("Not right yet: 1 item of 2");
    const first = keys[0];
    // The client's own repeats of the failed call, then the learner's: all with the first key.
    expect(keys.slice(0, -1).every((key) => key === first)).toBe(true);
    expect(keys.at(-1)).not.toBe(first);
  });

  it("begins the same task again after Correct", async () => {
    const { begun, attempts } = await renderTask({ mode: Mode.SELF });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await userEvent.click(await panel().findByRole("button", { name: "Try it again" }));
    await vi.waitFor(() => expect(attempts).toEqual([undefined, "a2"]));
    expect(begun[0]?.start).toEqual({ case: "previousAttemptId", value: "a1" });
    expect(begun[0]?.idempotencyKey).not.toBe("");
  });

  it("shows an attempt api closed unchecked, erases it and asks CheckPackages", async () => {
    const { check: checked, attempts } = await renderTask({
      open: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.UNCHECKED);
      },
    });
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
    expect(screen.getByText("Not checked")).toBeVisible();
    expect(checked).toHaveBeenCalledOnce();
    expect(attempts).toEqual([undefined]);
    expect(screen.getByRole("button", { name: "Try it again" })).toBeVisible();
  });

  it("closes the screen when a check finds the attempt closed meanwhile", async () => {
    const { check: checked } = await renderTask({
      mode: Mode.SELF,
      submit: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.LEFT);
      },
    });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
    expect(screen.getByText("Another task was begun")).toBeVisible();
    expect(checked).not.toHaveBeenCalled();
  });

  it("goes on where it was after a restart: the mode, the step and the history of writing", async () => {
    const first = await renderTask();
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    await userEvent.click(screen.getByRole("button", { name: "On my own" }));
    await userEvent.click(screen.getByRole("radio", { name: "4" }));
    const profile = await addProfile(first.device, "p1");
    const stroke: HistoryEvent = {
      kind: "write",
      t: 48,
      stroke: {
        id: 1,
        kind: "mouse",
        points: [0, 1, 2, 3].map((i) => ({ x: 100 + i * 7.3333, y: 100, t: i * 16, p: 0.5 })),
      },
    };
    await vi.waitFor(async () =>
      expect((await profile?.readAttempt("a1"))?.attempt.steps).toMatchObject({ mode: "self" }),
    );
    expect(
      await profile?.replaceHistory("a1", [
        stroke,
        { ...stroke, stroke: { ...stroke.stroke, id: 2 } },
      ]),
    ).toBe("saved");
    first.unmount();

    const again = await renderTask({ device: first.device });
    await screen.findByRole("radio", { name: "4" });
    expect(screen.getByRole("radio", { name: "4" })).toBeChecked();
    expect(screen.getByRole("button", { name: "On my own" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const element = document.querySelector("novatrail-canvas") as CanvasElement & {
      undo(): boolean;
    };
    await vi.waitFor(() => expect(element.history.length).toBe(2));
    // An undo on the sheet is an event the database gets.
    expect(element.undo()).toBe(true);
    await vi.waitFor(async () =>
      expect((await profile?.readAttempt("a1"))?.history.length).toBe(3),
    );
    expect(again.asked).toEqual(["open a1"]);
  });

  it("starts on another device from what api keeps: the options, the verdicts, the techniques", async () => {
    const { asked } = await renderTask({
      items: [{ item: 1, slot: 1, verdict: "not_yet", value: "4" }],
      wrongAnswers: 1,
      stepTechniqueIds: ["draw"],
    });
    const fruits = await screen.findByRole("group", { name: /How many fruits\?/ });
    expect(within(fruits).getByRole("radio", { name: "4" })).toBeChecked();
    expect(within(fruits).getAllByText("Not yet").length).toBe(2);
    for (const chip of ["Two apples", "Three pears", "How many fruits"]) {
      await userEvent.click(panel().getByRole("button", { name: chip }));
    }
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    expect(await panel().findByText("Draw the problem")).toBeVisible();
    expect(asked).toEqual(["open a1"]);
  });

  it("says the work is not saved on this device when its database cannot be had", async () => {
    await renderTask({ noDatabase: true, mode: Mode.SELF });
    expect(await screen.findByText("Your work isn't saved on this device")).toBeVisible();
  });

  it("has no switch of the mode for a module without steps", async () => {
    await renderTask({ steps: [] });
    await screen.findByRole("radio", { name: "4" });
    expect(screen.queryByRole("button", { name: "Step by step" })).toBeNull();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
  });

  it("blinks Check once on a pause, while it is open", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await renderTask({ mode: Mode.SELF });
    await vi.waitFor(() => screen.getByRole("radio", { name: "5" }));
    screen.getByRole("radio", { name: "5" }).click();
    screen.getByRole("radio", { name: "Yes" }).click();
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    vi.advanceTimersByTime(6000);
    await vi.waitFor(() => expect(check()).toHaveClass("nt-blink"));
    vi.advanceTimersByTime(3000);
    await vi.waitFor(() => expect(check()).not.toHaveClass("nt-blink"));
    vi.advanceTimersByTime(12000);
    expect(check()).not.toHaveClass("nt-blink");
  });

  it("goes home when api knows the attempt no more, in place of the task screen", async () => {
    window.location.hash = "#/task";
    const entries = window.history.length;
    const { attempts } = await renderTask({
      open: () => {
        throw refused(Code.NotFound, Cause.NOT_FOUND);
      },
    });
    await vi.waitFor(() => expect(attempts).toEqual([undefined]));
    expect(window.location.hash).toBe("#/home");
    // "Back" does not come to the task screen again: the way home took its place.
    expect(window.history.length).toBe(entries);
    window.location.hash = "";
  });

  it("offers to try again when the attempt does not come", async () => {
    let down = true;
    const { asked } = await renderTask({
      open: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await screen.findByRole("heading", { level: 1, name: "No connection" });
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    expect(asked.filter((call) => call === "open a1").length).toBeGreaterThan(1);
  });

  it("names a failure it cannot help, with a retry", async () => {
    await renderTask({
      open: () => {
        throw refused(Code.FailedPrecondition, Cause.NO_CONSENT);
      },
    });
    await screen.findByRole("heading", { level: 1, name: "A grown-up's consent is needed first" });
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("asks for the technique again on coming back to the step, when it did not come", async () => {
    let down = true;
    const { asked } = await renderTask({
      stepTechniqueIds: [],
      step: () => {
        if (down) throw refused(Code.FailedPrecondition, Cause.NOT_FOUND);
      },
    });
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    for (const chip of ["Two apples", "Three pears", "How many fruits"]) {
      await userEvent.click(panel().getByRole("button", { name: chip }));
    }
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    await panel().findByRole("heading", { name: "Make a plan", level: 2 });
    await vi.waitFor(() => expect(asked).toContain("step 2"));
    expect(panel().queryByText("Draw the problem")).toBeNull();
    down = false;
    await userEvent.click(panel().getByRole("button", { name: /Understand the task/ }));
    await userEvent.click(panel().getByRole("button", { name: /Make a plan/ }));
    expect(await panel().findByText("Draw the problem")).toBeVisible();
    expect(asked.filter((call) => call === "step 2").length).toBe(2);
  });

  it("begins the task again from the screen of an attempt over", async () => {
    const { begun, attempts } = await renderTask({
      open: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.ABANDONED);
      },
    });
    expect(await screen.findByText("Nothing was done on it for 7 days")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Try it again" }));
    await vi.waitFor(() => expect(attempts).toEqual([undefined, "a2"]));
    expect(begun.length).toBe(1);
  });
});
