// The states of a module's skills on its card (R148 spec; R62): the state or mark of each skill is
// what the function ./states of skill-map gives — the very rule its map draws by (R03 skill-map) —,
// so that the card and the map never part, and the card counts them: the five states of a skill
// with a verdict on its bar, in the order of the mockup's legend, and the two marks of the rest
// beside it. No DOM.
import type { GetSkillMapResponse } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { type SkillStatus, skillStates } from "@altnovatrail/skill-map/states";
import type * as open from "@altnovatrail/spec/formatv0/open";

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

/** One segment of a module's bar: its state and its share of the bar, in per cent. */
export interface Segment {
  readonly state: (typeof STATES)[number];
  readonly percent: number;
}

/** The segments of the bar, the states with no skill left out; none for a module with no verdict. */
export function segmentsOf(counts: SkillCounts): Segment[] {
  const all = judged(counts);
  if (all === 0) return [];
  return STATES.filter((state) => counts[state] > 0).map((state) => ({
    state,
    percent: (counts[state] / all) * 100,
  }));
}
