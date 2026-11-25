// The debug button and its window in the browser, with api's DebugService on connect-es's
// router: nothing until GetDebug answers; the window by the button, Escape and Close, the focus
// back on the button; the tab Models — "As admitted", one model of every call chosen with its
// effort and thinking, thinking that stays on, and a choice api refuses —; and the tab Log — each
// action with its calls, a call opened to its figures and what the model returned, the request of
// a finding, the export of a Check with what the Check answered and why it makes no case, and the
// log cleared —, with the app's own lines among the actions, filtered by level and source and
// copied; and the tab Performance with its strip and the flash of what a frame paints.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type DebugAction,
  DebugActionKind,
  DebugActionSchema,
  DebugCallKind,
  DebugCallSchema,
  DebugEffort,
  DebugOutcome,
  DebugService,
  type SetDebugModelsRequest,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { routedApi } from "../test/api.ts";
import DebugButton from "./DebugButton.tsx";
import { reset, take } from "./debug.ts";
import * as journal from "./journal.ts";
import { theMonitor } from "./Perf.tsx";

const HAIKU = {
  id: "claude-haiku-5-5",
  name: "Haiku 5.5",
  inputMicroUsd: 1_000_000n,
  outputMicroUsd: 5_000_000n,
  efforts: [DebugEffort.LOW, DebugEffort.MEDIUM, DebugEffort.HIGH],
  thinkingOffEfforts: [DebugEffort.LOW, DebugEffort.MEDIUM],
};
const OPUS = { id: "claude-opus-5-5", name: "Opus 5.5", inputMicroUsd: 5_000_000n };

/** The statement of the attempt's task, as "Recognise" read it. */
const RECOGNISED = create(DebugActionSchema, {
  kind: DebugActionKind.WORDS,
  attemptId: "attempt-1",
  at: timestampFromDate(new Date("2026-11-19T15:02:00Z")),
  calls: [
    create(DebugCallSchema, {
      kind: DebugCallKind.STATEMENT_READING,
      model: HAIKU.id,
      effort: DebugEffort.MEDIUM,
      answer: '{"tasks":[{"statement":"37 + 48 ="}]}',
      inputTokens: 1200n,
      costMicroUsd: 2_500n,
      durationMs: 1500n,
      billed: true,
    }),
  ],
});

/** A Check of a frame of one task: Haiku's answer, and Opus's attempt after it that failed. */
const CHECK = create(DebugActionSchema, {
  kind: DebugActionKind.CHECK,
  attemptId: "attempt-1",
  at: timestampFromDate(new Date("2026-11-19T15:04:05Z")),
  calls: [
    create(DebugCallSchema, {
      kind: DebugCallKind.TASK_CHECKING,
      model: HAIKU.id,
      thinking: true,
      answer:
        '{"tasks":[{"task":1,"verdict":"correct","read":"85","answer":"85"}],"tutor_words":"Well done","hints":["a","b"]}',
    }),
    create(DebugCallSchema, {
      kind: DebugCallKind.TASK_CHECKING,
      attempt: 2,
      model: OPUS.id,
      failure: Cause.AI_FAILURE,
    }),
  ],
});

/** A finding of the tasks on a page, at the learner's request. */
const FOUND = create(DebugActionSchema, {
  kind: DebugActionKind.FIND_TASKS,
  at: timestampFromDate(new Date("2026-11-19T15:03:00Z")),
  calls: [
    create(DebugCallSchema, {
      kind: DebugCallKind.TASK_FINDING,
      model: HAIKU.id,
      answer: "not JSON",
      failure: Cause.LIMIT_REACHED,
    }),
  ],
});

interface Routes {
  /** What SetDebugModels answers to each choice: by default what it was asked. */
  readonly set?: (request: SetDebugModelsRequest) => void;
  readonly actions?: readonly DebugAction[];
}

function renderDebug(routes: Routes = {}) {
  const asked: SetDebugModelsRequest[] = [];
  const api = routedApi((router) => {
    router.service(DebugService, {
      getDebug: () => ({
        models: [HAIKU, OPUS],
        admitted: [
          {
            kind: DebugCallKind.TASK_FINDING,
            model: { model: HAIKU.id, effort: DebugEffort.MEDIUM },
          },
          { kind: DebugCallKind.TASK_FINDING, model: { model: OPUS.id, effort: DebugEffort.HIGH } },
          { kind: DebugCallKind.TASK_CHECKING },
        ],
      }),
      setDebugModels(request) {
        asked.push(request);
        routes.set?.(request);
        return { choice: request.choice };
      },
      takeDebugCalls: () => ({ actions: [...(routes.actions ?? [])] }),
    });
  });
  render(
    <ApiProvider value={api}>
      <DebugButton />
    </ApiProvider>,
  );
  return { api, asked };
}

/** The window opened by the button, once GetDebug has answered. */
async function opened() {
  const button = await screen.findByRole("button", { name: "Debug: the models and their answers" });
  await userEvent.click(button);
  return within(screen.getByRole("dialog", { name: "Debug" }));
}

/** The calls of a Check and of a finding taken into the log, as a request of a task from paper does. */
async function logged(api: Api) {
  await act(() =>
    take(
      api.debug,
      {
        attemptId: "attempt-1",
        statement: new Uint8Array([1]),
        crop: new Uint8Array([2]),
        instruction: new Uint8Array([3]),
        outcomes: [DebugOutcome.CORRECT],
      },
      "only the first column",
    ),
  );
}

beforeEach(() => {
  reset();
  journal.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the debug button", () => {
  it("shows nothing without the mode, and opens and closes its window, the focus going back", async () => {
    const api = routedApi((router) => {
      router.service(DebugService, {
        getDebug: () => {
          throw new ConnectError("no flag", Code.Unimplemented);
        },
      });
    });
    const { container } = render(
      <ApiProvider value={api}>
        <DebugButton />
      </ApiProvider>,
    );
    await new Promise((later) => setTimeout(later, 50));
    expect(container).toBeEmptyDOMElement();
    reset();
    document.body.innerHTML = "";

    renderDebug();
    const window_ = await opened();
    expect(window_.getByText(/· 0 calls this session$/)).toBeVisible();
    // The button stays in its bar, expanded, so that the row does not move; a press closes the window.
    const bug = screen.getByRole("button", { name: "Debug: the models and their answers" });
    expect(bug).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement).toBe(window_.getByRole("button", { name: "Close" }));
    await userEvent.click(window_.getByRole("button", { name: "Full screen" }));
    expect(screen.getByRole("dialog", { name: "Debug" })).toHaveAttribute("data-size", "full");
    await userEvent.keyboard("{Escape}");
    const button = screen.getByRole("button", { name: "Debug: the models and their answers" });
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(button);
    await userEvent.click(button);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the models as admitted, and sets one model of every call, its effort and thinking", async () => {
    const { asked } = renderDebug();
    const window_ = await opened();
    const models = within(window_.getByRole("region", { name: "Models" }));
    expect(models.getByText("Haiku 5.5 · medium → Opus 5.5 · high")).toBeVisible();
    expect(models.getByText("Check")).toBeVisible();
    // One model of every call: no second reader.
    expect(models.queryByRole("switch", { name: "Second reader" })).toBeNull();
    expect(models.getAllByRole("button", { name: /^Model/ })).toHaveLength(1);

    const [first] = models.getAllByRole("button", { name: /^Model/ });
    await userEvent.click(first as HTMLElement);
    const menu = within(models.getByRole("menu", { name: "Model" }));
    expect(menu.getByRole("menuitemradio", { name: /As admitted/ })).toBeChecked();
    expect(menu.getByText("claude-haiku-5-5 · $1.00 / $5.00 per Mtok")).toBeVisible();
    await userEvent.click(menu.getByRole("menuitemradio", { name: /Haiku 5\.5/ }));
    await waitFor(() => expect(asked).toHaveLength(1));
    expect(asked[0]?.choice?.first).toMatchObject({ model: HAIKU.id, effort: DebugEffort.MEDIUM });

    // Haiku turns thinking off at medium.
    const thinking = models.getAllByRole("switch", { name: /Thinking/ })[0] as HTMLElement;
    expect(thinking).toHaveAttribute("aria-checked", "true");
    await userEvent.click(thinking);
    await waitFor(() => expect(asked).toHaveLength(2));
    expect(asked[1]?.choice?.first?.thinking).toBe(false);
    // And keeps it on at high.
    await userEvent.click(models.getAllByRole("button", { name: "high" })[0] as HTMLElement);
    await waitFor(() => expect(asked).toHaveLength(3));
    expect(asked[2]?.choice?.first).toMatchObject({ effort: DebugEffort.HIGH, thinking: true });
    expect(models.getByText("Always on at high")).toBeVisible();

    // Opus keeps it on at every effort.
    await userEvent.click(models.getAllByRole("button", { name: /^Model/ })[0] as HTMLElement);
    await userEvent.click(
      within(models.getByRole("menu", { name: "Model" })).getByRole("menuitemradio", {
        name: /Opus 5\.5/,
      }),
    );
    expect(await models.findByText("Always on for Opus 5.5")).toBeVisible();
    await userEvent.click(models.getByRole("switch", { name: /Thinking/ }), { force: true });
    expect(asked.every((each) => each.choice?.second === undefined)).toBe(true);

    // Back to as admitted.
    await userEvent.click(models.getAllByRole("button", { name: /^Model/ })[0] as HTMLElement);
    await userEvent.click(
      within(models.getByRole("menu", { name: "Model" })).getByRole("menuitemradio", {
        name: /As admitted/,
      }),
    );
    await waitFor(() => expect(asked.at(-1)?.choice?.first).toBeUndefined());
  });

  it("says why api refused a choice", async () => {
    renderDebug({
      set: () => {
        throw new ConnectError("no such model", Code.InvalidArgument);
      },
    });
    const window_ = await opened();
    await userEvent.click(window_.getAllByRole("button", { name: /^Model/ })[0] as HTMLElement);
    await userEvent.click(window_.getByRole("menuitemradio", { name: /Opus 5\.5/ }));
    expect((await window_.findByRole("alert")).textContent).toBe("api: invalid");
    expect(window_.getAllByRole("button", { name: /^Model/ })[0]?.textContent).toContain(
      "As admitted",
    );
  });

  it("logs each action with its calls, opens a call, and exports a Check as a case", async () => {
    const save = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const made = vi.spyOn(URL, "createObjectURL");
    const { api } = renderDebug({ actions: [FOUND, RECOGNISED, CHECK] });
    await logged(api);
    const window_ = await opened();
    await userEvent.click(window_.getByRole("tab", { name: /Log/ }));
    const log = within(window_.getByRole("region", { name: "Log" }));
    expect(log.getByText("Request: “only the first column”")).toBeVisible();
    expect(log.getByText("Check · attempt 2")).toBeVisible();

    // A call opens to its figures and what the model returned, indented when it is JSON.
    await userEvent.click(log.getByRole("button", { name: /^Statement/ }));
    expect(log.getByText("1,200")).toBeVisible();
    expect(log.getByText(/"statement": "37 \+ 48 ="/)).toBeVisible();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await userEvent.click(log.getByRole("button", { name: "Copy" }));
    expect(await log.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(copy).toHaveBeenCalledWith(expect.stringMatching(/"statement": "37 \+ 48 ="/));
    await userEvent.click(log.getByRole("button", { name: /^Check ?Haiku/ }));
    expect(log.getByText(/"tutor_words": "Well done"/)).toBeVisible();
    await userEvent.click(log.getByRole("button", { name: /^Find tasks/ }));
    expect(log.getByText("not JSON")).toBeVisible();
    expect(log.getByText("The own key's limit (CAUSE_LIMIT_REACHED).")).toBeVisible();
    // A call that returned nothing opens to its figures and why.
    await userEvent.click(log.getByRole("button", { name: /^Check · attempt 2/ }));
    expect(log.getByText("The call failed (CAUSE_AI_FAILURE).")).toBeVisible();

    // The export begins from what the Check gave, beside it, and saves the case once it makes one.
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    expect(log.getByText("The Check: correct · read “85”")).toBeVisible();
    expect(log.getByLabelText("Statement")).toHaveValue("37 + 48 =");
    expect(log.getByLabelText("Read · the answer the work holds")).toHaveValue("85");
    expect(log.getByRole("button", { name: "correct" })).toHaveAttribute("aria-pressed", "true");
    // Each field as the developer corrects it, trimmed in the case.
    await userEvent.fill(log.getByLabelText("Statement"), "37 + 48 = ");
    await userEvent.fill(log.getByLabelText("Read · the answer the work holds"), " 86");
    await userEvent.fill(log.getByLabelText("Note"), "the Check misread it");
    await userEvent.click(log.getByRole("button", { name: "not yet" }));
    await userEvent.click(log.getByRole("button", { name: "Save case" }));
    expect(save).toHaveBeenCalledOnce();
    expect((save.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      "case-20261119T150405-attempt-.json",
    );
    expect(log.queryByRole("button", { name: "Save case" })).toBeNull();
    const [file] = made.mock.calls[0] ?? [];
    if (!(file instanceof Blob)) throw new Error("no file saved");
    const saved = JSON.parse(await file.text());
    expect(saved.tasks[0]).toMatchObject({
      statement: "37 + 48 =",
      read: "86",
      outcome: "DEBUG_OUTCOME_NOT_YET",
      checkVerdict: "correct",
      checkRead: "85",
    });
    expect(saved.work.instruction).toBe("Aw==");
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    await userEvent.click(log.getByRole("button", { name: "Cancel" }));
    expect(log.queryByRole("button", { name: "Cancel" })).toBeNull();
    // Export again puts the export it opened away.
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    expect(log.queryByRole("button", { name: "Cancel" })).toBeNull();

    await userEvent.click(window_.getByRole("button", { name: "Clear" }));
    expect(
      await window_.findByText("Nothing yet. What the app does, and the AI’s calls, come here."),
    ).toBeVisible();
    expect(window_.getByRole("button", { name: "Clear" })).toHaveAttribute("aria-disabled", "true");
    // Marked disabled, and pressed all the same.
    await userEvent.click(window_.getByRole("button", { name: "Clear" }), { force: true });
    await userEvent.click(window_.getByRole("tab", { name: "Models" }));
    expect(window_.getByRole("region", { name: "Models" })).toBeVisible();
  });

  it("shows the app's lines among the actions, the errors alone, a filter and a copy", async () => {
    const { api } = renderDebug({ actions: [FOUND, CHECK] });
    await logged(api);
    journal.clear();
    journal.note("info", "camera", "Photo 4032 × 3024", "", new Date("2026-11-19T15:02:30Z"));
    journal.note(
      "error",
      "api",
      "AttemptService/SubmitWork · invalid_argument",
      "code: invalid_argument\ntook: 0.2 s",
      new Date("2026-11-19T15:03:30Z"),
    );
    journal.note("debug", "canvas", "a line of the canvas", "", new Date("2026-11-19T15:05:00Z"));
    act(() => journal.flush());
    const window_ = await opened();
    // The tab counts the errors in red.
    const tab = window_.getByRole("tab", { name: /Log/ });
    expect(tab.textContent).toBe("Logerrors: 1");
    await userEvent.click(tab);
    const log = within(window_.getByRole("region", { name: "Log" }));
    expect(log.getByText("5 entries")).toBeVisible();
    // Newest first: the canvas's line, the Check, the refusal, the finding, the photo.
    const order = [
      "a line of the canvas",
      "Check · attempt 2",
      "AttemptService/SubmitWork · invalid_argument",
      "Request: “only the first column”",
      "Photo 4032 × 3024",
    ].map((text) => log.getByText(text));
    for (let i = 1; i < order.length; i++)
      expect(
        (order[i - 1] as Node).compareDocumentPosition(order[i] as Node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    expect(log.getByText("Camera · 15:02:30", { exact: false })).toBeVisible();

    // A line opens to its details, which Copy takes.
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await userEvent.click(log.getByRole("button", { name: /SubmitWork · invalid_argument/ }));
    expect(log.getByText(/took: 0\.2 s/)).toBeVisible();
    await userEvent.click(log.getByRole("button", { name: "Copy" }));
    expect(copy).toHaveBeenLastCalledWith(
      expect.stringMatching(/error api .*\ncode: invalid_argument/),
    );
    expect(await log.findByRole("button", { name: "Copied" })).toBeVisible();

    // The errors alone, by one press.
    await userEvent.click(log.getByRole("button", { name: "1 error" }));
    expect(log.getByRole("button", { name: "Errors" })).toBeVisible();
    expect(log.getByText("1 of 5 entries")).toBeVisible();
    expect(log.queryByText("Photo 4032 × 3024")).toBeNull();
    expect(log.queryByRole("button", { name: "1 error" })).toBeNull();

    // The filter: everything again, then no AI and no debug.
    await userEvent.click(log.getByRole("button", { name: "Errors" }));
    await userEvent.click(log.getByRole("menuitem", { name: "Show everything" }));
    await userEvent.click(log.getByRole("button", { name: "All" }));
    expect(log.getByRole("menuitemcheckbox", { name: /AI calls/ }).textContent).toBe("AI calls2");
    await userEvent.click(log.getByRole("menuitemcheckbox", { name: /AI calls/ }));
    await userEvent.click(log.getByRole("button", { name: "Filtered" }));
    await userEvent.click(log.getByRole("menuitemcheckbox", { name: /Debug/ }));
    expect(log.queryByText("Check · attempt 2")).toBeNull();
    expect(log.queryByText("a line of the canvas")).toBeNull();
    expect(log.getByText("2 of 5 entries")).toBeVisible();
    // Copy at the foot takes what is shown, as text.
    await userEvent.click(window_.getByRole("button", { name: "Copy" }));
    const text = copy.mock.calls.at(-1)?.[0] ?? "";
    expect(text.split("\n").filter((l) => !l.startsWith(" "))).toEqual([
      expect.stringMatching(/ error api AttemptService\/SubmitWork · invalid_argument$/),
      expect.stringMatching(/ info camera Photo 4032 × 3024$/),
    ]);
    // A filter that shows nothing says so.
    await userEvent.click(log.getByRole("button", { name: "Filtered" }));
    await userEvent.click(log.getByRole("menuitemcheckbox", { name: /Server · api/ }));
    await userEvent.click(log.getByRole("button", { name: "Filtered" }));
    await userEvent.click(log.getByRole("menuitemcheckbox", { name: /^App/ }));
    expect(log.getByText("Nothing of what the filter shows.")).toBeVisible();
    // Clear takes the lines too.
    await userEvent.click(window_.getByRole("button", { name: "Clear" }));
    expect(journal.snapshot()).toEqual([]);
  });

  it("shows Performance, its strip on the screen and the flash on the canvas", async () => {
    const canvas = document.createElement("novatrail-canvas-stub");
    const stub = Object.assign(canvas, {
      paintFlash: false,
      paintStats: {
        strokes: 1284,
        points: 96410,
        frames: 40,
        fullRepaints: 4,
        fills: 300,
        last: { fills: 3, area: 0.04, ms: 1.5 },
        paintMs: [1, 2, 6],
        buffers: [{ width: 2388, height: 1668 }],
      },
    });
    const query = document.querySelectorAll.bind(document);
    vi.spyOn(document, "querySelectorAll").mockImplementation(((selector: string) =>
      selector === "novatrail-canvas" ? [stub] : query(selector)) as never);
    renderDebug();
    const window_ = await opened();
    await userEvent.click(window_.getByRole("tab", { name: "Performance" }));
    const perf = within(window_.getByRole("region", { name: "Performance" }));
    expect(perf.getByText("Frames a second")).toBeVisible();
    expect(perf.getByText("Live")).toBeVisible();
    await waitFor(() => expect(perf.getByText("1,284 · 96,410")).toBeVisible(), { timeout: 3000 });
    expect(perf.getByText("3 strokes · 4% of the view")).toBeVisible();
    expect(perf.getByText("6.0 ms")).toBeVisible();
    expect(perf.getByText(/^1 · 15\.2 MB$/)).toBeVisible();
    expect(perf.getByText("not given to a page")).toBeVisible();

    await userEvent.click(perf.getByRole("button", { name: "Pause" }));
    expect(perf.getByText("Paused")).toBeVisible();
    await userEvent.click(perf.getByRole("button", { name: "Resume" }));
    expect(perf.getByText("Live")).toBeVisible();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await userEvent.click(perf.getByRole("button", { name: "Copy" }));
    expect(JSON.parse(copy.mock.calls[0]?.[0] ?? "{}").canvas.strokes).toBe(1284);

    await userEvent.click(perf.getByRole("switch", { name: /Flash what is repainted/ }));
    expect(stub.paintFlash).toBe(true);
    await userEvent.click(perf.getByRole("switch", { name: /Show on the canvas/ }));
    await userEvent.click(window_.getByRole("button", { name: "Close" }));
    // The strip stays with the window closed, and the monitor measures for it.
    const strip = await screen.findByRole("status", { name: "Performance" });
    expect(strip.textContent).toMatch(/^\d+ fps · \d+ ms · busy \d+% · ≈ \d+ MB$/);
    expect(theMonitor().snapshot().live).toBe(true);
    await userEvent.click(
      screen.getByRole("button", { name: "Debug: the models and their answers" }),
    );
    const again = within(screen.getByRole("dialog", { name: "Debug" }));
    await userEvent.click(again.getByRole("tab", { name: "Performance" }));
    await userEvent.click(again.getByRole("switch", { name: /Show on the canvas/ }));
    await userEvent.click(again.getByRole("switch", { name: /Flash what is repainted/ }));
    expect(stub.paintFlash).toBe(false);
    expect(screen.queryByRole("status", { name: "Performance" })).toBeNull();
    await userEvent.click(again.getByRole("tab", { name: "Models" }));
    expect(theMonitor().snapshot().live).toBe(false);
  });

  it("counts one call of the session as one", async () => {
    const { api } = renderDebug({ actions: [FOUND] });
    await logged(api);
    const window_ = await opened();
    expect(window_.getByText(/· 1 call this session$/)).toBeVisible();
  });
});
