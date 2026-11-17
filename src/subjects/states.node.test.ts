// The counts of a module's skills on its card (R62 in docs/decisions.md): by the function ./states
// of skill-map, the five states with a verdict and the two marks, a status the build does not know
// left out, and the segments of the bar in the legend's order, the states with no skill left out.
import { GetSkillMapResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { countsOf, judged, type SkillStatus, segmentsOf, skillCounts } from "./states.ts";

describe("the states of a module's skills", () => {
  it("counts each state and mark, and leaves out one the build does not know", () => {
    const counts = countsOf(
      new Map<string, SkillStatus>([
        ["a", "mastered"],
        ["b", "mastered"],
        ["c", "locked"],
        ["d", "feedback-by-criteria"],
        ["e", "sleeping" as SkillStatus],
      ]),
    );
    expect(counts).toEqual({
      mastered: 2,
      "time-to-review": 0,
      "in-progress": 0,
      "ready-to-start": 0,
      locked: 1,
      "feedback-by-criteria": 1,
      "not-assessed": 0,
    });
    expect(judged(counts)).toBe(3);
    expect(segmentsOf(counts)).toEqual([
      { state: "mastered", percent: (2 / 3) * 100 },
      { state: "locked", percent: (1 / 3) * 100 },
    ]);
  });

  it("has no segment for a module with no skill with a verdict", () => {
    expect(segmentsOf(countsOf(new Map([["a", "not-assessed"]])))).toEqual([]);
  });

  it("takes the state of each skill from skill-map's rule, on the graph and the answer", () => {
    const counts = skillCounts(
      {
        skills: {
          a: { title: "A", assessability: "verdict" },
          b: { title: "B", assessability: "verdict", prerequisites: ["a"] },
          c: { title: "C", assessability: "none" },
        },
      } as Parameters<typeof skillCounts>[0],
      create(GetSkillMapResponseSchema, {
        packageDigest: "d",
        skills: [{ skill: "a" }, { skill: "b" }],
      }),
      new Date("2026-11-17T12:00:00Z"),
    );
    expect(counts["ready-to-start"]).toBe(1);
    expect(counts.locked).toBe(1);
    expect(counts["not-assessed"]).toBe(1);
  });
});
