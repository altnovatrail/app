import type {
  DemoState,
  ExportedWork,
  HistoryEvent,
  SheetSubmission,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import { DAY, memoryDevice } from "../test/device.ts";
import {
  addProfile,
  openProfile,
  openProfileDatabase,
  type Profile,
  profileUsage,
  sizeOf,
  type Work,
  workOf,
} from "./profile.ts";
import { addDatabase, eraseDatabases } from "./registry.ts";
import { KEEP_MS, PROFILE_SCHEMA, profileDatabase } from "./schema.ts";

const TASK: open.Task = {
  id: "probe",
  statement: [{ text: "Write the answer." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};
const LESSON: open.Lesson = { id: "gaps", title: "Gaps", segments: [{ task: "probe" }] };

function write(id: number, t: number): HistoryEvent {
  return {
    kind: "write",
    t,
    stroke: { id, kind: "mouse", points: [{ x: 10.25, y: 20.5, t, p: 0.5 }] },
  };
}

const CONTEXT: SheetSubmission = {
  crop: {
    drawn: 24,
    width: 100,
    height: 50,
    margins: [4, 4],
    sheetBox: [10.123456789, 1, 30, 40],
    frames: [{ label: "A", box: [0, 0, 1000, 1000] }],
    exact: { box: { minX: 1, minY: 2, maxX: 3, maxY: 4 }, median: 7 },
  },
  groups: [{ label: "A", ids: [1] }],
  digest: "0123456789abcdef",
};

const work = (text: string): ExportedWork => ({ png: new Blob([text]), submission: CONTEXT });

async function setUp() {
  const setup = memoryDevice();
  const found = await addProfile(setup.device, "p1");
  if (found === undefined) throw new Error("no profile");
  await found.beginAttempt({ attemptId: "a1", digest: "d1", task: TASK });
  return { ...setup, profile: found };
}

/** The crop of a sheet's work, which a test expects there. */
function crop(work: Work | undefined): Blob {
  if (work === undefined || !("png" in work)) throw new Error("no crop");
  return work.png;
}

const historyOf = async (profile: Profile, attemptId = "a1") =>
  (await profile.readAttempt(attemptId))?.history;

describe("the profile's database", () => {
  it("opens only when the registry names it and it is not to be erased", async () => {
    const { device, backend } = memoryDevice();
    expect(await openProfile(device, "p1")).toBeUndefined();
    expect(backend.databases.has(profileDatabase("p1"))).toBe(false);
    await addDatabase(device, profileDatabase("p1"), { kind: "profile", profileId: "p1" });
    expect(await openProfile(device, "p1")).toBeDefined();
    backend.blocked.add(profileDatabase("p1"));
    await eraseDatabases(device, [profileDatabase("p1")]);
    expect(await openProfile(device, "p1")).toBeUndefined();
    expect(await openProfileDatabase(device, profileDatabase("p2"))).toBeUndefined();
  });

  it("adds what each historychange tells, as the canvas gave it, and changes the attempt", async () => {
    const { profile, state } = await setUp();
    state.time += 1000;
    expect(await profile.appendHistory("a1", { from: 0, events: [write(1, 0), write(2, 5)] })).toBe(
      "saved",
    );
    expect(await profile.appendHistory("a1", { from: 2, events: [write(3, 9)] })).toBe("saved");
    const stored = await profile.readAttempt("a1");
    expect(stored?.history).toEqual([write(1, 0), write(2, 5), write(3, 9)]);
    expect(stored?.attempt).toEqual({
      attemptId: "a1",
      digest: "d1",
      task: TASK,
      changedAt: state.time,
    });
  });

  it("says a history missed events when its length is not `from`, and takes the whole history then", async () => {
    const { profile } = await setUp();
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    expect(await profile.appendHistory("a1", { from: 2, events: [write(3, 9)] })).toBe("missed");
    expect(await profile.appendHistory("a1", { from: 0, events: [write(2, 9)] })).toBe("missed");
    expect(await historyOf(profile)).toEqual([write(1, 0)]);
    const whole = [write(1, 0), write(2, 5), write(3, 9)];
    expect(await profile.replaceHistory("a1", whole)).toBe("saved");
    expect(await historyOf(profile)).toEqual(whole);
    expect(await profile.replaceHistory("a1", [write(1, 0)])).toBe("saved");
    expect(await historyOf(profile)).toEqual([write(1, 0)]);
  });

  it("says the work is not saved when a write is refused or the attempt is not there, and keeps nothing of it", async () => {
    const { profile, backend } = await setUp();
    expect(await profile.appendHistory("none", { from: 0, events: [write(1, 0)] })).toBe("unsaved");
    expect(await profile.replaceHistory("none", [write(1, 0)])).toBe("unsaved");
    expect(await profile.addSubmission("none", work("x"), 1)).toBe("unsaved");
    expect(await profile.saveSteps("none", {})).toBe("unsaved");
    backend.refuseWrites = true;
    expect(await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] })).toBe("unsaved");
    expect(await profile.beginAttempt({ attemptId: "a2", digest: "d1", task: TASK })).toBe(
      "unsaved",
    );
    backend.refuseWrites = false;
    expect(await historyOf(profile)).toEqual([]);
    expect(await profile.readAttempt("a2")).toBeUndefined();
  });

  it("keeps each submission's context unrounded, the history's length then, and its work", async () => {
    const { profile } = await setUp();
    expect(await profile.addSubmission("a1", work("first"), 3)).toBe(0);
    const cells: ExportedWork = {
      cells: [{ item: 1, slot: 1, png: new Blob(["box"]) }],
      submission: { boxes: [{ item: 1, slot: 1, ids: [1] }], digest: "fedcba9876543210" },
    };
    expect(await profile.addSubmission("a1", cells, 5)).toBe(1);
    const [sheet, workbook] = (await profile.readAttempt("a1"))?.submissions ?? [];
    expect(sheet?.context).toEqual(CONTEXT);
    expect(sheet?.historyLength).toBe(3);
    expect(await crop(sheet?.work).text()).toBe("first");
    expect(workbook?.context).toEqual(cells.submission);
    expect(workbook?.historyLength).toBe(5);
    expect("cells" in (workbook?.work ?? {})).toBe(true);
  });

  it("keeps the state of the steps with the attempt", async () => {
    const { profile } = await setUp();
    expect(await profile.saveSteps("a1", { mode: "steps", step: 2 })).toBe("saved");
    expect((await profile.readAttempt("a1"))?.attempt.steps).toEqual({ mode: "steps", step: 2 });
  });

  it("begins an attempt afresh, with no history or submission left under its ID", async () => {
    const { profile } = await setUp();
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    await profile.addSubmission("a1", work("x"), 1);
    await profile.beginAttempt({ attemptId: "a1", digest: "d2", task: TASK });
    const stored = await profile.readAttempt("a1");
    expect(stored?.history).toEqual([]);
    expect(stored?.submissions).toEqual([]);
    expect(stored?.attempt.digest).toBe("d2");
  });

  it("erases an ended attempt whole, but the correct submission's work until the words after it", async () => {
    const { profile, backend } = await setUp();
    await profile.beginAttempt({ attemptId: "a2", digest: "d1", task: TASK });
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    await profile.addSubmission("a1", work("wrong"), 1);
    await profile.addSubmission("a1", work("right"), 1);
    await profile.appendHistory("a2", { from: 0, events: [write(1, 0)] });
    await profile.attemptEnded("a1", 1);
    expect(await profile.readAttempt("a1")).toBeUndefined();
    const name = profileDatabase("p1");
    expect(backend.records(name, "history").map((entry) => entry.key)).toEqual([["a2", 0]]);
    expect(backend.records(name, "submissions")).toEqual([]);
    const kept = await profile.correctWork("a1");
    expect(await crop(kept).text()).toBe("right");
    await profile.wordsCame("a1");
    expect(await profile.correctWork("a1")).toBeUndefined();
    await profile.attemptEnded("a2", 7);
    expect(await profile.correctWork("a2")).toBeUndefined();
    expect(backend.records(name, "attempts")).toEqual([]);
  });

  it("clears at the start the work of correct submissions whose words never came", async () => {
    const { profile } = await setUp();
    await profile.addSubmission("a1", work("right"), 0);
    await profile.attemptEnded("a1", 0);
    await profile.clearCorrectWork();
    expect(await profile.correctWork("a1")).toBeUndefined();
  });
});

describe("the work in bytes", () => {
  const png = (text: string) => new Blob([text], { type: "image/png" });

  it("keeps each picture as bytes with its type, and gives it back as a Blob", async () => {
    const { profile, backend } = await setUp();
    await profile.addSubmission("a1", { png: png("crop"), submission: CONTEXT }, 1);
    const cells: ExportedWork = {
      cells: [{ item: 1, slot: 2, png: png("box") }],
      submission: { boxes: [{ item: 1, slot: 2, ids: [1] }], digest: "fedcba9876543210" },
    };
    await profile.addSubmission("a1", cells, 2);
    const [sheet, workbook] = backend
      .records(profileDatabase("p1"), "submissions")
      .map((entry) => entry.value);
    const kept = (sheet as { work: { png: { bytes: unknown; type: string } } }).work.png;
    expect(kept.bytes).toBeInstanceOf(ArrayBuffer);
    expect(kept.type).toBe("image/png");
    const box = (workbook as { work: { cells: { item: number; png: unknown }[] } }).work;
    expect(box.cells[0]).toMatchObject({ item: 1, slot: 2, png: { type: "image/png" } });
    const [first, second] = (await profile.readAttempt("a1"))?.submissions ?? [];
    expect(first?.work).toEqual({ png: expect.any(Blob) });
    expect(await crop(first?.work).text()).toBe("crop");
    expect(crop(first?.work).type).toBe("image/png");
    const cell =
      second?.work !== undefined && "cells" in second.work ? second.work.cells[0] : undefined;
    expect(cell).toMatchObject({ item: 1, slot: 2 });
    expect(await cell?.png.text()).toBe("box");
    await profile.attemptEnded("a1", 0);
    expect(await crop(await profile.correctWork("a1")).text()).toBe("crop");
  });

  it("reads a Blob that schema version 1 kept, of a sheet and of a workbook", async () => {
    const { device } = await setUp();
    const connection = await device.connect(profileDatabase("p1"), PROFILE_SCHEMA, false);
    await connection?.write(["submissions", "correctWork"], async (tx) => {
      await tx.put("submissions", ["a1", 0], {
        context: CONTEXT,
        historyLength: 1,
        work: { png: png("old") },
      });
      await tx.put("submissions", ["a1", 1], {
        context: CONTEXT,
        historyLength: 1,
        work: { cells: [{ item: 1, slot: 1, png: png("old box") }] },
      });
      await tx.put("correctWork", "a0", { png: png("old right") });
    });
    const profile = await openProfile(device, "p1");
    const [sheet, workbook] = (await profile?.readAttempt("a1"))?.submissions ?? [];
    expect(await crop(sheet?.work).text()).toBe("old");
    expect(workbook?.work !== undefined && "cells" in workbook.work).toBe(true);
    expect(await crop(await profile?.correctWork("a0")).text()).toBe("old right");
  });

  it("gives none for a work it cannot read, and keeps its record", async () => {
    const { device, backend } = await setUp();
    const connection = await device.connect(profileDatabase("p1"), PROFILE_SCHEMA, false);
    await connection?.write(["submissions"], (tx) =>
      tx.put("submissions", ["a1", 0], { context: CONTEXT, historyLength: 1, work: { svg: "x" } }),
    );
    const profile = await openProfile(device, "p1");
    const [kept] = (await profile?.readAttempt("a1"))?.submissions ?? [];
    expect(kept?.context).toEqual(CONTEXT);
    expect(kept?.work).toBeUndefined();
    expect(backend.records(profileDatabase("p1"), "submissions")).toHaveLength(1);
    for (const odd of [null, "png", { png: { bytes: "x", type: "image/png" } }, { cells: "x" }]) {
      expect(workOf(odd)).toBeUndefined();
    }
    expect(workOf({ cells: [{ item: 1, slot: 1, png: {} }] })).toBeUndefined();
  });

  it("gives the attempt and its history when its submissions cannot be read, and erases nothing", async () => {
    const { profile, backend } = await setUp();
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    await profile.addSubmission("a1", work("x"), 1);
    backend.unreadable.add("submissions");
    const stored = await profile.readAttempt("a1");
    expect(stored?.history).toEqual([write(1, 0)]);
    expect(stored?.submissions).toBeUndefined();
    backend.unreadable.clear();
    expect((await profile.readAttempt("a1"))?.submissions).toHaveLength(1);
  });

  it("ends an attempt whole when its correct submission cannot be read", async () => {
    const { profile, backend } = await setUp();
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    await profile.addSubmission("a1", work("right"), 1);
    backend.unreadable.add("submissions");
    await profile.attemptEnded("a1", 0);
    backend.unreadable.clear();
    expect(await profile.readAttempt("a1")).toBeUndefined();
    expect(backend.records(profileDatabase("p1"), "history")).toEqual([]);
    expect(await profile.correctWork("a1")).toBeUndefined();
  });

  it("says the work is not saved when its bytes cannot be read", async () => {
    const { profile, backend } = await setUp();
    const broken = new Blob(["x"]);
    broken.arrayBuffer = () => Promise.reject(new DOMException("gone", "NotReadableError"));
    expect(await profile.addSubmission("a1", { png: broken, submission: CONTEXT }, 1)).toBe(
      "unsaved",
    );
    expect(backend.records(profileDatabase("p1"), "submissions")).toEqual([]);
  });
});

describe("what a profile keeps on this device", () => {
  it("counts its unfinished attempts and about how many bytes its records take", async () => {
    const { device, profile, backend } = await setUp();
    const empty = await profileUsage(device, "p1");
    expect(empty).toMatchObject({ unfinished: 1 });
    await profile.addSubmission(
      "a1",
      { png: new Blob([new Uint8Array(5000)]), submission: CONTEXT },
      0,
    );
    const before = typeof empty === "object" ? (empty.bytes ?? 0) : 0;
    const after = await profileUsage(device, "p1");
    expect(typeof after === "object" ? after.bytes : 0).toBeGreaterThan(before + 5000);
    // A record that cannot be read leaves the count, and the size is not known.
    backend.unreadable.add("submissions");
    expect(await profileUsage(device, "p1")).toEqual({ unfinished: 1, bytes: undefined });
    backend.unreadable.clear();
    expect(await profileUsage(device, "p2")).toBeUndefined();
    backend.blocked.add(profileDatabase("p1"));
    await eraseDatabases(device, [profileDatabase("p1")]);
    expect(await profileUsage(device, "p1")).toBe("erasing");
    backend.blocked.clear();
    await eraseDatabases(device, [profileDatabase("p1")]);
    expect(await profileUsage(device, "p1")).toBeUndefined();
  });

  it("sizes strings in UTF-8, numbers by eight bytes, pictures by their size", () => {
    expect(sizeOf("ёж")).toBe(4);
    expect(sizeOf(0.5)).toBe(8);
    expect(sizeOf(new ArrayBuffer(3))).toBe(3);
    expect(sizeOf(new Blob(["abcd"]))).toBe(4);
    expect(sizeOf([1, "a"])).toBe(9);
    expect(sizeOf({ ab: true, c: null })).toBe(5);
  });
});

describe("the state of a lesson", () => {
  const demo: Record<number, DemoState> = { 2: { opened: 3, hidden: true } };
  const state = { lessonId: "gaps", digest: "d1", passageId: "s1", view: LESSON, place: 3, demo };

  it("comes back on the same package and passage", async () => {
    const { profile } = await setUp();
    expect(await profile.saveLesson(state)).toBe("saved");
    expect(await profile.readLesson("gaps", "d1", "s1")).toMatchObject(state);
    expect(await profile.readLesson("other", "d1", "s1")).toBeUndefined();
  });

  it("is over on another package or in another passage, and goes", async () => {
    const { profile, backend } = await setUp();
    await profile.saveLesson(state);
    expect(await profile.readLesson("gaps", "d2", "s1")).toBeUndefined();
    expect(backend.records(profileDatabase("p1"), "lessons")).toEqual([]);
    await profile.saveLesson(state);
    expect(await profile.readLesson("gaps", "d1", "s2")).toBeUndefined();
    expect(await profile.readLesson("gaps", "d1", "s1")).toBeUndefined();
  });

  it("goes when the lesson ended, and a new passage takes the place of the one kept", async () => {
    const { profile } = await setUp();
    await profile.saveLesson(state);
    await profile.saveLesson({ ...state, passageId: "s2", place: 1 });
    expect(await profile.readLesson("gaps", "d1", "s2")).toMatchObject({ place: 1 });
    await profile.lessonEnded("gaps");
    expect(await profile.readLesson("gaps", "d1", "s2")).toBeUndefined();
  });

  it("says it is not saved when the write is refused", async () => {
    const { profile, backend } = await setUp();
    backend.refuseWrites = true;
    expect(await profile.saveLesson(state)).toBe("unsaved");
  });
});

describe("withdrawal and the term", () => {
  it("takes the open views of a withdrawn version's tasks and its lessons, and leaves the rest", async () => {
    const { profile } = await setUp();
    await profile.beginAttempt({ attemptId: "a2", digest: "d2", task: TASK });
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    const lesson = { lessonId: "gaps", passageId: "s1", view: LESSON, place: 1, demo: {} };
    await profile.saveLesson({ ...lesson, digest: "d1" });
    await profile.saveLesson({ ...lesson, lessonId: "days", digest: "d2" });
    await profile.withdraw(["d1", "d9"]);
    const a1 = await profile.readAttempt("a1");
    expect(a1?.attempt.task).toBeUndefined();
    expect(a1?.history).toEqual([write(1, 0)]);
    expect((await profile.readAttempt("a2"))?.attempt.task).toEqual(TASK);
    expect(await profile.readLesson("gaps", "d1", "s1")).toBeUndefined();
    expect(await profile.readLesson("days", "d2", "s1")).toBeDefined();
  });

  it("erases attempts and lessons unchanged for 30 days, with their work, and keeps the newer", async () => {
    const { profile, state, backend } = await setUp();
    await profile.appendHistory("a1", { from: 0, events: [write(1, 0)] });
    await profile.addSubmission("a1", work("x"), 1);
    await profile.saveLesson({
      lessonId: "old",
      digest: "d1",
      passageId: "s1",
      view: LESSON,
      place: 1,
      demo: {},
    });
    const old = state.time;
    state.time += DAY;
    await profile.beginAttempt({ attemptId: "a2", digest: "d1", task: TASK });
    await profile.expire(old - 1);
    expect(await profile.readAttempt("a1")).toBeDefined();
    await profile.expire(old);
    expect(await profile.readAttempt("a1")).toBeUndefined();
    expect(await profile.readLesson("old", "d1", "s1")).toBeUndefined();
    expect(await profile.readAttempt("a2")).toBeDefined();
    const name = profileDatabase("p1");
    expect(backend.records(name, "history")).toEqual([]);
    expect(backend.records(name, "submissions")).toEqual([]);
    expect(KEEP_MS).toBe(30 * DAY);
  });
});
