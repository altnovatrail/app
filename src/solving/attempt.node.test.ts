// What the sheet sends and reads of an attempt: the options a last submission tapped, the words of
// a verdict and of a reason, a code the build does not know among them, and the work as the
// contract carries it.
import {
  type ItemVerdict,
  ItemVerdictSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type {
  PaperSubmission,
  SheetSubmission,
  WorkbookSubmission,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { choicesOf, reasonKey, slotKey, verdictKey, workOf } from "./attempt.ts";

const TASK: open.Task = {
  id: "pick",
  statement: [{ text: "Pick." }],
  canvas: { kind: "handwriting_sheet" },
  items: [
    { answer_slots: [{ binding: "choice", options: ["4", "5"] }] },
    {
      answer_slots: [{ binding: "anywhere" }, { binding: "choice", options: ["yes", "no"] }],
    },
  ],
};

function item(init: MessageInitShape<typeof ItemVerdictSchema>): ItemVerdict {
  return create(ItemVerdictSchema, init);
}

const ITEMS = [
  item({
    verdict: "correct",
    answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "5" }],
  }),
  item({
    verdict: "not_yet",
    answerSlots: [
      { answerSlot: { item: 2, slot: 1 }, verdict: "not_yet", value: "6" },
      { answerSlot: { item: 2, slot: 2 }, verdict: "not_yet", value: "yes" },
    ],
  }),
];

describe("an attempt on the sheet", () => {
  it("reads the options a last submission tapped, and nothing of a slot written by hand", () => {
    expect(slotKey(2, 1)).toBe("2.1");
    expect(choicesOf(TASK, ITEMS)).toEqual({ "1.1": "5", "2.2": "yes" });
    const unplaced = item({
      verdict: "correct",
      answerSlots: [{ verdict: "correct", value: "5" }],
    });
    expect(choicesOf(TASK, [unplaced])).toEqual({});
  });

  it("words a verdict the build does not know with the common string", () => {
    expect(verdictKey("correct")).toBe("task.correct");
    expect(verdictKey("not_yet")).toBe("task.not-yet");
    expect(verdictKey("half")).toBe("common.unknown");
    expect(verdictKey("constructor")).toBe("common.unknown");
  });

  it("words each reason a slot could not be read for, and one the build does not know", () => {
    expect(
      [
        "blank",
        "notation",
        "illegible",
        "ambiguous",
        "no_final_answer",
        "several_final_answers",
      ].map(reasonKey),
    ).toEqual([
      "task.reason-blank",
      "task.reason-notation",
      "task.reason-illegible",
      "task.reason-ambiguous",
      "task.reason-no_final_answer",
      "task.reason-several_final_answers",
    ]);
    expect(reasonKey("smudged")).toBe("common.unknown");
  });

  it("sends a sheet's one crop and a task from paper's crops as PNG bytes, and no cells", async () => {
    const png = (n: number) => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])]);
    const sheet = (await workOf({ png: png(1), submission: {} as SheetSubmission })).surface;
    if (sheet?.case !== "sheet") throw new Error("no crop of a sheet");
    expect([...(sheet.value.crop ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47, 1]);
    const paper = (
      await workOf({ statement: png(4), png: png(5), submission: {} as PaperSubmission })
    ).surface;
    if (paper?.case !== "paper") throw new Error("no work of a task from paper");
    expect(paper.value.statement?.at(-1)).toBe(4);
    expect(paper.value.crop?.at(-1)).toBe(5);
    expect(paper.value.instruction).toBeUndefined();
    // The crop of the instruction above the task goes beside the two, when it has one.
    const above = (
      await workOf({ statement: png(4), png: png(5), submission: {} as PaperSubmission }, png(6))
    ).surface;
    if (above?.case !== "paper") throw new Error("no work of a task from paper");
    expect(above.value.instruction?.at(-1)).toBe(6);
    await expect(workOf({ cells: [], submission: {} as WorkbookSubmission })).rejects.toThrow(
      "cells",
    );
  });
});
