// The screen of an essay in the browser, with the canvas element itself (section 3.3 of
// docs/architecture.md; R53): the reminder to write no names before each submission, SubmitEssay
// with the crop and one key for a check and its repeat, each way a submission ends, the essay kept
// on the device with its crop, what was read and the feedback, Done once it was sent, an attempt
// api closed meanwhile, and "Report a problem" at the feedback — with api on connect-es's router
// and the storage on the device's memory.
import "@altnovatrail/canvas";
import { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  type DoneRequest,
  type ReportProblemRequest,
  SubmissionEnd,
  type SubmitEssayRequest,
  type SubmitEssayResponseSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { LearningService } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { Task } from "./Task.tsx";

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
  /** What the device keeps of the essay's submissions before the screen opens. */
  kept?: boolean;
  /** How many submissions api counts. */
  submissions?: number;
  /** The answer to a submission, or a throw in place of it. */
  answer?: (
    request: SubmitEssayRequest,
    n: number,
  ) => MessageInitShape<typeof SubmitEssayResponseSchema>;
  /** Throws in place of the answer to Done. */
  done?: () => void;
  adult?: boolean;
  lesson?: boolean;
}

async function renderEssay(setup: Setup = {}) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  const task = setup.task ?? ESSAY;
  if (setup.history !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: D1, task });
    await profile?.beginEssay({ attemptId: "a1", digest: D1, task }, "en");
    await profile?.replaceHistory("a1", setup.history);
    if (setup.kept === true) {
      await profile?.addEssaySubmission("a1", new Blob([new Uint8Array(PNG)]), {
        end: "feedback",
        text: "The umbrella sighed.",
        feedback: "Kept from before.",
      });
    }
  }
  const submitted: SubmitEssayRequest[] = [];
  const dones: DoneRequest[] = [];
  const reports: ReportProblemRequest[] = [];
  const routes = (router: ConnectRouter) => {
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
      submitEssay(request) {
        submitted.push(request);
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
        return {
          solved: {
            criteria: ["There are three first sentences."],
            solution: encode([{ text: "A model answer." }]),
            moduleFormatVersion: "0.4",
          },
        };
      },
      getHint: () => ({
        hint: { case: "techniques", value: { techniqueIds: ["middle"] } },
        leadingQuestion: "What does the umbrella say?",
      }),
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
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
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
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
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
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return { device, submitted, dones, reports, attempts, nexts };
}

const check = () => screen.getByRole("button", { name: "Check" });
const done = () => screen.getByRole("button", { name: "Done" });
const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const found = async () => within(await screen.findByRole("complementary", { name: "Tutor" }));
const essayOf = async (device: Device) => (await openProfile(device, "p1"))?.essay("a1");

describe("the screen of an essay", () => {
  it("reminds to write no names, sends the crop and shows the feedback, which the device keeps", async () => {
    const { submitted, device } = await renderEssay({ history: WRITTEN });
    await vi.waitFor(() => expect(check()).toHaveAttribute("aria-disabled", "false"));
    const reminder = "Don't write your name or the real names of people you know";
    expect(screen.getByText(reminder)).toBeVisible();
    expect(check()).toHaveAccessibleDescription(reminder);
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
    expect(panel().getByText("The tutor is an AI, not a person")).toBeVisible();
    const sent = submitted[0];
    expect([...(sent?.crop.slice(0, 4) ?? [])]).toEqual(PNG);
    expect(sent?.clockOffsetMinutes).toBeDefined();
    expect(done()).toHaveAttribute("aria-disabled", "false");
    // No report for a learner who is not of the category adult.
    expect(panel().queryByRole("button", { name: "Report a problem" })).toBeNull();
    await vi.waitFor(async () => expect((await essayOf(device))?.sent).toHaveLength(1));
    const kept = (await essayOf(device))?.sent[0];
    expect(kept).toMatchObject({
      end: "feedback",
      text: "The umbrella spoke.",
      feedback: "Each sentence makes a reader ask why.",
    });
    const bytes = new Uint8Array((await kept?.crop?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect([...bytes.slice(0, 4)]).toEqual(PNG);
  });

  it("locks Check on a blank sheet, and says so", async () => {
    await renderEssay();
    await vi.waitFor(() =>
      expect(check()).toHaveAccessibleDescription(
        "Don't write your name or the real names of people you know Write an answer on the sheet",
      ),
    );
    expect(check()).toHaveAttribute("aria-disabled", "true");
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
    await vi.waitFor(async () =>
      expect((await essayOf(device))?.sent.map((one) => one.end)).toEqual([
        "feedback",
        "unreadable",
        "unchecked",
      ]),
    );
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

  it("finishes by Done: the criteria and the solution, and the essay stays, ended", async () => {
    const { dones, device, attempts } = await renderEssay({ history: WRITTEN, submissions: 1 });
    await vi.waitFor(() => expect(done()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(done());
    expect(await (await found()).findByText("Essay finished")).toBeVisible();
    expect(panel().getByRole("heading", { name: "What the feedback looked at" })).toBeVisible();
    expect(panel().getByText("There are three first sentences.")).toBeVisible();
    expect(panel().getByText("A model answer.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Check" })).toBeNull();
    expect(dones).toHaveLength(1);
    expect(attempts).toEqual([undefined]);
    await vi.waitFor(async () => expect((await essayOf(device))?.ended).toBe(true));
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

  it("goes on with what this device kept: the last feedback, and Done open", async () => {
    await renderEssay({ history: WRITTEN, kept: true });
    expect(await (await found()).findByText("Kept from before.")).toBeVisible();
    expect(screen.getByText("The umbrella sighed.")).toBeVisible();
    expect(done()).toHaveAttribute("aria-disabled", "false");
  });

  it("keeps the feedback of a submission api closed the attempt with, and says it is over", async () => {
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
    const kept = await essayOf(device);
    expect(kept?.sent[0]?.feedback).toBe("Late but here.");
    expect(kept?.ended).toBe(true);
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
    await userEvent.click(screen.getByRole("button", { name: "Step by step" }));
    expect(
      await (await found()).findByRole("heading", { name: "Plan the essay", level: 2 }),
    ).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
    expect(
      await (await found()).findByRole("heading", { name: "Write it", level: 2 }),
    ).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Step done" }));
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

describe("the reminder on the task screen", () => {
  it("stands before Check on a sheet written by hand, and not on a choice", async () => {
    await renderEssay({
      task: {
        id: "rungs",
        statement: [{ text: "How many rungs?" }],
        canvas: { kind: "handwriting_sheet" },
        items: [{ answer_slots: [{ binding: "anywhere" }] }],
      },
    });
    await vi.waitFor(() =>
      expect(check()).toHaveAccessibleDescription(
        "Don't write your name or the real names of people you know Write an answer on the sheet",
      ),
    );
    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
  });
});
