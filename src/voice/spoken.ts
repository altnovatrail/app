// A module's text as the synthesis reads it (section 3.5 of docs/architecture.md; R07 and R36 in
// docs/decisions.md, which closed Д6 of RUN.md): the signs a module's plain text holds, written in
// words by the table of its language, since every engine reads a sign its own way and reads a box
// of a workbook's line not at all; and the text cut into sentences, each an utterance of its own,
// since Chrome cuts a long one short. The screen shows the text as it is: only what is spoken
// changes. This is app's code, after api's checks, not the model's (R56 in tutor). A language with
// no table of its own is spoken with its signs as they are. No DOM.
import { tagOf } from "./voices.ts";

/** The box of a workbook's line, as app writes a line for speech (texts.ts). */
export const BOX = "□";

/** The words of one language: a sign between two operands, the sign alone, and a fraction. */
interface Table {
  /** A sign beside an operand — a number, a fraction, a box, a bracket: "7 × 8", "= 40". */
  readonly between: Readonly<Record<Sign, string>>;
  /** A sign standing alone, named: "Write <, > or =". */
  readonly alone: Readonly<Record<Sign, string>>;
  /** The box of a line. */
  readonly box: string;
  /** A fraction a/b. */
  readonly fraction: (numerator: number, denominator: number) => string;
}

type Sign = "×" | "÷" | "−" | "=" | "<" | ">";

/** The names of the parts of a whole, 2 to 12, in English: one, and more than one. */
const EN_PARTS: Readonly<Record<number, readonly [string, string]>> = {
  2: ["half", "halves"],
  3: ["third", "thirds"],
  4: ["quarter", "quarters"],
  5: ["fifth", "fifths"],
  6: ["sixth", "sixths"],
  7: ["seventh", "sevenths"],
  8: ["eighth", "eighths"],
  9: ["ninth", "ninths"],
  10: ["tenth", "tenths"],
  11: ["eleventh", "elevenths"],
  12: ["twelfth", "twelfths"],
};

/**
 * The names of the parts of a whole, 2 to 12, in Russian: after one — «одна вторая» — and after
 * any other number — «три четвёртых», «пять восьмых».
 */
const RU_PARTS: Readonly<Record<number, readonly [string, string]>> = {
  2: ["вторая", "вторых"],
  3: ["третья", "третьих"],
  4: ["четвёртая", "четвёртых"],
  5: ["пятая", "пятых"],
  6: ["шестая", "шестых"],
  7: ["седьмая", "седьмых"],
  8: ["восьмая", "восьмых"],
  9: ["девятая", "девятых"],
  10: ["десятая", "десятых"],
  11: ["одиннадцатая", "одиннадцатых"],
  12: ["двенадцатая", "двенадцатых"],
};

/** The tables of the build's languages (Д6). */
const TABLES: Readonly<Record<string, Table>> = {
  en: {
    between: {
      "×": "times",
      "÷": "divided by",
      "−": "minus",
      "=": "equals",
      "<": "is less than",
      ">": "is greater than",
    },
    alone: {
      "×": "times sign",
      "÷": "division sign",
      "−": "minus",
      "=": "equals sign",
      "<": "less-than sign",
      ">": "greater-than sign",
    },
    box: "box",
    fraction(numerator, denominator) {
      const parts = EN_PARTS[denominator];
      if (parts === undefined) return `${numerator} over ${denominator}`;
      return `${numerator} ${numerator === 1 ? parts[0] : parts[1]}`;
    },
  },
  ru: {
    between: {
      "×": "умножить на",
      "÷": "разделить на",
      "−": "минус",
      "=": "равно",
      "<": "меньше, чем",
      ">": "больше, чем",
    },
    alone: {
      "×": "знак умножения",
      "÷": "знак деления",
      "−": "минус",
      "=": "знак равно",
      "<": "знак меньше",
      ">": "знак больше",
    },
    box: "окошко",
    fraction(numerator, denominator) {
      const parts = RU_PARTS[denominator];
      if (parts === undefined) return `${numerator} делённое на ${denominator}`;
      // A number spoken in digits is read in the masculine: one and two are written in words.
      const count = numerator === 1 ? "одна" : numerator === 2 ? "две" : `${numerator}`;
      const one = numerator % 10 === 1 && numerator % 100 !== 11;
      return `${count} ${one ? parts[0] : parts[1]}`;
    },
  },
};

/** The table of a language by its primary subtag: `en-GB` reads by `en`. */
function tableOf(language: string): Table | undefined {
  const primary = tagOf(language).split("-")[0] ?? "";
  return Object.hasOwn(TABLES, primary) ? TABLES[primary] : undefined;
}

/**
 * A number, a fraction when a slash and digits follow it, a sign or a box; a hyphen between two
 * numbers is read as a minus first. A number alone is a token too, so that nothing after its digits
 * can fail and send the match back through them: the pattern stays linear in a long run of digits.
 */
const TOKEN = /(\d+)(?:\/(\d+))?|[×÷−=<>□]/gu;

/** Whether the character before or after a sign is an operand's: a digit, a box, a bracket. */
const BEFORE = /[\p{N}□)]/u;
const AFTER = /[\p{N}□(−]/u;

/** The text with its signs, boxes and fractions in the words of its language. */
export function spokenText(text: string, language: string): string {
  const table = tableOf(language);
  if (table === undefined) return text;
  const minus = text.replace(/(\d)\s+-\s+(?=\d)/gu, "$1 − ");
  const spoken = minus.replace(TOKEN, (match, numerator, denominator, at: number) => {
    if (numerator !== undefined) {
      if (denominator === undefined) return match;
      return ` ${table.fraction(Number(numerator), Number(denominator))} `;
    }
    if (match === BOX) return ` ${table.box} `;
    const sign = match as Sign;
    const before = minus.slice(0, at).trimEnd().at(-1);
    const after = minus.slice(at + match.length).trimStart()[0];
    // Beside an operand on either side it is read as an operation — "18 ÷ 2 =" on a line whose
    // answer is written by hand, "= 40" after a box; with none, as a sign named: "Write <, > or =".
    const between =
      (before !== undefined && BEFORE.test(before)) || (after !== undefined && AFTER.test(after));
    return ` ${(between ? table.between : table.alone)[sign]} `;
  });
  // Every run of white space is one space by then, so the space before a mark is matched alone:
  // a quantified run there would be tried again from each of its spaces.
  return spoken
    .replace(/\s+/gu, " ")
    .replace(/ ([,;:!?]|\.(?!\.))/gu, "$1")
    .trim();
}

/**
 * The sentences of a text, each an utterance of its own (section 3.5): by `Intl.Segmenter` where
 * the browser has it, else after a full stop, a question or an exclamation mark and a space. An
 * empty text has none.
 */
export function sentencesOf(text: string, language: string): string[] {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  let pieces: string[];
  if (typeof Intl.Segmenter === "function") {
    let segmenter: Intl.Segmenter;
    try {
      segmenter = new Intl.Segmenter(language, { granularity: "sentence" });
    } catch {
      segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });
    }
    pieces = [...segmenter.segment(trimmed)].map(({ segment }) => segment);
  } else {
    pieces = trimmed.split(/(?<=[.!?…])\s+/u);
  }
  return pieces.map((piece) => piece.trim()).filter((piece) => piece !== "");
}
