// A module solved on the sheet in the browser: `#/paper/module/<module>` begins its tasks with
// BeginPaperAttempts by the module's ID, the shapes of a sheet standing meanwhile; each task is the
// screen of solving of a task from paper, its tracing paper the module's text drawn — the source
// "module", no Recognise —, its list with no Add; Check sends that picture as the statement; a
// closed task begins anew on the same page with no module; a failed beginning says why and tries
// again; a page held is shown again with no request — with api on connect-es's router.

import type { SubmitWorkRequest } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { AttemptService } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginPaperAttemptsRequest,
  BeginPaperAttemptsResponseSchema,
  PaperService,
} from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { formatHash } from "../app/hash.ts";
import { HOME, navigate, useRoute } from "../app/router.ts";
import { routedApi } from "../test/api.ts";
import { inLanguage } from "../test/language.tsx";
import { modulePageOf, paperModuleRoute } from "./module.ts";
import { PaperProvider } from "./PaperContext.tsx";
import { PaperScreen } from "./PaperScreen.tsx";
import { statementPicture, statementText, wrapped } from "./statement.ts";

const MODULE = "novatrail/check-board";
const TEXTS = [
  "A notebook costs 14, an album three times as much. What do 2 albums cost?",
  "Find x.",
];

/** The open view of a task of the module, as api gives it. */
function viewOf(id: string, text: string) {
  return {
    json: new TextEncoder().encode(
      JSON.stringify({ id, canvas: { kind: "handwriting_sheet" }, statement: [{ text }] }),
    ),
    moduleFormatVersion: "0.4",
  };
}

/** Home, a word alone, or the screen of `#/paper`, as the app routes them. */
function Routed() {
  return useRoute().screen === "paper" ? <PaperScreen profileId="p1" adult /> : <p>Home</p>;
}

/** The screen on the module's route; `fail` refuses each beginning under the first key. */
function renderModule({ fail = false } = {}) {
  const begins: BeginPaperAttemptsRequest[] = [];
  const submits: SubmitWorkRequest[] = [];
  const hinted: string[] = [];
  const api = routedApi((router) => {
    router.service(PaperService, {
      beginPaperAttempts(request) {
        begins.push(request);
        if (fail && request.idempotencyKey === begins[0]?.idempotencyKey)
          throw new ConnectError("down", Code.Unavailable);
        if (request.moduleId === "")
          return { attemptIds: Array.from({ length: request.tasks }, (_, i) => `renewed-${i}`) };
        return {
          attemptIds: TEXTS.map((_, i) => `a${i + 1}`),
          tasks: TEXTS.map((text, i) => viewOf(`t${i + 1}`, text)),
          packageDigest: "sha256:board",
        };
      },
    });
    router.service(AttemptService, {
      // The first attempt is closed, as by another page: the refusal begins the task anew.
      getHint(request) {
        hinted.push(request.attemptId);
        if (request.attemptId === "a1")
          throw new ConnectError("closed", Code.FailedPrecondition, undefined, [
            { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.ATTEMPT_CLOSED }) },
          ]);
        return { hint: { case: "rung", value: { rung: 1, words: "Look at the tens." } } };
      },
      submitWork(request) {
        submits.push(request);
        return {
          items: [
            {
              verdict: "correct",
              answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "84" }],
            },
          ],
        };
      },
    });
  });
  navigate(paperModuleRoute(MODULE));
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PaperProvider>
          <Routed />
        </PaperProvider>
      </ApiProvider>,
    ),
  );
  return { begins, submits, hinted };
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
    t: 30,
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

const SLOW = { timeout: 15_000 };

beforeEach(() => navigate(HOME));
afterEach(() => {
  cleanup();
  navigate(HOME);
});

it("begins the module's tasks by its ID, each a sheet under its text, with no Recognise and no Add", async () => {
  const { begins } = renderModule();
  expect(await screen.findByRole("heading", { name: "Task 1" }, SLOW)).toBeVisible();
  expect(begins).toHaveLength(1);
  expect(begins[0]?.moduleId).toBe(MODULE);
  expect(begins[0]?.tasks).toBe(0);
  expect(begins[0]?.pageId).toMatch(/^[0-9a-f-]{36}$/);
  const paper = sheet().paper;
  expect(paper?.source).toBe("module");
  expect(sheet().reading).toBeUndefined();
  await userEvent.click(screen.getByRole("button", { name: "Tasks, 1 / 2" }));
  expect(await screen.findByText("0 of 2 done")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
});

it("sends the module's text drawn as the statement of Check, and goes on to the next task", async () => {
  const { submits } = renderModule();
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  writeOn(sheet());
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await expect.poll(() => submits.length).toBe(1);
  const work = submits[0]?.work?.surface;
  if (work?.case !== "paper") throw new Error("no work of a task from paper");
  expect([...work.value.statement.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  const statement = sheet().paper?.statement;
  if (statement === undefined) throw new Error("no paper");
  const picture = new Uint8Array(await statement.arrayBuffer());
  expect(work.value.statement).toEqual(picture);
  expect(submits[0]?.attemptId).toBe("a1");
  await userEvent.click(await screen.findByRole("button", { name: "Next task" }, SLOW));
  expect(await screen.findByRole("heading", { name: "Task 2" })).toBeVisible();
});

it("begins a task api closed anew on the same page, with no module", async () => {
  const { begins, hinted } = renderModule();
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  await userEvent.click(screen.getByRole("button", { name: "Hint" }));
  await expect.poll(() => begins.length).toBe(2);
  expect(begins[1]?.moduleId).toBe("");
  expect(begins[1]?.tasks).toBe(1);
  expect(begins[1]?.pageId).toBe(begins[0]?.pageId);
  await expect.poll(() => hinted.at(-1)).toBe("renewed-0");
});

it("stands the shapes of a sheet while it begins, says a failure, and tries again", async () => {
  const { begins } = renderModule({ fail: true });
  expect(await screen.findByRole("button", { name: "Try again" }, SLOW)).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Task 1" }, SLOW)).toBeVisible();
  expect(begins.at(-1)?.idempotencyKey).not.toBe(begins[0]?.idempotencyKey);
});

it("shows the page held again with no request, and the route names the module alone", async () => {
  const { begins } = renderModule();
  await screen.findByRole("heading", { name: "Task 1" }, SLOW);
  writeOn(sheet());
  navigate(HOME);
  expect(await screen.findByText("Home")).toBeVisible();
  navigate(paperModuleRoute(MODULE));
  expect(await screen.findByRole("heading", { name: "Task 1" })).toBeVisible();
  expect(sheet().history).toHaveLength(1);
  expect(begins).toHaveLength(1);
  expect(formatHash(paperModuleRoute(MODULE))).toBe("#/paper/module/novatrail%2Fcheck-board");
});

it("draws the statement's text parts as one wrapped picture, wider than tall", async () => {
  expect(
    statementText(
      new TextEncoder().encode(
        JSON.stringify({ statement: [{ text: " Two " }, { media: "x.png" }, { text: "parts." }] }),
      ),
    ),
  ).toBe("Two parts.");
  for (const json of ["null", "3", '{"statement":3}', '{"statement":[3,{"text":4}]}'])
    expect(statementText(new TextEncoder().encode(json))).toBe("");
  expect(wrapped("a bb ccc", (line) => line.length <= 4)).toEqual(["a bb", "ccc"]);
  expect(wrapped("", () => true)).toEqual([""]);
  const picture = await createImageBitmap(await statementPicture(TEXTS[0] as string));
  expect(picture.width).toBeGreaterThan(picture.height);
});

it("refuses an answer that began another number of tasks than it gave", async () => {
  const answer = create(BeginPaperAttemptsResponseSchema, {
    attemptIds: ["a1", "a2"],
    tasks: [viewOf("t1", "x")],
  });
  await expect(modulePageOf(answer, "page", MODULE)).rejects.toThrow("another number");
  await expect(
    modulePageOf(create(BeginPaperAttemptsResponseSchema, {}), "page", MODULE),
  ).rejects.toThrow("another number");
});
