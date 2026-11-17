// The states of the skills on the cards of the modules connected (R62 in docs/decisions.md;
// section 3.10 of docs/architecture.md): the cards show at once, and each of a module with a current
// version takes its counts when its map has come — GetSkillMap by the learner's action, and the open
// view of the skill graph of the version that answer names, as the skill map reads them (R34) —,
// counted by the function ./states of skill-map at the time of the device. A map that does not
// come, or a module with no skill graph, leaves its card with no bar.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { useEffect, useMemo, useState } from "react";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import { readModuleMap } from "../skills/map.ts";
import type { ModuleCard } from "./modules.ts";
import { type SkillCounts, skillCounts } from "./states.ts";

/** The counts of a module's skills, or none when it has no map to count. */
export async function countsOfModule(
  api: Api,
  views: OpenViews,
  profileId: string,
  moduleId: string,
  now: () => Date = () => new Date(),
): Promise<SkillCounts | undefined> {
  const map = await readModuleMap(api, views, { profileId, moduleId, action: Action.LEARNING });
  return map.graph === undefined ? undefined : skillCounts(map.graph.view, map.skillMap, now());
}

/** The cards, each with the counts of its skills once its map has come; undefined while none. */
export function useSkillCounts(
  api: Api,
  views: OpenViews,
  profileId: string,
  cards: readonly ModuleCard[] | undefined,
): readonly ModuleCard[] | undefined {
  // By module and version: the cards read anew after a connection keep the counts they had.
  const [counted, setCounted] = useState<ReadonlyMap<string, SkillCounts>>(new Map());
  const keys = [
    ...new Set(
      (cards ?? []).flatMap((card) =>
        card.digest === undefined ? [] : [`${card.moduleId} ${card.digest}`],
      ),
    ),
  ]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join("\n");
  useEffect(() => {
    let current = true;
    for (const key of keys === "" ? [] : keys.split("\n")) {
      const moduleId = key.slice(0, key.indexOf(" "));
      void countsOfModule(api, views, profileId, moduleId).then(
        (counts) => {
          if (current && counts !== undefined) setCounted((held) => new Map(held).set(key, counts));
        },
        () => {},
      );
    }
    return () => {
      current = false;
    };
  }, [api, views, profileId, keys]);
  return useMemo(
    () =>
      cards?.map((card) => {
        const counts =
          card.digest === undefined ? undefined : counted.get(`${card.moduleId} ${card.digest}`);
        return counts === undefined ? card : { ...card, skills: counts };
      }),
    [cards, counted],
  );
}
