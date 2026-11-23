// The screen of an essay in the browser, with the canvas element itself: no reminder of names
// before a submission, SubmitEssay with the crop and one key for a check and its
// repeat, each way a submission ends, what was read and the feedback while the attempt is open, the
// context of each submission kept with the attempt and put on the server, Done once it was sent,
// the work off the device at the end, an attempt api closed meanwhile, and "Report a problem" at the
// feedback — with api on connect-es's router and the storage on the device's memory.
import "@altnovatrail/canvas";
import {
  Mode,
  ProfileSchema,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  type DoneRequest,
  type DoneResponseSchema,
  type GetHintResponseSchema,
  type ReportProblemRequest,
  SubmissionEnd,
  type SubmitEssayRequest,
  type SubmitEssayResponseSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  ChoiceKind,
  CloseReason,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { LearningService } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  type PutWorkRequest,
  WorkService,
} from "@altnovatrail/contracts/novatrail/api/v1/work_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { fakeSpeech, voice } from "../test/speech.ts";
import { SpeechProvider, VoicingProvider } from "../voice/VoicingContext.tsx";
import { forgetPuts } from "../works/stored.ts";
import { EssayScreen } from "./EssayScreen.tsx";
import { initialState } from "./steps.ts";
import { Task } from "./Task.tsx";

// The tablet's layout, where the row stands beside the open panel: on a phone its sheet hides the row,
// which the tests of the sheet show.
beforeEach(async () => {
  await page.viewport(1194, 834);
});

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const PNG = [0x89, 0x50, 0x4e, 0x47];

const MANIFEST = {
  module_format_version: "0.4",
  id: "example/essays",
  version: "1.0.0",
  title: "Short essays",
  languages: { explanation: "en" },
};

/** The steps of the format's example of short essays. */
const STEPS: readonly open.Step[] = [
  { title: "Plan the essay", gives: ["techniques"], exit_condition: "none" },
  { title: "Write it", exit_condition: "none" },
  { title: "Read it again", exit_condition: "none" },
];

const ESSAY: open.Task = {
  id: "umbrella",
  statement: [{ text: "An umbrella talks when it rains. Write three first sentences about it." }],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

/** A stroke the sheet could have written. */
function stroke(id: number, x: number, t: number): HistoryEvent {
  const points = [0, 1, 2, 3].map((i) => ({
    x: x + i * 7.3,
    y: 100 + i * 3.1,
    t: t + i * 16,
    p: 0.5,
  }));
  return { kind: "write", t: t + 48, stroke: { id, kind: "mouse", points } };
}

const WRITTEN = [stroke(1, 100, 0), stroke(2, 160, 5000)];

function refused(code: Code, cause: Cause, closeReason?: CloseReason): ConnectError {
  const refusal = create(RefusalSchema, {
    cause,
    ...(closeReason === undefined ? {} : { data: { case: "closeReason", value: closeReason } }),
  });
  return new ConnectError("refused", code, undefined, [{ desc: RefusalSchema, value: refusal }]);
}

interface Setup {
  /** The task of the attempt: the essay when left out. */
  task?: open.Task;
  /** The history this device keeps; none, and the sheet is blank. */
  history?: readonly HistoryEvent[];
  /** How many submissions api counts. */
  submissions?: number;
  /** The answer to a submission, or a throw in place of it. */
  answer?: (
    request: SubmitEssayRequest,
    n: number,
  ) => MessageInitShape<typeof SubmitEssayResponseSchema>;
  /** What the answer to a submission waits for: the essay is read till then. */
  submitWait?: Promise<void>;
  /** Throws in place of the answer to Done. */
  done?: () => void;
  /** The answer to Done, in place of the criteria and the model answer. */
  doneAnswer?: MessageInitShape<typeof DoneResponseSchema>;
  /** The answer to Hint, or a throw in place of it. */
  hint?: () => MessageInitShape<typeof GetHintResponseSchema>;
  adult?: boolean;
  lesson?: boolean;
  /** Among a learner's screens, the profile's storage of works on the server on. */
  storage?: boolean;
  /** The synthesis the screen speaks by, the profile's voicing on. */
  speech?: ReturnType<typeof fakeSpeech>;
}

async function renderEssay(setup: Setup = {}) {
  const { device, backend } = memoryDevice();
  await setAccount(device, "account-1");
  const task = setup.task ?? ESSAY;
  if (setup.history !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: D1, task });
    await profile?.replaceHistory("a1", setup.history);
  }
  const submitted: SubmitEssayRequest[] = [];
  const dones: DoneRequest[] = [];
  const reports: ReportProblemRequest[] = [];
  const puts: PutWorkRequest[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(WorkService, {
      putWork(request) {
        puts.push(request);
        return { work: { attemptId: request.work?.attemptId ?? "" } };
      },
    });
    router.service(LearningService, {
      getOpenAttempt(request) {
        return {
          attempt: {
            start: {
              attemptId: request.attemptId,
              task: { json: encode(task), moduleFormatVersion: "0.4" },
              packageDigest: D1,
            },
            essaySubmissions: Array.from({ length: setup.submissions ?? 0 }, () => ({
              end: SubmissionEnd.FEEDBACK,
            })),
          },
        };
      },
    });
    router.service(AttemptService, {
      async submitEssay(request) {
        submitted.push(request);
        await setup.submitWait;
        return (
          setup.answer?.(request, submitted.length - 1) ?? {
            end: SubmissionEnd.FEEDBACK,
            text: "The umbrella spoke.",
            feedback: "Each sentence makes a reader ask why.",
          }
        );
      },
      done(request) {
        dones.push(request);
        setup.done?.();
        return (
          setup.doneAnswer ?? {
            solved: {
              criteria: ["There are three first sentences."],
              solution: encode([{ text: "A model answer." }]),
              moduleFormatVersion: "0.4",
            },
          }
        );
      },
      getHint: () =>
        setup.hint?.() ?? {
          hint: { case: "techniques", value: { techniqueIds: ["middle"] } },
          leadingQuestion: "What does the umbrella say?",
        },
      beginStep: () => ({ techniques: { techniqueIds: [] } }),
      reportProblem(request) {
        reports.push(request);
        return { reportId: "r1", reviewBy: timestampFromDate(new Date("2026-11-20T12:00:00Z")) };
      },
    });
    router.service(PackageService, {
      getManifest: () => ({ manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } }),
      getSolvingSteps: () => ({
        solvingSteps: { json: encode({ steps: STEPS }), moduleFormatVersion: "0.4" },
      }),
      getTechniques: () => ({
        techniques: {
          json: encode({
            techniques: { middle: { title: "Start in the middle", description: "Begin there." } },
          }),
          moduleFormatVersion: "0.4",
        },
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
  const attempts: (string | undefined)[] = [];
  const nexts: unknown[] = [];
  const screenOf = (
    <Task
      profileId="p1"
      attemptId="a1"
      defaultMode={Mode.SELF}
      device={device}
      adult={setup.adult ?? false}
      onAttempt={(id) => attempts.push(id)}
      {...(setup.lesson === true
        ? { lesson: { onNext: (next) => nexts.push(next), onClosed: () => {} } }
        : {})}
    />
  );
  const voiced =
    setup.speech === undefined ? (
      screenOf
    ) : (
      <SpeechProvider value={setup.speech.speech}>
        <VoicingProvider
          profile={create(ProfileSchema, {
            profileId: "p1",
            presentationStyle: { voicing: { enabled: true, speed: VoicingSpeed.NORMAL } },
          })}
          device={device}
          place="task"
          onSaved={() => {}}
          onFailed={() => {}}
        >
          {screenOf}
        </VoicingProvider>
      </SpeechProvider>
    );
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          {setup.storage === undefined ? (
            voiced
          ) : (
            <LearnerProvider
              value={{
                learner: create(ProfileSchema, { profileId: "p1", workStorage: setup.storage }),
                switchLearner: () => {},
                signOut: () => {},
                openLegal: () => {},
                onSaved: () => {},
                onFailed: () => {},
              }}
            >
              {voiced}
            </LearnerProvider>
          )}
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return { device, backend, submitted, dones, reports, attempts, nexts, puts };
}

const check = () => screen.getByRole("button", { name: "Check" });
/** The row's Done: the card of the feedback has one too. */
const done = () =>
  within(document.querySelector(".nt-task-row") as HTMLElement).getByRole("button", {
    name: "Done",
  });
/** The card above the row, while there is one. */
const card = () => document.querySelector(".nt-card-verdict");

/** The mode named, chosen in the pop-over of its pill. */
async function chooseMode(mode: "Step by step" | "On my own") {
  await userEvent.click(await screen.findByRole("button", { name: /^Mode: / }));
  const modes = within(await screen.findByRole("dialog", { name: "Mode" }));
  await userEvent.click(modes.getByRole("button", { name: new RegExp(`^${mode}`) }));
}
const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
/** The panel, shown: by steps, with a hint, or with the result. */
const shown = async () => within(await screen.findByRole("complementary", { name: "Tutor" }));
/** The panel, opened by the tutor's button where it is closed: feedback does not open it. */
const found = async () => {
  if (screen.queryByRole("complementary", { name: "Tutor" }) === null) {
    await userEvent.click(await screen.findByRole("button", { name: "Tutor" }));
  }
  return shown();
};
/** What the device keeps of the attempt of the essay; none once it is over. */
const keptOf = async (device: Device) => (await openProfile(device, "p1"))?.readAttempt("a1");

// Each test's p1 is another profile: what one put is no copy for the next.
afterEach(() => forgetPuts("p1"));

describe("the screen of an essay", () => {
  it("sends the crop and shows the feedback, and keeps the submission's context alone", async () => {
    const { submitted, device } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    expect(screen.queryByText(/real names/)).toBeNull();
    expect(check()).not.toHaveAccessibleDescription();
    expect(done()).toHaveAttribute("aria-disabled", "true");
    expect(done()).toHaveAccessibleDescription("Done opens once the essay has been sent");
    expect(screen.queryByRole("button", { name: "Show the solution" })).toBeNull();
    await userEvent.click(check());
    const feedback = await (await found()).findByText("Each sentence makes a reader ask why.");
    expect(feedback).toHaveAttribute("lang", "en");
    expect(screen.getByText("The umbrella spoke.")).toHaveAttribute("lang", "en");
    expect(screen.getByRole("heading", { name: "What was read" })).toBeVisible();
    expect(screen.getAllByRole("status").map((line) => line.textContent)).toContain(
      "The feedback came",
    );
    const sent = submitted[0];
    expect([...(sent?.crop.slice(0, 4) ?? [])]).toEqual(PNG);
    expect(sent?.clockOffsetMinutes).toBeDefined();
    // The card says where the feedback is, not its words, and holds a Done of its own.
    expect(card()).toHaveAttribute("data-kind", "feedback");
    expect(card()).toHaveTextContent(
      "FeedbackThe feedback is in the tutor's panel. Write again, or press Done.Done",
    );
    // Done opens once the submission is kept on the device, which may come after the feedback.
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    // No report for a learner who is not of the category adult.
    expect(panel().queryByRole("button", { name: "Report a problem" })).toBeNull();
    // The device keeps the context of the submission and the history's length, for the work on the
    // server, and neither the crop nor the words: the screen holds those.
    await vi.waitFor(async () => expect((await keptOf(device))?.submissions).toHaveLength(1));
    const [kept] = (await keptOf(device))?.submissions ?? [];
    expect(kept).toEqual({
      context: expect.objectContaining({ crop: expect.any(Object) }),
      historyLength: WRITTEN.length,
      work: undefined,
    });
    expect(JSON.stringify(kept)).not.toContain("Each sentence makes a reader ask why.");
  });

  it("puts the essay on the server at each submission, with its context, and at Done only what changed, while storage is on", async () => {
    const { puts, device } = await renderEssay({ history: WRITTEN, storage: true });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(puts).toHaveLength(1));
    const decoder = new TextDecoder();
    const [first] = puts;
    expect(JSON.parse(decoder.decode(first?.work?.history))).toEqual(WRITTEN);
    expect(first?.work?.submissions.map((one) => one.historyLength)).toEqual([WRITTEN.length]);
    const context = JSON.parse(decoder.decode(first?.work?.submissions[0]?.context));
    expect(context).toEqual((await keptOf(device))?.submissions?.[0]?.context);
    await vi.waitFor(async () =>
      expect((await keptOf(device))?.attempt.stored).toEqual({
        history: WRITTEN.length,
        submissions: 1,
      }),
    );
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    // Done read the work the server keeps already, and the attempt's work leaves the device.
    await vi.waitFor(async () => expect(await keptOf(device)).toBeUndefined());
    expect(puts).toHaveLength(1);
  });

  it("goes back to Home before the essay is finished", async () => {
    window.location.hash = "#/task";
    await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
  });

  it("locks Check on a blank sheet, and says so", async () => {
    await renderEssay();
    await vi.waitFor(() =>
      expect(check()).toHaveAccessibleDescription("Write an answer on the sheet"),
    );
    expect(check()).toHaveAttribute("aria-disabled", "true");
    // The lines why are descriptions alone, till a press asks for them: the card says each, and OK
    // puts it away.
    expect(
      [...document.querySelectorAll(".nt-task-foot .nt-hint")].map((line) => line.textContent),
    ).toEqual([]);
    await userEvent.click(check(), { force: true });
    expect(card()).toHaveTextContent(
      "Write an answer on the sheetWrite it with the pen, then Check.OK",
    );
    await userEvent.click(done(), { force: true });
    expect(card()).toHaveTextContent(
      "Done opens once the essay has been sentWrite the essay, then send it with Check.OK",
    );
    await userEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(card()).toBeNull();
  });

  it("says no feedback this time, an essay it cannot read and no check, each in its own words", async () => {
    const answers: MessageInitShape<typeof SubmitEssayResponseSchema>[] = [
      { end: SubmissionEnd.FEEDBACK, text: "It rained." },
      { end: SubmissionEnd.UNREADABLE, reason: "illegible" },
      { end: SubmissionEnd.UNCHECKED, outcome: { cause: Cause.AI_FAILURE } },
    ];
    const { device } = await renderEssay({
      history: WRITTEN,
      answer: (_, n) => answers[n] ?? {},
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await (await found()).findByText("No feedback this time")).toBeVisible();
    await userEvent.click(check());
    expect(
      await (await found()).findByText(
        "The essay can't be read: It can't be made out. Write it again and send it",
      ),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "What was read" })).toBeNull();
    await userEvent.click(check());
    expect(await (await found()).findByText("The tutor can't answer right now")).toBeVisible();
    // Each submission is the attempt's, however it ended.
    await vi.waitFor(async () => expect((await keptOf(device))?.submissions).toHaveLength(3));
  });

  it("sends the same work again with the same key", async () => {
    // Down for every repeat the client makes of the first check, and up for the learner's own.
    let down = true;
    const { submitted } = await renderEssay({
      history: WRITTEN,
      answer: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
        return { end: SubmissionEnd.FEEDBACK, feedback: "Good." };
      },
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    down = false;
    await userEvent.click(check());
    expect(await (await found()).findByText("Good.")).toBeVisible();
    const keys = new Set(submitted.map((one) => one.idempotencyKey));
    expect(keys.size).toBe(1);
  });

  it("sends a new stroke with a new key", async () => {
    const { submitted } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await (await found()).findByText("Each sentence makes a reader ask why.");
    // A stroke undone is a change of the work: another action, with a key of its own.
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    expect(sheet.undo()).toBe(true);
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(submitted).toHaveLength(2));
    expect(submitted[1]?.idempotencyKey).not.toBe(submitted[0]?.idempotencyKey);
  });

  it("blinks Check once on a pause after a stroke, while the sheet holds writing", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await renderEssay({ history: WRITTEN });
      await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
      const sheet = document.querySelector("novatrail-canvas") as CanvasElement & {
        undo(): boolean;
      };
      expect(sheet.undo()).toBe(true);
      vi.advanceTimersByTime(6000);
      await vi.waitFor(() => expect(check()).toHaveClass("nt-blink"));
      vi.advanceTimersByTime(3000);
      await vi.waitFor(() => expect(check()).not.toHaveClass("nt-blink"));
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends nothing by Check on a blank sheet, nor by Done before a submission", async () => {
    const { submitted, dones } = await renderEssay();
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "true"));
    // A press the browser lets through, as a screen reader's would: aria-disabled does not stop it.
    check().click();
    done().click();
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    await screen.findByText("Start in the middle");
    expect(submitted).toEqual([]);
    expect(dones).toEqual([]);
  });

  it("says when the work did not reach the device: a submission, the steps, a stroke", async () => {
    const { backend, submitted } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    const status = () => screen.getAllByRole("status").map((line) => line.textContent);
    expect(status()).not.toContain("Your work isn't saved on this device");
    backend.refuseWrites = true;
    await userEvent.click(check());
    await (await found()).findByText("Each sentence makes a reader ask why.");
    expect(submitted).toHaveLength(1);
    await vi.waitFor(() => expect(status()).toContain("Your work isn't saved on this device"));
  });

  it("keeps the steps and the strokes it could not write, and says so", async () => {
    const { backend } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    backend.refuseWrites = true;
    await chooseMode("Step by step");
    const status = () => screen.getAllByRole("status").map((line) => line.textContent);
    await vi.waitFor(() => expect(status()).toContain("Your work isn't saved on this device"));
    cleanup();
    const other = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    other.backend.refuseWrites = true;
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement & { undo(): boolean };
    expect(sheet.undo()).toBe(true);
    await vi.waitFor(() => expect(status()).toContain("Your work isn't saved on this device"));
  });

  it("sends nothing when the sheet gives no crop", async () => {
    const { submitted } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    const sheet = document.querySelector("novatrail-canvas") as CanvasElement;
    sheet.exportWork = () => Promise.resolve(null);
    await userEvent.click(check());
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    expect(submitted).toEqual([]);
  });

  it("says why Hint did not go, gives one without a question, and a closed attempt ends it", async () => {
    let answer = (): MessageInitShape<typeof GetHintResponseSchema> => {
      throw new ConnectError("down", Code.Unavailable);
    };
    await renderEssay({ history: WRITTEN, hint: () => answer() });
    const hint = await screen.findByRole("button", { name: "Hint" });
    await userEvent.click(hint);
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    // A hint of another kind than techniques shows nothing.
    answer = () => ({});
    await userEvent.click(hint);
    await vi.waitFor(() => expect(hint).toHaveAttribute("aria-disabled", "false"));
    expect(screen.queryByText("Start in the middle")).toBeNull();
    answer = () => ({ hint: { case: "techniques", value: { techniqueIds: ["middle"] } } });
    await userEvent.click(hint);
    expect(await (await found()).findByText("Start in the middle")).toBeVisible();
    expect(screen.queryByRole("alert")).toBeNull();
    answer = () => {
      throw refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.LEFT);
    };
    await userEvent.click(hint);
    expect(await screen.findByText("Another task was begun")).toBeVisible();
  });

  it("finishes without a solution, offers the engine's choice, and goes home", async () => {
    window.location.hash = "#/task";
    await renderEssay({
      history: WRITTEN,
      submissions: 1,
      doneAnswer: {
        next: { next: { case: "choice", value: { choiceId: "c2", kind: ChoiceKind.TASK } } },
      },
    });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    expect(await (await shown()).findByText("Essay finished")).toBeVisible();
    expect(panel().queryByRole("heading", { name: "What the feedback looked at" })).toBeNull();
    expect(panel().getByRole("button", { name: "Next task" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
  });

  it("says the feedback aloud only while the tutor's panel is open", async () => {
    const speech = fakeSpeech([voice("Samantha", "en-US", { isDefault: true })]);
    await renderEssay({ history: WRITTEN, speech });
    const spoken = () => speech.said().map((each) => each.text);
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(card()).toHaveAttribute("data-kind", "feedback"));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    expect(spoken()).not.toContain("Each sentence makes a reader ask why.");
    await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(spoken()).toContain("Each sentence makes a reader ask why."));
  });

  it("says the feedback was lost when a repeat brings no words", async () => {
    await renderEssay({
      history: WRITTEN,
      answer: () => ({ end: SubmissionEnd.FEEDBACK, repeated: true }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(
      await (await found()).findByText(
        "The feedback was lost on the way. Send the essay again to get it",
      ),
    ).toBeVisible();
  });

  it("finishes by Done: the criteria and the solution, and the work leaves the device", async () => {
    const { dones, device, attempts } = await renderEssay({ history: WRITTEN, submissions: 1 });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    expect(await (await shown()).findByText("Essay finished")).toBeVisible();
    expect(panel().getByRole("heading", { name: "What the feedback looked at" })).toBeVisible();
    expect(panel().getByText("There are three first sentences.")).toBeVisible();
    expect(panel().getByText("A model answer.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    expect(dones).toHaveLength(1);
    expect(attempts).toEqual([undefined]);
    await vi.waitFor(async () => expect(await keptOf(device)).toBeUndefined());
  });

  it("finishes by the Done of the card of the feedback, and shows the essay read meanwhile", async () => {
    let answer: (() => void) | undefined;
    const { dones } = await renderEssay({
      history: WRITTEN,
      submitWait: new Promise<void>((resolve) => {
        answer = resolve;
      }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await vi.waitFor(() => expect(card()).toHaveAttribute("data-kind", "reading"));
    expect(card()).toHaveTextContent(
      "Reading your work…A picture of the work goes to be read, with no name.",
    );
    answer?.();
    await vi.waitFor(() => expect(card()).toHaveAttribute("data-kind", "feedback"));
    const inCard = within(card() as HTMLElement).getByRole("button", { name: "Done" });
    await vi.waitFor(() => expect(inCard).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(inCard);
    expect(await (await shown()).findByText("Essay finished")).toBeVisible();
    expect(card()).toBeNull();
    expect(dones).toHaveLength(1);
  });

  it("says why Done did not go, and a closed attempt is a screen of its own", async () => {
    let refusal = new ConnectError("down", Code.Unavailable);
    await renderEssay({
      history: WRITTEN,
      submissions: 1,
      done: () => {
        throw refusal;
      },
    });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    refusal = refused(Code.FailedPrecondition, Cause.ATTEMPT_CLOSED, CloseReason.ABANDONED);
    await userEvent.click(done());
    expect(await screen.findByText("Nothing was done on it for 7 days")).toBeVisible();
  });

  it("opens again with Done open by api's count, and no feedback, which the server keeps none of", async () => {
    await renderEssay({ history: WRITTEN, submissions: 1 });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    expect(card()).toBeNull();
    expect(screen.queryByRole("heading", { name: "What was read" })).toBeNull();
  });

  it("says it is over when api closed the attempt with a submission, and the work leaves the device", async () => {
    const { device } = await renderEssay({
      history: WRITTEN,
      answer: () => ({
        end: SubmissionEnd.FEEDBACK,
        feedback: "Late but here.",
        closed: CloseReason.ABANDONED,
      }),
    });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    expect(await screen.findByText("Nothing was done on it for 7 days")).toBeVisible();
    await vi.waitFor(async () => expect(await keptOf(device)).toBeUndefined());
  });

  it("offers an adult to report a problem with the feedback", async () => {
    const { reports } = await renderEssay({ history: WRITTEN, adult: true });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(check());
    await (await found()).findByText("Each sentence makes a reader ask why.");
    await userEvent.click(panel().getByRole("button", { name: "Report a problem" }));
    await userEvent.click(screen.getByRole("radio", { name: /Wrong/ }));
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await vi.waitFor(() => expect(reports).toHaveLength(1));
    expect(reports[0]?.reply).toBe(TutorReply.ESSAY_FEEDBACK);
    expect(reports[0]?.words).toBe("Each sentence makes a reader ask why.");
  });

  it("gives a hint with the technique and the leading question, and leads by steps", async () => {
    await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(screen.getByRole("button", { name: "Hint" }));
    expect(await (await found()).findByText("What does the umbrella say?")).toBeVisible();
    expect(panel().getByText("Start in the middle")).toBeVisible();
    await chooseMode("Step by step");
    expect(
      await (await found()).findByRole("heading", { name: "Plan the essay", level: 2 }),
    ).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    expect(
      await (await found()).findByRole("heading", { name: "Write it", level: 2 }),
    ).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    await userEvent.click(panel().getByRole("button", { name: /^Step \d+ of \d+$/ }));
    await userEvent.click(panel().getByRole("button", { name: /Plan the essay/ }));
    expect(
      await (await found()).findByRole("heading", { name: "Plan the essay", level: 2 }),
    ).toBeVisible();
  });

  it("tells a lesson's player what comes next once it is done", async () => {
    const { nexts } = await renderEssay({ history: WRITTEN, submissions: 1, lesson: true });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    await vi.waitFor(() => expect(nexts).toHaveLength(1));
    expect(screen.queryByRole("button", { name: "Try it again" })).toBeNull();
  });
});

describe("the task screen of a sheet written by hand", () => {
  it("says to write on the sheet before Check, with no Done of an essay", async () => {
    await renderEssay({
      task: {
        id: "rungs",
        statement: [{ text: "How many rungs?" }],
        canvas: { kind: "handwriting_sheet" },
        items: [{ answer_slots: [{ binding: "anywhere" }] }],
      },
    });
    await vi.waitFor(() =>
      expect(check()).toHaveAccessibleDescription("Write an answer on the sheet"),
    );
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});

/** The screen of an essay alone, with what a test gives it, and what it was asked to do. */
function drawnEssay(given: Partial<Parameters<typeof EssayScreen>[0]> = {}) {
  const asked: string[] = [];
  const props = {
    task: ESSAY,
    manifest: undefined,
    steps: [],
    catalog: undefined,
    state: initialState("self"),
    mode: "self" as const,
    filled: [[true]],
    history: [],
    media: () => Promise.reject(new Error("no file")),
    notSaved: false,
    pending: false,
    checking: false,
    blink: false,
    came: false,
    mayFinish: false,
    onHint: () => {},
    onHistoryChange: () => {},
    onMode: () => {},
    onGoTo: () => {},
    onTick: () => {},
    onDone: () => {},
    onAgain: () => {},
    onHome: () => {},
    onCheck: () => asked.push("check"),
    onFinish: () => asked.push("done"),
  };
  const shown = (more: Partial<Parameters<typeof EssayScreen>[0]>) =>
    inLanguage(<EssayScreen {...props} {...given} {...more} />);
  const { rerender } = render(shown({}));
  return {
    asked,
    redraw: (more: Partial<Parameters<typeof EssayScreen>[0]>) => rerender(shown(more)),
  };
}

describe("the card of an essay's feedback", () => {
  it("says nothing of writing while Done waits only for the submission to be kept", async () => {
    const { asked } = drawnEssay({ came: true, feedback: "Each sentence makes a reader ask why." });
    const inCard = within(card() as HTMLElement).getByRole("button", { name: "Done" });
    expect(inCard).toHaveAttribute("aria-disabled", "true");
    expect(inCard).toHaveAccessibleDescription("Done opens once the essay has been sent");
    await userEvent.click(inCard, { force: true });
    await userEvent.click(done(), { force: true });
    expect(card()).toHaveAttribute("data-kind", "feedback");
    expect(asked).toEqual([]);
  });

  it("puts the card of a lock away once its button opens", async () => {
    const { redraw } = drawnEssay({ filled: [[false]] });
    await userEvent.click(check(), { force: true });
    expect(card()).toHaveTextContent(
      "Write an answer on the sheetWrite it with the pen, then Check.OK",
    );
    redraw({ filled: [[true]] });
    expect(card()).toBeNull();
    await userEvent.click(done(), { force: true });
    expect(card()).toHaveTextContent(
      "Done opens once the essay has been sentWrite the essay, then send it with Check.OK",
    );
    redraw({ filled: [[true]], mayFinish: true });
    expect(card()).toBeNull();
  });

  it("takes no press of Check or Done while a request is under way", async () => {
    const { asked } = drawnEssay({ mayFinish: true, pending: true });
    await userEvent.click(check(), { force: true });
    await userEvent.click(done(), { force: true });
    expect(asked).toEqual([]);
    expect(card()).toBeNull();
  });
});
