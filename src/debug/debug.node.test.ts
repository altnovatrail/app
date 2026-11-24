// The debug mode: what the window writes of the models and the calls, and the
// tab's memory of them — the choice as api holds it, the calls taken after each request of a task
// from paper, and the session's sum.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  DebugActionKind,
  DebugActionSchema,
  DebugCallKind,
  DebugCallSchema,
  DebugCaseSchema,
  DebugChoiceSchema,
  DebugEffort,
  DebugModelChoiceSchema,
  DebugModelSchema,
  DebugOutcome,
  GetDebugResponseSchema,
  SetDebugModelsResponseSchema,
  TakeDebugCallsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create, fromJsonString } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code } from "@connectrpc/connect";
import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "../api/failure.ts";
import {
  actionKey,
  actionTime,
  actionTitle,
  answerOf,
  began,
  callLine,
  callsOf,
  callTitle,
  choose,
  clear,
  costOf,
  type DebugClient,
  exportOf,
  failureOf,
  fitted,
  load,
  OUTCOMES,
  outcomeOf,
  perMtok,
  reset,
  snapshot,
  statsOf,
  take,
  thinkingFixed,
  truthOf,
  usd,
} from "./debug.ts";
import { signedIn } from "./gate.ts";

const haiku = create(DebugModelSchema, {
  id: "claude-haiku-5-5",
  name: "Haiku 5.5",
  inputMicroUsd: 100_000n,
  outputMicroUsd: 500_000n,
  thinkingOffEfforts: [DebugEffort.LOW, DebugEffort.MEDIUM, DebugEffort.HIGH],
});
const opus = create(DebugModelSchema, { id: "claude-opus-5-5", name: "Opus 5.5" });
const models = [haiku, opus];

/** A client of the debug mode that answers as it is told, and keeps what it was asked. */
function client(answers: {
  readonly get?: () => Promise<unknown>;
  readonly set?: () => Promise<unknown>;
  readonly take?: () => Promise<unknown>;
}) {
  const asked: unknown[] = [];
  const c = {
    getDebug: async () => (answers.get ?? (async () => create(GetDebugResponseSchema)))(),
    setDebugModels: async (req: unknown) => {
      asked.push(req);
      return (answers.set ?? (async () => create(SetDebugModelsResponseSchema)))();
    },
    takeDebugCalls: async () =>
      (answers.take ?? (async () => create(TakeDebugCallsResponseSchema)))(),
  };
  return { client: c as unknown as DebugClient, asked };
}

afterEach(() => reset());

describe("the figures", () => {
  it("writes dollars with five places below a cent and four from it", () => {
    expect(usd(1230n)).toBe("$0.00123");
    expect(usd(13_700n)).toBe("$0.0137");
    expect(perMtok(100_000n)).toBe("$0.10");
  });

  it("keeps thinking on where a model or an effort cannot turn it off", () => {
    expect(thinkingFixed(haiku, DebugEffort.LOW)).toBe(false);
    expect(thinkingFixed(haiku, DebugEffort.XHIGH)).toBe(true);
    expect(thinkingFixed(opus, DebugEffort.LOW)).toBe(true);
    expect(
      fitted(models, { model: opus.id, effort: DebugEffort.LOW, thinking: false }).thinking,
    ).toBe(true);
  });

  it("names a call by what it did, its attempt and its model as the provider gave it back", () => {
    const read = create(DebugCallSchema, {
      kind: DebugCallKind.TASK_CHECKING,
      model: "claude-haiku-5-5-20261101",
      effort: DebugEffort.LOW,
      thinking: false,
      answer: '{"a":1}',
      costMicroUsd: 20n,
      inputTokens: 1200n,
    });
    expect(callTitle(read)).toBe("Check");
    expect(callTitle({ ...read, attempt: 3 })).toBe("Check · attempt 3");
    expect(callTitle({ ...read, kind: DebugCallKind.TUTOR_WORDS })).toBe("Tutor's words");
    expect(callLine(models, read)).toBe("Haiku 5.5 · low · no thinking");
    expect(answerOf(read)).toBe('{\n  "a": 1\n}');
    expect(statsOf(read)[0]).toEqual({ k: "Input", v: "1,200" });
    const plain = create(DebugCallSchema, { answer: "not json" });
    expect(answerOf(plain)).toBe("not json");
    expect(answerOf(create(DebugCallSchema))).toBe("");
    expect(failureOf(create(DebugCallSchema, { failure: Cause.KEY_REFUSED }))).toMatch(
      /KEY_REFUSED/,
    );
    expect(failureOf(plain)).toBe("");
  });

  it("names every call and action, a model not in the catalog by its ID, and when api took it", () => {
    const named = (kind: DebugCallKind) => callTitle(create(DebugCallSchema, { kind }));
    expect(named(DebugCallKind.TASK_FINDING)).toBe("Find tasks");
    expect(named(DebugCallKind.STATEMENT_READING)).toBe("Statement");
    expect(named(DebugCallKind.TASK_CHECKING)).toBe("Check");
    expect(named(DebugCallKind.DRAWING)).toBe("Drawing");
    // A kind api no longer records is a call.
    expect(named(DebugCallKind.SOLVER)).toBe("Call");
    expect(named(DebugCallKind.WORK_READING)).toBe("Call");
    expect(named(DebugCallKind.UNSPECIFIED)).toBe("Call");
    const call = create(DebugCallSchema, { kind: DebugCallKind.TUTOR_WORDS, model: "other-1" });
    expect(callLine(models, { ...call, thinking: true })).toMatch(/^other-1 · .* · thinking$/);
    const action = (kind: DebugActionKind) => actionTitle(create(DebugActionSchema, { kind }));
    expect(action(DebugActionKind.FIND_TASKS)).toBe("Find tasks");
    expect(action(DebugActionKind.WORDS)).toBe("Tutor's words");
    expect(action(DebugActionKind.CHECK)).toBe("Check");
    const at = new Date(2026, 10, 19, 15, 4, 5);
    expect(actionTime(create(DebugActionSchema, { at: timestampFromDate(at) }))).toBe("15:04:05");
    expect(actionTime(create(DebugActionSchema))).toBe("");
    const failed = (failure: Cause) => failureOf(create(DebugCallSchema, { failure }));
    expect(failed(Cause.LIMIT_REACHED)).toMatch(/CAUSE_LIMIT_REACHED/);
    expect(failed(Cause.PLATFORM_LIMIT)).toMatch(/CAUSE_PLATFORM_LIMIT/);
    expect(failed(Cause.AI_FAILURE)).toMatch(/CAUSE_AI_FAILURE/);
  });

  it("names the verdict of every slot api gives, so far correct among them", () => {
    expect(outcomeOf("correct")).toBe(DebugOutcome.CORRECT);
    expect(outcomeOf("not_yet")).toBe(DebugOutcome.NOT_YET);
    expect(outcomeOf("unreadable")).toBe(DebugOutcome.UNREADABLE);
    expect(outcomeOf("unchecked")).toBe(DebugOutcome.UNCHECKED);
    expect(outcomeOf("so_far_correct")).toBe(DebugOutcome.SO_FAR_CORRECT);
    expect(outcomeOf(undefined)).toBe(DebugOutcome.UNSPECIFIED);
    expect(OUTCOMES.map((o) => o.name)).toContain("so far");
  });
});

describe("the tab's memory", () => {
  it("is off for the session when api has no debug mode", async () => {
    const { client: c } = client({
      get: async () => {
        throw new ApiError({ kind: "stale" });
      },
    });
    await load(c);
    expect(snapshot().status).toBe("off");
  });

  it("is off for an account without the right", async () => {
    const { client: c } = client({
      get: async () => {
        throw new ApiError({ kind: "forbidden" });
      },
    });
    await load(c);
    expect(snapshot().status).toBe("off");
  });

  it("begins from nothing with another account, and asks for it", async () => {
    signedIn("a");
    const { client: c } = client({ get: async () => create(GetDebugResponseSchema, { models }) });
    await load(c);
    await take(
      client({
        take: async () =>
          create(TakeDebugCallsResponseSchema, {
            actions: [create(DebugActionSchema, { kind: DebugActionKind.CHECK })],
          }),
      }).client,
    );
    expect(snapshot().actions).toHaveLength(1);
    signedIn("b");
    await load(
      client({
        get: async () => {
          throw new ApiError({ kind: "forbidden" });
        },
      }).client,
    );
    expect(snapshot()).toMatchObject({ status: "off", actions: [], models: [] });
  });

  it("asks again after a failure that is no refusal, and holds what api answers", async () => {
    await load(
      client({
        get: async () => {
          throw new ApiError({ kind: "unknown", code: Code.Internal });
        },
      }).client,
    );
    expect(snapshot().status).toBe("unknown");
    const choice = create(DebugChoiceSchema, {
      first: create(DebugModelChoiceSchema, {
        model: haiku.id,
        effort: DebugEffort.HIGH,
        thinking: true,
      }),
    });
    await load(
      client({ get: async () => create(GetDebugResponseSchema, { models, choice }) }).client,
    );
    const now = snapshot();
    expect(now.status).toBe("on");
    expect(now.first).toEqual({ model: haiku.id, effort: DebugEffort.HIGH, thinking: true });
    await load(undefined);
    expect(snapshot().status).toBe("on");
  });

  it("forgets an asking under way once the tab's memory is reset", async () => {
    let answered: () => void = () => {};
    const asked = new Promise<void>((done) => (answered = done));
    const c = client({
      get: async () => {
        await asked;
        return create(GetDebugResponseSchema, { models });
      },
    }).client;
    const loaded = load(c);
    reset();
    answered();
    await loaded;
    // A new asking is not the one before.
    expect(load(c)).not.toBe(loaded);
  });

  it("does nothing with no client", async () => {
    await choose(undefined, { model: opus.id, effort: DebugEffort.LOW, thinking: true });
    await take(undefined);
    expect(snapshot().first).toBeUndefined();
    expect(snapshot().actions).toEqual([]);
  });

  it("sends a choice held to what its model takes, and shows what api holds or why it refused", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const held = create(SetDebugModelsResponseSchema, {
      choice: create(DebugChoiceSchema, {
        first: create(DebugModelChoiceSchema, {
          model: opus.id,
          effort: DebugEffort.LOW,
          thinking: true,
        }),
      }),
    });
    const { client: c, asked } = client({ set: async () => held });
    await choose(c, { model: opus.id, effort: DebugEffort.LOW, thinking: false });
    expect(asked).toHaveLength(1);
    // One model of every call: no second reader goes.
    const sent = asked[0] as { choice: { first: { thinking: boolean }; second?: unknown } };
    expect(sent.choice.first.thinking).toBe(true);
    expect(sent.choice.second).toBeUndefined();
    expect(snapshot().first?.model).toBe(opus.id);

    await choose(
      client({
        set: async () => {
          throw new Error("no");
        },
      }).client,
      undefined,
    );
    expect(snapshot().refused).toBe("no");
    // The window goes back to what api still holds.
    expect(snapshot().first?.model).toBe(opus.id);
  });

  it("sends the changes one at a time, and shows api's answer to the last", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const sent: string[] = [];
    let first: () => void = () => {};
    const answer = (model: string) =>
      create(SetDebugModelsResponseSchema, {
        choice: create(DebugChoiceSchema, {
          first: create(DebugModelChoiceSchema, { model, effort: DebugEffort.LOW, thinking: true }),
        }),
      });
    const c = {
      setDebugModels: async (req: { choice: { first: { model: string } } }) => {
        sent.push(req.choice.first.model);
        if (sent.length === 1) await new Promise<void>((done) => (first = done));
        return answer(req.choice.first.model);
      },
    } as unknown as DebugClient;
    const pick = (model: string) => ({ model, effort: DebugEffort.LOW, thinking: true });
    const one = choose(c, pick(opus.id));
    const two = choose(c, pick(haiku.id));
    await Promise.resolve();
    expect(sent).toEqual([opus.id]);
    first();
    await Promise.all([one, two]);
    expect(sent).toEqual([opus.id, haiku.id]);
    expect(snapshot().first?.model).toBe(haiku.id);
  });

  it("shows no refusal of a change that a later one followed, and a refusal that is no Error", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const pick = (model: string) => ({ model, effort: DebugEffort.LOW, thinking: true });
    const refusing = client({
      set: async () => {
        throw "refused";
      },
    }).client;
    const one = choose(refusing, undefined);
    const two = choose(refusing, pick(opus.id));
    await one;
    expect(snapshot().refused).toBeUndefined();
    await two;
    expect(snapshot().refused).toBe("refused");
  });

  it("joins the actions taken after each request, counts the session's calls and cost, and clears", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const action = create(DebugActionSchema, {
      kind: DebugActionKind.CHECK,
      attemptId: "a",
      calls: [
        create(DebugCallSchema, { kind: DebugCallKind.STATEMENT_READING, costMicroUsd: 100n }),
        create(DebugCallSchema, { kind: DebugCallKind.TASK_CHECKING, costMicroUsd: 300n }),
      ],
    });
    const taken = create(TakeDebugCallsResponseSchema, { actions: [action] });
    began();
    expect(snapshot().busy).toBe(1);
    await take(client({ take: async () => taken }).client);
    await take(
      client({
        take: async () => {
          throw new Error("down");
        },
      }).client,
    );
    const now = snapshot();
    expect(now.busy).toBe(0);
    expect(now.actions).toHaveLength(1);
    expect(callsOf(now.actions)).toHaveLength(2);
    expect(costOf(action.calls)).toBe(400n);
    expect(actionKey(action)).toBe(`${DebugActionKind.CHECK}-a-0-0`);
    clear();
    expect(snapshot().actions).toEqual([]);
  });

  it("counts a call begun while api is asked, and takes after its answer", async () => {
    let answered: () => void = () => {};
    const asked = new Promise<void>((done) => (answered = done));
    let taken = false;
    const c = client({
      get: async () => {
        await asked;
        throw new ApiError({ kind: "stale" });
      },
      take: async () => {
        taken = true;
        return create(TakeDebugCallsResponseSchema);
      },
    }).client;
    const loaded = load(c);
    expect(load(c)).toBe(loaded);
    began();
    expect(snapshot().busy).toBe(1);
    const took = take(c);
    answered();
    await took;
    expect(snapshot().status).toBe("off");
    expect(snapshot().busy).toBe(0);
    expect(taken).toBe(false);
  });

  it("takes nothing while api has no debug mode", async () => {
    let asked = false;
    await take(
      client({
        take: async () => {
          asked = true;
          return create(TakeDebugCallsResponseSchema);
        },
      }).client,
    );
    expect(asked).toBe(false);
  });
});

describe("the export of a Check", () => {
  const sent = {
    attemptId: "0a1b2c3d-attempt",
    statement: new Uint8Array([1, 2]),
    crop: new Uint8Array([3, 4]),
    instruction: new Uint8Array([5, 6]),
    outcomes: [outcomeOf("not_yet")],
  };
  const call = (kind: DebugCallKind, answer: string) => create(DebugCallSchema, { kind, answer });
  /** The model's JSON of a Check, its hidden solution and answer among it. */
  const checking = (...tasks: readonly object[]) =>
    call(
      DebugCallKind.TASK_CHECKING,
      JSON.stringify({ tasks, tutor_words: "Look again", hints: ["What is 7 + 8?", "Row 2"] }),
    );
  const first = create(DebugActionSchema, {
    kind: DebugActionKind.WORDS,
    attemptId: sent.attemptId,
    calls: [call(DebugCallKind.STATEMENT_READING, '{"tasks":[{"statement":"37 + 48 ="}]}')],
  });
  const second = create(DebugActionSchema, {
    kind: DebugActionKind.CHECK,
    attemptId: sent.attemptId,
    at: timestampFromDate(new Date("2026-11-19T15:04:05.250Z")),
    calls: [
      checking({ task: 1, verdict: "incorrect", read: "75", answer: "85", solution: "37+48=85" }),
    ],
  });
  const task = {
    statement: "37 + 48 =",
    read: "75",
    outcome: DebugOutcome.NOT_YET,
    checkVerdict: "incorrect",
    checkRead: "75",
  };

  it("begins from what the Check gave, the statement Recognise read on the attempt beside it", () => {
    expect(truthOf([first, second], second, sent)).toEqual({ tasks: [task], note: "" });
    expect(truthOf([first, second], second, undefined).tasks[0]?.outcome).toBe(
      DebugOutcome.UNSPECIFIED,
    );
    // Of the attempts of a call, the last that answered is what it gave.
    const tried = create(DebugActionSchema, {
      kind: DebugActionKind.CHECK,
      attemptId: sent.attemptId,
      calls: [
        checking({ task: 1, verdict: "unreadable", read: "" }),
        checking({ task: 1, verdict: "correct", read: "85" }),
        { ...checking({ task: 1, verdict: "no_answer" }), failure: Cause.AI_FAILURE },
      ],
    });
    expect(truthOf([tried], tried, sent).tasks).toMatchObject([
      { statement: "", read: "85", checkVerdict: "correct", checkRead: "85" },
    ]);
  });

  it("begins a frame of several tasks with each, by its number, and its verdict", () => {
    const several = create(DebugActionSchema, {
      kind: DebugActionKind.CHECK,
      attemptId: "another",
      calls: [
        checking(
          { task: 2, verdict: "no_answer", read: "3 + 4" },
          { task: 1, verdict: "correct", read: "85" },
        ),
      ],
    });
    const outcomes = [DebugOutcome.CORRECT, DebugOutcome.SO_FAR_CORRECT];
    expect(truthOf([several], several, { ...sent, outcomes }).tasks).toEqual([
      {
        statement: "",
        read: "85",
        outcome: DebugOutcome.CORRECT,
        checkVerdict: "correct",
        checkRead: "85",
      },
      {
        statement: "",
        read: "3 + 4",
        outcome: DebugOutcome.SO_FAR_CORRECT,
        checkVerdict: "no_answer",
        checkRead: "3 + 4",
      },
    ]);
    // With no Check that answered, as many tasks as api gave verdicts, one at least.
    expect(truthOf([first], first, { ...sent, outcomes }).tasks).toHaveLength(2);
    expect(truthOf([first], first, undefined).tasks).toHaveLength(1);
    // An action the log no longer holds is its own attempt alone; one with no answer reads nothing.
    expect(truthOf([], second, sent).tasks).toEqual([{ ...task, statement: "" }]);
    const unread = create(DebugActionSchema, {
      kind: DebugActionKind.CHECK,
      attemptId: "u",
      calls: [call(DebugCallKind.TASK_CHECKING, "not json")],
    });
    expect(truthOf([unread], unread, undefined).tasks).toMatchObject([
      { read: "", statement: "", checkVerdict: "" },
    ]);
  });

  it("writes a case of tutor-eval with the work sent, the truth corrected and what the Check gave", () => {
    const truth = {
      tasks: [{ ...task, read: " 85 ", outcome: DebugOutcome.CORRECT }],
      note: "misread 85",
    };
    const file = exportOf(second, sent, truth);
    if ("error" in file) throw new Error(file.error);
    expect(file.name).toBe("case-20261119T150405-0a1b2c3d.json");
    const back = fromJsonString(DebugCaseSchema, file.json);
    expect(back.work?.statement).toEqual(sent.statement);
    expect(back.work?.crop).toEqual(sent.crop);
    expect(back.work?.instruction).toEqual(sent.instruction);
    const [one] = back.tasks;
    expect(one?.statement).toBe("37 + 48 =");
    expect(one?.formula).toBe("");
    expect(one?.key).toBeUndefined();
    expect(one?.read).toBe("85");
    expect(one?.outcome).toBe(DebugOutcome.CORRECT);
    expect(one?.checkVerdict).toBe("incorrect");
    expect(one?.checkRead).toBe("75");
    expect(back.note).toBe("misread 85");
    expect(back.action?.calls).toHaveLength(1);

    const with_ = (change: Partial<typeof task>) =>
      ({ ...truth, tasks: [{ ...truth.tasks[0], ...change }] }) as typeof truth;
    // A statement is the developer's to give or not: the Check reads the crop itself.
    expect(exportOf(second, sent, with_({ statement: " " }))).not.toHaveProperty("error");
    expect(exportOf(second, sent, with_({ outcome: DebugOutcome.UNSPECIFIED }))).toEqual({
      error: "Choose the verdict each task should get.",
    });
    expect(exportOf(second, sent, { ...truth, tasks: [] })).toHaveProperty("error");
    // A Check with no instruction sends none, an action with no instant is named by the clock's start.
    const { instruction: _, ...plain } = sent;
    const undated = exportOf(first, plain, truth);
    if ("error" in undated) throw new Error(undated.error);
    expect(undated.name).toBe("case-19700101T000000-0a1b2c3d.json");
    expect(fromJsonString(DebugCaseSchema, undated.json).work?.instruction).toHaveLength(0);
    const two = exportOf(second, sent, {
      ...truth,
      tasks: [truth.tasks[0], { ...task, outcome: DebugOutcome.SO_FAR_CORRECT }],
    } as typeof truth);
    if ("error" in two) throw new Error(two.error);
    expect(fromJsonString(DebugCaseSchema, two.json).tasks.map((t) => t.outcome)).toEqual([
      DebugOutcome.CORRECT,
      DebugOutcome.SO_FAR_CORRECT,
    ]);
  });

  it("keeps what a Check sent by its action, and forgets it with the log", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const taken = create(TakeDebugCallsResponseSchema, { actions: [second] });
    await take(client({ take: async () => taken }).client, sent);
    expect(snapshot().sent.get(actionKey(second))).toBe(sent);
    clear();
    expect(snapshot().sent.size).toBe(0);
  });

  it("keeps the learner's request by its finding, and forgets it with the log", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const finding = create(DebugActionSchema, { kind: DebugActionKind.FIND_TASKS });
    const taken = create(TakeDebugCallsResponseSchema, { actions: [finding] });
    await take(client({ take: async () => taken }).client, undefined, "only the first column");
    expect(snapshot().asked.get(actionKey(finding))).toBe("only the first column");
    clear();
    expect(snapshot().asked.size).toBe(0);
  });
});
