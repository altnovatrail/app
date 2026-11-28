// A task of a module solved on the sheet of a task from paper, one at a time, as the engine gives
// them: its statement in pieces for the picture of statement.ts — its paragraphs and its pictures
// from the module's media, in their order —, the answer slot bound `choice` whose options canvas
// draws on the tracing paper, the option tapped as `SubmitWork` takes it, and the handwriting as
// `SheetWork`, the strokes without the tracing paper. A module's task gives one choice at most to
// the tracing paper: the first slot bound `choice`, in the task's order. No DOM.
import type { WorkSchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ExportedWork, Media } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { MessageInitShape } from "@bufbuild/protobuf";
import type { Tapped } from "../solving/attempt.ts";
import type { PaperVerdict } from "./solve.ts";

/** A piece of a statement: a paragraph, or a picture of the module with its width in CSS px. */
export type StatementPiece =
  | { readonly text: string }
  | { readonly picture: Blob; readonly width?: number };

/** The answer slot bound `choice` whose options stand on the tracing paper. */
export interface ChoiceSlot {
  readonly item: number;
  readonly slot: number;
  readonly options: readonly string[];
}

/** The first answer slot bound `choice` with options, in the task's order; none on another task. */
export function choiceSlotOf(task: open.Task): ChoiceSlot | undefined {
  for (const [i, item] of task.items.entries()) {
    for (const [s, slot] of (item.answer_slots ?? []).entries()) {
      const options = (slot.options ?? []).filter((option) => option.trim() !== "");
      if (slot.binding === "choice" && options.length > 0)
        return { item: i + 1, slot: s + 1, options };
    }
  }
  return undefined;
}

/** Whether the task asks for writing too: an answer slot not bound `choice`. */
export function writesOn(task: open.Task): boolean {
  return task.items.some(
    (item) =>
      (item.line ?? []).length > 0 ||
      (item.answer_slots ?? []).some((slot) => slot.binding !== "choice"),
  );
}

/** The option chosen, by its index, of the option an attempt's last submission tapped. */
export function chosenOf(choice: ChoiceSlot | undefined, tapped: string | undefined) {
  if (choice === undefined || tapped === undefined) return undefined;
  const at = choice.options.indexOf(tapped);
  return at < 0 ? undefined : at;
}

/** The option chosen as `SubmitWork` takes it: none with no option chosen. */
export function tappedOf(choice: ChoiceSlot | undefined, chosen: number | undefined): Tapped[] {
  const value = chosen === undefined ? undefined : choice?.options[chosen];
  return choice === undefined || value === undefined
    ? []
    : [{ answerSlot: { item: choice.item, slot: choice.slot }, value }];
}

/**
 * The verdict of a task whose answer is an option alone: what the card says was read is the option
 * chosen.
 */
export function choseOf(
  verdict: PaperVerdict,
  side: { readonly choice?: ChoiceSlot | undefined; readonly writes: boolean },
  chosen: number | undefined,
): PaperVerdict {
  const option = chosen === undefined ? undefined : side.choice?.options[chosen];
  if (side.writes || option === undefined) return verdict;
  if (verdict.kind !== "correct" && verdict.kind !== "not-yet" && verdict.kind !== "so-far")
    return verdict;
  return { ...verdict, read: option, chose: true };
}

/**
 * The handwriting of a task of a module for `SubmitWork`: the crop of the strokes alone, without the
 * tracing paper, as `SheetWork.crop`; none with no stroke.
 */
export async function sheetWorkOf(
  work: ExportedWork | null,
): Promise<MessageInitShape<typeof WorkSchema> | undefined> {
  if (work === null || !("strokes" in work) || work.strokes === undefined) return undefined;
  const crop = new Uint8Array(await work.strokes.arrayBuffer());
  return { surface: { case: "sheet", value: { crop } } };
}

/** The words of a box to write in, in a line of a workbook's item drawn as text. */
const BOX = "____";

/** An item's own words: its question, and its line with a gap for each box. */
function itemWords(item: open.Item): string[] {
  const line = (item.line ?? []).map((part) => part.text?.trim() ?? BOX).join(" ");
  return [item.text?.trim() ?? "", line].filter((text) => text !== "");
}

/**
 * The statement's pieces, in its order: each paragraph, and each picture from the module's media
 * with its width, a picture that does not come the words of what it shows, or nothing; then each
 * item's question and line, numbered when there are more than one.
 */
export async function statementPiecesOf(
  task: open.Task,
  media: Media,
): Promise<readonly StatementPiece[]> {
  const pieces = await Promise.all(
    task.statement.map(async (part): Promise<StatementPiece | undefined> => {
      if (part.text !== undefined && part.text.trim() !== "") return { text: part.text.trim() };
      if (part.picture === undefined) return undefined;
      const alt = part.alt?.trim() ?? "";
      try {
        const picture = await media(part.picture);
        return { picture, ...(part.width === undefined ? {} : { width: part.width }) };
      } catch {
        return alt === "" ? undefined : { text: alt };
      }
    }),
  );
  const many = task.items.length > 1;
  const items = task.items.flatMap((item, i) =>
    itemWords(item).map((text, n) => ({ text: many && n === 0 ? `${i + 1}. ${text}` : text })),
  );
  return [...pieces.filter((piece) => piece !== undefined), ...items];
}
