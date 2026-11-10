// What the task screen sends and reads of an attempt (section 15 of the text of the contracts;
// sections 3.3 and 3.10 of docs/architecture.md): the options tapped, one for each answer slot bound
// `choice`, in the task's order; the verdict of each item and slot, whose code the build may not
// know; and the solution of a task solved, as JSON of the module format. No DOM.
import type {
  ItemVerdict,
  SolvedTask,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { keyFor } from "../i18n/codes.ts";
import type { OpenViews } from "../packages/views.ts";
import {
  fitState,
  givesTechniques,
  gotTechniques,
  initialState,
  type Mode,
  type StepsState,
  slotKey,
  slotsOf,
} from "./steps.ts";

/** An option tapped, by its answer slot, as `SubmitWork` takes it. */
export interface Tapped {
  readonly answerSlot: { readonly item: number; readonly slot: number };
  readonly value: string;
}

/** The options tapped, in the task's order: a slot with none tapped is not among them. */
export function tappedChoices(
  task: open.Task,
  choices: Readonly<Record<string, string>>,
): Tapped[] {
  const tapped: Tapped[] = [];
  task.items.forEach((item, i) => {
    slotsOf(item).forEach((slot, s) => {
      const value = choices[slotKey(i + 1, s + 1)];
      if (slot === "choice" && value !== undefined) {
        tapped.push({ answerSlot: { item: i + 1, slot: s + 1 }, value });
      }
    });
  });
  return tapped;
}

/** The words of each verdict an item or a slot gets (section 3.8). */
export const VERDICT_KEYS = {
  correct: "task.correct",
  not_yet: "task.not-yet",
  unreadable: "task.unreadable",
  unchecked: "task.unchecked",
} as const;

/** The key of a verdict's words; a code the build does not know gets the common string. */
export function verdictKey(verdict: string) {
  return keyFor(VERDICT_KEYS, verdict);
}

/** The verdicts of a submission, by item from 1 and by slot key: what the screen shows. */
export interface Verdicts {
  readonly items: ReadonlyMap<number, string>;
  readonly slots: ReadonlyMap<string, string>;
}

export const NO_VERDICTS: Verdicts = { items: new Map(), slots: new Map() };

/** The verdicts of an answer, or of an open attempt's last submission. */
export function verdictsOf(items: readonly ItemVerdict[]): Verdicts {
  const byItem = new Map<number, string>();
  const bySlot = new Map<string, string>();
  items.forEach((item, i) => {
    byItem.set(i + 1, item.verdict);
    for (const slot of item.answerSlots) {
      const place = slot.answerSlot;
      if (place !== undefined) bySlot.set(slotKey(place.item, place.slot), slot.verdict);
    }
  });
  return { items: byItem, slots: bySlot };
}

/** The options an open attempt's last submission tapped, by slot key, as its verdicts read them. */
export function choicesOf(task: open.Task, items: readonly ItemVerdict[]): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const item of items) {
    for (const slot of item.answerSlots) {
      const place = slot.answerSlot;
      if (place === undefined || slot.value === undefined) continue;
      const kind = slotsOf(task.items[place.item - 1] ?? {})[place.slot - 1];
      if (kind === "choice") choices[slotKey(place.item, place.slot)] = slot.value;
    }
  }
  return choices;
}

/** A verdict without the slot whose option was changed: it was the verdict of another answer. */
export function withoutSlot(verdicts: Verdicts, key: string): Verdicts {
  if (!verdicts.slots.has(key)) return verdicts;
  const slots = new Map(verdicts.slots);
  slots.delete(key);
  const items = new Map(verdicts.items);
  items.delete(Number(key.split(".")[0]));
  return { items, slots };
}

/** How many items are not correct yet. */
export function notYet(verdicts: Verdicts): number {
  return [...verdicts.items.values()].filter((verdict) => verdict !== "correct").length;
}

/** What api keeps of an open attempt that the screen goes on from. */
export interface KeptByApi {
  readonly items: readonly ItemVerdict[];
  readonly wrongAnswers: number;
  readonly stepTechniqueIds: readonly string[];
}

/**
 * The state an attempt goes on with, and the verdicts it shows: what this device kept, with what
 * api owns over it. The count of wrong answers is api's. A count that differs from the one kept
 * tells of a submission on another device, whose options are then the latest; the techniques api
 * gave at a step fill every step that gives them and has none kept. A verdict stands only beside
 * the option it was the verdict of: one changed since on this device drops it.
 */
export function resumed(
  task: open.Task,
  steps: readonly open.Step[],
  kept: StepsState | undefined,
  answer: KeptByApi,
  mode: Mode,
): { readonly state: StepsState; readonly verdicts: Verdicts } {
  const submitted = choicesOf(task, answer.items);
  const elsewhere = kept === undefined || kept.wrongAnswers !== answer.wrongAnswers;
  let state: StepsState = {
    ...(kept ?? initialState(mode)),
    wrongAnswers: answer.wrongAnswers,
  };
  if (elsewhere) state = { ...state, choices: { ...state.choices, ...submitted } };
  if (answer.stepTechniqueIds.length > 0) {
    steps.forEach((step, i) => {
      if (givesTechniques(step) && state.techniques[i + 1] === undefined) {
        state = gotTechniques(state, i + 1, answer.stepTechniqueIds);
      }
    });
  }
  let verdicts = verdictsOf(answer.items);
  for (const key of [...verdicts.slots.keys()]) {
    if (state.choices[key] !== submitted[key]) verdicts = withoutSlot(verdicts, key);
  }
  return { state: fitState(state, steps), verdicts };
}

/** The solution of a task solved: its parts, as its statement's — none when the task has none. */
export function solutionOf(views: OpenViews, solved: SolvedTask): readonly open.StatementPart[] {
  if (solved.solution.length === 0) return [];
  const parts = views.parseView(solved.solution, solved.moduleFormatVersion);
  return Array.isArray(parts) ? (parts as open.StatementPart[]) : [];
}
