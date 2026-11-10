// The solving steps on the device (section 3.3 of docs/architecture.md; R05): each exit condition,
// a step gone back to resets nothing, a task without chips, a module without steps, and a state the
// database kept in another shape. The steps are those of the format's example of olympiad maths.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import {
  choicesOnly,
  choose,
  exitMet,
  fitState,
  givesChips,
  givesTechniques,
  goTo,
  gotTechniques,
  initialState,
  modeOf,
  readState,
  slotKey,
  slotsFilled,
  stepDone,
  tick,
} from "./steps.ts";

const STEPS: readonly open.Step[] = [
  { title: "Understand the task", gives: ["givens"], exit_condition: "givens_ticked" },
  { title: "Make a plan", gives: ["techniques"], exit_condition: "none" },
  { title: "Solve it", exit_condition: "answer_slots_filled" },
  { title: "Check the answer", exit_condition: "none" },
];

const CHOICE: open.Task = {
  id: "pick",
  statement: [{ text: "Pick." }],
  canvas: { kind: "handwriting_sheet" },
  givens: ["Two apples", "Three pears"],
  unknown: "How many fruits",
  items: [
    { text: "a)", answer_slots: [{ binding: "choice", options: ["4", "5"] }] },
    { answer_slots: [{ binding: "choice", options: ["yes", "no"] }] },
  ],
};

const SHEET: open.Task = {
  id: "ladder",
  statement: [{ text: "Count." }],
  canvas: { kind: "handwriting_sheet" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

const WORKBOOK: open.Task = {
  id: "page",
  statement: [{ text: "Fill in." }],
  canvas: { kind: "workbook" },
  items: [
    { line: [{ text: "7 × " }, { binding: "box" }, { text: " = 56" }] },
    { line: [{ text: "47 ÷ 6 = " }, { binding: "box" }, { text: " r " }, { binding: "box" }] },
  ],
};

describe("the exit conditions", () => {
  const state = initialState("steps");

  it("opens givens_ticked once every given and the unknown are ticked, and a second touch unticks", () => {
    const [understand] = STEPS as [open.Step];
    expect(exitMet(understand, CHOICE, state, null)).toBe(false);
    let ticked = tick(tick(state, 1), 0);
    expect(ticked.ticked.givens).toEqual([0, 1]);
    expect(exitMet(understand, CHOICE, ticked, null)).toBe(false);
    ticked = tick(ticked, "unknown");
    expect(exitMet(understand, CHOICE, ticked, null)).toBe(true);
    expect(exitMet(understand, CHOICE, tick(ticked, 0), null)).toBe(false);
    expect(tick(ticked, "unknown").ticked.unknown).toBe(false);
  });

  it("passes givens_ticked by itself on a task without chips", () => {
    expect(exitMet(STEPS[0] as open.Step, SHEET, state, null)).toBe(true);
    expect(givesChips(STEPS[0], SHEET)).toBe(false);
    expect(givesChips(STEPS[0], CHOICE)).toBe(true);
    expect(givesChips(STEPS[1], CHOICE)).toBe(false);
  });

  it("opens answer_slots_filled by the options tapped, the sheet's filled and a workbook's boxes", () => {
    const solve = STEPS[2] as open.Step;
    const one = choose(state, slotKey(1, 1), "5");
    expect(exitMet(solve, CHOICE, one, null)).toBe(false);
    expect(exitMet(solve, CHOICE, choose(one, slotKey(2, 1), "no"), null)).toBe(true);
    expect(slotsFilled(SHEET, {}, null)).toBe(false);
    expect(slotsFilled(SHEET, {}, [[true]])).toBe(true);
    expect(slotsFilled(WORKBOOK, {}, [[true], [true, false]])).toBe(false);
    expect(slotsFilled(WORKBOOK, {}, [[true], [true, true]])).toBe(true);
  });

  it("never fills a slot in a zone, which the canvas takes not", () => {
    const zone: open.Task = {
      ...SHEET,
      items: [
        { answer_slots: [{ binding: "zone", zone: { left: 0, top: 0, width: 1, height: 1 } }] },
      ],
    } as open.Task;
    expect(slotsFilled(zone, {}, [[true]])).toBe(false);
  });

  it("opens none at once, and a condition of a newer format too", () => {
    expect(exitMet(STEPS[1] as open.Step, CHOICE, state, null)).toBe(true);
    const newer = { title: "Say it", exit_condition: "spoken" } as unknown as open.Step;
    expect(exitMet(newer, CHOICE, state, null)).toBe(true);
  });

  it("tells a task answered by options alone from one with handwriting", () => {
    expect(choicesOnly(CHOICE)).toBe(true);
    expect(choicesOnly(SHEET)).toBe(false);
    expect(choicesOnly(WORKBOOK)).toBe(false);
    expect(choicesOnly({ ...SHEET, items: [] })).toBe(false);
  });
});

describe("the way through the steps", () => {
  it("goes forward by Step done and back to any step reached, resetting nothing", () => {
    let state = gotTechniques(tick(initialState("steps"), 0), 2, ["draw"]);
    state = stepDone(stepDone(state, STEPS), STEPS);
    expect([state.place, state.reached]).toEqual([3, 3]);
    state = goTo(state, 1);
    expect([state.place, state.reached]).toEqual([1, 3]);
    expect(state.ticked.givens).toEqual([0]);
    expect(state.techniques).toEqual({ 2: ["draw"] });
    expect(goTo(state, 4)).toBe(state);
    expect(goTo(state, 0)).toBe(state);
    expect(stepDone(goTo(state, 4), STEPS).reached).toBe(3);
  });

  it("stops at the last step", () => {
    let state = initialState("steps");
    for (let i = 0; i < 6; i++) state = stepDone(state, STEPS);
    expect([state.place, state.reached]).toEqual([4, 4]);
  });

  it("knows the steps that give techniques", () => {
    expect(STEPS.map(givesTechniques)).toEqual([false, true, false, false]);
    expect(givesTechniques(undefined)).toBe(false);
  });

  it("has only the mode on my own for a module without steps", () => {
    expect(modeOf(initialState("steps"), [])).toBe("self");
    expect(modeOf(initialState("steps"), STEPS)).toBe("steps");
    expect(modeOf(initialState("self"), STEPS)).toBe("self");
  });
});

describe("the state the database keeps", () => {
  const kept = {
    ...initialState("self"),
    place: 2,
    reached: 3,
    ticked: { givens: [1], unknown: true },
    techniques: { 2: ["draw"] },
    choices: { "1.1": "5" },
    wrongAnswers: 2,
  };

  it("reads back what it wrote, through JSON as IndexedDB clones it", () => {
    expect(readState(JSON.parse(JSON.stringify(kept)))).toEqual(kept);
  });

  it("takes a state of another shape for none", () => {
    for (const other of [
      undefined,
      null,
      "steps",
      [],
      { ...kept, mode: "alone" },
      { ...kept, place: 0 },
      { ...kept, place: 4 },
      { ...kept, ticked: { givens: [-1], unknown: false } },
      { ...kept, ticked: { givens: [], unknown: "no" } },
      { ...kept, ticked: null },
      { ...kept, techniques: { 2: [1] } },
      { ...kept, techniques: [] },
      { ...kept, choices: { "1.1": 5 } },
      { ...kept, choices: null },
      { ...kept, wrongAnswers: -1 },
      { ...kept, wrongAnswers: "1" },
    ]) {
      expect(readState(other), JSON.stringify(other)).toBeUndefined();
    }
  });

  it("goes back to the last step when the steps are fewer than when it was kept", () => {
    const fitted = fitState({ ...kept, place: 3, reached: 3 }, STEPS.slice(0, 2));
    expect([fitted.place, fitted.reached]).toEqual([2, 2]);
    expect(fitState(kept, []).place).toBe(1);
  });
});
