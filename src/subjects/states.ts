// The states of a module's skills on its card: the state or mark of each skill is
// what the function ./states of skill-map gives — the very rule its map draws by —,
// so that the card and the map never part, and the card counts them: the five states of a skill
// with a verdict on its bar, in the order of the mockup's legend, and the two marks of the rest
// beside it; and the skills the choice of a module's task skill offers. No DOM.
import type { GetSkillMapResponse } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { type SkillStatus, skillStates } from "@altnovatrail/skill-map/states";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { SkillPick, SkillPicks } from "./modules.ts";

export type { SkillStatus };

/** The states of a skill with a verdict, as the bar and the legend order them. */
export const STATES = [
  "mastered",
  "time-to-review",
  "in-progress",
  "ready-to-start",
  "locked",
] as const satisfies readonly SkillStatus[];

/** The marks of a skill with a rubric and of one not assessed, after the states in the legend. */
export const MARKS = [
  "feedback-by-criteria",
  "not-assessed",
] as const satisfies readonly SkillStatus[];

/** How many of a module's skills have each state or mark. */
export type SkillCounts = Readonly<Record<SkillStatus, number>>;

/** The counts of the states and marks of a map of skills, a status the build does not know left out. */
export function countsOf(statuses: ReadonlyMap<string, SkillStatus>): SkillCounts {
  const counts: Record<string, number> = {};
  for (const status of [...STATES, ...MARKS]) counts[status] = 0;
  for (const status of statuses.values()) {
    if (Object.hasOwn(counts, status)) counts[status] = (counts[status] as number) + 1;
  }
  return counts as SkillCounts;
}

/** The counts of a module's skills by its skill graph and the answer of GetSkillMap, at a time. */
export function skillCounts(
  graph: open.SkillGraph,
  skillMap: GetSkillMapResponse,
  now: Date,
): SkillCounts {
  return countsOf(skillStates(graph, skillMap, now));
}

/** The skills with a verdict, whose states the bar shows. */
export function judged(counts: SkillCounts): number {
  return STATES.reduce((sum, state) => sum + counts[state], 0);
}

/** The states whose skills the tutor suggests for a module's tasks, in that order. */
const SUGGESTED: readonly SkillStatus[] = [
  "time-to-review",
  "in-progress",
  "ready-to-start",
  "feedback-by-criteria",
];

/**
 * The skills of a module for the choice of its task skill, by its skill graph, the skills'
 * statuses and the tiers of the graph: three suggested, and every skill by its tier, a skill with
 * no tier after them.
 */
export function picksOf(
  moduleId: string,
  graph: open.SkillGraph,
  statuses: ReadonlyMap<string, SkillStatus>,
  tiers: Readonly<Record<string, number>>,
): SkillPicks {
  const ids = [...statuses.keys()];
  // The full ID, as skill-map's fullSkillId joins it.
  const pick = (id: string): SkillPick => ({
    skill: `${moduleId}/skill/${id}`,
    title: graph.skills[id]?.title ?? id,
    status: statuses.get(id) as SkillStatus,
  });
  const suggested = SUGGESTED.flatMap((state) => ids.filter((id) => statuses.get(id) === state))
    .slice(0, 3)
    .map(pick);
  const by = new Map<number, string[]>();
  for (const id of ids) {
    const tier = tiers[id] ?? Number.MAX_SAFE_INTEGER;
    by.set(tier, [...(by.get(tier) ?? []), id]);
  }
  return {
    suggested,
    tiers: [...by.keys()]
      .sort((a, b) => a - b)
      .map((tier) => {
        // The format numbers the tiers from 1 and names them in that order.
        const name = tier === Number.MAX_SAFE_INTEGER ? undefined : graph.tiers?.[tier - 1];
        return {
          ...(name === undefined ? {} : { name }),
          skills: (by.get(tier) as string[]).map(pick),
        };
      }),
  };
}
