// What a speaker button reads (section 3.5 of docs/architecture.md): the open texts of a synthetic
// module in the order the learner sees them, the pictures and the empty texts left out.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import {
  examplePhrases,
  explanationPhrases,
  hintPhrases,
  lineText,
  stepPhrases,
  taskPhrases,
} from "./texts.ts";

const texts = (phrases: readonly { text: string }[]) => phrases.map(({ text }) => text);

const CATALOG: open.Techniques = {
  techniques: {
    "count-up": { title: "Count up", description: "Say the table up to the product." },
    halve: { title: "Halve" },
  },
};

describe("a task", () => {
  it("reads its statement, its pictures left out, then each item and the options of a choice", () => {
    const task = {
      id: "t",
      statement: [
        { text: "Pick the greater." },
        { picture: "media/pie.png", alt: "A pie" },
        { text: " " },
      ],
      canvas: { kind: "sheet" },
      items: [
        { text: "Which is more?", answer_slots: [{ binding: "choice", options: ["1/2", "1/3"] }] },
        { text: "How many?", answer_slots: [{ binding: "number" }] },
        { answer_slots: [{ binding: "choice" }] },
      ],
    } as unknown as open.Task;
    const phrases = taskPhrases(task, "en");
    expect(texts(phrases)).toEqual([
      "Pick the greater.",
      "Which is more?",
      "1/2",
      "1/3",
      "How many?",
    ]);
    expect(phrases.every(({ language }) => language === "en")).toBe(true);
  });

  it("reads a workbook's lines with their boxes", () => {
    const task = {
      id: "t",
      statement: [{ text: "Write the missing numbers." }],
      canvas: { kind: "workbook" },
      items: [{ line: [{ text: "6 ×" }, { binding: "box" }, { text: "= 42" }] }],
    } as open.Task;
    expect(texts(taskPhrases(task, undefined))).toEqual([
      "Write the missing numbers.",
      "6 × □ = 42",
    ]);
    expect(taskPhrases(task, undefined)[0]?.language).toBeUndefined();
  });

  it("writes a line as one text, with a box where it has one", () => {
    expect(lineText([{ text: "  7 × 8 " }, {}, { text: "" }])).toBe("7 × 8 □");
  });
});

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

describe("a step", () => {
  it("reads its title, its description, its chips and its cards", () => {
    const step = {
      title: "Find the givens",
      description: "Tick what the task gives.",
    } as open.Step;
    expect(texts(stepPhrases(step, ["6 bags", "7 apples"], ["halve"], CATALOG, "en"))).toEqual([
      "Find the givens",
      "Tick what the task gives.",
      "6 bags",
      "7 apples",
      "Halve",
    ]);
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
