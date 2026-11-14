// The task screen in the browser, with the canvas element itself (sections 3.2 and 3.3 of
// docs/architecture.md; R05, R20): the steps, the chips and the technique api gives once, the mode,
// the options tapped and Check from the keyboard, "Not yet" and "Correct" with the solution, one
// idempotency key for a check and its repeat, an attempt api closed meanwhile, the history of writing
// in the profile's database, and a write that did not land — with api on connect-es's router and
// the storage on the device's memory.
import "@altnovatrail/canvas";
import {
  AccountService,
  Mode,
  type Profile,
  ProfileSchema,
  type SetVoicingRequest,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Action,
  AttemptService,
  type ExplainDifferentlyRequest,
  type ExplainDifferentlyResponseSchema,
  type GetCorrectAnswerWordsRequest,
  type GetCorrectAnswerWordsResponseSchema,
  type GetHintResponseSchema,
  type GetRungWordsRequest,
  type GetRungWordsResponseSchema,
  MarkKind,
  ProblemKind,
  type ReportProblemRequest,
  type ReportProblemResponseSchema,
  type ShowSolutionRequest,
  type ShowSolutionResponseSchema,
  type SubmitWorkRequest,
  type SubmitWorkResponseSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  ChoiceKind,
  CloseReason,
  type OutcomeSchema,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { fakeSpeech, voice } from "../test/speech.ts";
import { SpeechProvider, VoicingProvider } from "../voice/VoicingContext.tsx";
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
  /** Throws in place of a new attempt. */
  begin?: () => void;
  /** The module has no part of solving steps. */
  noSteps?: boolean;
  /** api answers with no start of the attempt. */
  noStart?: boolean;
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
  /** The task of the attempt; the one with options when left out. */
  task?: open.Task;
  /** The history of writing this device kept of the attempt. */
  history?: readonly HistoryEvent[];
  /** The answer to a submission, in place of the verdicts of the options. */
  answer?: (request: SubmitWorkRequest) => MessageInitShape<typeof SubmitWorkResponseSchema>;
  /** The words of a rung. */
  rung?: (
    request: GetRungWordsRequest,
  ) =>
    | MessageInitShape<typeof GetRungWordsResponseSchema>
    | Promise<MessageInitShape<typeof GetRungWordsResponseSchema>>;
  /** The words after a correct answer. */
  correct?: (
    request: GetCorrectAnswerWordsRequest,
  ) =>
    | MessageInitShape<typeof GetCorrectAnswerWordsResponseSchema>
    | Promise<MessageInitShape<typeof GetCorrectAnswerWordsResponseSchema>>;
  /** The words of the rung an open attempt keeps. */
  kept?: { rung: number; words: string };
  /** The learner is of the category `adult`. */
  adult?: boolean;
  /** What a hint gives. */
  hint?: () => MessageInitShape<typeof GetHintResponseSchema>;
  /** What "Explain differently" gives. */
  explain?: (
    request: ExplainDifferentlyRequest,
  ) =>
    | MessageInitShape<typeof ExplainDifferentlyResponseSchema>
    | Promise<MessageInitShape<typeof ExplainDifferentlyResponseSchema>>;
  /** What showing the solution gives. */
  show?: (request: ShowSolutionRequest) => MessageInitShape<typeof ShowSolutionResponseSchema>;
  /** "Explain differently" was asked on the current rung, as the open attempt says. */
  explained?: boolean;
  /** The hint asked for that the open attempt keeps. */
  openHint?: { techniques: string[]; question?: string };
  /**
   * Before api answers a report: throws to refuse it, or to lose its reply once it is recorded; the
   * number is of the request, from 0.
   */
  report?: (request: ReportProblemRequest, n: number) => void | Promise<void>;
  /** The answer to a report in place of the one api keeps by its key. */
  reportAnswer?: MessageInitShape<typeof ReportProblemResponseSchema>;
  /**
   * The screen among a learner's screens, with this synthesis and the profile's voicing on or
   * off; else outside them, the voicing off. SetVoicing fails when `voicingFails` says.
   */
  voicing?: { speech: ReturnType<typeof fakeSpeech>; on: boolean };
  voicingFails?: boolean;
}

/** When the operator reviews a report by, in the tests: 3 days after 2026-11-12, at noon UTC. */
const REVIEW_BY = new Date("2026-11-15T12:00:00Z");

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
  if (setup.history !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: D1, task: setup.task ?? TASK });
    await profile?.replaceHistory("a1", setup.history);
  }
  const asked: string[] = [];
  const keys: string[] = [];
  const begun: BeginAttemptRequest[] = [];
  const submitted: SubmitWorkRequest[] = [];
  const rungs: GetRungWordsRequest[] = [];
  const corrects: GetCorrectAnswerWordsRequest[] = [];
  const explains: ExplainDifferentlyRequest[] = [];
  const shows: ShowSolutionRequest[] = [];
  // Every request of a report, and the reports api keeps, by their idempotency key.
  const reportRequests: ReportProblemRequest[] = [];
  const reports = new Map<string, ReportProblemRequest>();
  let wrong = setup.wrongAnswers ?? 0;
  const voicings: SetVoicingRequest[] = [];
  const saved: Profile[] = [];
  const failed: unknown[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(AccountService, {
      setVoicing(request) {
        voicings.push(request);
        if (setup.voicingFails === true) throw new ConnectError("down", Code.Unavailable);
        return {
          profile: {
            profileId: request.profileId,
            presentationStyle: { voicing: request.voicing },
          },
        };
      },
    });
    router.service(LearningService, {
      getOpenAttempt(request) {
        asked.push(`open ${request.attemptId}`);
        setup.open?.();
        if (setup.noStart === true) return {};
        return {
          attempt: {
            start: {
              attemptId: request.attemptId,
              task: { json: encode(setup.task ?? TASK), moduleFormatVersion: "0.4" },
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
            ...(setup.kept === undefined ? {} : { rung: setup.kept }),
            explainedDifferently: setup.explained ?? false,
            requestedTechniqueIds: setup.openHint?.techniques ?? [],
            requestedLeadingQuestion: setup.openHint?.question ?? "",
          },
        };
      },
      beginAttempt(request) {
        begun.push(request);
        setup.begin?.();
        return { attempt: { attemptId: "a2", packageDigest: D1 } };
      },
    });
    router.service(AttemptService, {
      submitWork(request) {
        keys.push(request.idempotencyKey);
        submitted.push(request);
        setup.submit?.(request);
        if (setup.answer !== undefined) {
          const given = setup.answer(request);
          wrong = given.wrongAnswers ?? wrong;
          return given;
        }
        const items = judged(request);
        const right = items.every((item) => item.verdict === "correct");
        if (!right) wrong += 1;
        return {
          items,
          wrongAnswers: wrong,
          ...(right ? { solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" } } : {}),
        };
      },
      getRungWords(request) {
        rungs.push(request);
        return (
          setup.rung?.(request) ?? {
            rung: request.wrongAnswers ?? 1,
            words: "Count the gaps between the rungs.",
            outcome: { cause: Cause.NOT_ADMITTED },
          }
        );
      },
      getCorrectAnswerWords(request) {
        corrects.push(request);
        return setup.correct?.(request) ?? { outcome: { cause: Cause.NOT_ADMITTED } };
      },
      getHint() {
        asked.push("hint");
        return (
          setup.hint?.() ?? {
            hint: { case: "techniques", value: { techniqueIds: ["draw"] } },
            leadingQuestion: "What if there were only two pears?",
          }
        );
      },
      explainDifferently(request) {
        explains.push(request);
        return (
          setup.explain?.(request) ?? { words: "In other words: count the fruits one by one." }
        );
      },
      showSolution(request) {
        shows.push(request);
        return (
          setup.show?.(request) ?? {
            solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
          }
        );
      },
      async reportProblem(request) {
        reportRequests.push(request);
        // A repeat with the same key gets the same report, and api keeps no second one.
        if (!reports.has(request.idempotencyKey)) reports.set(request.idempotencyKey, request);
        await setup.report?.(request, reportRequests.length - 1);
        return (
          setup.reportAnswer ?? {
            reportId: `report-${[...reports.keys()].indexOf(request.idempotencyKey) + 1}`,
            reviewBy: timestampFromDate(REVIEW_BY),
          }
        );
      },
      beginStep(request) {
        asked.push(`step ${request.step}`);
        setup.step?.();
        return { techniques: { techniqueIds: ["draw"] } };
      },
    });
    router.service(PackageService, {
      getManifest: () => ({ manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } }),
      getSolvingSteps: () =>
        setup.noSteps === true
          ? {}
          : {
              solvingSteps: {
                json: encode({ steps: setup.steps ?? STEPS }),
                moduleFormatVersion: "0.4",
              },
            },
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
  const voiced = (screen: ReactNode) =>
    setup.voicing === undefined ? (
      screen
    ) : (
      <SpeechProvider value={setup.voicing.speech.speech}>
        <VoicingProvider
          profile={create(ProfileSchema, {
            profileId: "p1",
            presentationStyle: {
              voicing: { enabled: setup.voicing.on, speed: VoicingSpeed.NORMAL },
            },
          })}
          device={device}
          place="task"
          onSaved={(profile) => saved.push(profile)}
          onFailed={(failure) => failed.push(failure)}
        >
          {screen}
        </VoicingProvider>
      </SpeechProvider>
    );
  const rendered = render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          {voiced(
            <Task
              profileId="p1"
              attemptId="a1"
              defaultMode={setup.mode ?? Mode.BY_STEPS}
              device={device}
              adult={setup.adult ?? false}
              onAttempt={(id) => attempts.push(id)}
            />,
          )}
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return {
    device,
    asked,
    keys,
    begun,
    submitted,
    rungs,
    corrects,
    explains,
    shows,
    reportRequests,
    reports,
    check,
    attempts,
    voicings,
    saved,
    failed,
    unmount: rendered.unmount,
  };
}

const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const check = () => screen.getByRole("button", { name: "Check" });

/** The midnight after now on the device's clock: the next family day, by the offset it sends. */
function tomorrow(): Date {
  const day = new Date();
  day.setHours(24, 0, 0, 0);
  return day;
}
const at = (moment: Date) => dateTimeFormat("en", { timeStyle: "short" }).format(moment);

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

  it("offers what the engine chose with Correct and with the solution shown, or asks for it", async () => {
    const chosen = await renderTask({
      mode: Mode.SELF,
      answer: (request) => ({
        items: judged(request),
        wrongAnswers: 0,
        solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
        next: { next: { case: "choice", value: { choiceId: "c2", kind: ChoiceKind.TASK } } },
      }),
    });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    expect(await panel().findByRole("button", { name: "Next task" })).toBeVisible();
    expect(panel().getByRole("button", { name: "Try it again" })).toHaveClass("nt-secondary");
    chosen.unmount();

    const shown = await renderTask({
      mode: Mode.SELF,
      adult: true,
      show: () => ({
        solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
        next: { next: { case: "choice", value: { choiceId: "c1", kind: ChoiceKind.LESSON } } },
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Show the solution" }));
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(await panel().findByRole("button", { name: "Next lesson" })).toBeVisible();
    shown.unmount();

    // An answer with no choice: the press asks for it.
    await renderTask({ mode: Mode.SELF });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    expect(await panel().findByRole("button", { name: "What's next" })).toBeVisible();
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
    expect(screen.getByRole("button", { name: "What's next" })).toHaveClass("nt-secondary");
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

  it("says a new attempt did not begin, keeps its key, and begins it on the next press", async () => {
    let down = true;
    const { begun, attempts } = await renderTask({
      mode: Mode.SELF,
      begin: () => {
        if (down) throw refused(Code.FailedPrecondition, Cause.NO_CURRENT_VERSION);
      },
    });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await userEvent.click(await panel().findByRole("button", { name: "Try it again" }));
    expect(await panel().findByRole("alert")).toHaveTextContent(
      "This version of the module is no longer given",
    );
    down = false;
    await userEvent.click(panel().getByRole("button", { name: "Try it again" }));
    await vi.waitFor(() => expect(attempts).toEqual([undefined, "a2"]));
    expect(begun.map((request) => request.idempotencyKey)).toEqual([
      begun[0]?.idempotencyKey,
      begun[0]?.idempotencyKey,
    ]);
  });

  it("goes back to My subjects from the result, and to the steps from on my own", async () => {
    window.location.hash = "#/task";
    await renderTask();
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    await userEvent.click(screen.getByRole("button", { name: "On my own" }));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Step by step" }));
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    await userEvent.click(screen.getByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await userEvent.click(await panel().findByRole("button", { name: "Back to My subjects" }));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
  });

  it("closes the screen when api says at a step that the attempt is over", async () => {
    await renderTask({
      step: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.SOLUTION_SHOWN);
      },
    });
    await screen.findByRole("heading", { name: "Understand the task", level: 2 });
    for (const chip of ["Two apples", "Three pears", "How many fruits"]) {
      await userEvent.click(panel().getByRole("button", { name: chip }));
    }
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
    expect(screen.getByText("Its solution was shown")).toBeVisible();
  });

  it("names an answer without the start of the attempt, and reads it again on a retry", async () => {
    const { asked } = await renderTask({ noStart: true });
    await screen.findByRole("heading", {
      level: 1,
      name: "This version of the app doesn't know this yet",
    });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(asked).toEqual(["open a1", "open a1"]));
  });

  it("goes on my own for a module that has no part of solving steps", async () => {
    await renderTask({ noSteps: true });
    await screen.findByRole("radio", { name: "4" });
    expect(screen.queryByRole("button", { name: "Step by step" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
  });
});

/** The task of the ladder's rungs, answered on the sheet. */
const SHEET_TASK: open.Task = {
  id: "rungs",
  statement: [{ text: "The rungs are 30 cm apart, 180 cm from the lowest to the highest." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ text: "How many rungs?", answer_slots: [{ binding: "anywhere" }] }],
};

/** A stroke the sheet could have written: points apart, in time, a third of a unit off the grid. */
function stroke(id: number, x: number, t: number): HistoryEvent {
  const points = [0, 1, 2, 3].map((i) => ({
    x: x + i * 7.3333,
    y: 100 + i * 3.1111,
    t: t + i * 16,
    p: 0.5,
  }));
  return { kind: "write", t: t + 48, stroke: { id, kind: "mouse", points } };
}

const WRITTEN = [stroke(1, 100, 0), stroke(2, 160, 5000)];

/** The answer of a submission of the sheet: its one slot's verdict, and what came of it. */
function sheetAnswer(
  verdict: string,
  more: { value?: string; reason?: string; wrong?: number } = {},
) {
  return {
    items: [
      {
        verdict,
        answerSlots: [
          {
            answerSlot: { item: 1, slot: 1 },
            verdict,
            ...(more.value === undefined ? {} : { value: more.value }),
            ...(more.reason === undefined ? {} : { reason: more.reason }),
          },
        ],
      },
    ],
    wrongAnswers: more.wrong ?? 0,
  };
}

const PNG = [0x89, 0x50, 0x4e, 0x47];

describe("the task screen with handwriting", () => {
  it("sends the crop, keeps the submission, shows what was read and asks the words of its rung", async () => {
    const { submitted, rungs, device } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
      rung: () => ({
        rung: 1,
        words: "How many gaps are there between the rungs?",
        marks: [
          {
            kind: MarkKind.FRAME,
            place: { case: "cropBox", value: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 } },
          },
        ],
      }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("Read: 5")).toBeVisible();
    const sent = submitted[0];
    if (sent?.work?.surface.case !== "sheet") throw new Error("no crop of the sheet");
    expect([...sent.work.surface.value.crop.slice(0, 4)]).toEqual(PNG);
    expect(sent.clockOffsetMinutes).toBeDefined();
    // The words of the rung: in the panel, in the module's language, told by a line of status.
    const words = await panel().findByText("How many gaps are there between the rungs?");
    expect(words).toHaveAttribute("lang", "en");
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
    expect(screen.getAllByRole("status").map((line) => line.textContent)).toContain(
      "The tutor's words came",
    );
    expect(rungs[0]?.wrongAnswers).toBe(1);
    expect(rungs[0]?.work).toEqual(sent.work);
    // The mark goes on the canvas with the context of the submission it is of, named.
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement;
    await vi.waitFor(() => expect(sheet.marks?.marks[0]?.name).toBe("Tutor's mark 1 of 1"));
    const profile = await addProfile(device, "p1");
    const kept = await profile?.readAttempt("a1");
    expect(kept?.submissions?.length).toBe(1);
    expect(sheet.marks?.submission).toEqual(kept?.submissions?.[0]?.context);
  });

  it("says why a slot could not be read, for every reason, and an outcome of AI in neutral words", async () => {
    const reasons = [
      ["blank", "Nothing is written"],
      ["notation", "Write it the way the task asks"],
      ["illegible", "It can't be made out"],
      ["ambiguous", "It can be read two ways"],
      ["no_final_answer", "There is no final answer"],
      ["several_final_answers", "There is more than one final answer"],
      ["smudged", "This version of the app doesn't know this yet"],
    ] as const;
    let n = 0;
    const { rungs } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("unreadable", { reason: reasons[n++]?.[0] ?? "blank" }),
    });
    for (const [, line] of reasons) {
      await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
      await userEvent.click(check());
      expect(await screen.findByText(line)).toBeVisible();
    }
    // Not reading raises no rung: no words are asked.
    expect(rungs).toEqual([]);
  });

  it("words an outcome of AI neutrally, with every slot unchecked", async () => {
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => ({ ...sheetAnswer("unchecked"), outcome: { cause: Cause.AI_FAILURE } }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("The tutor can't answer right now")).toBeVisible();
    expect(screen.getAllByText("Not checked").length).toBeGreaterThan(0);
  });

  it("says when the tutor comes back once the quota left a check unchecked (R37)", async () => {
    const midnight = tomorrow();
    const { rungs } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => ({
        ...sheetAnswer("unchecked"),
        outcome: { cause: Cause.QUOTA, nextFamilyDay: timestampFromDate(midnight) },
      }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(
      await screen.findByText(
        `Today's tutor time is used up. It comes back tomorrow at ${at(midnight)}`,
      ),
    ).toBeVisible();
    expect(screen.getAllByText("Not checked").length).toBeGreaterThan(0);
    // "Unchecked" is no wrong answer: no rung, no words asked.
    expect(rungs).toEqual([]);
  });

  it("stands the quota beside the fallback text of a rung, and no line beside it for no admission", async () => {
    const midnight = tomorrow();
    let outcome: MessageInitShape<typeof OutcomeSchema> = {
      cause: Cause.QUOTA,
      nextFamilyDay: timestampFromDate(midnight),
    };
    const { rungs } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: rungs.length + 1 }),
      rung: (request) => ({ rung: request.wrongAnswers, words: "Read the task again.", outcome }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    // In "On my own" the block "Tutor" comes with the first answer: wait for it before reading it.
    await screen.findByRole("complementary", { name: "Tutor" });
    expect(await panel().findByText("Read the task again.")).toBeVisible();
    const line = `Today's tutor time is used up. It comes back tomorrow at ${at(midnight)}`;
    expect(panel().getByText(line)).toBeVisible();
    // On platform AI the words carry the clock's offset, for the family day of the quota.
    expect(rungs[0]?.clockOffsetMinutes).toBe(-new Date().getTimezoneOffset() || 0);
    // The limit of platform AI stands beside them too, in its neutral phrase.
    outcome = { cause: Cause.PLATFORM_LIMIT };
    await userEvent.click(check());
    await vi.waitFor(() => expect(panel().queryByText(line)).toBeNull());
    expect(panel().getByText("The tutor can't answer right now")).toBeVisible();
    // A deployment that admits no words of a model yet gives the fallback text alone.
    outcome = { cause: Cause.NOT_ADMITTED };
    await userEvent.click(check());
    await vi.waitFor(() => expect(rungs.length).toBe(3));
    await vi.waitFor(() =>
      expect(panel().queryByText("The tutor can't answer right now")).toBeNull(),
    );
    expect(panel().getByText("Read the task again.")).toBeVisible();
    expect(screen.queryByText("The tutor isn't available for this profile")).toBeNull();
  });

  it("says the quota once, by Check or by the words, and drops it once a model's words come", async () => {
    const midnight = tomorrow();
    const quota = { cause: Cause.QUOTA, nextFamilyDay: timestampFromDate(midnight) };
    const line = `Today's tutor time is used up. It comes back tomorrow at ${at(midnight)}`;
    let atCheck = true;
    let explained: () => MessageInitShape<typeof ExplainDifferentlyResponseSchema> = () => {
      throw new ConnectError("refused", Code.ResourceExhausted, undefined, [
        {
          desc: RefusalSchema,
          value: create(RefusalSchema, {
            cause: Cause.QUOTA,
            data: { case: "nextFamilyDay", value: quota.nextFamilyDay },
          }),
        },
      ]);
    };
    const { rungs } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      // A check whose slot of choice was wrong while the quota left its handwriting unchecked.
      answer: () => ({
        ...sheetAnswer("not_yet", { value: "5", wrong: rungs.length + 1 }),
        ...(atCheck ? { outcome: quota } : {}),
      }),
      rung: (request) => ({
        rung: request.wrongAnswers,
        words: "Read the task again.",
        outcome: quota,
      }),
      explain: () => explained(),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("Read the task again.")).toBeVisible();
    // The line stands by Check, and the words of the same check do not say it again.
    expect(screen.getAllByText(line)).toHaveLength(1);
    expect(panel().queryByText(line)).toBeNull();
    // A check that read the work: the line goes with the words.
    atCheck = false;
    await userEvent.click(check());
    await vi.waitFor(() => expect(rungs.length).toBe(2));
    expect(await panel().findByText(line)).toBeVisible();
    expect(screen.getAllByText(line)).toHaveLength(1);
    // "Explain differently" refused by the quota says nothing the line does not; the right stays.
    await userEvent.click(panel().getByRole("button", { name: "Explain differently" }));
    await vi.waitFor(() =>
      expect(panel().getByRole("button", { name: "Explain differently" })).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
    expect(screen.getAllByText(line)).toHaveLength(1);
    // The family day began: a model's words take the place of the fallback, and the line goes.
    explained = () => ({ words: "In other words: count again." });
    await userEvent.click(panel().getByRole("button", { name: "Explain differently" }));
    expect(await panel().findByText("In other words: count again.")).toBeVisible();
    expect(screen.queryByText(line)).toBeNull();
  });

  it("says why no words came after a correct answer while platform AI is closed (R37)", async () => {
    let outcome: { cause: Cause } = { cause: Cause.PLATFORM_LIMIT };
    const solved = () => ({
      ...sheetAnswer("correct", { value: "7" }),
      solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
    });
    const first = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: solved,
      correct: () => ({ outcome }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByRole("region", { name: "Solution" });
    // In "On my own" the block "Tutor" comes with the first answer: wait for it before reading it.
    await screen.findByRole("complementary", { name: "Tutor" });
    expect(await panel().findByText("The tutor can't answer right now")).toBeVisible();
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
    expect(first.corrects[0]?.clockOffsetMinutes).toBe(-new Date().getTimezoneOffset() || 0);
    first.unmount();
    // No admission after a correct answer is no news: the result stands without a line.
    outcome = { cause: Cause.NOT_ADMITTED };
    const second = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: solved,
      correct: () => ({ outcome }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByRole("region", { name: "Solution" });
    await vi.waitFor(() => expect(second.corrects.length).toBe(1));
    expect(screen.queryByText("The tutor isn't available for this profile")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Tutor", level: 2 })).toBeNull();
  });

  it("keeps Check closed with a line until the sheet holds an answer", async () => {
    await renderTask({ task: SHEET_TASK, mode: Mode.SELF });
    await screen.findByText("How many rungs?");
    expect(check()).toHaveAttribute("aria-disabled", "true");
    expect(check()).toHaveAccessibleDescription("Write an answer on the sheet");
  });

  it("sends a check again with the same key and work, and a new stroke with a new key", async () => {
    let down = true;
    const { keys, submitted } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      submit: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
      },
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    const tried = keys.length;
    await userEvent.click(check());
    await vi.waitFor(() => expect(keys.length).toBeGreaterThan(tried));
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    // The learner's repeat of a check that did not answer: the same key, the same work.
    const first = keys[0];
    expect(keys.every((key) => key === first)).toBe(true);
    expect(submitted.at(-1)?.work).toEqual(submitted[0]?.work);
    // A new stroke is another action, even after a check that did not answer.
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    expect(sheet.undo()).toBe(true);
    down = false;
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByText("Read: 5");
    expect(keys.at(-1)).not.toBe(first);
    expect(submitted.at(-1)?.work).not.toEqual(submitted[0]?.work);
  });

  it("keeps the work of the correct submission until the words after it, then lets it go", async () => {
    let answer: () => void = () => {};
    const { corrects, device } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => ({
        ...sheetAnswer("correct", { value: "7" }),
        solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
      }),
      correct: () =>
        new Promise((resolve) => {
          answer = () => resolve({ words: "The gaps were the key: well found." });
        }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByRole("region", { name: "Solution" });
    const profile = await addProfile(device, "p1");
    await vi.waitFor(() => expect(corrects.length).toBe(1));
    expect(corrects[0]?.work?.surface.case).toBe("sheet");
    expect(await profile?.correctWork("a1")).toBeDefined();
    answer();
    expect(await panel().findByText("The gaps were the key: well found.")).toHaveAttribute(
      "lang",
      "en",
    );
    await vi.waitFor(async () => expect(await profile?.correctWork("a1")).toBeUndefined());
  });

  it("goes on with the words of the rung the attempt keeps, on my own too", async () => {
    await renderTask({
      task: SHEET_TASK,
      mode: Mode.SELF,
      kept: { rung: 1, words: "Look at the gaps." },
    });
    expect(await screen.findByText("Look at the gaps.")).toBeVisible();
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
  });

  it("shows no words of a rung that is not this answer's, and words a failure of their request", async () => {
    let refusal = refused(Code.FailedPrecondition, Cause.NOT_CURRENT);
    const { rungs } = await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: rungs.length + 1 }),
      rung: () => {
        throw refusal;
      },
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(rungs.length).toBe(1));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    refusal = refused(Code.FailedPrecondition, Cause.NO_CONSENT);
    await userEvent.click(check());
    expect(await screen.findByText("A grown-up's consent is needed first")).toBeVisible();
  });

  it("drops marks the canvas refuses, and words a request of words that gave none", async () => {
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
      rung: () => ({
        rung: 1,
        words: "",
        outcome: { cause: Cause.AI_FAILURE },
        // A box upside down: the canvas takes no such mark.
        marks: [
          {
            kind: MarkKind.FRAME,
            place: { case: "cropBox", value: { ymin: 900, xmin: 0, ymax: 100, xmax: 1000 } },
          },
        ],
      }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("The tutor can't answer right now")).toBeVisible();
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement;
    expect(sheet.marks).toBeUndefined();
    expect(screen.getByText("Read: 5")).toBeVisible();
  });

  it("closes the screen when the words of the rung find the attempt over", async () => {
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
      rung: () => {
        throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.ABANDONED);
      },
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
  });

  it("checks the handwriting when the profile's database cannot be had, and says it is not saved", async () => {
    const { submitted } = await renderTask({
      task: SHEET_TASK,
      noDatabase: true,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5" }),
    });
    await screen.findByText("How many rungs?");
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    sheet.history = [...WRITTEN, stroke(3, 220, 9000)];
    // An undo tells the screen of the sheet, as a stroke would.
    expect(sheet.undo()).toBe(true);
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByText("Read: 5");
    expect(submitted[0]?.work?.surface.case).toBe("sheet");
    expect(screen.getByText("Your work isn't saved on this device")).toBeVisible();
  });

  it("says the tutor is writing while the words of the rung are asked, and not once they came", async () => {
    let words: () => void = () => {};
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
      rung: () =>
        new Promise((resolve) => {
          words = () => resolve({ rung: 1, words: "How many gaps are there?" });
        }),
    });
    expect(screen.queryByText("The tutor is writing…")).toBeNull();
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByText("Read: 5");
    expect(await panel().findByText("The tutor is writing…")).toBeVisible();
    expect(panel().getByRole("heading", { name: "Tutor" })).toBeVisible();
    words();
    expect(await panel().findByText("How many gaps are there?")).toBeVisible();
    await vi.waitFor(() => expect(screen.queryByText("The tutor is writing…")).toBeNull());
  });

  it("offers no Explain differently while the words of the rung are still asked", async () => {
    let words: () => void = () => {};
    await renderTask({
      mode: Mode.SELF,
      rung: () =>
        new Promise((resolve) => {
          words = () => resolve({ rung: 1, words: "Count the gaps between the rungs." });
        }),
      hint: () => ({
        hint: { case: "rung", value: { rung: 1, words: "Look at the pears again." } },
      }),
    });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await panel().findByText("The tutor is writing…");
    // Hint gives the rung's words it keeps meanwhile: the right to other words waits for the model's.
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await panel().findByText("Look at the pears again.");
    expect(screen.queryByRole("button", { name: "Explain differently" })).toBeNull();
    words();
    await panel().findByText("Count the gaps between the rungs.");
    expect(await screen.findByRole("button", { name: "Explain differently" })).toBeVisible();
  });

  it("says the tutor is writing while Explain differently is under way, under the words before", async () => {
    let words: () => void = () => {};
    await renderTask({
      mode: Mode.SELF,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explain: () =>
        new Promise((resolve) => {
          words = () => resolve({ words: "In other words: count the gaps one by one." });
        }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    expect(await panel().findByText("The tutor is writing…")).toBeVisible();
    expect(panel().getByText("Count the gaps.")).toBeVisible();
    words();
    expect(await panel().findByText("In other words: count the gaps one by one.")).toBeVisible();
    await vi.waitFor(() => expect(screen.queryByText("The tutor is writing…")).toBeNull());
  });

  it("drops the words of a rung that come after a newer check has solved the task", async () => {
    let words: () => void = () => {};
    let n = 0;
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () =>
        n++ === 0
          ? sheetAnswer("not_yet", { value: "5", wrong: 1 })
          : {
              ...sheetAnswer("correct", { value: "7", wrong: 1 }),
              solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" },
            },
      rung: () =>
        new Promise((resolve) => {
          words = () => resolve({ rung: 1, words: "A hint for the wrong answer." });
        }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByText("Read: 5");
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByRole("region", { name: "Solution" });
    words();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("A hint for the wrong answer.")).toBeNull();
  });

  it("says a check that could not even begin did not, rather than nothing", async () => {
    await renderTask({ task: SHEET_TASK, history: WRITTEN, mode: Mode.SELF });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement;
    sheet.exportWork = () => Promise.reject(new Error("the crop failed"));
    await userEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This version of the app doesn't know this yet",
    );
    expect(check()).toHaveAttribute("aria-disabled", "false");
  });

  it("takes what was read off the item once the sheet changes", async () => {
    await renderTask({
      task: SHEET_TASK,
      history: WRITTEN,
      mode: Mode.SELF,
      answer: () => sheetAnswer("not_yet", { value: "5", wrong: 1 }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await screen.findByText("Read: 5");
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    expect(sheet.undo()).toBe(true);
    await vi.waitFor(() => expect(screen.queryByText("Read: 5")).toBeNull());
    expect(screen.queryByText("Not yet")).toBeNull();
  });
});

describe("the hint, Explain differently and the solution", () => {
  const hintButton = () => screen.getByRole("button", { name: "Hint" });

  it("gives before a wrong answer what the task gives and asks, its technique and its question", async () => {
    const { asked } = await renderTask({ mode: Mode.SELF });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(hintButton());
    const hint = await screen.findByRole("region", { name: "Hint" });
    expect(within(hint).getByText("Two apples")).toHaveAttribute("lang", "en");
    expect(within(hint).getByText("How many fruits")).toBeVisible();
    expect(within(hint).getByText("Draw the problem")).toBeVisible();
    expect(within(hint).getByText("What if there were only two pears?")).toHaveAttribute(
      "lang",
      "en",
    );
    expect(asked).toEqual(["open a1", "hint"]);
  });

  it("says when the task has nothing more to hint", async () => {
    await renderTask({
      mode: Mode.SELF,
      hint: () => ({ hint: { case: "techniques", value: { techniqueIds: [] } } }),
    });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(hintButton());
    expect(await screen.findByText("This task has nothing more to hint")).toBeVisible();
  });

  it("gives after a wrong answer the words of the rung again", async () => {
    await renderTask({
      mode: Mode.SELF,
      wrongAnswers: 1,
      hint: () => ({
        hint: { case: "rung", value: { rung: 1, words: "Look at the pears again." } },
      }),
    });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(hintButton());
    expect(await screen.findByText("Look at the pears again.")).toHaveAttribute("lang", "en");
  });

  it("goes on with the hint the attempt keeps", async () => {
    const { asked } = await renderTask({
      mode: Mode.SELF,
      openHint: { techniques: ["draw"], question: "What if there were only two pears?" },
    });
    expect(await screen.findByText("What if there were only two pears?")).toBeVisible();
    expect(asked).toEqual(["open a1"]);
  });

  it("names a hint that did not come, and closes the screen on an attempt over", async () => {
    let refusal: ConnectError = new ConnectError("down", Code.Unavailable);
    await renderTask({
      mode: Mode.SELF,
      hint: () => {
        throw refusal;
      },
    });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(hintButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    refusal = refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.LEFT);
    await userEvent.click(hintButton());
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
  });

  it("explains the rung differently once, with its wrong answer and its key", async () => {
    const { explains } = await renderTask({ mode: Mode.SELF });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await screen.findByText("Count the gaps between the rungs.");
    await userEvent.click(panel().getByRole("button", { name: "Explain differently" }));
    expect(await screen.findByText("In other words: count the fruits one by one.")).toBeVisible();
    expect(explains[0]?.wrongAnswers).toBe(1);
    expect(explains[0]?.idempotencyKey).not.toBe("");
    expect(explains[0]?.clockOffsetMinutes).toBeDefined();
    expect(screen.queryByRole("button", { name: "Explain differently" })).toBeNull();
    // A new wrong answer is a new rung: its own "Explain differently" once more.
    await userEvent.click(screen.getByRole("radio", { name: "5" }));
    await userEvent.click(check());
    expect(await screen.findByRole("button", { name: "Explain differently" })).toBeVisible();
  });

  it("says when there are no other words, and keeps the right through a refusal of the limit", async () => {
    let n = 0;
    await renderTask({
      mode: Mode.SELF,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explain: () => {
        if (n++ === 0) throw refused(Code.ResourceExhausted, Cause.PLATFORM_LIMIT);
        return { words: "Count the gaps.", outcome: { cause: Cause.NO_OTHER_WORDS } };
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    expect(await screen.findByText("The tutor can't answer right now")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Explain differently" }));
    expect(await screen.findByText("The tutor has no other words for this")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Explain differently" })).toBeNull();
  });

  it("offers no Explain differently on a rung that had it, nor after a refusal that it did", async () => {
    const first = await renderTask({
      mode: Mode.SELF,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explained: true,
    });
    await screen.findByText("Count the gaps.");
    expect(screen.queryByRole("button", { name: "Explain differently" })).toBeNull();
    first.unmount();
    await renderTask({
      mode: Mode.SELF,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explain: () => {
        throw refused(Code.FailedPrecondition, Cause.ALREADY_ASKED);
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    await vi.waitFor(() =>
      expect(screen.queryByRole("button", { name: "Explain differently" })).toBeNull(),
    );
  });

  it("shows the solution to an adult from the start, once confirmed, and ends the attempt", async () => {
    const { shows, attempts } = await renderTask({ mode: Mode.SELF, adult: true });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    const question = screen.getByRole("group", {
      name: "Once the solution is shown, the task is over",
    });
    // The button that asked has gone: the focus is on the answer, and back after Cancel.
    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Show it" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(shows).toEqual([]);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("button", { name: "Show the solution" }),
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(await panel().findByText("Solution shown")).toBeVisible();
    expect(panel().getByText("Two and three make five.")).toBeVisible();
    expect(shows[0]?.action).toBe(Action.LEARNING);
    expect(attempts).toEqual([undefined]);
    expect(screen.queryByRole("button", { name: "Hint" })).toBeNull();
  });

  it("offers a child the solution from the fourth wrong answer, and says why it was not shown", async () => {
    const before = await renderTask({ mode: Mode.SELF, wrongAnswers: 3 });
    await screen.findByRole("radio", { name: "4" });
    expect(screen.queryByRole("button", { name: "Show the solution" })).toBeNull();
    before.unmount();
    let refusal = refused(Code.PermissionDenied, Cause.ADULT_NEEDED);
    await renderTask({
      mode: Mode.SELF,
      wrongAnswers: 4,
      show: () => {
        throw refusal;
      },
    });
    const show = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Show the solution" }));
      await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    };
    await show();
    expect(await screen.findByText("A grown-up needs to help")).toBeVisible();
    refusal = refused(Code.FailedPrecondition, Cause.LADDER_NOT_PASSED);
    await show();
    expect(
      await screen.findByText("The solution can be shown after a few more answers"),
    ).toBeVisible();
    refusal = refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.CORRECT);
    await show();
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
  });
});

describe("the hint and the solution, against late answers and lost replies", () => {
  it("drops an answer of Explain differently that comes once the next rung began", async () => {
    let late: () => void = () => {};
    let n = 0;
    await renderTask({
      mode: Mode.SELF,
      rung: (request) => ({
        rung: request.wrongAnswers ?? 1,
        words: `Rung ${request.wrongAnswers}.`,
      }),
      explain: () =>
        n++ === 0
          ? new Promise((resolve) => {
              late = () => resolve({ words: "Rung 1 in other words." });
            })
          : { words: "Rung 2 in other words." },
    });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    // The next wrong answer, while the first explanation is still under way.
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("Rung 2.")).toBeVisible();
    late();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Rung 1 in other words.")).toBeNull();
    expect(screen.getByText("Rung 2.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Explain differently" })).toBeVisible();
  });

  it("asks to show the solution again with the same key after a reply that did not come back", async () => {
    let n = 0;
    const { shows } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      show: () => {
        if (n++ === 0) throw new ConnectError("lost", Code.Internal);
        return { solved: { solution: encode(SOLUTION), moduleFormatVersion: "0.4" } };
      },
    });
    const show = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Show the solution" }));
      await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    };
    await show();
    expect(await screen.findByText("This version of the app doesn't know this yet")).toBeVisible();
    await show();
    expect(await screen.findByText("Solution shown", { selector: ".nt-result" })).toBeVisible();
    expect(shows[1]?.idempotencyKey).toBe(shows[0]?.idempotencyKey);
    // What came before the solution does not stay on its result.
    expect(screen.queryByText("This version of the app doesn't know this yet")).toBeNull();
  });

  it("takes the hint off once a wrong answer begins the ladder", async () => {
    await renderTask({ mode: Mode.SELF });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await screen.findByRole("region", { name: "Hint" });
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await screen.findByText("Count the gaps between the rungs.");
    expect(screen.queryByRole("region", { name: "Hint" })).toBeNull();
  });

  it("does not say there is nothing to hint when api gave a technique the catalog does not name", async () => {
    await renderTask({
      mode: Mode.SELF,
      hint: () => ({ hint: { case: "techniques", value: { techniqueIds: ["lost"] } } }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Hint" }));
    await screen.findByRole("region", { name: "Hint" });
    expect(screen.queryByText("This task has nothing more to hint")).toBeNull();
  });
});

describe("the hint and the solution on their edges", () => {
  it("closes the screen when Explain differently finds the attempt over, and repeats a lost one by its key", async () => {
    let refusal: ConnectError = new ConnectError("down", Code.Unavailable);
    const { explains } = await renderTask({
      mode: Mode.SELF,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explain: () => {
        throw refusal;
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    expect(await screen.findByText("No connection")).toBeVisible();
    refusal = refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.ABANDONED);
    await userEvent.click(screen.getByRole("button", { name: "Explain differently" }));
    await screen.findByRole("heading", { name: "This task is already over", level: 1 });
    expect(new Set(explains.map((request) => request.idempotencyKey)).size).toBe(1);
  });

  it("takes no second press while Explain differently, Hint or the solution is under way", async () => {
    let answer: () => void = () => {};
    const { explains, asked, shows } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      explain: () =>
        new Promise((resolve) => {
          answer = () => resolve({ words: "Other words." });
        }),
      hint: () => ({}),
      show: () => ({}),
    });
    const explain = await screen.findByRole("button", { name: "Explain differently" });
    await userEvent.click(explain);
    // A press the browser lets through, as a screen reader's would: aria-disabled does not stop it.
    explain.click();
    answer();
    await screen.findByText("Other words.");
    expect(explains.length).toBe(1);
    // A hint that gives neither techniques nor words changes nothing.
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await vi.waitFor(() => expect(asked).toContain("hint"));
    expect(screen.queryByRole("region", { name: "Hint" })).toBeNull();
    // The solution shown with nothing to show is still the end of the attempt.
    await userEvent.click(screen.getByRole("button", { name: "Show the solution" }));
    await userEvent.click(screen.getByRole("button", { name: "Show it" }));
    expect(await screen.findByText("Solution shown", { selector: ".nt-result" })).toBeVisible();
    expect(shows.length).toBe(1);
    expect(screen.queryByRole("region", { name: "Solution" })).toBeNull();
  });
});

describe("Report a problem with the tutor's words (R33)", () => {
  /** A wrong answer on my own: the words of its rung come. */
  async function notYet(): Promise<void> {
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await screen.findByText("Count the gaps between the rungs.");
  }
  const form = () =>
    within(screen.getByRole("form", { name: "Report a problem with these words" }));
  const send = () => userEvent.click(form().getByRole("button", { name: "Send" }));
  const day = dateTimeFormat("en", { dateStyle: "long" }).format(REVIEW_BY);
  const thanks = `Thank you: the report is sent. It will be reviewed by ${day}`;

  it("says the tutor is an AI, and offers a learner who is not an adult no report", async () => {
    await renderTask({ mode: Mode.SELF });
    await notYet();
    expect(panel().getByText("The tutor is an AI, not a person")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
  });

  it("reports the words of a rung with its kind, its text and a key, and says by when it is reviewed", async () => {
    const { reportRequests } = await renderTask({ mode: Mode.SELF, adult: true });
    await notYet();
    expect(panel().getByText("The tutor is an AI, not a person")).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "Report a problem with these words" }),
    );
    expect(form().getAllByRole("radio")).toHaveLength(6);
    expect(form().getByText(/Please write no names in it/)).toBeVisible();
    // No kind chosen: nothing goes, and the group is told why.
    await send();
    expect(form().getByRole("alert")).toHaveTextContent("Choose what is wrong");
    expect(
      form().getByRole("group", { name: "What is wrong with the words?" }),
    ).toHaveAccessibleDescription("Choose what is wrong");
    expect(reportRequests).toEqual([]);
    await userEvent.click(form().getByRole("radio", { name: "Unclear" }));
    expect(form().queryByRole("alert")).toBeNull();
    await userEvent.type(
      form().getByRole("textbox", { name: "What else to say, if anything" }),
      "  The gaps are not on the picture.  ",
    );
    await send();
    const answer = await screen.findByText(thanks);
    expect(document.activeElement).toBe(answer);
    expect(reportRequests).toHaveLength(1);
    const [sent] = reportRequests;
    expect(sent?.profileId).toBe("p1");
    expect(sent?.attemptId).toBe("a1");
    expect(sent?.idempotencyKey).not.toBe("");
    expect(sent?.reply).toBe(TutorReply.RUNG);
    expect(sent?.rung).toBe(1);
    expect(sent?.words).toBe("Count the gaps between the rungs.");
    expect(sent?.kind).toBe(ProblemKind.UNCLEAR);
    expect(sent?.text).toBe("The gaps are not on the picture.");
    // The same words are reported once: no second button beside them.
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
  });

  it("repeats a report whose reply was lost with the same key, and api keeps one report", async () => {
    const { reportRequests, reports } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      report: (_, n) => {
        // The first reply lost on the way, which the client repeats itself; the second a failure
        // the screen names; the third goes through.
        if (n === 0) throw new ConnectError("lost", Code.Unavailable);
        if (n === 1) throw new ConnectError("lost", Code.Internal);
      },
    });
    await notYet();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Wrong" }));
    await send();
    expect(await form().findByRole("alert")).toHaveTextContent(
      "This version of the app doesn't know this yet",
    );
    await send();
    expect(await screen.findByText(thanks)).toBeVisible();
    expect(reportRequests).toHaveLength(3);
    const keys = new Set(reportRequests.map((request) => request.idempotencyKey));
    expect(keys.size).toBe(1);
    expect(reports.size).toBe(1);
  });

  it("gives an edited report a key of its own, after a failure too", async () => {
    const { reportRequests, reports } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      report: (_, n) => {
        if (n === 0) throw new ConnectError("lost", Code.Internal);
      },
    });
    await notYet();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Harmful, dangerous or upsetting" }));
    await send();
    await form().findByRole("alert");
    // Another text is another report, which api may keep beside the first.
    await userEvent.type(form().getByRole("textbox"), "It scared the learner.");
    expect(form().queryByRole("alert")).toBeNull();
    await send();
    expect(await screen.findByText(thanks)).toBeVisible();
    expect(reportRequests).toHaveLength(2);
    expect(reportRequests[0]?.idempotencyKey).not.toBe(reportRequests[1]?.idempotencyKey);
    expect(reportRequests[1]?.kind).toBe(ProblemKind.HARMFUL);
    expect(reports.size).toBe(2);
  });

  it("keeps the key of a report still under way, and takes a refusal as its end", async () => {
    let going = true;
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      report: (_, n) => {
        if (going) throw refused(Code.Unavailable, Cause.STILL_GOING);
        if (n === reportRequests.length - 1 && reportRequests.length <= 20) {
          throw refused(Code.InvalidArgument, Cause.KEY_ALREADY_USED);
        }
      },
    });
    await notYet();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Not right for the learner's age" }));
    // The client waits for the first as long as api lets it go, then the screen says no connection.
    await send();
    expect(await form().findByRole("alert")).toHaveTextContent("No connection");
    const waited = reportRequests.length;
    going = false;
    await send();
    expect(await form().findByRole("alert")).toHaveTextContent(
      "This version of the app doesn't know this yet",
    );
    expect(reportRequests[waited]?.idempotencyKey).toBe(reportRequests[0]?.idempotencyKey);
    // A refusal ends the report: the next press is another, with a key of its own.
    const refusedKey = reportRequests[waited]?.idempotencyKey;
    await send();
    await vi.waitFor(() => expect(reportRequests.length).toBe(waited + 2));
    expect(reportRequests[waited + 1]?.idempotencyKey).not.toBe(refusedKey);
  });

  it("reports the words after a correct answer without a rung", async () => {
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      correct: () => ({ words: "Well done: five fruits." }),
    });
    await userEvent.click(await screen.findByRole("radio", { name: "5" }));
    await userEvent.click(screen.getByRole("radio", { name: "Yes" }));
    await userEvent.click(check());
    await screen.findByText("Well done: five fruits.");
    expect(panel().getByText("The tutor is an AI, not a person")).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(
      form().getByRole("radio", { name: "Asks about something personal, or talks of it" }),
    );
    await send();
    expect(await screen.findByText(thanks)).toBeVisible();
    expect(reportRequests[0]?.reply).toBe(TutorReply.CORRECT_ANSWER);
    expect(reportRequests[0]?.rung).toBe(0);
    expect(reportRequests[0]?.words).toBe("Well done: five fruits.");
    expect(reportRequests[0]?.kind).toBe(ProblemKind.PERSONAL);
  });

  it("reports the words a rung keeps by its rung, and Explain differently by the same rung", async () => {
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      kept: { rung: 2, words: "Count the gaps." },
      wrongAnswers: 2,
    });
    await screen.findByText("Count the gaps.");
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Wrong" }));
    await send();
    await screen.findByText(thanks);
    expect(reportRequests[0]?.reply).toBe(TutorReply.RUNG);
    expect(reportRequests[0]?.rung).toBe(2);
    // Other words are another reply: the button stands beside them anew.
    await userEvent.click(panel().getByRole("button", { name: "Explain differently" }));
    await screen.findByText("In other words: count the fruits one by one.");
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Unclear" }));
    await send();
    await vi.waitFor(() => expect(reportRequests).toHaveLength(2));
    expect(reportRequests[1]?.reply).toBe(TutorReply.EXPLAINED_DIFFERENTLY);
    expect(reportRequests[1]?.rung).toBe(2);
    expect(reportRequests[1]?.words).toBe("In other words: count the fruits one by one.");
    expect(reportRequests[1]?.idempotencyKey).not.toBe(reportRequests[0]?.idempotencyKey);
  });

  it("keeps a report begun on words that Hint gives again, as the reply they came by", async () => {
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      kept: { rung: 1, words: "Count the gaps." },
      wrongAnswers: 1,
      hint: () => ({
        hint: {
          case: "rung",
          value: { rung: 1, words: "In other words: count the fruits one by one." },
        },
      }),
    });
    await userEvent.click(await screen.findByRole("button", { name: "Explain differently" }));
    await screen.findByText("In other words: count the fruits one by one.");
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Unclear" }));
    await userEvent.type(form().getByRole("textbox"), "Still unclear.");
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Hint" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    expect(form().getByRole("textbox")).toHaveValue("Still unclear.");
    await send();
    await screen.findByText(thanks);
    expect(reportRequests[0]?.reply).toBe(TutorReply.EXPLAINED_DIFFERENTLY);
    expect(reportRequests[0]?.rung).toBe(1);
  });

  it("offers no report beside words that are empty", async () => {
    await renderTask({
      mode: Mode.SELF,
      adult: true,
      kept: { rung: 1, words: "" },
      wrongAnswers: 1,
    });
    expect(await screen.findByText("The tutor is an AI, not a person")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Report a problem" })).toBeNull();
  });

  it("takes no Cancel and no second Send while a report is under way", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      report: () => gate,
    });
    await notYet();
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Wrong" }));
    await send();
    await vi.waitFor(() => expect(reportRequests).toHaveLength(1));
    expect(form().getByRole("button", { name: "Cancel" })).toHaveAttribute("aria-disabled", "true");
    expect(form().getByRole("button", { name: "Send" })).toHaveAttribute("aria-disabled", "true");
    // Presses the browser lets through, as a screen reader's would: aria-disabled does not stop them.
    form().getByRole("button", { name: "Cancel" }).click();
    form().getByRole("button", { name: "Send" }).click();
    release();
    expect(await screen.findByText(thanks)).toBeVisible();
    expect(reportRequests).toHaveLength(1);
  });

  it("asks Something else for its text, gives the focus back on Cancel, and thanks without a day none came", async () => {
    const { reportRequests } = await renderTask({
      mode: Mode.SELF,
      adult: true,
      reportAnswer: { reportId: "report-1" },
    });
    await notYet();
    const button = panel().getByRole("button", { name: "Report a problem" });
    await userEvent.click(button);
    await userEvent.click(form().getByRole("radio", { name: "Something else" }));
    await send();
    expect(form().getByRole("alert")).toHaveTextContent("Say in the text what is wrong");
    expect(form().getByRole("textbox")).toHaveAccessibleDescription(
      /Up to 1000 characters.*Say in the text what is wrong/,
    );
    expect(form().getByRole("textbox")).toHaveAttribute("maxlength", "1000");
    await userEvent.click(form().getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(panel().getByRole("button", { name: "Report a problem" }));
    expect(reportRequests).toEqual([]);
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(form().getByRole("radio", { name: "Something else" }));
    await userEvent.type(form().getByRole("textbox"), "The words are in another language.");
    await send();
    expect(await screen.findByText("Thank you: the report is sent")).toBeVisible();
    expect(reportRequests[0]?.kind).toBe(ProblemKind.OTHER);
  });
});

describe("the task screen's voicing", () => {
  const SAMANTHA = voice("Samantha", "en-US", { isDefault: true });

  it("says the verdict and then the tutor's words by itself while the voicing is on", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    await renderTask({ mode: Mode.SELF, voicing: { speech, on: true } });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await screen.findByText("Not right yet: 2 items of 2");
    await vi.waitFor(() =>
      expect(speech.texts()).toEqual([
        "Not right yet: 2 items of 2",
        "Count the gaps between the rungs.",
      ]),
    );
    // The press marked an empty utterance first, for WebKit; the words went on after the verdict.
    expect(speech.said()[0]?.text).toBe("");
    expect(speech.asked.filter((each) => "cancel" in each)).toHaveLength(2);
    expect(speech.said().every((each) => each.text === "" || each.voice === SAMANTHA)).toBe(true);
  });

  it("says a hint by itself, in the module's language, while the voicing is on", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    await renderTask({ mode: Mode.SELF, voicing: { speech, on: true } });
    await screen.findByRole("radio", { name: "4" });
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await screen.findByRole("region", { name: "Hint" });
    await vi.waitFor(() =>
      expect(speech.texts()).toEqual([
        "Two apples",
        "Three pears",
        "How many fruits",
        "Draw the problem",
        "A picture helps.",
        "What if there were only two pears?",
      ]),
    );
    expect(speech.said().at(-1)?.lang).toBe("en");
  });

  it("says nothing by itself while the voicing is off, and reads the task on a press", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    await renderTask({ mode: Mode.SELF, voicing: { speech, on: false } });
    await userEvent.click(await screen.findByRole("button", { name: "Read aloud" }));
    expect(speech.texts()).toEqual([
      "Two apples and three pears are in a bowl.",
      "How many fruits?",
      "4",
      "5",
      "More pears?",
      "Yes",
      "No",
    ]);
    // A second press while it reads stops it.
    await userEvent.click(screen.getByRole("button", { name: "Read aloud" }));
    expect(speech.speech.speaking()).toBeUndefined();
    expect(speech.asked.at(-1)).toEqual({ cancel: true });
    const before = speech.asked.length;
    await userEvent.click(screen.getByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await screen.findByText("Not right yet: 2 items of 2");
    await screen.findByText("Count the gaps between the rungs.");
    expect(speech.asked).toHaveLength(before);
  });

  it("turns the voicing on by SetVoicing, and the session takes the profile it gives", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    const { voicings, saved } = await renderTask({
      mode: Mode.SELF,
      voicing: { speech, on: false },
    });
    const toggle = await screen.findByRole("button", { name: "Voicing" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(toggle);
    await vi.waitFor(() => expect(saved).toHaveLength(1));
    expect(voicings.map(({ profileId, voicing }) => [profileId, voicing?.enabled])).toEqual([
      ["p1", true],
    ]);
    expect(saved[0]?.presentationStyle?.voicing?.enabled).toBe(true);
  });

  it("turns the voicing off, stops speech, and says when SetVoicing did not go through", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    const { voicings, failed } = await renderTask({
      mode: Mode.SELF,
      voicing: { speech, on: true },
      voicingFails: true,
    });
    const toggle = await screen.findByRole("button", { name: "Voicing" });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(toggle);
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(voicings[0]?.voicing?.enabled).toBe(false);
    expect(failed).toHaveLength(1);
    expect(speech.asked).toEqual([{ cancel: true }]);
  });

  it("says why it is silent while on, on a device with no voice for the module's language", async () => {
    const speech = fakeSpeech([voice("Milena", "ru-RU")]);
    await renderTask({ mode: Mode.SELF, voicing: { speech, on: true } });
    await screen.findByRole("button", { name: "Voicing" });
    expect(screen.getAllByText("This device has no voice for English").length).toBeGreaterThan(0);
    const read = screen.getByRole("button", { name: "Read aloud" });
    expect(read).toHaveAttribute("aria-disabled", "true");
    expect(read).toHaveAccessibleDescription("This device has no voice for English");
    // Not active, though not disabled: Playwright would wait for it to be enabled.
    await userEvent.click(read, { force: true });
    // The text stays on the screen: nothing is said, and the press is no failure.
    expect(speech.texts()).toEqual([]);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the task screen's voicing, once the screen is gone", () => {
  it("stops what it said, and says no words that come after the learner left", async () => {
    const speech = fakeSpeech([voice("Samantha", "en-US", { isDefault: true })]);
    let answer: (words: string) => void = () => {};
    const { unmount } = await renderTask({
      mode: Mode.SELF,
      voicing: { speech, on: true },
      rung: (request) =>
        new Promise((resolve) => {
          answer = (words) => resolve({ rung: request.wrongAnswers ?? 1, words });
        }),
    });
    await userEvent.click(await screen.findByRole("radio", { name: "4" }));
    await userEvent.click(screen.getByRole("radio", { name: "No" }));
    await userEvent.click(check());
    await vi.waitFor(() => expect(speech.texts()).toEqual(["Not right yet: 2 items of 2"]));
    unmount();
    expect(speech.asked.at(-1)).toEqual({ cancel: true });
    answer("Count the gaps between the rungs.");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(speech.texts()).toEqual(["Not right yet: 2 items of 2"]);
  });
});
