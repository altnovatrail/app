// The counts of a module's skills on its card (R62): by the function ./states of skill-map, the
// five states with a verdict and the two marks, a status the build does not know left out, and the
// segments of the bar in the legend's order, the states with no skill left out.
import { GetSkillMapResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import {
  chainPlace,
  countsOf,
  judged,
  type SkillStatus,
  segmentsOf,
  skillCounts,
  skillToWork,
} from "./states.ts";

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

describe("the place in a chain", () => {
  const graph = {
    skills: {
      a: { title: "A", assessability: "verdict" },
      b: { title: "B", assessability: "verdict" },
      c: { title: "C", assessability: "verdict" },
    },
  } as unknown as Parameters<typeof chainPlace>[0];
  const tiers = { a: 0, b: 1, c: 2 };

  it("is the first skill not mastered by the tiers, with the one after it", () => {
    expect(
      chainPlace(
        graph,
        new Map<string, SkillStatus>([
          ["c", "locked"],
          ["b", "in-progress"],
          ["a", "mastered"],
        ]),
        tiers,
      ),
    ).toEqual({ step: 2, total: 3, mastered: 1, current: "B", next: "C" });
  });

  it("has no skill to work on past the last", () => {
    const all = new Map<string, SkillStatus>([
      ["a", "mastered"],
      ["b", "mastered"],
      ["c", "mastered"],
    ]);
    expect(chainPlace(graph, all, tiers)).toEqual({ step: 3, total: 3, mastered: 3 });
  });
});

describe("the skill a card's Continue works on", () => {
  const statuses = new Map([
    ["a", "mastered"],
    ["b", "ready-to-start"],
    ["c", "time-to-review"],
    ["d", "in-progress"],
  ] as const);
  it("is a chain's first skill not mastered, by its tiers", () => {
    expect(skillToWork(statuses, { a: 0, b: 2, c: 1, d: 3 })).toBe("c");
  });
  it("is the first skill begun, else due, else ready to start, in an adaptive module", () => {
    expect(skillToWork(statuses, undefined)).toBe("d");
    expect(
      skillToWork(
        new Map([
          ["b", "ready-to-start"],
          ["c", "time-to-review"],
        ]),
        undefined,
      ),
    ).toBe("c");
    expect(
      skillToWork(
        new Map([
          ["a", "mastered"],
          ["e", "locked"],
        ]),
        undefined,
      ),
    ).toBeUndefined();
  });
});
