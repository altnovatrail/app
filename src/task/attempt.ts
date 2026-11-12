// What the task screen sends and reads of an attempt (section 15 of the text of the contracts;
// sections 3.3 and 3.10 of docs/architecture.md): the options tapped, one for each answer slot bound
// `choice`, in the task's order, and the handwriting as the contract carries it — a sheet's one
// crop, a workbook's filled boxes with their places, and nothing of the history or the context; the
// verdict of each item and slot, with what was read or why it could not be, whose codes the build
// may not know; the tutor's marks as the canvas takes them, each named; and the solution of a task
// solved, as JSON of the module format. No DOM.

import type { WorkSchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  type Mark as ContractMark,
  type ItemVerdict,
  MarkKind,
  type SolvedTask,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ExportedWork, Mark, Marks, Submission } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { keyFor } from "../i18n/codes.ts";
import type { Words } from "../i18n/words.ts";
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

/** The words of each reason a slot could not be read for (R56, R86 in spec; section 3.3). */
export const REASON_KEYS = {
  blank: "task.reason-blank",
  notation: "task.reason-notation",
  illegible: "task.reason-illegible",
  ambiguous: "task.reason-ambiguous",
  no_final_answer: "task.reason-no_final_answer",
  several_final_answers: "task.reason-several_final_answers",
} as const;

/** The key of a reason's words; a reason the build does not know gets the common string. */
export function reasonKey(reason: string) {
  return keyFor(REASON_KEYS, reason);
}

/** What was read in a slot, "Read: 6", or why it could not be; neither beside a choice tapped. */
export type Reading = { readonly value: string } | { readonly reason: string };

/** The verdicts of a submission, by item from 1 and by slot key: what the screen shows. */
export interface Verdicts {
  readonly items: ReadonlyMap<number, string>;
  readonly slots: ReadonlyMap<string, string>;
  /** What was read, or why not, in each slot that is no choice, by slot key. */
  readonly readings: ReadonlyMap<string, Reading>;
}

export const NO_VERDICTS: Verdicts = { items: new Map(), slots: new Map(), readings: new Map() };

/** The verdicts of an answer, or of an open attempt's last submission. */
export function verdictsOf(items: readonly ItemVerdict[], task: open.Task): Verdicts {
  const byItem = new Map<number, string>();
  const bySlot = new Map<string, string>();
  const readings = new Map<string, Reading>();
  items.forEach((item, i) => {
    byItem.set(i + 1, item.verdict);
    for (const slot of item.answerSlots) {
      const place = slot.answerSlot;
      if (place === undefined) continue;
      const key = slotKey(place.item, place.slot);
      bySlot.set(key, slot.verdict);
      if (slotsOf(task.items[place.item - 1] ?? {})[place.slot - 1] === "choice") continue;
      if (slot.value !== undefined) readings.set(key, { value: slot.value });
      else if (slot.reason !== "") readings.set(key, { reason: slot.reason });
    }
  });
  return { items: byItem, slots: bySlot, readings };
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
  const readings = new Map(verdicts.readings);
  readings.delete(key);
  const items = new Map(verdicts.items);
  items.delete(Number(key.split(".")[0]));
  return { items, slots, readings };
}

/** Verdicts without those of the slots written by hand: the sheet changed since they were given. */
export function withoutWriting(verdicts: Verdicts, task: open.Task): Verdicts {
  let left = verdicts;
  for (const key of verdicts.slots.keys()) {
    const [item, slot] = key.split(".").map(Number) as [number, number];
    if (slotsOf(task.items[item - 1] ?? {})[slot - 1] !== "choice") left = withoutSlot(left, key);
  }
  return left;
}

/** How many items are not correct yet. */
export function notYet(verdicts: Verdicts): number {
  return [...verdicts.items.values()].filter((verdict) => verdict !== "correct").length;
}

/**
 * The summary of the tutor's panel after a check, which the voicing says too: Correct, the solution
 * shown, or how many items are not right yet; empty with none to name.
 */
export function summaryText(
  verdicts: Verdicts,
  solved: "correct" | "shown" | undefined,
  items: number,
  words: Words,
): string {
  if (solved !== undefined) {
    return words.text(solved === "shown" ? "task.solution-shown" : "task.correct");
  }
  const count = notYet(verdicts);
  return count === 0 ? "" : words.text("task.summary-not-yet", { count, total: items });
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
  let verdicts = verdictsOf(answer.items, task);
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

/** The work the contract carries, of the work the canvas gave: PNG bytes, and a box's place. */
export async function workOf(work: ExportedWork): Promise<MessageInitShape<typeof WorkSchema>> {
  const bytes = async (png: Blob) => new Uint8Array(await png.arrayBuffer());
  if ("png" in work) return { surface: { case: "sheet", value: { crop: await bytes(work.png) } } };
  const boxes = await Promise.all(
    work.cells.map(async (cell) => ({
      answerSlot: { item: cell.item, slot: cell.slot },
      crop: await bytes(cell.png),
    })),
  );
  return { surface: { case: "workbook", value: { boxes } } };
}

/** How a mark is named by its number, the count, and on a workbook its line and box. */
export type MarkName = (n: number, total: number, cell?: { item: number; slot: number }) => string;

/** The names of marks in a screen's words (section 3.8): on a workbook, with the line and the box. */
export function markNames(words: Words): MarkName {
  return (n, total, cell) =>
    cell === undefined
      ? words.text("task.mark", { n, total })
      : words.text("task.mark-box", { n, total, line: cell.item, box: cell.slot });
}

/**
 * A mark of the contract where the canvas puts it: on a workbook a cell alone, on a sheet a box of
 * the crop alone (R53 in spec); none for a kind or a place the build knows not, or for this canvas.
 */
function anchorOf(mark: ContractMark, workbook: boolean): Mark["at"] | undefined {
  if (mark.kind !== MarkKind.FRAME) return undefined;
  if (mark.place.case === "answerSlot" && workbook) {
    return { cell: { item: mark.place.value.item, slot: mark.place.value.slot } };
  }
  if (mark.place.case === "cropBox" && !workbook) {
    const { ymin, xmin, ymax, xmax } = mark.place.value;
    return { box: [ymin, xmin, ymax, xmax] };
  }
  return undefined;
}

/**
 * The tutor's marks as the canvas takes them, with the context of the submission they are of (R74
 * in spec), each named by its number among the marks placed — "Tutor's mark 1 of 2", and on a
 * workbook with its line and box. None when no mark has a place the build knows.
 */
export function marksOf(
  marks: readonly ContractMark[],
  submission: Submission,
  name: MarkName,
  workbook: boolean,
): Marks | undefined {
  const placed = marks.flatMap((mark) => {
    const at = anchorOf(mark, workbook);
    return at === undefined ? [] : [at];
  });
  if (placed.length === 0) return undefined;
  return {
    submission,
    marks: placed.map((at, i) => ({
      kind: "frame" as const,
      at,
      name: name(i + 1, placed.length, "cell" in at ? at.cell : undefined),
    })),
  };
}
