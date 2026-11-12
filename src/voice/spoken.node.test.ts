// The table of signs in words (R36, which closed Д6 of RUN.md; section 3.5 of
// docs/architecture.md), on texts of the first slice's modules — grade-3-math, olympiad-math and
// english-essays of modules v0.2.5, whose explanation language is `en` — and, for `ru`, on texts of
// the same kinds written for the test.
import { describe, expect, it } from "vitest";
import { sentencesOf, spokenText } from "./spoken.ts";
import { lineText } from "./texts.ts";

describe("a module's text in English", () => {
  it.each([
    // grade-3-math: the lines of times-tables-d3, as lineText writes a line with its box.
    [lineText([{ text: "6 ×" }, {}, { text: "= 42" }]), "6 times box equals 42"],
    [lineText([{}, { text: "× 8 = 32" }]), "box times 8 equals 32"],
    [lineText([{ text: "7 × 8 =" }, {}]), "7 times 8 equals box"],
    // grade-3-math: a line whose answer is written by hand, and a division.
    ["10 ÷ 3 =", "10 divided by 3 equals"],
    ["10 ÷ 2 = 5, so 1/2 of 10 is 5.", "10 divided by 2 equals 5, so 1 half of 10 is 5."],
    ["1/3 of 12 =", "1 third of 12 equals"],
    [
      "10 ÷ 5 = 2 is one fifth, and two fifths are 2 × 2 = 4.",
      "10 divided by 5 equals 2 is one fifth, and two fifths are 2 times 2 equals 4.",
    ],
    // grade-3-math: comparing-fractions-d1, the signs named alone and a line of two fractions.
    [
      "Write <, > or = between the two fractions.",
      "Write less-than sign, greater-than sign or equals sign between the two fractions.",
    ],
    [lineText([{ text: "1/4" }, {}, { text: "3/4" }]), "1 quarter box 3 quarters"],
    [lineText([{ text: "5/6" }, {}, { text: "2/6" }]), "5 sixths box 2 sixths"],
    // olympiad-math: a minus typed as a hyphen, the true minus, brackets and an expression.
    [
      "1 + 2 + ... + 9 = 45 is taken away in all. 50 - 45 = 5.",
      "1 + 2 + ... + 9 equals 45 is taken away in all. 50 minus 45 equals 5.",
    ],
    ["10 − 9 = 1", "10 minus 9 equals 1"],
    ["(12 + 2) × 2 = 28", "(12 + 2) times 2 equals 28"],
    ["XY + YX = 99.", "XY + YX equals 99."],
    ["Kim says: '2 + 2 = 5.'", "Kim says: '2 + 2 equals 5.'"],
    // english-essays: a text with no sign is as it is.
    [
      "Write a first sentence that makes a reader want the second.",
      "Write a first sentence that makes a reader want the second.",
    ],
  ])("%s", (text, spoken) => {
    expect(spokenText(text, "en")).toBe(spoken);
  });

  it("reads a fraction it has no name for as one number over another", () => {
    expect(spokenText("5/36", "en")).toBe("5 over 36");
    expect(spokenText("1/2", "en-GB")).toBe("1 half");
    expect(spokenText("3/2", "en")).toBe("3 halves");
  });

  it("leaves a sign whose operands are letters named, but a minus is a minus", () => {
    expect(spokenText("XY − YX = 45.", "en")).toBe("XY minus YX equals 45.");
    expect(spokenText("Is it < or >?", "en")).toBe("Is it less-than sign or greater-than sign?");
  });

  it("does not take the time of day or a range for a sign", () => {
    expect(spokenText("14:25 + 1 hour = 15:25.", "en")).toBe("14:25 + 1 hour equals 15:25.");
    expect(spokenText("pages 3-5", "en")).toBe("pages 3-5");
  });

  it("takes a fraction once from a run of slashes, and goes through a long run of digits at once", () => {
    expect(spokenText("1/2/3", "en")).toBe("1 half /3");
    expect(spokenText("Pay 12 , then 5 .", "en")).toBe("Pay 12, then 5.");
    // A pattern that tried each digit of the run again took 6.5 s here; a linear one, a moment.
    const digits = "1".repeat(100_000);
    const started = performance.now();
    expect(spokenText(`${digits} =`, "en")).toBe(`${digits} equals`);
    expect(performance.now() - started).toBeLessThan(3_000);
  });
});

describe("a text in Russian", () => {
  it.each([
    [lineText([{ text: "6 ×" }, {}, { text: "= 42" }]), "6 умножить на окошко равно 42"],
    ["18 ÷ 2 =", "18 разделить на 2 равно"],
    ["50 - 45 = 5.", "50 минус 45 равно 5."],
    [lineText([{ text: "1/4" }, {}, { text: "3/4" }]), "одна четвёртая окошко 3 четвёртых"],
    ["2/5 и 21/100", "две пятых и 21 делённое на 100"],
    ["21/12 и 11/12", "21 двенадцатая и 11 двенадцатых"],
    [
      "Поставь <, > или = между дробями.",
      "Поставь знак меньше, знак больше или знак равно между дробями.",
    ],
    ["5 < 7 и 9 > 3", "5 меньше, чем 7 и 9 больше, чем 3"],
  ])("%s", (text, spoken) => {
    expect(spokenText(text, "ru-RU")).toBe(spoken);
  });
});

describe("a language with no table", () => {
  it("is said with its signs as they are", () => {
    expect(spokenText("6 × 7 = 42", "de")).toBe("6 × 7 = 42");
    expect(spokenText("1/2", "")).toBe("1/2");
  });
});

describe("the sentences of a text", () => {
  it("are each an utterance of their own", () => {
    expect(sentencesOf("Count up in sixes. Stop at the product!  Is it 42?", "en")).toEqual([
      "Count up in sixes.",
      "Stop at the product!",
      "Is it 42?",
    ]);
    expect(sentencesOf("Считай шестёрками. Где остановиться?", "ru")).toEqual([
      "Считай шестёрками.",
      "Где остановиться?",
    ]);
  });

  it("are none for an empty text, and one for a text with no stop", () => {
    expect(sentencesOf("  ", "en")).toEqual([]);
    expect(sentencesOf("6 times box equals 42", "en")).toEqual(["6 times box equals 42"]);
  });

  it("are cut after a stop where Intl.Segmenter is not there, or the tag is not one", () => {
    expect(sentencesOf("One. Two?", "not a tag")).toEqual(["One.", "Two?"]);
    const segmenter = Intl.Segmenter;
    try {
      Object.defineProperty(Intl, "Segmenter", { value: undefined, configurable: true });
      expect(sentencesOf("One. Two? Three!", "en")).toEqual(["One.", "Two?", "Three!"]);
    } finally {
      Object.defineProperty(Intl, "Segmenter", { value: segmenter, configurable: true });
    }
  });
});
