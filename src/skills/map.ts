// The skill map of a module, as the element of skill-map takes it (architecture 3.3 in spec; R99 in
// spec; R34 in docs/decisions.md): the state of its skills from `GetSkillMap` — by the learner's
// action on the learner's screen, by an adult's in the section for adults — and, by the digest of
// that answer, the open views of its skill graph with its tiers and of its manifest, from the
// shared cache or api. And the modules the answer offers beside an anchor skill whose holding is
// unknown: skill-map does not show `teaching_modules`, so app does, beside the map (Д211 in the
// table 4 of spec's RUN.md). No DOM.
import type { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  AnchorSkillHolding,
  type GetSkillMapResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { Api } from "../api/client.ts";
import type { Opened, OpenViews } from "../packages/views.ts";

/** A module's map: its state, and its graph and manifest, which a module may not have. */
export interface ModuleMap {
  readonly skillMap: GetSkillMapResponse;
  /** The skill graph with its tiers; none when the module has no skill graph. */
  readonly graph?: Opened<"skill-graph">;
  readonly manifest?: open.Manifest;
}

/** The map of a connected module's current version, for the learner or for an adult. */
export async function readModuleMap(
  api: Api,
  views: OpenViews,
  request: { readonly profileId: string; readonly moduleId: string; readonly action: Action },
): Promise<ModuleMap> {
  const skillMap = await api.progress.getSkillMap(request);
  const digest = skillMap.packageDigest;
  const [graph, manifest] = await Promise.all([
    views.get(digest, "skill-graph"),
    views.get(digest, "manifest"),
  ]);
  return {
    skillMap,
    ...(graph === undefined ? {} : { graph }),
    ...(manifest === undefined ? {} : { manifest: manifest.view }),
  };
}

/** Whether a holding is unknown: a value this build does not know reads so, as the contract says. */
function unknown(holding: AnchorSkillHolding): boolean {
  return holding !== AnchorSkillHolding.HELD && holding !== AnchorSkillHolding.NOT_HELD;
}

/**
 * The modules of the catalog the answer offers: those that teach an anchor skill whose holding is
 * unknown, each once, in the order the answer names them. api names them whatever the holding, and
 * app offers them beside an unknown one alone (section 15 of the text of the contracts).
 */
export function offeredModules(skillMap: GetSkillMapResponse): string[] {
  const offered = new Set<string>();
  for (const anchor of skillMap.anchorSkills) {
    if (!unknown(anchor.holding)) continue;
    for (const moduleId of anchor.teachingModules) offered.add(moduleId);
  }
  return [...offered];
}
