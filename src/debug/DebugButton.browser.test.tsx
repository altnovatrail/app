// The debug button and its window in the browser (R72), with api's DebugService on connect-es's
// router: nothing until GetDebug answers; the window by the button, Escape and Close, the focus
// back on the button; the tab Models — "As admitted", a model chosen with its effort and thinking,
// thinking that stays on, the second reader, and a choice api refuses —; and the tab Log — each
// action with its calls, a call opened to its figures and what the model returned, the request of
// a finding, how two readers came out, the export of a Check and why it makes no case, and the
// log cleared.
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

const HAIKU = {
  id: "claude-haiku-5-5",
  name: "Haiku 5.5",
  inputMicroUsd: 1_000_000n,
  outputMicroUsd: 5_000_000n,
  efforts: [DebugEffort.LOW, DebugEffort.MEDIUM, DebugEffort.HIGH],
  thinkingOffEfforts: [DebugEffort.LOW, DebugEffort.MEDIUM],
};
const OPUS = { id: "claude-opus-5-5", name: "Opus 5.5", inputMicroUsd: 5_000_000n };

/** A Check of a frame of one task: the statement read, the solver's key and two readers. */
const CHECK = create(DebugActionSchema, {
  kind: DebugActionKind.CHECK,
  attemptId: "attempt-1",
  at: timestampFromDate(new Date("2026-11-19T15:04:05Z")),
  readersDiffer: true,
  calls: [
    create(DebugCallSchema, {
      kind: DebugCallKind.STATEMENT_READING,
      model: HAIKU.id,
      effort: DebugEffort.MEDIUM,
      answer: '{"tasks":[{"statement":"37 + 48 =","formula":"37+48"}]}',
      inputTokens: 1200n,
      costMicroUsd: 2_500n,
      durationMs: 1500n,
      billed: true,
    }),
    create(DebugCallSchema, {
      kind: DebugCallKind.SOLVER,
      answer: '{"tasks":[{"statement":"37 + 48 =","answer":{"number":{"value":"85"}}}]}',
      durationMs: 3n,
    }),
    create(DebugCallSchema, {
      kind: DebugCallKind.WORK_READING,
      reader: 1,
      model: HAIKU.id,
      thinking: true,
      answer: '{"results":[{"task":1,"part":1,"value":"85"}]}',
    }),
    create(DebugCallSchema, {
      kind: DebugCallKind.WORK_READING,
      reader: 2,
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
          { kind: DebugCallKind.WORK_READING },
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
        outcomes: [DebugOutcome.CORRECT],
      },
      "only the first column",
    ),
  );
}

beforeEach(() => {
  reset();
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
    expect(document.activeElement).toBe(window_.getByRole("button", { name: "Close" }));
    await userEvent.click(window_.getByRole("button", { name: "Full screen" }));
    expect(screen.getByRole("dialog", { name: "Debug" })).toHaveAttribute("data-size", "full");
    await userEvent.keyboard("{Escape}");
    const button = screen.getByRole("button", { name: "Debug: the models and their answers" });
    expect(document.activeElement).toBe(button);
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the models as admitted, and sets a model, its effort and thinking, and the second reader", async () => {
    const { asked } = renderDebug();
    const window_ = await opened();
    const models = within(window_.getByRole("region", { name: "Models" }));
    expect(models.getByText("Haiku 5.5 · medium → Opus 5.5 · high")).toBeVisible();
    expect(models.getByText("Off: one reader, the first model.")).toBeVisible();

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

    // The second reader, Sonnet at low until another is chosen.
    await userEvent.click(models.getByRole("switch", { name: "Second reader" }));
    expect(
      await models.findByText(
        "Two readers of the work: a place they read differently is unreadable (R68).",
      ),
    ).toBeVisible();
    await waitFor(() => expect(asked.at(-1)?.choice?.second?.effort).toBe(DebugEffort.LOW));
    const second = models.getAllByRole("button", { name: /^Model/ })[1] as HTMLElement;
    await userEvent.click(second);
    await userEvent.click(
      within(models.getByRole("menu", { name: "Model" })).getByRole("menuitemradio", {
        name: /Haiku 5\.5/,
      }),
    );
    await waitFor(() => expect(asked.at(-1)?.choice?.second?.model).toBe(HAIKU.id));

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
    const { api } = renderDebug({ actions: [FOUND, CHECK] });
    await logged(api);
    const window_ = await opened();
    await userEvent.click(window_.getByRole("tab", { name: /Log/ }));
    const log = within(window_.getByRole("region", { name: "Log of the models" }));
    expect(log.getByText("Request: “only the first column”")).toBeVisible();
    expect(
      log.getByText("The readers read a place differently: it is unreadable (R68)."),
    ).toBeVisible();
    expect(log.getByText("Read the work · reader 2 · attempt 2")).toBeVisible();
    expect(log.getByText("module-kit · no AI")).toBeVisible();

    // A call opens to its figures and what the model returned, indented when it is JSON.
    await userEvent.click(log.getByRole("button", { name: /^Statement/ }));
    expect(log.getByText("1,200")).toBeVisible();
    expect(log.getByText(/"formula": "37\+48"/)).toBeVisible();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await userEvent.click(log.getByRole("button", { name: "Copy" }));
    expect(await log.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(copy).toHaveBeenCalledWith(expect.stringMatching(/"formula": "37\+48"/));
    await userEvent.click(log.getByRole("button", { name: /^Solver/ }));
    expect(log.getByText("The key")).toBeVisible();
    await userEvent.click(log.getByRole("button", { name: /^Find tasks/ }));
    expect(log.getByText("not JSON")).toBeVisible();
    expect(log.getByText("The own key's limit (CAUSE_LIMIT_REACHED).")).toBeVisible();
    // A call that returned nothing opens to its figures and why.
    await userEvent.click(log.getByRole("button", { name: /^Read the work · reader 2/ }));
    expect(log.getByText("The call failed (CAUSE_AI_FAILURE).")).toBeVisible();

    // The export begins from what the calls gave, and saves the case once it makes one.
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    expect(log.getByLabelText("Statement")).toHaveValue("37 + 48 =");
    expect(log.getByLabelText("Key · JSON of paper.v1.Answer")).toHaveValue(
      '{"number":{"value":"85"}}',
    );
    expect(log.getByLabelText("Read · the answer the work holds")).toHaveValue("85");
    await userEvent.fill(log.getByLabelText("Key · JSON of paper.v1.Answer"), "{oops");
    await userEvent.click(log.getByRole("button", { name: "Save case" }));
    expect(log.getByRole("alert").textContent).toMatch(
      /^The key of task 1 is no paper\.v1\.Answer: /,
    );
    await userEvent.fill(log.getByLabelText("Key · JSON of paper.v1.Answer"), "");
    // Each field as the developer corrects it, trimmed in the case.
    await userEvent.fill(log.getByLabelText("Statement"), "37 + 48 = ");
    await userEvent.fill(log.getByLabelText("Formula"), "37 + 48");
    await userEvent.fill(log.getByLabelText("Read · the answer the work holds"), " 86");
    await userEvent.fill(log.getByLabelText("Note"), "the second reader failed");
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
      formula: "37 + 48",
      read: "86",
    });
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    await userEvent.click(log.getByRole("button", { name: "Cancel" }));
    expect(log.queryByRole("button", { name: "Cancel" })).toBeNull();
    // Export again puts the export it opened away.
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    await userEvent.click(log.getByRole("button", { name: "Export" }));
    expect(log.queryByRole("button", { name: "Cancel" })).toBeNull();

    await userEvent.click(window_.getByRole("button", { name: "Clear log" }));
    expect(
      await window_.findByText("No calls yet. Take a photo of a page, or Check a task."),
    ).toBeVisible();
    expect(window_.getByRole("button", { name: "Clear log" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Marked disabled, and pressed all the same.
    await userEvent.click(window_.getByRole("button", { name: "Clear log" }), { force: true });
    await userEvent.click(window_.getByRole("tab", { name: "Models" }));
    expect(window_.getByRole("region", { name: "Models" })).toBeVisible();
  });

  it("counts one call of the session as one", async () => {
    const { api } = renderDebug({ actions: [FOUND] });
    await logged(api);
    const window_ = await opened();
    expect(window_.getByText(/· 1 call this session$/)).toBeVisible();
  });
});
