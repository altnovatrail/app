// The counts of a module's skills on its card: by the function ./states of skill-map, the
// five states with a verdict and the two marks, a status the build does not know left out; and the
// skills the choice of a module's task skill offers.
import { GetSkillMapResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { describe, expect, it } from "vitest";
import { countsOf, judged, picksOf, type SkillStatus, skillCounts } from "./states.ts";

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

describe("the skills the choice of a module's task skill offers", () => {
  const graph = {
    tiers: ["Warm-up"],
    skills: {
      a: { title: "A", assessability: "verdict" },
      b: { title: "B", assessability: "verdict" },
      c: { title: "C", assessability: "verdict" },
      d: { title: "D", assessability: "rubric" },
      e: { title: "E", assessability: "verdict" },
    },
  } as unknown as Parameters<typeof picksOf>[1];
  const statuses = new Map<string, SkillStatus>([
    ["a", "mastered"],
    ["b", "ready-to-start"],
    ["c", "in-progress"],
    ["d", "feedback-by-criteria"],
    ["e", "time-to-review"],
  ]);
  const full = (id: string) => `m/skill/${id}`;

  it("suggests three: due for review, then begun, then ready to start, then with a rubric", () => {
    const picks = picksOf("m", graph, statuses, { a: 1, b: 1, c: 2, d: 2, e: 3 });
    expect(picks.suggested.map((pick) => pick.skill)).toEqual([full("e"), full("c"), full("b")]);
    expect(picks.suggested[0]).toEqual({ skill: full("e"), title: "E", status: "time-to-review" });
  });

  it("groups every skill by its tier, named where the graph names it, one with none last", () => {
    const picks = picksOf("m", graph, statuses, { a: 1, b: 1, c: 2, e: 2 });
    expect(picks.tiers.map((tier) => [tier.name, tier.skills.map((pick) => pick.title)])).toEqual([
      ["Warm-up", ["A", "B"]],
      [undefined, ["C", "E"]],
      [undefined, ["D"]],
    ]);
  });
});
