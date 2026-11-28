// A task of a module on the sheet, with no DOM: its slot bound `choice` and its options, whether it
// asks for writing, the option chosen as api takes it and gives it back, the verdict of an option
// alone, the strokes as `SheetWork`, and the statement's pieces with the module's pictures.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import {
  choiceSlotOf,
  chosenOf,
  choseOf,
  sheetWorkOf,
  statementPiecesOf,
  tappedOf,
  writesOn,
} from "./moduleTask.ts";

const MONTHS: open.Task = {
  id: "months",
  statement: [
    { text: " Which month comes after November? " },
    { picture: "calendar.png", alt: "A calendar", width: 120 },
    { picture: "lost.png", alt: "A clock" },
    { picture: "decor.png" },
    { picture: "gone.png" },
    { text: "  " },
  ],
  canvas: { kind: "handwriting_sheet" },
  items: [
    { text: "Write it.", answer_slots: [{ binding: "sheet" }] },
    { answer_slots: [{ binding: "choice", options: [" ", "October", "December"] }] },
  ],
};

describe("a task of a module on the sheet", () => {
  it("takes its first slot bound choice with options, without the blank ones", () => {
    expect(choiceSlotOf(MONTHS)).toEqual({ item: 2, slot: 1, options: ["October", "December"] });
    expect(
      choiceSlotOf({
        ...MONTHS,
        items: [{ answer_slots: [{ binding: "choice", options: [""] }] }],
      }),
    ).toBeUndefined();
    expect(choiceSlotOf({ ...MONTHS, items: [{ text: "x" }] })).toBeUndefined();
  });

  it("asks for writing by a slot not bound choice, or a line of boxes", () => {
    expect(writesOn(MONTHS)).toBe(true);
    expect(writesOn({ ...MONTHS, items: [MONTHS.items[1] as open.Item] })).toBe(false);
    expect(
      writesOn({ ...MONTHS, items: [{ line: [{ binding: "box" }] } as unknown as open.Item] }),
    ).toBe(true);
  });

  it("gives the option chosen as SubmitWork takes it, and back by its text", () => {
    const choice = choiceSlotOf(MONTHS);
    expect(tappedOf(choice, 1)).toEqual([{ answerSlot: { item: 2, slot: 1 }, value: "December" }]);
    expect(tappedOf(choice, undefined)).toEqual([]);
    expect(tappedOf(choice, 7)).toEqual([]);
    expect(tappedOf(undefined, 0)).toEqual([]);
    expect(chosenOf(choice, "December")).toBe(1);
    expect(chosenOf(choice, "May")).toBeUndefined();
    expect(chosenOf(choice, undefined)).toBeUndefined();
    expect(chosenOf(undefined, "December")).toBeUndefined();
  });

  it("says the option chosen on the verdict of a task answered by an option alone", () => {
    const choice = { item: 1, slot: 1, options: ["October", "December"] };
    const read = { kind: "not-yet", read: "x", parts: [] } as const;
    expect(choseOf(read, { choice, writes: false }, 0)).toEqual({
      kind: "not-yet",
      read: "October",
      parts: [],
      chose: true,
    });
    expect(choseOf(read, { choice, writes: true }, 0)).toBe(read);
    expect(choseOf(read, { choice, writes: false }, undefined)).toBe(read);
    const nokey = { kind: "nokey" } as const;
    expect(choseOf(nokey, { choice, writes: false }, 0)).toBe(nokey);
  });

  it("sends the strokes alone as SheetWork, and nothing with no stroke", async () => {
    const strokes = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
    const work = { strokes } as unknown as Parameters<typeof sheetWorkOf>[0];
    const sent = await sheetWorkOf(work);
    expect(sent?.surface?.case).toBe("sheet");
    expect(sent?.surface?.value).toEqual({ crop: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) });
    expect(await sheetWorkOf(null)).toBeUndefined();
    expect(await sheetWorkOf({} as Parameters<typeof sheetWorkOf>[0])).toBeUndefined();
  });

  it("lays out the statement's paragraphs and pictures, a lost picture its words, then the items", async () => {
    const calendar = new Blob(["png"], { type: "image/png" });
    const asked: string[] = [];
    const pieces = await statementPiecesOf(MONTHS, async (path) => {
      asked.push(path);
      if (path === "calendar.png" || path === "decor.png") return calendar;
      throw new Error("missing");
    });
    expect(asked).toEqual(["calendar.png", "lost.png", "decor.png", "gone.png"]);
    expect(pieces).toEqual([
      { text: "Which month comes after November?" },
      { picture: calendar, width: 120 },
      { text: "A clock" },
      { picture: calendar },
      { text: "1. Write it." },
    ]);
    const workbook = await statementPiecesOf(
      {
        ...MONTHS,
        statement: [],
        items: [
          { text: " Fill in. ", line: [{ text: "7 ×" }, { binding: "box" }, { text: "= 56" }] },
        ],
      } as open.Task,
      async () => calendar,
    );
    expect(workbook).toEqual([{ text: "Fill in." }, { text: "7 × ____ = 56" }]);
  });
});
