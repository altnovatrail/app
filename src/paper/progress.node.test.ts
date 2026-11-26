// The progress of a Check still going: when it is asked, what of its answers the card takes, that a
// failure is quiet and a stop ends it; and the names of the track, for the debug mode alone.
import {
  DebugAdmittedSchema,
  DebugCallKind,
  DebugChoiceSchema,
  DebugEffort,
  DebugModelChoiceSchema,
  DebugModelSchema,
  GetDebugResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create } from "@bufbuild/protobuf";
import { afterEach, describe, expect, it } from "vitest";
import { type DebugClient, load, reset } from "../debug/debug.ts";
import {
  type AskProgress,
  type Closer,
  PROGRESS_EVERY_MS,
  PROGRESS_FIRST_MS,
  type Timers,
  trackNames,
  watchProgress,
} from "./progress.ts";

/** Timers a test runs by hand: each set one waits for `run`, with its delay. */
function handTimers() {
  const due: { run: () => void; ms: number; cleared: boolean }[] = [];
  const timers: Timers = {
    set: (run, ms) => {
      const t = { run, ms, cleared: false };
      due.push(t);
      return t;
    },
    clear: (t) => {
      (t as { cleared: boolean }).cleared = true;
    },
  };
  /** Runs the last timer set, and lets the question it asks answer. */
  const fire = async () => {
    const t = due.at(-1);
    if (t === undefined || t.cleared) throw new Error("no timer is due");
    t.run();
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  return { timers, due, fire };
}

const on = { profileId: "p", attemptId: "a" };

describe("the progress of a Check", () => {
  it("asks first after PROGRESS_FIRST_MS and then each PROGRESS_EVERY_MS, one at a time", async () => {
    const { timers, due, fire } = handTimers();
    const answers = [
      { going: true, model: 0, models: 0 },
      { going: true, model: 1, models: 3 },
      { going: true, model: 2, models: 3 },
    ];
    const asked: unknown[] = [];
    const ask: AskProgress = async (request, options) => {
      asked.push({ request, timeoutMs: options.timeoutMs });
      const a = answers.shift();
      if (a === undefined) throw new Error("asked too often");
      return a;
    };
    const told: Closer[] = [];
    const stop = watchProgress(
      ask,
      () => on,
      (c) => told.push(c),
      timers,
    );
    expect(due.map((t) => t.ms)).toEqual([PROGRESS_FIRST_MS]);
    expect(asked).toHaveLength(0);
    await fire();
    expect(asked).toEqual([{ request: on, timeoutMs: PROGRESS_EVERY_MS * 2 }]);
    expect(told).toEqual([]);
    await fire();
    await fire();
    expect(due.map((t) => t.ms)).toEqual([
      PROGRESS_FIRST_MS,
      PROGRESS_EVERY_MS,
      PROGRESS_EVERY_MS,
      PROGRESS_EVERY_MS,
    ]);
    expect(told).toEqual([
      { model: 1, models: 3 },
      { model: 2, models: 3 },
    ]);
    stop();
    expect(due.at(-1)?.cleared).toBe(true);
  });

  it("takes no answer of a Check not going, or of a place past the list", async () => {
    const { timers, fire } = handTimers();
    const answers = [
      { going: false, model: 0, models: 0 },
      { going: false, model: 1, models: 3 },
      { going: true, model: 3, models: 3 },
    ];
    const told: Closer[] = [];
    watchProgress(
      async () => answers.shift() ?? { going: false, model: 0, models: 0 },
      () => on,
      (c) => told.push(c),
      timers,
    );
    await fire();
    await fire();
    await fire();
    expect(told).toEqual([]);
  });

  it("asks nothing before the attempt is known, and again after a failure", async () => {
    const { timers, fire } = handTimers();
    let attempt: typeof on | undefined;
    let asked = 0;
    const told: Closer[] = [];
    watchProgress(
      async () => {
        asked += 1;
        if (asked === 1) throw new Error("down");
        return { going: true, model: 1, models: 2 };
      },
      () => attempt,
      (c) => told.push(c),
      timers,
    );
    await fire();
    expect(asked).toBe(0);
    attempt = on;
    await fire();
    expect(asked).toBe(1);
    expect(told).toEqual([]);
    await fire();
    expect(told).toEqual([{ model: 1, models: 2 }]);
  });

  it("lets the question under way finish once stopped, and tells nothing of it", async () => {
    const { timers, due, fire } = handTimers();
    let answer: (a: { going: boolean; model: number; models: number }) => void = () => {};
    const told: Closer[] = [];
    const stop = watchProgress(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        }),
      () => on,
      (c) => told.push(c),
      timers,
    );
    await fire();
    stop();
    answer({ going: true, model: 1, models: 3 });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(told).toEqual([]);
    expect(due).toHaveLength(1);
  });
});

describe("the names of the track", () => {
  afterEach(() => reset());

  const debugAnswer = (first?: string) =>
    create(GetDebugResponseSchema, {
      models: [
        create(DebugModelSchema, { id: "claude-haiku-5-5", name: "Haiku 5.5" }),
        create(DebugModelSchema, { id: "claude-sonnet-5-5", name: "Sonnet 5.5" }),
      ],
      admitted: [
        create(DebugAdmittedSchema, {
          kind: DebugCallKind.TASK_FINDING,
          model: create(DebugModelChoiceSchema, { model: "claude-haiku-5-5" }),
        }),
        ...["claude-haiku-5-5", "claude-sonnet-5-5"].map((model) =>
          create(DebugAdmittedSchema, {
            kind: DebugCallKind.TASK_CHECKING,
            model: create(DebugModelChoiceSchema, { model, effort: DebugEffort.MEDIUM }),
          }),
        ),
      ],
      ...(first === undefined
        ? {}
        : {
            choice: create(DebugChoiceSchema, {
              first: create(DebugModelChoiceSchema, { model: first }),
            }),
          }),
    });
  const withDebug = (answer: ReturnType<typeof debugAnswer>) =>
    ({
      getDebug: async () => answer,
    }) as unknown as DebugClient;

  it("are none without the debug mode", async () => {
    expect(await trackNames(2, false)).toBeUndefined();
  });

  it("are the Check's models as admitted, short on a narrow screen, as many as api counts", async () => {
    await load(withDebug(debugAnswer()));
    expect(await trackNames(2, false)).toEqual(["Haiku 5.5", "Sonnet 5.5"]);
    expect(await trackNames(2, true)).toEqual(["Haiku", "Sonnet"]);
    expect(await trackNames(3, false)).toBeUndefined();
  });

  it("are none while the account chose a model of its own", async () => {
    await load(withDebug(debugAnswer("claude-sonnet-5-5")));
    expect(await trackNames(2, false)).toBeUndefined();
  });
});
