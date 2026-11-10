// What the task screen sends and reads of an attempt (section 15 of the text of the contracts): the
// options tapped in the task's order, the verdicts by item and slot, a code the build does not know,
// and the solution in the window of versions, which offers a reload outside it.
import {
  type ItemVerdict,
  ItemVerdictSchema,
  MarkKind,
  MarkSchema,
  SolvedTaskSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { SheetSubmission, WorkbookSubmission } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { WORDS } from "../i18n/words.ts";
import { OpenViews } from "../packages/views.ts";
import { memoryDevice } from "../test/device.ts";
import {
  choicesOf,
  markNames,
  marksOf,
  notYet,
  reasonKey,
  resumed,
  solutionOf,
  tappedChoices,
  verdictKey,
  verdictsOf,
  withoutSlot,
  withoutWriting,
  workOf,
} from "./attempt.ts";
import { choose, initialState, writingFilled } from "./steps.ts";

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
      { answerSlot: { item: 2, slot: 1 }, verdict: "unreadable", reason: "blank" },
      { answerSlot: { item: 2, slot: 2 }, verdict: "not_yet", value: "yes" },
    ],
  }),
];

function views(stale: () => void = () => {}) {
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => undefined, signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
  });
  return new OpenViews({ api, device: memoryDevice().device, stale });
}

describe("an attempt on the screen", () => {
  it("sends the options tapped in the task's order, and none of a slot not tapped", () => {
    expect(tappedChoices(TASK, { "2.2": "no", "1.1": "4", "2.1": "ink" })).toEqual([
      { answerSlot: { item: 1, slot: 1 }, value: "4" },
      { answerSlot: { item: 2, slot: 2 }, value: "no" },
    ]);
    expect(tappedChoices(TASK, {})).toEqual([]);
  });

  it("reads the verdicts by item and slot, and the options a last submission tapped", () => {
    const verdicts = verdictsOf(ITEMS, TASK);
    expect([...verdicts.items]).toEqual([
      [1, "correct"],
      [2, "not_yet"],
    ]);
    expect(verdicts.slots.get("2.1")).toBe("unreadable");
    expect(notYet(verdicts)).toBe(1);
    expect(choicesOf(TASK, ITEMS)).toEqual({ "1.1": "5", "2.2": "yes" });
    const unplaced = item({
      verdict: "correct",
      answerSlots: [{ verdict: "correct", value: "5" }],
    });
    expect(verdictsOf([unplaced], TASK).slots.size).toBe(0);
    expect(choicesOf(TASK, [unplaced])).toEqual({});
  });

  it("drops the verdict of a slot whose option changed, and its item's", () => {
    const verdicts = withoutSlot(verdictsOf(ITEMS, TASK), "2.2");
    expect(verdicts.slots.has("2.2")).toBe(false);
    expect(verdicts.items.has(2)).toBe(false);
    expect(verdicts.items.get(1)).toBe("correct");
    const same = verdictsOf(ITEMS, TASK);
    expect(withoutSlot(same, "3.1")).toBe(same);
  });

  it("goes on from what this device kept, with what api owns over it", () => {
    const steps = [
      { title: "Plan", gives: ["techniques" as const], exit_condition: "none" as const },
      { title: "Solve", exit_condition: "answer_slots_filled" as const },
    ];
    const answer = { items: ITEMS, wrongAnswers: 1, stepTechniqueIds: ["draw"] };
    // Nothing kept: the mode given, api's options and techniques, and its verdicts.
    const fresh = resumed(TASK, steps, undefined, answer, "self");
    expect(fresh.state.mode).toBe("self");
    expect(fresh.state.choices).toEqual({ "1.1": "5", "2.2": "yes" });
    expect(fresh.state.techniques).toEqual({ 1: ["draw"] });
    expect(fresh.verdicts.slots.get("2.2")).toBe("not_yet");
    // Kept with the same count: the option tapped since on this device stays, without the verdict
    // that was another option's.
    const kept = {
      ...choose(choose(initialState("steps"), "1.1", "5"), "2.2", "no"),
      wrongAnswers: 1,
    };
    const here = resumed(TASK, steps, { ...kept, techniques: { 1: [] } }, answer, "self");
    expect(here.state.mode).toBe("steps");
    expect(here.state.choices["2.2"]).toBe("no");
    expect(here.state.techniques).toEqual({ 1: [] });
    expect(here.verdicts.slots.has("2.2")).toBe(false);
    expect(here.verdicts.items.has(2)).toBe(false);
    expect(here.verdicts.slots.get("1.1")).toBe("correct");
    // A count api moved on another device: its options are the latest.
    const there = resumed(TASK, steps, kept, { ...answer, wrongAnswers: 3 }, "self");
    expect(there.state.choices["2.2"]).toBe("yes");
    expect(there.state.wrongAnswers).toBe(3);
    expect(there.verdicts.slots.get("2.2")).toBe("not_yet");
  });

  it("words a verdict the build does not know with the common string", () => {
    expect(verdictKey("correct")).toBe("task.correct");
    expect(verdictKey("not_yet")).toBe("task.not-yet");
    expect(verdictKey("half")).toBe("common.unknown");
    expect(verdictKey("constructor")).toBe("common.unknown");
  });

  it("reads the solution in the window of versions, and none of a task with none", () => {
    const parts = [
      { text: "Count the gaps." },
      { picture: "gaps.png", alt: "Gaps", width: 10, height: 5 },
    ];
    const solved = (json: unknown, version = "0.4") =>
      create(SolvedTaskSchema, {
        solution: new TextEncoder().encode(JSON.stringify(json)),
        moduleFormatVersion: version,
      });
    expect(solutionOf(views(), solved(parts))).toEqual(parts);
    expect(solutionOf(views(), create(SolvedTaskSchema, {}))).toEqual([]);
    expect(solutionOf(views(), solved({ text: "not a list" }))).toEqual([]);
    let offered = 0;
    expect(() =>
      solutionOf(
        views(() => (offered += 1)),
        solved(parts, "0.5"),
      ),
    ).toThrow(ApiError);
    expect(offered).toBe(1);
    const broken = create(SolvedTaskSchema, {
      solution: new Uint8Array([0xff]),
      moduleFormatVersion: "0.4",
    });
    expect(() => solutionOf(views(), broken)).toThrow(ApiError);
  });

  it("reads what was read in a slot written by hand, or why not, and nothing of a choice", () => {
    const verdicts = verdictsOf(ITEMS, TASK);
    expect([...verdicts.readings]).toEqual([["2.1", { reason: "blank" }]]);
    const read = verdictsOf(
      [
        item({
          verdict: "correct",
          answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "5" }],
        }),
        item({
          verdict: "not_yet",
          answerSlots: [{ answerSlot: { item: 2, slot: 1 }, verdict: "not_yet", value: "7" }],
        }),
      ],
      TASK,
    );
    expect(read.readings.get("2.1")).toEqual({ value: "7" });
    expect(read.readings.has("1.1")).toBe(false);
    expect(withoutSlot(read, "2.1").readings.size).toBe(0);
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

  it("sends a sheet's one crop and a workbook's boxes with their places, as PNG bytes", async () => {
    const png = (n: number) => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])]);
    const sheet = (await workOf({ png: png(1), submission: {} as SheetSubmission })).surface;
    if (sheet?.case !== "sheet") throw new Error("no crop of a sheet");
    expect([...(sheet.value.crop ?? [])]).toEqual([0x89, 0x50, 0x4e, 0x47, 1]);
    const book = (
      await workOf({
        cells: [
          { item: 1, slot: 2, png: png(2) },
          { item: 3, slot: 1, png: png(3) },
        ],
        submission: {} as WorkbookSubmission,
      })
    ).surface;
    if (book?.case !== "workbook") throw new Error("no boxes of a workbook");
    const boxes = book.value.boxes ?? [];
    expect(boxes.map((box) => box.answerSlot)).toEqual([
      { item: 1, slot: 2 },
      { item: 3, slot: 1 },
    ]);
    expect(boxes[1]?.crop?.at(-1)).toBe(3);
  });

  it("puts the tutor's marks where the canvas takes them, named by their number among those placed", () => {
    const name = (n: number, total: number, cell?: { item: number; slot: number }) =>
      cell === undefined ? `${n}/${total}` : `${n}/${total} ${cell.item}.${cell.slot}`;
    const submission = { digest: "0123456789abcdef" } as SheetSubmission;
    const given = [
      create(MarkSchema, {
        kind: MarkKind.FRAME,
        place: { case: "cropBox", value: { ymin: 10, xmin: 20, ymax: 300, xmax: 400 } },
      }),
      create(MarkSchema, { kind: MarkKind.FRAME }),
      create(MarkSchema, {
        kind: MarkKind.UNSPECIFIED,
        place: { case: "answerSlot", value: { item: 1, slot: 1 } },
      }),
      create(MarkSchema, {
        kind: MarkKind.FRAME,
        place: { case: "answerSlot", value: { item: 3, slot: 2 } },
      }),
    ];
    // On a sheet, a box of the crop alone; on a workbook, a cell alone (R53 in spec).
    expect(marksOf(given, submission, name, false)).toEqual({
      submission,
      marks: [{ kind: "frame", at: { box: [10, 20, 300, 400] }, name: "1/1" }],
    });
    expect(marksOf(given, submission, name, true)).toEqual({
      submission,
      marks: [{ kind: "frame", at: { cell: { item: 3, slot: 2 } }, name: "1/1 3.2" }],
    });
    expect(marksOf([given[1] as (typeof given)[number]], submission, name, false)).toBeUndefined();
  });

  it("drops the verdicts of the slots written by hand, and keeps the options'", () => {
    const left = withoutWriting(verdictsOf(ITEMS, TASK), TASK);
    // The slot written by hand goes, with its item's verdict; the options of both items stay.
    expect([...left.slots.keys()]).toEqual(["1.1", "2.2"]);
    expect([...left.items.keys()]).toEqual([1]);
    expect(left.readings.size).toBe(0);
  });

  it("names the marks in the screen's words, a workbook's with its line and box", () => {
    expect(markNames(WORDS.en)(1, 2)).toBe("Tutor's mark 1 of 2");
    expect(markNames(WORDS.ru)(2, 2, { item: 3, slot: 1 })).toBe(
      "Пометка наставника 2 из 2: строка 3, окошко 1",
    );
  });

  it("tells whether the slots written by hand hold something, the options aside", () => {
    expect(writingFilled(TASK, null)).toBe(false);
    expect(writingFilled(TASK, [[true]])).toBe(true);
  });
});
