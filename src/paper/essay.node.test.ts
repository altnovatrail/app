import {
  SubmissionEnd,
  SubmitEssayResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { WORDS } from "../i18n/words.ts";
import { essaySentOf, isEssay } from "./essay.ts";
import { paperCard, tutorActs } from "./solve.ts";

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
    essaySentOf(create(SubmitEssayResponseSchema, init));
  const card = (init: Parameters<typeof answer>[0]) => paperCard(answer(init).verdict, words);

  it("gives the feedback's words, its card saying they are in the panel", () => {
    expect(
      answer({ end: SubmissionEnd.FEEDBACK, text: "It rained.", feedback: "A good start." }),
    ).toEqual({ verdict: { kind: "feedback" }, feedback: "A good start." });
    expect(card({ end: SubmissionEnd.FEEDBACK, feedback: "A good start." })).toEqual({
      kind: "feedback",
      title: "Feedback",
      line: "The feedback is in the tutor's panel. Write again, or tap Done.",
    });
  });

  it("says no feedback this time when the words did not pass, and a repeat lost them", () => {
    expect(card({ end: SubmissionEnd.FEEDBACK, text: "It rained." }).line).toBe(
      "No feedback this time",
    );
    const repeat = answer({ end: SubmissionEnd.FEEDBACK, repeated: true });
    expect(repeat).toEqual({ verdict: { kind: "feedback", note: "lost" } });
    expect(paperCard(repeat.verdict, words).line).toBe(
      "The feedback was lost on the way. Send the essay again to get it",
    );
  });

  it("says why an essay cannot be read", () => {
    expect(card({ end: SubmissionEnd.UNREADABLE, reason: "blank" })).toEqual({
      kind: "write",
      title: "Can't read this",
      line: "Nothing is written",
    });
  });

  it("says no check, by the outcome of the call; an unknown end is unchecked", () => {
    expect(card({ end: SubmissionEnd.UNCHECKED, outcome: { cause: Cause.AI_FAILURE } })).toEqual({
      kind: "write",
      title: "Not checked",
      line: "The tutor can't answer right now",
    });
    expect(answer({ end: SubmissionEnd.UNSPECIFIED, feedback: "x", reason: "blank" })).toEqual({
      verdict: { kind: "unchecked", outcome: undefined },
    });
  });

  it("keeps Hint beside the feedback till Done solves the essay, with no next task before", () => {
    expect(tutorActs({ verdict: { kind: "feedback" } })).toEqual({ hint: true, next: false });
    expect(tutorActs({ verdict: { kind: "feedback" }, solved: true })).toEqual({
      hint: false,
      next: true,
    });
  });
});
