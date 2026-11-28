// What a speaker button reads: the open texts of a synthetic module in the order the learner
// sees them, the pictures and the empty texts left out.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import { examplePhrases, explanationPhrases, hintPhrases, lineText } from "./texts.ts";

const texts = (phrases: readonly { text: string }[]) => phrases.map(({ text }) => text);

const CATALOG: open.Techniques = {
  techniques: {
    "count-up": { title: "Count up", description: "Say the table up to the product." },
    halve: { title: "Halve" },
  },
};

describe("a hint", () => {
  it("reads the givens, the unknown, the cards of its techniques and its question", () => {
    const task = {
      id: "t",
      statement: [],
      canvas: { kind: "sheet" },
      items: [],
      givens: ["There are 6 bags.", "Each has 7 apples."],
      unknown: "How many apples in all?",
    } as unknown as open.Task;
    expect(
      texts(hintPhrases(task, ["count-up", "missing", "halve"], "What is 6 × 7?", CATALOG, "en")),
    ).toEqual([
      "There are 6 bags.",
      "Each has 7 apples.",
      "How many apples in all?",
      "Count up",
      "Say the table up to the product.",
      "Halve",
      "What is 6 × 7?",
    ]);
  });

  it("reads nothing a task does not have, nor cards with no catalog", () => {
    const task = {
      id: "t",
      statement: [],
      canvas: { kind: "sheet" },
      items: [],
    } as unknown as open.Task;
    expect(hintPhrases(task, ["count-up"], undefined, undefined, "en")).toEqual([]);
  });
});

describe("an explanation", () => {
  it("reads its paragraphs and the items of its lists, its pictures left out", () => {
    const parts: open.ExplanationPart[] = [
      { text: "A fraction is a part of a whole." },
      { picture: "media/pie.png", alt: "A pie cut in four" },
      { numbered_list: ["Cut the whole.", "Count the parts."] },
    ] as open.ExplanationPart[];
    expect(texts(explanationPhrases(parts, "en"))).toEqual([
      "A fraction is a part of a whole.",
      "Cut the whole.",
      "Count the parts.",
    ]);
  });
});

describe("a line", () => {
  it("is written as one text, with a box where it has one", () => {
    expect(lineText([{ text: "  7 × 8 " }, {}, { text: "" }])).toBe("7 × 8 □");
  });
});

describe("a worked example", () => {
  const example = {
    statement: [{ text: "Find the missing numbers." }, { picture: "media/rows.png" }],
    canvas: { kind: "workbook" },
    lines: [
      {
        line: [
          { text: "3 ×" },
          { binding: "box", value: "4" },
          { text: "=" },
          { binding: "box", value: "12" },
        ],
      },
      { line: [{ binding: "box", value: "5" }, { text: "× 2 = 10" }] },
    ],
    demo: [
      { text: "Three fours make twelve.", fill: { line: 1, box: 2 } },
      { fill: { line: 1, box: 1 } },
      { picture: "media/arrow.png" },
      { text: "Five twos make ten.", fill: { line: 2, box: 1 } },
    ],
  } as unknown as open.WorkedExample;

  it("reads its statement and its lines with boxes before the demo opens", () => {
    expect(texts(examplePhrases(example, 0, false, "en"))).toEqual([
      "Find the missing numbers.",
      "3 × □ = □",
      "□ × 2 = 10",
    ]);
  });

  it("reads a box the opened demo filled with what it wrote, and the opened parts' texts", () => {
    expect(texts(examplePhrases(example, 1, false, "en"))).toEqual([
      "Find the missing numbers.",
      "3 × □ = 12",
      "□ × 2 = 10",
      "Three fours make twelve.",
    ]);
    expect(texts(examplePhrases(example, 4, false, "en"))).toEqual([
      "Find the missing numbers.",
      "3 × 4 = 12",
      "5 × 2 = 10",
      "Three fours make twelve.",
      "Five twos make ten.",
    ]);
  });

  it("reads no part of a demo the learner hid, nor what it wrote in the boxes", () => {
    expect(texts(examplePhrases(example, 4, true, "en"))).toEqual([
      "Find the missing numbers.",
      "3 × □ = □",
      "□ × 2 = 10",
    ]);
  });

  it("reads an example on a sheet, with no lines", () => {
    const sheet = {
      statement: [{ text: "Halve 8." }],
      canvas: { kind: "sheet" },
      demo: [{ text: "8 is 4 and 4." }],
    } as unknown as open.WorkedExample;
    expect(texts(examplePhrases(sheet, 1, false, "en"))).toEqual(["Halve 8.", "8 is 4 and 4."]);
  });
});
