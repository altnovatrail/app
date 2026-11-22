import {
  SubmissionEnd,
  SubmitEssayResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { WORDS } from "../i18n/words.ts";
import { isEssay, noteOf, sentOf } from "./essay.ts";

const words = WORDS.en;

const sheet = (binding: "sheet" | "anywhere" | "choice"): open.Task => ({
  id: "t",
  statement: [{ text: "Write." }],
  canvas: { kind: "handwriting_sheet" },
  items: [
    {
      answer_slots: [binding === "choice" ? { binding, options: ["a", "b"] } : { binding }],
    },
  ],
});

const WORKBOOK: open.Task = {
  id: "w",
  statement: [{ text: "Fill in." }],
  canvas: { kind: "workbook" },
  items: [{ line: [{ text: "2 + 2 =" }, { binding: "box" }] }],
};

describe("an essay", () => {
  it("is an essay by an answer slot bound sheet alone", () => {
    expect(isEssay(sheet("sheet"))).toBe(true);
    expect(isEssay(sheet("anywhere"))).toBe(false);
    expect(isEssay(WORKBOOK)).toBe(false);
  });
});

describe("how a submission of an essay ended", () => {
  const answer = (init: Parameters<typeof create<typeof SubmitEssayResponseSchema>>[1]) =>
    sentOf(create(SubmitEssayResponseSchema, init));

  it("keeps the feedback and the text read, or no words when they did not pass", () => {
    expect(
      answer({ end: SubmissionEnd.FEEDBACK, text: "It rained.", feedback: "A good start." }),
    ).toEqual({ end: "feedback", text: "It rained.", feedback: "A good start." });
    const none = answer({ end: SubmissionEnd.FEEDBACK, text: "It rained." });
    expect(none).toEqual({ end: "feedback", text: "It rained." });
    expect(noteOf(none, words)).toBe("No feedback this time");
    expect(noteOf({ end: "feedback", feedback: "Good." }, words)).toBeUndefined();
  });

  it("says a repeat lost its words", () => {
    const repeat = answer({ end: SubmissionEnd.FEEDBACK, repeated: true });
    expect(repeat).toEqual({ end: "feedback", repeated: true });
    expect(noteOf(repeat, words)).toBe(
      "The feedback was lost on the way. Send the essay again to get it",
    );
  });

  it("says why an essay cannot be read, a reason unknown in common words", () => {
    const blank = answer({ end: SubmissionEnd.UNREADABLE, reason: "blank" });
    expect(blank).toEqual({ end: "unreadable", reason: "blank" });
    expect(noteOf(blank, words)).toBe(
      "The essay can't be read: Nothing is written. Write it again and send it",
    );
    expect(noteOf(answer({ end: SubmissionEnd.UNREADABLE, reason: "illegible" }), words)).toBe(
      "The essay can't be read: It can't be made out. Write it again and send it",
    );
    const odd = answer({ end: SubmissionEnd.UNREADABLE, reason: "smudged" });
    expect(noteOf(odd, words)).toContain("The essay can't be read");
    expect(answer({ end: SubmissionEnd.UNREADABLE })).toEqual({ end: "unreadable" });
  });

  it("says no check, by the outcome of the call when there is one; an unknown end is unchecked", () => {
    const unchecked = answer({ end: SubmissionEnd.UNCHECKED, text: "It rained." });
    expect(unchecked).toEqual({ end: "unchecked", text: "It rained." });
    expect(noteOf(unchecked, words)).toBe("The essay wasn't checked this time");
    expect(noteOf({ ...unchecked, outcome: { cause: Cause.AI_FAILURE } }, words)).toBe(
      "The tutor can't answer right now",
    );
    expect(answer({ end: SubmissionEnd.UNSPECIFIED, feedback: "x", reason: "blank" })).toEqual({
      end: "unchecked",
    });
  });
});
