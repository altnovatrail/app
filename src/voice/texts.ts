// What a speaker button reads (section 3.5 of docs/architecture.md; R07 in docs/decisions.md): the
// open texts of a module that the learner reads anyway (R05 in spec), each a phrase in the module's
// explanation language — a task's statement with its items, its workbook's lines and the options of
// its `choice` slots; what a hint gives; the step shown, with its chips and the cards of its
// techniques; a lesson's explanation; and a worked example's statement, lines and the parts of its
// demo that are open. Pictures are not read, nor their `alt`: a screen reader reads that. No DOM.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { BOX } from "./spoken.ts";

/** A text spoken in a language of its own: the voice is the language's (section 3.5). */
export interface Phrase {
  readonly text: string;
  /** A tag of BCP 47; none when the module does not say, and then nothing speaks it. */
  readonly language: string | undefined;
}

/** The phrases of texts in one language, the empty ones left out. */
function phrases(texts: readonly (string | undefined)[], language: string | undefined): Phrase[] {
  return texts.flatMap((text) =>
    text === undefined || text.trim() === "" ? [] : [{ text, language }],
  );
}

/** A line of a workbook with its boxes, as one text: "7 × □ = 56". */
export function lineText(line: readonly { readonly text?: string }[]): string {
  return line
    .map((part) => part.text ?? ` ${BOX} `)
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** The texts of a statement's paragraphs, its pictures left out. */
function paragraphs(parts: readonly open.StatementPart[]): (string | undefined)[] {
  return parts.map((part) => (part.picture === undefined ? part.text : undefined));
}

/** A task as the learner reads it: its statement, then each item, line or option in order. */
export function taskPhrases(task: open.Task, language: string | undefined): Phrase[] {
  const items = task.items.flatMap((item) => {
    if (item.line !== undefined) return [lineText(item.line)];
    const options = (item.answer_slots ?? []).flatMap((slot) =>
      slot.binding === "choice" ? (slot.options ?? []) : [],
    );
    return [item.text, ...options];
  });
  return phrases([...paragraphs(task.statement), ...items], language);
}

/** What a hint gives before the first wrong answer: the givens, the unknown, the cards, the question. */
export function hintPhrases(
  task: open.Task,
  techniques: readonly string[],
  question: string | undefined,
  catalog: open.Techniques | undefined,
  language: string | undefined,
): Phrase[] {
  return phrases(
    [...(task.givens ?? []), task.unknown, ...cardTexts(techniques, catalog), question],
    language,
  );
}

/** The title and description of each card of techniques the catalog names. */
function cardTexts(
  ids: readonly string[],
  catalog: open.Techniques | undefined,
): (string | undefined)[] {
  return ids.flatMap((id) => {
    const technique = catalog?.techniques[id];
    return technique === undefined ? [] : [technique.title, technique.description];
  });
}

/** The step shown: its title and description, its chips if it gives them, its cards. */
export function stepPhrases(
  step: open.Step,
  chips: readonly string[],
  techniques: readonly string[],
  catalog: open.Techniques | undefined,
  language: string | undefined,
): Phrase[] {
  return phrases(
    [step.title, step.description, ...chips, ...cardTexts(techniques, catalog)],
    language,
  );
}

/** An explanation of a lesson: its paragraphs and the items of its lists, its pictures left out. */
export function explanationPhrases(
  parts: readonly open.ExplanationPart[],
  language: string | undefined,
): Phrase[] {
  return phrases(
    parts.flatMap((part): readonly (string | undefined)[] =>
      part.numbered_list !== undefined
        ? part.numbered_list
        : part.picture === undefined
          ? [part.text]
          : [],
    ),
    language,
  );
}

/**
 * A worked example: its statement, its lines — a box the demo filled already with what it wrote,
 * else a box — and the parts of its demo the learner opened, from the first. A hidden demo is out of
 * sight, its boxes filled too: the lines are read with their boxes.
 */
export function examplePhrases(
  example: open.WorkedExample,
  opened: number,
  hidden: boolean,
  language: string | undefined,
): Phrase[] {
  const shown = hidden ? [] : example.demo.slice(0, opened);
  const filled = new Set(
    shown.flatMap((part) =>
      part.fill === undefined ? [] : [`${part.fill.line} ${part.fill.box}`],
    ),
  );
  const lines = (example.lines ?? []).map((line, l) => {
    let box = 0;
    return lineText(
      line.line.map((part) => {
        if (part.text !== undefined) return part;
        box += 1;
        return filled.has(`${l + 1} ${box}`) && part.value !== undefined
          ? { text: part.value }
          : {};
      }),
    );
  });
  const demo = shown.map((part) => (part.picture === undefined ? part.text : undefined));
  return phrases([...paragraphs(example.statement), ...lines, ...demo], language);
}
