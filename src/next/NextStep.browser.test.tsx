// The way to what the engine chose, in the browser (section 3.4 of docs/architecture.md; R24): each
// kind of choice — a lesson, a task, nothing with and without why, one this build does not know —,
// the choice an answer gave, a task begun already by its choice, "Something else" with its
// question and the attempt it closes, and one key for each action until a refusal ends it — with
// api on connect-es's router and the storage on the device's memory.
import {
  AccountService,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Cause,
  ChoiceKind,
  type EngineChoice,
  EngineChoiceSchema,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  type ChooseNextRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { LessonProvider, useLessons } from "../lesson/LessonContext.tsx";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { AttemptProvider, useAttempt } from "../task/AttemptContext.tsx";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { NextStep } from "./NextStep.tsx";

const D1 = `sha256:${"1".repeat(64)}`;

const choiceOf = (init: MessageInitShape<typeof EngineChoiceSchema>) =>
  create(EngineChoiceSchema, init);
const LESSON = choiceOf({ choiceId: "c1", kind: ChoiceKind.LESSON });
const TASK = choiceOf({ choiceId: "c2", kind: ChoiceKind.TASK });

function refused(code: Code, cause: Cause): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

interface Setup {
  /** What "Something else" or "What's next" gives; throws in its place, once for each call given. */
  readonly choose?: () => MessageInitShape<typeof EngineChoiceSchema> | undefined;
  /** Throws in place of the attempt of a task chosen. */
  readonly begin?: () => void;
  /** The beginning answers with no attempt. */
  readonly emptyBegin?: boolean;
  /** The attempt the profile has open, as GetAccount names it. */
  readonly accountAttempt?: { attemptId: string; segment?: number };
  /** The choice an answer gave. */
  readonly choice?: EngineChoice;
  /** The attempt open outside a lesson, which "Something else" and a task begun close. */
  readonly leaving?: string;
  readonly secondary?: boolean;
}

/** What the screen around the step knows: the attempt open and the lesson chosen. */
function Probe() {
  const attempt = useAttempt()?.attemptId;
  const chosen = useLessons()?.chosen;
  return (
    <p data-testid="probe">
      {`attempt ${attempt ?? "none"}; lesson ${chosen?.kind === "choice" ? chosen.choiceId : "none"}`}
    </p>
  );
}

async function renderStep(setup: Setup = {}) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  if (setup.leaving !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({
      attemptId: setup.leaving,
      digest: D1,
      task: {
        id: "t",
        statement: [{ text: "A." }],
        canvas: { kind: "handwriting_sheet" },
        items: [{ answer_slots: [{ binding: "choice", options: ["1", "2"] }] }],
      },
    });
  }
  const chosen: ChooseNextRequest[] = [];
  const begun: BeginAttemptRequest[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, {
      chooseNext(request) {
        chosen.push(request);
        const given = setup.choose?.();
        return given === undefined ? {} : { choice: given };
      },
      beginAttempt(request) {
        begun.push(request);
        setup.begin?.();
        if (setup.emptyBegin === true) return {};
        return { attempt: { attemptId: "a9", packageDigest: D1 } };
      },
    });
    router.service(AccountService, {
      getAccount: () => ({
        account: {
          accountId: "account-1",
          profiles: [
            {
              profileId: "p1",
              ...(setup.accountAttempt === undefined
                ? {}
                : {
                    openAttempt: {
                      attemptId: setup.accountAttempt.attemptId,
                      ...(setup.accountAttempt.segment === undefined
                        ? {}
                        : {
                            segment: { lessonRunId: "r1", segment: setup.accountAttempt.segment },
                          }),
                    },
                  }),
            },
          ],
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
  const learner = create(ProfileSchema, {
    profileId: "p1",
    ...(setup.leaving === undefined ? {} : { openAttempt: { attemptId: setup.leaving } }),
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        <AttemptProvider learner={learner}>
          <LessonProvider learner={learner}>
            <NextStep
              profileId="p1"
              device={device}
              {...(setup.choice === undefined ? {} : { choice: setup.choice })}
              {...(setup.secondary === undefined ? {} : { secondary: setup.secondary })}
            />
            <Probe />
          </LessonProvider>
        </AttemptProvider>
      </ApiProvider>,
    ),
  );
  return { device, chosen, begun };
}

const probe = () => screen.getByTestId("probe");

afterEach(() => {
  window.location.hash = "";
});

describe("the way to what the engine chose", () => {
  it("asks for the choice and opens the lesson it gives in the player", async () => {
    const { chosen } = await renderStep({ choose: () => LESSON });
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    await waitFor(() => expect(probe()).toHaveTextContent("attempt none; lesson c1"));
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.idempotencyKey).not.toBe("");
    expect(chosen[0]?.skill).toBe("");
  });

  it("begins the task it gives, and the task screen takes the attempt", async () => {
    const { begun } = await renderStep({ choose: () => TASK });
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() => expect(window.location.hash).toBe("#/task"));
    await waitFor(() => expect(probe()).toHaveTextContent("attempt a9; lesson none"));
    expect(begun[0]?.start).toEqual({ case: "choiceId", value: "c2" });
  });

  it("says when there is nothing to give, with why when the AI is closed, and asks again", async () => {
    let answer: MessageInitShape<typeof EngineChoiceSchema> = {
      kind: ChoiceKind.NOTHING,
      outcome: {
        cause: Cause.QUOTA,
        nextFamilyDay: timestampFromDate(new Date(2026, 10, 12, 0, 0)),
      },
    };
    const { chosen } = await renderStep({ choose: () => answer });
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    expect(await screen.findByText(/There is nothing more to offer for now/)).toBeVisible();
    // Two sentences, not one run on (T57).
    expect(
      screen.getByText(/^There is nothing more to offer for now\. Today's tutor time is used up\./),
    ).toBeVisible();
    // A kind this build does not know is nothing too, with no why.
    answer = { choiceId: "c7", kind: 99 as ChoiceKind };
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() => expect(chosen).toHaveLength(2));
    expect(screen.queryByText(/Today's tutor time/)).toBeNull();
    expect(screen.getByText("There is nothing more to offer for now")).toBeVisible();
    expect(window.location.hash).toBe("");
  });

  it("goes to the choice an answer gave without asking, and has no button for nothing", async () => {
    const lesson = await renderStep({ choice: LESSON });
    await userEvent.click(screen.getByRole("button", { name: "Next lesson" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    expect(lesson.chosen).toHaveLength(0);
    document.body.innerHTML = "";

    await renderStep({ choice: TASK, secondary: true });
    expect(screen.getByRole("button", { name: "Next task" })).toHaveClass("nt-secondary");
    document.body.innerHTML = "";

    await renderStep({ choice: choiceOf({ kind: ChoiceKind.NOTHING }) });
    expect(screen.getByText("There is nothing more to offer for now")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("goes on with the attempt a choice began already, as GetAccount names it", async () => {
    await renderStep({
      choice: TASK,
      begin: () => {
        throw refused(Code.AlreadyExists, Cause.ALREADY_EXISTS);
      },
      accountAttempt: { attemptId: "a4" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    await waitFor(() => expect(window.location.hash).toBe("#/task"));
    await waitFor(() => expect(probe()).toHaveTextContent("attempt a4; lesson none"));
  });

  it("says a beginning refused, with a new key for the next press, and one with no attempt", async () => {
    let refusals = 1;
    const { begun } = await renderStep({
      choice: TASK,
      begin: () => {
        if (refusals-- > 0) throw refused(Code.FailedPrecondition, Cause.NOT_ADMITTED);
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    expect(await screen.findByText("The tutor isn't available for this profile")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    await waitFor(() => expect(window.location.hash).toBe("#/task"));
    expect(begun[0]?.idempotencyKey).not.toBe(begun[1]?.idempotencyKey);
    document.body.innerHTML = "";
    window.location.hash = "";

    await renderStep({
      choice: TASK,
      begin: () => {
        throw refused(Code.AlreadyExists, Cause.ALREADY_EXISTS);
      },
      accountAttempt: { attemptId: "a4", segment: 3 },
    });
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    document.body.innerHTML = "";

    await renderStep({ choice: TASK, emptyBegin: true });
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    expect(await screen.findByText("This version of the app doesn't know this yet")).toBeVisible();
    expect(window.location.hash).toBe("");
  });

  it("asks before Something else closes the task in progress, and erases its work", async () => {
    const { device, chosen } = await renderStep({ leaving: "a1", choose: () => LESSON });
    const button = screen.getByRole("button", { name: "Something else" });
    await userEvent.click(button);
    const go = screen.getByRole("button", { name: "Go on" });
    expect(document.activeElement).toBe(go);
    expect(
      screen.getByRole("group", {
        name: "The task in progress closes, and it can't be gone back to",
      }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Something else" }));
    expect(chosen).toHaveLength(0);

    await userEvent.click(screen.getByRole("button", { name: "Something else" }));
    await userEvent.click(screen.getByRole("button", { name: "Go on" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    await waitFor(() => expect(probe()).toHaveTextContent("attempt none; lesson c1"));
    const profile = await openProfile(device, "p1");
    expect(await profile?.readAttempt("a1")).toBeUndefined();
  });

  it("asks again with the same key after no answer, and with a new one after a refusal", async () => {
    let state: "offline" | "still going" | "answers" = "offline";
    const { chosen } = await renderStep({
      choose: () => {
        if (state === "offline") throw new ConnectError("down", Code.Unavailable);
        if (state === "still going") {
          state = "answers";
          throw refused(Code.FailedPrecondition, Cause.STILL_GOING);
        }
        return LESSON;
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    expect(await screen.findByText("No connection")).toBeVisible();
    const offline = chosen.length;
    state = "still going";
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() => expect(screen.queryByText("No connection")).toBeNull());
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    const keys = chosen.map((request) => request.idempotencyKey);
    // No answer is no end of the action: its repeat has its key; a refusal is, and the next has a new.
    expect(keys[offline]).toBe(keys[0]);
    expect(keys[offline + 1]).not.toBe(keys[0]);
  });

  it("goes nowhere when api answers with no choice", async () => {
    await renderStep({ choose: () => undefined });
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "What's next" })).toHaveAttribute(
        "aria-disabled",
        "false",
      ),
    );
    expect(window.location.hash).toBe("");
  });

  it("asks before a task chosen closes the attempt open, and not before a lesson", async () => {
    const { device, begun } = await renderStep({ leaving: "a1", choice: TASK });
    await userEvent.click(screen.getByRole("button", { name: "Next task" }));
    expect(begun).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Go on" }));
    await waitFor(() => expect(probe()).toHaveTextContent("attempt a9; lesson none"));
    const profile = await openProfile(device, "p1");
    expect(await profile?.readAttempt("a1")).toBeUndefined();
    document.body.innerHTML = "";
    window.location.hash = "";

    // A lesson opens with no attempt begun: the one open stays, and nothing asks.
    await renderStep({ leaving: "a1", choice: LESSON });
    await userEvent.click(screen.getByRole("button", { name: "Next lesson" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    expect(probe()).toHaveTextContent("attempt a1; lesson c1");
  });

  it("says nothing was chosen after Something else, and then offers What's next", async () => {
    await renderStep({ leaving: "a1", choose: () => ({ kind: ChoiceKind.NOTHING }) });
    await userEvent.click(screen.getByRole("button", { name: "Something else" }));
    await userEvent.click(screen.getByRole("button", { name: "Go on" }));
    expect(await screen.findByText("There is nothing more to offer for now")).toBeVisible();
    expect(await screen.findByRole("button", { name: "What's next" })).toBeVisible();
    expect(probe()).toHaveTextContent("attempt none; lesson none");
  });
});
