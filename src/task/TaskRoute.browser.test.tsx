// The attempt of `#/task` read and what became of it, in the browser: an attempt api closed, with
// why, "Try it again" by `BeginAttempt` of the same task, one key until it is done and a failure
// beside it; an attempt api does not know, which goes home; and a read that failed, or came with
// no start, read again by "Try again" — with api on connect-es's router and the storage on the
// device's memory.
import {
  Cause,
  CloseReason,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Packages } from "../packages/PackagesContext.tsx";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { setAccount } from "../storage/registry.ts";
import { routedApi } from "../test/api.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { Task } from "./TaskRoute.tsx";

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

const closed = (reason: CloseReason) =>
  new ConnectError("refused", Code.FailedPrecondition, undefined, [
    {
      desc: RefusalSchema,
      value: create(RefusalSchema, {
        cause: Cause.ATTEMPT_CLOSED,
        data: { case: "closeReason", value: reason },
      }),
    },
  ]);

const notFound = () =>
  new ConnectError("refused", Code.NotFound, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.NOT_FOUND }) },
  ]);

interface Setup {
  /** Throws in place of the open attempt, or gives it with no start, by the count of the reads before. */
  readonly read: (reads: number) => "no start" | undefined;
  /** Throws in place of the attempt begun again, by the count of the calls before. */
  readonly begin?: (calls: number) => void;
}

async function renderTask(setup: Setup) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  const begun: BeginAttemptRequest[] = [];
  const check = vi.fn(async () => {});
  let reads = 0;
  const api = routedApi((router) => {
    router.service(LearningService, {
      getOpenAttempt() {
        if (setup.read(reads++) === "no start") return { attempt: { wrongAnswers: 0 } };
        throw new Error("a test that reads no attempt");
      },
      beginAttempt(request) {
        begun.push(request);
        setup.begin?.(begun.length - 1);
        return { attempt: { attemptId: "a2", packageDigest: "d" } };
      },
    });
  });
  const packages = { views: {}, checks: { check }, files: {} } as unknown as Packages;
  const attempts: (string | undefined)[] = [];
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <Task
            profileId="p1"
            attemptId="a1"
            device={device}
            adult={false}
            onAttempt={(id) => attempts.push(id)}
          />
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
  return { begun, attempts, check };
}

describe("the attempt of the task screen", () => {
  it("says why api closed it, and begins it again by Try it again, with one key until it is done", async () => {
    let offline = true;
    const { begun, attempts, check } = await renderTask({
      read: () => {
        throw closed(CloseReason.UNCHECKED);
      },
      begin: () => {
        if (offline) throw new ConnectError("down", Code.Unavailable);
      },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "This task is already over" }),
    ).toBeVisible();
    expect(check).toHaveBeenCalledOnce();
    expect(attempts).toEqual([undefined]);
    await userEvent.click(screen.getByRole("button", { name: "Try it again" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No connection");
    offline = false;
    await userEvent.click(screen.getByRole("button", { name: "Try it again" }));
    await waitFor(() => expect(attempts).toEqual([undefined, "a2"]));
    expect(new Set(begun.map((request) => request.start.value))).toEqual(new Set(["a1"]));
    expect(begun.every((request) => request.start.case === "previousAttemptId")).toBe(true);
    expect(new Set(begun.map((request) => request.idempotencyKey)).size).toBe(1);
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeVisible();
  });

  it("names the reason a task was left", async () => {
    await renderTask({
      read: () => {
        throw closed(CloseReason.LEFT);
      },
    });
    expect(await screen.findByText("Another task was begun")).toBeVisible();
  });

  it("goes home from an attempt api does not know", async () => {
    window.location.hash = "#/task";
    const { attempts } = await renderTask({
      read: () => {
        throw notFound();
      },
    });
    await waitFor(() => expect(window.location.hash).toBe("#/home"));
    expect(attempts).toEqual([undefined]);
  });

  it("reads the attempt again by Try again after a failure, and after one with no start", async () => {
    await renderTask({
      read: (reads) => {
        if (reads === 0) throw new ConnectError("no", Code.Internal);
        if (reads === 1) return "no start";
        throw closed(CloseReason.CORRECT);
      },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("It was answered correctly")).toBeVisible();
  });
});
