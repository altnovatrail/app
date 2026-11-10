// What the task screen sends and reads of an attempt (section 15 of the text of the contracts): the
// options tapped in the task's order, the verdicts by item and slot, a code the build does not know,
// and the solution in the window of versions, which offers a reload outside it.
import {
  type ItemVerdict,
  ItemVerdictSchema,
  SolvedTaskSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { OpenViews } from "../packages/views.ts";
import { memoryDevice } from "../test/device.ts";
import {
  choicesOf,
  notYet,
  resumed,
  solutionOf,
  tappedChoices,
  verdictKey,
  verdictsOf,
  withoutSlot,
} from "./attempt.ts";
import { choose, initialState } from "./steps.ts";

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
    const verdicts = verdictsOf(ITEMS);
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
    expect(verdictsOf([unplaced]).slots.size).toBe(0);
    expect(choicesOf(TASK, [unplaced])).toEqual({});
  });

  it("drops the verdict of a slot whose option changed, and its item's", () => {
    const verdicts = withoutSlot(verdictsOf(ITEMS), "2.2");
    expect(verdicts.slots.has("2.2")).toBe(false);
    expect(verdicts.items.has(2)).toBe(false);
    expect(verdicts.items.get(1)).toBe("correct");
    const same = verdictsOf(ITEMS);
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
});
