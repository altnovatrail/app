// The solving steps of an attempt as app leads them on the device (section 3.3 of
// docs/architecture.md; R05 in docs/decisions.md): the mode, the step the learner is on and the
// furthest reached, the chips ticked, the techniques api gave at a step, the options tapped and the
// count of wrong answers — kept with the attempt in the profile's database, read back after a
// restart. A step's exit condition opens its "Step done", which leads on and reads no work; no
// condition needs the key. No DOM.
import type * as open from "@altnovatrail/spec/formatv0/open";

/** "By steps" shows the steps; "on my own" none, and a module without steps has only that. */
export type Mode = "steps" | "self";

/** The state of the steps of one attempt, as the profile's database keeps it. */
export interface StepsState {
  readonly mode: Mode;
  /** The step shown, from 1. */
  readonly place: number;
  /** The furthest step reached, from 1: a step up to it can be gone back to. */
  readonly reached: number;
  /** The chips ticked: the givens by their place in the task, from 0, and the unknown. */
  readonly ticked: { readonly givens: readonly number[]; readonly unknown: boolean };
  /** The IDs of the techniques api gave at a step, by the step's place. */
  readonly techniques: Readonly<Record<number, readonly string[]>>;
  /** The option tapped in each answer slot bound `choice`, by `slotKey`. */
  readonly choices: Readonly<Record<string, string>>;
  /** How many submissions had a slot "not yet" (R82 in spec). */
  readonly wrongAnswers: number;
}

/** The key of an answer slot, by its item and its slot, each from 1, as the contract counts. */
export function slotKey(item: number, slot: number): string {
  return `${item}.${slot}`;
}

/** The state a new attempt starts with, in the mode given. */
export function initialState(mode: Mode): StepsState {
  return {
    mode,
    place: 1,
    reached: 1,
    ticked: { givens: [], unknown: false },
    techniques: {},
    choices: {},
    wrongAnswers: 0,
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isPlace = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1;
const isStrings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * The state the database kept, if it has this build's shape: anything else — none, or one an older
 * or newer build wrote — is none, and the attempt goes on from the first step.
 */
export function readState(value: unknown): StepsState | undefined {
  if (!isRecord(value)) return undefined;
  const { mode, place, reached, ticked, techniques, choices, wrongAnswers } = value;
  if (mode !== "steps" && mode !== "self") return undefined;
  if (!isPlace(place) || !isPlace(reached) || place > reached) return undefined;
  if (!isRecord(ticked) || typeof ticked.unknown !== "boolean") return undefined;
  const givens = ticked.givens;
  if (!Array.isArray(givens) || !givens.every((n) => Number.isInteger(n) && n >= 0)) {
    return undefined;
  }
  if (!isRecord(techniques) || !Object.values(techniques).every(isStrings)) return undefined;
  if (!isRecord(choices) || !Object.values(choices).every((v) => typeof v === "string")) {
    return undefined;
  }
  if (typeof wrongAnswers !== "number" || !Number.isInteger(wrongAnswers) || wrongAnswers < 0) {
    return undefined;
  }
  return {
    mode,
    place,
    reached,
    ticked: { givens: givens as number[], unknown: ticked.unknown },
    techniques: techniques as Record<number, string[]>,
    choices: choices as Record<string, string>,
    wrongAnswers,
  };
}

/** A state kept against the steps it is for: a place past the last step goes back to it. */
export function fitState(state: StepsState, steps: readonly open.Step[]): StepsState {
  const last = Math.max(steps.length, 1);
  const reached = Math.min(state.reached, last);
  return { ...state, reached, place: Math.min(state.place, reached) };
}

/** The mode a module allows: a module without steps is "on my own" alone. */
export function modeOf(state: StepsState, steps: readonly open.Step[]): Mode {
  return steps.length === 0 ? "self" : state.mode;
}

/** The answer slots of an item: a sheet's are its own, a workbook's line's boxes, in order. */
export function slotsOf(item: open.Item): readonly ("choice" | "box" | "sheet" | "zone")[] {
  if (item.answer_slots !== undefined) {
    return item.answer_slots.map((slot) =>
      slot.binding === "choice" ? "choice" : slot.binding === "zone" ? "zone" : "sheet",
    );
  }
  return (item.line ?? []).filter((part) => part.binding === "box").map(() => "box");
}

/** Whether every answer slot of the task is bound `choice`: its work is the options tapped. */
export function choicesOnly(task: open.Task): boolean {
  const slots = task.items.flatMap(slotsOf);
  return slots.length > 0 && slots.every((slot) => slot === "choice");
}

/**
 * Whether every answer slot holds something (`answer_slots_filled`): an option tapped in a slot
 * bound `choice`, and for the others the canvas's `filled` — a workbook's box by its item and slot,
 * a sheet's one answer anywhere on it by its first (the second 2026-11-01 amendment to R36 in spec).
 */
export function slotsFilled(
  task: open.Task,
  choices: Readonly<Record<string, string>>,
  filled: readonly (readonly boolean[])[] | null,
): boolean {
  return task.items.every((item, i) =>
    slotsOf(item).every((slot, s) => {
      if (slot === "choice") return choices[slotKey(i + 1, s + 1)] !== undefined;
      if (slot === "box") return filled?.[i]?.[s] === true;
      // The canvas takes no zone: a slot in one is never filled.
      return slot === "sheet" && filled?.[0]?.[0] === true;
    }),
  );
}

/** Whether the task's chips are all ticked; a task without chips has nothing to tick. */
export function chipsTicked(task: open.Task, ticked: StepsState["ticked"]): boolean {
  const givens = task.givens ?? [];
  return (
    givens.every((_, i) => ticked.givens.includes(i)) &&
    (task.unknown === undefined || ticked.unknown)
  );
}

/** Whether a step's exit condition is met: its "Step done" opens. */
export function exitMet(
  step: open.Step,
  task: open.Task,
  state: StepsState,
  filled: readonly (readonly boolean[])[] | null,
): boolean {
  switch (step.exit_condition) {
    case "givens_ticked":
      return chipsTicked(task, state.ticked);
    case "answer_slots_filled":
      return slotsFilled(task, state.choices, filled);
    case "none":
      return true;
    default:
      // A condition of a newer format the build does not read keeps nothing locked.
      return true;
  }
}

/** Whether a step gives the techniques of the task, which `BeginStep` asks api for. */
export function givesTechniques(step: open.Step | undefined): boolean {
  return step?.gives?.includes("techniques") === true;
}

/** Whether a step shows the chips "what we know and what to find". */
export function givesChips(step: open.Step | undefined, task: open.Task): boolean {
  return (
    (step?.gives?.includes("givens") === true || step?.exit_condition === "givens_ticked") &&
    ((task.givens?.length ?? 0) > 0 || task.unknown !== undefined)
  );
}

/** The step after "Step done": the next, and the furthest reached moves with it. */
export function stepDone(state: StepsState, steps: readonly open.Step[]): StepsState {
  const place = Math.min(state.place + 1, steps.length);
  return { ...state, place, reached: Math.max(state.reached, place) };
}

/** Back to a step already reached: nothing is reset. */
export function goTo(state: StepsState, place: number): StepsState {
  return place >= 1 && place <= state.reached ? { ...state, place } : state;
}

/** A chip ticked, or unticked by a second touch: a given by its place, or the unknown. */
export function tick(state: StepsState, chip: number | "unknown"): StepsState {
  if (chip === "unknown") {
    return { ...state, ticked: { ...state.ticked, unknown: !state.ticked.unknown } };
  }
  const givens = state.ticked.givens.includes(chip)
    ? state.ticked.givens.filter((n) => n !== chip)
    : [...state.ticked.givens, chip].sort((a, b) => a - b);
  return { ...state, ticked: { ...state.ticked, givens } };
}

/** An option tapped in an answer slot bound `choice`. */
export function choose(state: StepsState, key: string, option: string): StepsState {
  return { ...state, choices: { ...state.choices, [key]: option } };
}

/** The techniques api gave at a step. */
export function gotTechniques(
  state: StepsState,
  place: number,
  ids: readonly string[],
): StepsState {
  return { ...state, techniques: { ...state.techniques, [place]: [...ids] } };
}
