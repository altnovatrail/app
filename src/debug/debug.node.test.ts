// The debug mode of a local run (R72): what the window writes of the models and the calls, and the
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
  answerOf,
  began,
  callLine,
  callTitle,
  choose,
  clear,
  costOf,
  type DebugClient,
  exportOf,
  failureOf,
  fitted,
  joinOf,
  load,
  modelCalls,
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

const haiku = create(DebugModelSchema, {
  id: "claude-haiku-5-5",
  name: "Haiku 5.5",
  inputMicroUsd: 100_000n,
  outputMicroUsd: 500_000n,
  thinkingOffEfforts: [DebugEffort.LOW, DebugEffort.MEDIUM, DebugEffort.HIGH],
});
const opus = create(DebugModelSchema, { id: "claude-opus-5-5", name: "Opus 5.5" });
const models = [haiku, opus];
const SECOND_PICK = { model: haiku.id, effort: DebugEffort.LOW, thinking: false };

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

  it("names a call by what it did, its reader and its model as the provider gave it back", () => {
    const read = create(DebugCallSchema, {
      kind: DebugCallKind.WORK_READING,
      reader: 2,
      model: "claude-haiku-5-5-20261101",
      effort: DebugEffort.LOW,
      thinking: false,
      answer: '{"a":1}',
      costMicroUsd: 20n,
      inputTokens: 1200n,
    });
    expect(callTitle(read)).toBe("Read the work · reader 2");
    expect(callLine(models, read)).toBe("Haiku 5.5 · low · no thinking");
    expect(answerOf(read)).toBe('{\n  "a": 1\n}');
    expect(statsOf(read)[0]).toEqual({ k: "Input", v: "1,200" });
    const solver = create(DebugCallSchema, { kind: DebugCallKind.SOLVER, answer: "not json" });
    expect(callLine(models, solver)).toBe("module-kit · no AI");
    expect(answerOf(solver)).toBe("not json");
    expect(statsOf(solver).map((s) => s.k)).toEqual(["Time", "Cost"]);
    expect(failureOf(create(DebugCallSchema, { failure: Cause.KEY_REFUSED }))).toMatch(
      /KEY_REFUSED/,
    );
    expect(failureOf(solver)).toBe("");
  });

  it("says how two readers came out, and nothing of one", () => {
    const reading = (reader: number) =>
      create(DebugCallSchema, { kind: DebugCallKind.WORK_READING, reader });
    const two = create(DebugActionSchema, { calls: [reading(1), reading(2)], readersDiffer: true });
    expect(joinOf(two)).toMatch(/unreadable/);
    expect(joinOf({ ...two, readersDiffer: false })).toBe("Both readers agree.");
    expect(joinOf(create(DebugActionSchema, { calls: [reading(0)] }))).toBe("");
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
      second: create(DebugModelChoiceSchema, {
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
    expect(now.first).toBeUndefined();
    expect(now.secondOn).toBe(true);
    expect(now.second).toEqual({ model: haiku.id, effort: DebugEffort.HIGH, thinking: true });
    await load(undefined);
    expect(snapshot().status).toBe("on");
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
    const second = { model: haiku.id, effort: DebugEffort.LOW, thinking: false };
    await choose(c, { model: opus.id, effort: DebugEffort.LOW, thinking: false }, second, false);
    expect(asked).toHaveLength(1);
    const sent = asked[0] as { choice: { first: { thinking: boolean }; second?: unknown } };
    expect(sent.choice.first.thinking).toBe(true);
    expect(sent.choice.second).toBeUndefined();
    expect(snapshot().first?.model).toBe(opus.id);
    expect(snapshot().second).toEqual(second);

    await choose(
      client({
        set: async () => {
          throw new Error("no");
        },
      }).client,
      undefined,
      second,
      true,
    );
    expect(snapshot().refused).toBe("no");
    // The window goes back to what api still holds.
    expect(snapshot().first?.model).toBe(opus.id);
    expect(snapshot().secondOn).toBe(false);
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
    const one = choose(c, pick(opus.id), SECOND_PICK, false);
    const two = choose(c, pick(haiku.id), SECOND_PICK, false);
    await Promise.resolve();
    expect(sent).toEqual([opus.id]);
    first();
    await Promise.all([one, two]);
    expect(sent).toEqual([opus.id, haiku.id]);
    expect(snapshot().first?.model).toBe(haiku.id);
  });

  it("joins the actions taken after each request, counts the session's calls and cost, and clears", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const action = create(DebugActionSchema, {
      kind: DebugActionKind.CHECK,
      attemptId: "a",
      calls: [
        create(DebugCallSchema, { kind: DebugCallKind.STATEMENT_READING, costMicroUsd: 100n }),
        create(DebugCallSchema, { kind: DebugCallKind.SOLVER }),
        create(DebugCallSchema, { kind: DebugCallKind.WORK_READING, costMicroUsd: 300n }),
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
    expect(modelCalls(now.actions)).toBe(2);
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
    outcome: outcomeOf("unreadable"),
  };
  const call = (kind: DebugCallKind, answer: string, reader = 0) =>
    create(DebugCallSchema, { kind, answer, reader });
  const first = create(DebugActionSchema, {
    kind: DebugActionKind.CHECK,
    attemptId: sent.attemptId,
    calls: [
      call(DebugCallKind.STATEMENT_READING, '{"formula":"37+48"}'),
      call(DebugCallKind.SOLVER, '{"number":{"value":"85"}}'),
      call(DebugCallKind.WORK_READING, '{"results":[{"part":1,"value":"35"}]}', 1),
    ],
  });
  const second = create(DebugActionSchema, {
    kind: DebugActionKind.CHECK,
    attemptId: sent.attemptId,
    at: timestampFromDate(new Date("2026-11-19T15:04:05.250Z")),
    calls: [call(DebugCallKind.WORK_READING, '{"results":[{"part":1,"value":"36"}]}', 1)],
  });

  it("begins from what the calls gave, the key of an earlier Check of the attempt among them", () => {
    expect(truthOf([first, second], second, sent)).toEqual({
      formula: "37+48",
      key: '{"number":{"value":"85"}}',
      read: "36",
      outcome: DebugOutcome.UNREADABLE,
      note: "",
    });
    expect(truthOf([first], first, undefined).outcome).toBe(DebugOutcome.UNSPECIFIED);
    expect(outcomeOf("no such")).toBe(DebugOutcome.UNSPECIFIED);
  });

  it("writes a case of tutor-eval with the work sent and the truth corrected, or says why not", () => {
    const truth = {
      ...truthOf([first, second], second, sent),
      read: " 85 ",
      outcome: DebugOutcome.CORRECT,
      note: "misread 85",
    };
    const file = exportOf(second, sent, truth);
    if ("error" in file) throw new Error(file.error);
    expect(file.name).toBe("case-20261119T150405-0a1b2c3d.json");
    const back = fromJsonString(DebugCaseSchema, file.json);
    expect(back.work?.statement).toEqual(sent.statement);
    expect(back.work?.crop).toEqual(sent.crop);
    expect(back.formula).toBe("37+48");
    expect(back.key?.kind.case).toBe("number");
    expect(back.read).toBe("85");
    expect(back.outcome).toBe(DebugOutcome.CORRECT);
    expect(back.note).toBe("misread 85");
    expect(back.action?.calls).toHaveLength(1);

    expect(exportOf(second, sent, { ...truth, key: "" })).not.toHaveProperty("error");
    expect(exportOf(second, sent, { ...truth, key: "{oops" })).toHaveProperty("error");
    expect(exportOf(second, sent, { ...truth, outcome: DebugOutcome.UNSPECIFIED })).toEqual({
      error: "Choose the verdict it should get.",
    });
  });

  it("keeps what a Check sent by its action, and forgets it with the log", async () => {
    await load(client({ get: async () => create(GetDebugResponseSchema, { models }) }).client);
    const taken = create(TakeDebugCallsResponseSchema, { actions: [second] });
    await take(client({ take: async () => taken }).client, sent);
    expect(snapshot().sent.get(actionKey(second))).toBe(sent);
    clear();
    expect(snapshot().sent.size).toBe(0);
  });
});
