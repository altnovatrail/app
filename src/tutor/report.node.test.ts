import { ProblemKind, TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { describe, expect, it } from "vitest";
import { KINDS, reportRequest, type Said, unsendable } from "./report.ts";

const RUNG: Said = { text: "Count the gaps.", reply: TutorReply.RUNG, rung: 2 };

describe("a report of a problem", () => {
  it("offers the six kinds of the contract, each once, and never the one not named", () => {
    const named = Object.values(ProblemKind).filter(
      (value): value is ProblemKind =>
        typeof value === "number" && value !== ProblemKind.UNSPECIFIED,
    );
    expect(KINDS.map(([kind]) => kind).sort()).toEqual(named.sort());
    expect(new Set(KINDS.map(([, word]) => word)).size).toBe(6);
  });

  it("goes with a kind, and Something else with a text", () => {
    expect(unsendable(undefined, "text")).toBe("report.no-kind");
    expect(unsendable(ProblemKind.OTHER, "  ")).toBe("report.no-text");
    expect(unsendable(ProblemKind.OTHER, "In another language")).toBeUndefined();
    expect(unsendable(ProblemKind.WRONG, "")).toBeUndefined();
  });

  it("names the rung beside a rung's words and Explain differently, and none beside a correct answer", () => {
    const fields = { profileId: "p1", attemptId: "a1", key: "k1", kind: ProblemKind.WRONG };
    expect(reportRequest({ ...fields, said: RUNG, text: "  Not so.\n" })).toEqual({
      profileId: "p1",
      attemptId: "a1",
      idempotencyKey: "k1",
      reply: TutorReply.RUNG,
      rung: 2,
      words: "Count the gaps.",
      kind: ProblemKind.WRONG,
      text: "Not so.",
    });
    const explained = { ...RUNG, reply: TutorReply.EXPLAINED_DIFFERENTLY };
    expect(reportRequest({ ...fields, said: explained, text: "" }).rung).toBe(2);
    const correct = { text: "Well done.", reply: TutorReply.CORRECT_ANSWER, rung: 0 };
    expect(reportRequest({ ...fields, said: correct, text: "" })).not.toHaveProperty("rung");
    const essay = { text: "A clear plan.", reply: TutorReply.ESSAY_FEEDBACK, rung: 0 };
    expect(reportRequest({ ...fields, said: essay, text: "" })).not.toHaveProperty("rung");
  });
});
