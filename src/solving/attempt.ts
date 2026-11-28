// What the sheet sends and reads of an attempt: an answer slot by its key, the option tapped as
// `SubmitWork` takes it, and the options an open attempt's last submission tapped; the words of a
// verdict and of a reason a slot could not be read for, whose codes the build may not know; and the
// work as the contract carries it — a sheet's one crop, or a task from paper's crops — with nothing
// of the history or the context. No DOM.

import type {
  ItemVerdict,
  WorkSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ExportedWork } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { keyFor } from "../i18n/codes.ts";

/** The key of an answer slot, by its item and its slot, each from 1, as the contract counts. */
export function slotKey(item: number, slot: number): string {
  return `${item}.${slot}`;
}

/** An option tapped, by its answer slot, as `SubmitWork` takes it. */
export interface Tapped {
  readonly answerSlot: { readonly item: number; readonly slot: number };
  readonly value: string;
}

/** The words of each verdict an item or a slot gets. */
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

/** The words of each reason a slot could not be read for. */
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

/** The options an open attempt's last submission tapped, by slot key, as its verdicts read them. */
export function choicesOf(task: open.Task, items: readonly ItemVerdict[]): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const item of items) {
    for (const slot of item.answerSlots) {
      const place = slot.answerSlot;
      if (place === undefined || slot.value === undefined) continue;
      const binding = task.items[place.item - 1]?.answer_slots?.[place.slot - 1]?.binding;
      if (binding === "choice") choices[slotKey(place.item, place.slot)] = slot.value;
    }
  }
  return choices;
}

/**
 * The work the contract carries, of the work the canvas gave: a sheet's PNG bytes; a task from
 * paper's, its statement's crop beside its work's, and the crop of its instruction when it has one.
 */
export async function workOf(
  work: ExportedWork,
  instruction?: Blob,
): Promise<MessageInitShape<typeof WorkSchema>> {
  // The sheet of a task from paper gives no work of cells.
  if ("cells" in work) throw new Error("app: a work of cells, which no sheet gives");
  const bytes = async (png: Blob) => new Uint8Array(await png.arrayBuffer());
  if (work.statement === undefined) {
    return { surface: { case: "sheet", value: { crop: await bytes(work.png) } } };
  }
  const [statement, crop, above] = await Promise.all([
    bytes(work.statement),
    bytes(work.png),
    instruction === undefined ? undefined : bytes(instruction),
  ]);
  return {
    surface: {
      case: "paper",
      value: { statement, crop, ...(above === undefined ? {} : { instruction: above }) },
    },
  };
}
