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

/**
 * Where the learner stands in a module whose skills go in a chain (R06): the skill to work on —
 * the first not mastered in the order of the tiers — by its place from 1 and its title, the one
 * after it, and how many are mastered of all; past the last, no skill to work on.
 */
export interface ChainPlace {
  readonly step: number;
  readonly total: number;
  readonly mastered: number;
  readonly current?: string;
  readonly next?: string;
}

/** The states a card's Continue works on, the first that has a skill: begun, then due, then new. */
const TO_WORK: readonly SkillStatus[] = ["in-progress", "time-to-review", "ready-to-start"];

/**
 * The ID in the module of the skill its card's Continue works on: a chain's skill to work on, the
 * first not mastered in the order of the tiers; else the first skill begun, else due, else ready
 * to start, in the graph's order; none when no skill is any of them, and the map is the way.
 */
export function skillToWork(
  statuses: ReadonlyMap<string, SkillStatus>,
  tiers: Readonly<Record<string, number>> | undefined,
): string | undefined {
  if (tiers !== undefined) {
    const order = [...statuses.keys()].sort(
      (a, b) => (tiers[a] ?? Number.MAX_SAFE_INTEGER) - (tiers[b] ?? Number.MAX_SAFE_INTEGER),
    );
    return order.find((id) => statuses.get(id) !== "mastered");
  }
  for (const state of TO_WORK) {
    for (const [id, status] of statuses) if (status === state) return id;
  }
  return undefined;
}

/** The place in a chain, by the graph's titles, the skills' statuses and the tiers of the graph. */
export function chainPlace(
  graph: open.SkillGraph,
  statuses: ReadonlyMap<string, SkillStatus>,
  tiers: Readonly<Record<string, number>>,
): ChainPlace {
  const order = [...statuses.keys()].sort(
    (a, b) => (tiers[a] ?? Number.MAX_SAFE_INTEGER) - (tiers[b] ?? Number.MAX_SAFE_INTEGER),
  );
  const at = order.findIndex((id) => statuses.get(id) !== "mastered");
  const mastered = order.filter((id) => statuses.get(id) === "mastered").length;
  const title = (id: string | undefined) =>
    id === undefined ? undefined : graph.skills[id]?.title;
  const current = title(order[at]);
  const next = at === -1 ? undefined : title(order[at + 1]);
  return {
    step: at === -1 ? order.length : at + 1,
    total: order.length,
    mastered,
    ...(current === undefined ? {} : { current }),
    ...(next === undefined ? {} : { next }),
  };
}
