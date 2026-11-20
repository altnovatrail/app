// The debug mode of a local run with models (R163 spec; R72): which models check a task from paper,
// what each call returned and what it cost. app loads this module only under import.meta.env.DEV,
// which a release's build replaces with false, and shows the mode only once api's `GetDebug`
// answers, which it does only with its debug flag. The choice is api's; the calls taken from api and
// the sum since the session began are the tab's memory alone, and go at a reload.

import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type DebugAction,
  DebugActionKind,
  type DebugAdmitted,
  type DebugCall,
  DebugCallKind,
  DebugCaseSchema,
  type DebugChoice,
  DebugChoiceSchema,
  DebugEffort,
  type DebugModel,
  type DebugModelChoice,
  DebugModelChoiceSchema,
  DebugOutcome,
  type DebugService,
  type DebugTask,
  DebugTaskSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create, fromJsonString, toJsonString } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Client } from "@connectrpc/connect";
import { ApiError } from "../api/failure.ts";

export type DebugClient = Client<typeof DebugService>;

/** A model chosen, as the window edits it. */
export interface Pick {
  readonly model: string;
  readonly effort: DebugEffort;
  readonly thinking: boolean;
}

/**
 * What a Check sent, and the verdict api gave each task of its frame, in the frame's order, which
 * the export of its action holds.
 */
export interface Sent {
  readonly attemptId: string;
  readonly statement: Uint8Array;
  readonly crop: Uint8Array;
  readonly outcomes: readonly DebugOutcome[];
}

export interface DebugState {
  /** Whether api has the mode: unknown until `GetDebug` answers, off when it refuses. */
  readonly status: "unknown" | "loading" | "on" | "off";
  readonly models: readonly DebugModel[];
  readonly admitted: readonly DebugAdmitted[];
  /** The first model, none as admitted. */
  readonly first: Pick | undefined;
  /** The second reader, and whether it reads: the window keeps the model while it is off. */
  readonly second: Pick;
  readonly secondOn: boolean;
  /** The actions taken from api since the session began, oldest first. */
  readonly actions: readonly DebugAction[];
  /** What each Check of the log sent, by the key of its action. */
  readonly sent: ReadonlyMap<string, Sent>;
  /** The learner's request of each finding that had one, by the key of its action, from the tab. */
  readonly asked: ReadonlyMap<string, string>;
  /** A call of a task from paper is under way. */
  readonly busy: number;
  /** What the last change of the choice came to, when api refused it. */
  readonly refused: string | undefined;
}

/** The second reader before one is chosen: Sonnet at low, as the mockup's window has it. */
const SECOND: Pick = { model: "claude-sonnet-5-5", effort: DebugEffort.LOW, thinking: true };

export const EFFORTS: readonly DebugEffort[] = [
  DebugEffort.LOW,
  DebugEffort.MEDIUM,
  DebugEffort.HIGH,
  DebugEffort.XHIGH,
  DebugEffort.MAX,
];

export function effortName(effort: DebugEffort): string {
  switch (effort) {
    case DebugEffort.LOW:
      return "low";
    case DebugEffort.HIGH:
      return "high";
    case DebugEffort.XHIGH:
      return "xhigh";
    case DebugEffort.MAX:
      return "max";
    default:
      return "medium";
  }
}

const initial: DebugState = {
  status: "unknown",
  models: [],
  admitted: [],
  first: undefined,
  second: SECOND,
  secondOn: false,
  actions: [],
  sent: new Map(),
  asked: new Map(),
  busy: 0,
  refused: undefined,
};

let state = initial;
/** The choice api last confirmed, which a refused change goes back to. */
let confirmed: DebugChoice | undefined;
/** Changes of the choice go to api one at a time, so that api ends on the last. */
let sending: Promise<void> = Promise.resolve();
let changes = 0;
/** GetDebug under way, which a call of a task from paper waits for before it takes. */
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function set(change: (now: DebugState) => DebugState): void {
  state = change(state);
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshot(): DebugState {
  return state;
}

/** The state forgotten, for the tests. */
export function reset(): void {
  confirmed = undefined;
  sending = Promise.resolve();
  changes = 0;
  loading = undefined;
  set(() => initial);
}

function pickOf(c: DebugModelChoice | undefined): Pick | undefined {
  return c === undefined ? undefined : { model: c.model, effort: c.effort, thinking: c.thinking };
}

function choiceOf(p: Pick | undefined): DebugModelChoice | undefined {
  return p === undefined ? undefined : create(DebugModelChoiceSchema, p);
}

function held(now: DebugState, choice: DebugChoice | undefined): DebugState {
  const second = pickOf(choice?.second);
  return {
    ...now,
    first: pickOf(choice?.first),
    second: second ?? now.second,
    secondOn: second !== undefined,
  };
}

/**
 * Asks api once a session whether it has the mode, or joins the asking under way; after a failure
 * other than a refusal, the next call asks again.
 */
export function load(client: DebugClient | undefined): Promise<void> {
  if (client === undefined) return Promise.resolve();
  if (loading !== undefined) return loading;
  if (state.status !== "unknown") return Promise.resolve();
  set((now) => ({ ...now, status: "loading" }));
  const asked = ask(client);
  loading = asked;
  void asked.then(() => {
    if (loading === asked) loading = undefined;
  });
  return asked;
}

async function ask(client: DebugClient): Promise<void> {
  try {
    const answer = await client.getDebug({});
    confirmed = answer.choice;
    set((now) => ({
      ...held(now, answer.choice),
      status: "on",
      models: answer.models,
      admitted: answer.admitted,
    }));
  } catch (reason) {
    // unimplemented is api without its flag, for the session; anything else may answer later.
    const absent = reason instanceof ApiError && reason.failure.kind === "stale";
    set((now) => ({ ...now, status: absent ? "off" : "unknown" }));
  }
}

/** The model of the catalog by its ID. */
export function modelOf(models: readonly DebugModel[], id: string): DebugModel | undefined {
  return models.find((m) => m.id === id);
}

/** Thinking stays on for a model that cannot turn it off, and at an effort above its own. */
export function thinkingFixed(model: DebugModel | undefined, effort: DebugEffort): boolean {
  return model === undefined || !model.thinkingOffEfforts.includes(effort);
}

/** A pick held to what its model takes: thinking on where it cannot be off. */
export function fitted(models: readonly DebugModel[], p: Pick): Pick {
  return thinkingFixed(modelOf(models, p.model), p.effort) ? { ...p, thinking: true } : p;
}

/**
 * Sets the choice at api; the window shows what api holds after the last change, or why it refused
 * it and the choice api still holds.
 */
export function choose(
  client: DebugClient | undefined,
  first: Pick | undefined,
  second: Pick,
  secondOn: boolean,
): Promise<void> {
  if (client === undefined) return Promise.resolve();
  const held_ = (p: Pick) => fitted(state.models, p);
  // The window shows the change at once, and api's answer after.
  set((now) => ({
    ...now,
    first: first === undefined ? undefined : held_(first),
    second: held_(second),
    secondOn,
    refused: undefined,
  }));
  const choice = create(DebugChoiceSchema, {
    first: choiceOf(first === undefined ? undefined : held_(first)),
    second: choiceOf(secondOn ? held_(second) : undefined),
  });
  const change = ++changes;
  sending = sending.then(async () => {
    try {
      const answer = await client.setDebugModels({ choice });
      confirmed = answer.choice;
      if (change === changes) set((now) => held(now, confirmed));
    } catch (reason) {
      const refused = reason instanceof Error ? reason.message : String(reason);
      if (change === changes) set((now) => ({ ...held(now, confirmed), refused }));
    }
  });
  return sending;
}

/** A call of a task from paper begins: the button shows it under way. */
export function began(): void {
  if (state.status === "on" || state.status === "loading")
    set((now) => ({ ...now, busy: now.busy + 1 }));
}

/**
 * After a call of a task from paper: the actions since the last take join the session's, and a
 * Check's action holds what it sent, and a finding's the learner's request.
 */
export async function take(
  client: DebugClient | undefined,
  sent?: Sent,
  request?: string,
): Promise<void> {
  if (client === undefined) return;
  if (loading !== undefined) await loading;
  if (state.status !== "on") {
    // Begun while api was asked, which then had no mode.
    if (state.busy > 0) set((now) => ({ ...now, busy: now.busy - 1 }));
    return;
  }
  try {
    const answer = await client.takeDebugCalls({});
    const check = [...answer.actions]
      .reverse()
      .find((a) => a.kind === DebugActionKind.CHECK && a.attemptId === sent?.attemptId);
    const finding = [...answer.actions]
      .reverse()
      .find((a) => a.kind === DebugActionKind.FIND_TASKS);
    set((now) => ({
      ...now,
      actions: [...now.actions, ...answer.actions],
      sent:
        check === undefined || sent === undefined
          ? now.sent
          : new Map([...now.sent, [actionKey(check), sent]]),
      asked:
        finding === undefined || request === undefined
          ? now.asked
          : new Map([...now.asked, [actionKey(finding), request]]),
      busy: Math.max(0, now.busy - 1),
    }));
  } catch {
    set((now) => ({ ...now, busy: Math.max(0, now.busy - 1) }));
  }
}

/** The log forgotten; the choice stays. */
export function clear(): void {
  set((now) => ({ ...now, actions: [], sent: new Map(), asked: new Map() }));
}

/** Micro-dollars as the window writes them: five places below a cent, four from it. */
export function usd(micro: bigint | number): string {
  const dollars = Number(micro) / 1e6;
  return `$${dollars < 0.01 ? dollars.toFixed(5) : dollars.toFixed(4)}`;
}

/** A price per million tokens, in micro-dollars, as the menu of models writes it. */
export function perMtok(micro: bigint): string {
  return `$${(Number(micro) / 1e6).toFixed(2)}`;
}

export function costOf(calls: readonly DebugCall[]): bigint {
  return calls.reduce((sum, c) => sum + c.costMicroUsd, 0n);
}

export function callsOf(actions: readonly DebugAction[]): readonly DebugCall[] {
  return actions.flatMap((a) => a.calls);
}

/** The calls of a model, the solver's left out. */
export function modelCalls(actions: readonly DebugAction[]): number {
  return callsOf(actions).filter((c) => c.kind !== DebugCallKind.SOLVER).length;
}

export function callName(kind: DebugCallKind): string {
  switch (kind) {
    case DebugCallKind.TASK_FINDING:
      return "Find tasks";
    case DebugCallKind.STATEMENT_READING:
      return "Statement";
    case DebugCallKind.SOLVER:
      return "Solver";
    case DebugCallKind.TASK_SOLVING:
      return "Solution";
    case DebugCallKind.WORK_READING:
      return "Read the work";
    case DebugCallKind.TUTOR_WORDS:
      return "Tutor's words";
    default:
      return "Call";
  }
}

/** A call's title: what it did, its reader beside two, and its attempt after the first (R73). */
export function callTitle(call: DebugCall): string {
  const reader = call.reader > 0 ? ` · reader ${call.reader}` : "";
  const attempt = call.attempt > 1 ? ` · attempt ${call.attempt}` : "";
  return `${callName(call.kind)}${reader}${attempt}`;
}

/** The name of a model by the catalog, or its ID as the provider gave it back. */
export function modelName(models: readonly DebugModel[], id: string): string {
  const known = models.find((m) => id === m.id || id.startsWith(`${m.id}-`));
  return known?.name ?? id;
}

/** The line under a call's title: the model, its effort and whether it thought. */
export function callLine(models: readonly DebugModel[], call: DebugCall): string {
  if (call.kind === DebugCallKind.SOLVER) return "module-kit · no AI";
  return `${modelName(models, call.model)} · ${effortName(call.effort)} · ${call.thinking ? "thinking" : "no thinking"}`;
}

export function actionTitle(action: DebugAction): string {
  switch (action.kind) {
    case DebugActionKind.FIND_TASKS:
      return "Find tasks";
    case DebugActionKind.WORDS:
      return "Tutor's words";
    default:
      return "Check";
  }
}

/** An action's key in the log: one request, at the instant api took it. */
export function actionKey(action: DebugAction): string {
  return `${action.kind}-${action.attemptId}-${action.at?.seconds ?? 0n}-${action.at?.nanos ?? 0}`;
}

/** When api took the action, as the clock of the tab tells it. */
export function actionTime(action: DebugAction): string {
  return action.at === undefined ? "" : timestampDate(action.at).toLocaleTimeString("en-GB");
}

export function took(ms: bigint): string {
  const n = Number(ms);
  return n < 100 ? `${n} ms` : `${(n / 1000).toFixed(1)} s`;
}

/** The figures of a call that opens. */
export function statsOf(call: DebugCall): readonly { readonly k: string; readonly v: string }[] {
  const n = (v: bigint | number) => Number(v).toLocaleString("en-US");
  if (call.kind === DebugCallKind.SOLVER) {
    return [
      { k: "Time", v: took(call.durationMs) },
      { k: "Cost", v: "$0" },
    ];
  }
  return [
    { k: "Input", v: n(call.inputTokens) },
    { k: "Cache read", v: n(call.cacheReadTokens) },
    { k: "Cache write", v: n(call.cacheWriteTokens) },
    { k: "Output", v: n(call.outputTokens) },
    { k: "Thinking", v: n(call.thinkingTokens) },
    { k: "Retries", v: String(call.retries) },
    {
      k: "Time · first token",
      v: `${took(call.durationMs)} · ${took(call.firstTokenMs)}`,
    },
    { k: "Billed", v: call.billed ? "whole" : "worst" },
  ];
}

/** What a call returned, indented when it is JSON, as it came when it is not. */
export function answerOf(call: DebugCall): string {
  if (call.answer === "") return "";
  try {
    return JSON.stringify(JSON.parse(call.answer), null, 2);
  } catch {
    return call.answer;
  }
}

/** What a call that gave no answer came to. */
export function failureOf(call: DebugCall): string {
  switch (call.failure) {
    case Cause.UNSPECIFIED:
      return "";
    case Cause.LIMIT_REACHED:
      return "The own key's limit (CAUSE_LIMIT_REACHED).";
    case Cause.PLATFORM_LIMIT:
      return "The platform's limit (CAUSE_PLATFORM_LIMIT).";
    case Cause.KEY_REFUSED:
      return "The key was refused (CAUSE_KEY_REFUSED).";
    default:
      return "The call failed (CAUSE_AI_FAILURE).";
  }
}

/** How the two readers of an action came out, beside a second reader. */
export function joinOf(action: DebugAction): string {
  const readers = new Set(
    action.calls.filter((c) => c.kind === DebugCallKind.WORK_READING).map((c) => c.reader),
  ).size;
  if (readers < 2) return "";
  return action.readersDiffer
    ? "The readers read a place differently: it is unreadable (R68)."
    : "Both readers agree.";
}

/** The verdict of a slot as api gives it, as a case of the debug mode names it. */
export function outcomeOf(verdict: string | undefined): DebugOutcome {
  switch (verdict) {
    case "correct":
      return DebugOutcome.CORRECT;
    case "not_yet":
      return DebugOutcome.NOT_YET;
    case "unreadable":
      return DebugOutcome.UNREADABLE;
    case "unchecked":
      return DebugOutcome.UNCHECKED;
    default:
      return DebugOutcome.UNSPECIFIED;
  }
}

export const OUTCOMES: readonly { readonly outcome: DebugOutcome; readonly name: string }[] = [
  { outcome: DebugOutcome.CORRECT, name: "correct" },
  { outcome: DebugOutcome.NOT_YET, name: "not yet" },
  { outcome: DebugOutcome.UNREADABLE, name: "unreadable" },
  { outcome: DebugOutcome.UNCHECKED, name: "unchecked" },
];

/**
 * The truth of one task of an exported Check, as the developer edits it: the key as the JSON of its
 * Answer.
 */
export interface TaskTruth {
  readonly statement: string;
  readonly formula: string;
  readonly key: string;
  readonly read: string;
  readonly outcome: DebugOutcome;
}

/** The truth of an exported Check: each task of its frame, in the frame's order, and a note. */
export interface Truth {
  readonly tasks: readonly TaskTruth[];
  readonly note: string;
}

function parsed(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return undefined;
  }
}

/** A list a value of a call's answer holds under a name, of objects alone; none when it holds none. */
function listOf(value: unknown, name: string): Record<string, unknown>[] {
  const list =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)[name]
      : undefined;
  if (!Array.isArray(list)) return [];
  return list.filter(
    (each): each is Record<string, unknown> => typeof each === "object" && each !== null,
  );
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * The truth an export begins from, what the calls gave (R162 spec): the tasks the statement was read
 * into, each with its formula, and the solver's key, of this Check or of an earlier one of the
 * attempt, since a later Check keeps the key; the value the first reader read for each task; and the
 * verdict api gave each. Of a call's attempts, the last that answered is what the call gave (R73).
 * A frame whose statement no call read has as many tasks as api gave verdicts, one at least.
 */
export function truthOf(
  actions: readonly DebugAction[],
  action: DebugAction,
  sent: Sent | undefined,
): Truth {
  const upTo = actions.indexOf(action);
  const ofAttempt = (upTo < 0 ? [action] : actions.slice(0, upTo + 1))
    .filter((a) => a.kind === DebugActionKind.CHECK && a.attemptId === action.attemptId)
    .reverse();
  const gave = (c: DebugCall) => c.answer !== "" && c.failure === Cause.UNSPECIFIED;
  const last = (kind: DebugCallKind) =>
    ofAttempt.flatMap((a) => [...a.calls].reverse()).find((c) => c.kind === kind && gave(c));
  const read = listOf(parsed(last(DebugCallKind.STATEMENT_READING)?.answer ?? ""), "tasks");
  // The solver's call answers with the key, a paper.v1.Key: a task it solved has its answer.
  const keys = listOf(parsed(last(DebugCallKind.SOLVER)?.answer ?? ""), "tasks");
  const results = listOf(
    parsed(
      [...action.calls]
        .reverse()
        .find((c) => c.kind === DebugCallKind.WORK_READING && c.reader <= 1 && gave(c))?.answer ??
        "",
    ),
    "results",
  );
  const outcomes = sent?.outcomes ?? [];
  const count = Math.max(read.length, outcomes.length, 1);
  return {
    tasks: Array.from({ length: count }, (_, n) => {
      const answer = keys[n]?.answer;
      return {
        statement: text(read[n]?.statement ?? keys[n]?.statement),
        formula: text(read[n]?.formula),
        key: typeof answer === "object" && answer !== null ? JSON.stringify(answer) : "",
        read: text(results.find((r) => r.task === n + 1)?.value),
        outcome: outcomes[n] ?? DebugOutcome.UNSPECIFIED,
      };
    }),
    note: "",
  };
}

/**
 * The file of an exported Check: a case of the set of a task from paper of tutor-eval, the JSON of
 * `DebugCase` (R72; R163 spec), or why the truth makes none.
 */
export function exportOf(
  action: DebugAction,
  sent: Sent,
  truth: Truth,
): { readonly name: string; readonly json: string } | { readonly error: string } {
  if (truth.tasks.length === 0) return { error: "A case has one task at least." };
  if (truth.tasks.some((t) => t.outcome === DebugOutcome.UNSPECIFIED))
    return { error: "Choose the verdict each task should get." };
  if (truth.tasks.some((t) => t.statement.trim() === ""))
    return { error: "Give each task its statement as printed." };
  const tasks: DebugTask[] = [];
  for (const [n, t] of truth.tasks.entries()) {
    let key: DebugTask["key"];
    if (t.key.trim() !== "") {
      try {
        key = fromJsonString(DebugTaskSchema, `{"key":${t.key}}`).key;
      } catch (reason) {
        return {
          error: `The key of task ${n + 1} is no paper.v1.Answer: ${reason instanceof Error ? reason.message : String(reason)}`,
        };
      }
    }
    tasks.push(
      create(DebugTaskSchema, {
        statement: t.statement.trim(),
        formula: t.formula.trim(),
        key,
        read: t.read.trim(),
        outcome: t.outcome,
      }),
    );
  }
  const c = create(DebugCaseSchema, {
    work: { statement: sent.statement, crop: sent.crop },
    tasks,
    note: truth.note.trim(),
    action,
  });
  const at = action.at === undefined ? new Date(0) : timestampDate(action.at);
  const stamp = at.toISOString().replace(/[-:]/g, "").replace(/\..*$/, "");
  return {
    name: `case-${stamp}-${action.attemptId.slice(0, 8)}.json`,
    json: toJsonString(DebugCaseSchema, c, { prettySpaces: 2 }),
  };
}
