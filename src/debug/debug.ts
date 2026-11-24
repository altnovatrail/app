// The debug mode of the models of a task from paper: which models check it, what
// each call returned and what it cost, for an account with api's debug right. app loads this module
// only once api's `GetDebug` answered (gate.ts). The choice is api's; the calls taken from api and
// the sum since the session began are the tab's memory alone, and go at a reload or with the
// account.

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
  DebugTaskSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create, toJsonString } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import type { Client } from "@connectrpc/connect";
import * as gate from "./gate.ts";

export type DebugClient = Client<typeof DebugService>;

/** A model chosen, as the window edits it. */
export interface Pick {
  readonly model: string;
  readonly effort: DebugEffort;
  readonly thinking: boolean;
}

/**
 * What a Check sent — the task's crop, the work's and the instruction's, when it had one —, and the
 * verdict api gave each task of its frame, in the frame's order, which the export of its action
 * holds.
 */
export interface Sent {
  readonly attemptId: string;
  readonly statement: Uint8Array;
  readonly crop: Uint8Array;
  readonly instruction?: Uint8Array;
  readonly outcomes: readonly DebugOutcome[];
}

export interface DebugState {
  /** Whether api has the mode: unknown until `GetDebug` answers, off when it refuses. */
  readonly status: "unknown" | "loading" | "on" | "off";
  readonly models: readonly DebugModel[];
  readonly admitted: readonly DebugAdmitted[];
  /** The model of every call, none as admitted. */
  readonly first: Pick | undefined;
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
/** The account of the gate the state is of: another account's begins from nothing. */
let account = gate.snapshot().account;
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

function forget(): void {
  confirmed = undefined;
  sending = Promise.resolve();
  changes = 0;
  loading = undefined;
  set(() => initial);
}

/** The state and the gate forgotten, for the tests. */
export function reset(): void {
  gate.reset();
  account = gate.snapshot().account;
  forget();
}

function pickOf(c: DebugModelChoice | undefined): Pick | undefined {
  return c === undefined ? undefined : { model: c.model, effort: c.effort, thinking: c.thinking };
}

function choiceOf(p: Pick | undefined): DebugModelChoice | undefined {
  return p === undefined ? undefined : create(DebugModelChoiceSchema, p);
}

function held(now: DebugState, choice: DebugChoice | undefined): DebugState {
  return { ...now, first: pickOf(choice?.first) };
}

/**
 * Takes the gate's answer of whether the account has the mode, or joins the asking under way; after
 * a failure other than a refusal, the next call asks again.
 */
export function load(client: DebugClient | undefined): Promise<void> {
  if (client === undefined) return Promise.resolve();
  if (gate.snapshot().account !== account) {
    account = gate.snapshot().account;
    forget();
  }
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
  const answer = await gate.ask(client);
  if (answer === undefined) {
    const off = gate.snapshot().status === "off";
    set((now) => ({ ...now, status: off ? "off" : "unknown" }));
    return;
  }
  confirmed = answer.choice;
  set((now) => ({
    ...held(now, answer.choice),
    status: "on",
    models: answer.models,
    admitted: answer.admitted,
  }));
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
 * Sets the choice at api, one model of every call or none as admitted; the window shows what api
 * holds after the last change, or why it refused it and the choice api still holds.
 */
export function choose(client: DebugClient | undefined, first: Pick | undefined): Promise<void> {
  if (client === undefined) return Promise.resolve();
  const pick = first === undefined ? undefined : fitted(state.models, first);
  // The window shows the change at once, and api's answer after.
  set((now) => ({ ...now, first: pick, refused: undefined }));
  const choice = create(DebugChoiceSchema, { first: choiceOf(pick) });
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

/** The name of a call by its kind; one api no longer records is a call. */
export function callName(kind: DebugCallKind): string {
  switch (kind) {
    case DebugCallKind.TASK_FINDING:
      return "Find tasks";
    case DebugCallKind.STATEMENT_READING:
      return "Statement";
    case DebugCallKind.TASK_CHECKING:
      return "Check";
    case DebugCallKind.TUTOR_WORDS:
      return "Tutor's words";
    default:
      return "Call";
  }
}

/** A call's title: what it did, and its attempt after the first. */
export function callTitle(call: DebugCall): string {
  const attempt = call.attempt > 1 ? ` · attempt ${call.attempt}` : "";
  return `${callName(call.kind)}${attempt}`;
}

/** The name of a model by the catalog, or its ID as the provider gave it back. */
export function modelName(models: readonly DebugModel[], id: string): string {
  const known = models.find((m) => id === m.id || id.startsWith(`${m.id}-`));
  return known?.name ?? id;
}

/** The line under a call's title: the model, its effort and whether it thought. */
export function callLine(models: readonly DebugModel[], call: DebugCall): string {
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
    case "so_far_correct":
      return DebugOutcome.SO_FAR_CORRECT;
    default:
      return DebugOutcome.UNSPECIFIED;
  }
}

export const OUTCOMES: readonly { readonly outcome: DebugOutcome; readonly name: string }[] = [
  { outcome: DebugOutcome.CORRECT, name: "correct" },
  { outcome: DebugOutcome.NOT_YET, name: "not yet" },
  { outcome: DebugOutcome.UNREADABLE, name: "unreadable" },
  { outcome: DebugOutcome.SO_FAR_CORRECT, name: "so far" },
  { outcome: DebugOutcome.UNCHECKED, name: "unchecked" },
];

/**
 * The truth of one task of an exported Check, as the developer edits it, beside what the Check
 * answered for the task's slot, which the developer does not edit.
 */
export interface TaskTruth {
  readonly statement: string;
  readonly read: string;
  readonly outcome: DebugOutcome;
  /** The model's verdict of the slot, as it wrote it; empty when no Check answered. */
  readonly checkVerdict: string;
  /** What the Check read as the task's answer; empty when it read none. */
  readonly checkRead: string;
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
 * The truth an export begins from, what the calls gave: each task of the Check's answer, by its
 * number, its verdict and what it read as the Check wrote them, the value read the truth's too; the
 * verdict api gave each; and the statement the attempt's Recognise read, when it did. Of a call's
 * attempts, the last that answered is what the call gave. A frame has as many tasks as the Check
 * or api gave, one at least.
 */
export function truthOf(
  actions: readonly DebugAction[],
  action: DebugAction,
  sent: Sent | undefined,
): Truth {
  const upTo = actions.indexOf(action);
  const before = (upTo < 0 ? [action] : actions.slice(0, upTo + 1)).filter(
    (a) => a.attemptId === action.attemptId,
  );
  const gave = (c: DebugCall) => c.answer !== "" && c.failure === Cause.UNSPECIFIED;
  const lastOf = (calls: readonly DebugCall[], kind: DebugCallKind) =>
    [...calls].reverse().find((c) => c.kind === kind && gave(c));
  const read = listOf(
    parsed(
      lastOf(
        before.flatMap((a) => a.calls),
        DebugCallKind.STATEMENT_READING,
      )?.answer ?? "",
    ),
    "tasks",
  );
  const checked = listOf(
    parsed(lastOf(action.calls, DebugCallKind.TASK_CHECKING)?.answer ?? ""),
    "tasks",
  );
  const outcomes = sent?.outcomes ?? [];
  const count = Math.max(checked.length, outcomes.length, 1);
  return {
    tasks: Array.from({ length: count }, (_, n) => {
      const slot = checked.find((t) => t.task === n + 1) ?? checked[n];
      return {
        statement: text(read[n]?.statement),
        read: text(slot?.read),
        outcome: outcomes[n] ?? DebugOutcome.UNSPECIFIED,
        checkVerdict: text(slot?.verdict),
        checkRead: text(slot?.read),
      };
    }),
    note: "",
  };
}

/**
 * The file of an exported Check: a case of the set of a task from paper of tutor-eval, the JSON of
 * `DebugCase`, or why the truth makes none.
 */
export function exportOf(
  action: DebugAction,
  sent: Sent,
  truth: Truth,
): { readonly name: string; readonly json: string } | { readonly error: string } {
  if (truth.tasks.length === 0) return { error: "A case has one task at least." };
  if (truth.tasks.some((t) => t.outcome === DebugOutcome.UNSPECIFIED))
    return { error: "Choose the verdict each task should get." };
  const tasks = truth.tasks.map((t) =>
    create(DebugTaskSchema, {
      statement: t.statement.trim(),
      read: t.read.trim(),
      outcome: t.outcome,
      checkVerdict: t.checkVerdict,
      checkRead: t.checkRead,
    }),
  );
  const c = create(DebugCaseSchema, {
    work: {
      statement: sent.statement,
      crop: sent.crop,
      ...(sent.instruction === undefined ? {} : { instruction: sent.instruction }),
    },
    tasks,
    note: truth.note.trim(),
    action,
  });
  const at = action.at === undefined ? new Date(0) : timestampDate(action.at);
  const stamp = at.toISOString().replace(/[-:]/g, "").split(".")[0];
  return {
    name: `case-${stamp}-${action.attemptId.slice(0, 8)}.json`,
    json: toJsonString(DebugCaseSchema, c, { prettySpaces: 2 }),
  };
}
