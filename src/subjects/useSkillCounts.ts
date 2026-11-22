// The states of the skills on the cards of the modules connected (R62): the cards show at once, and
// each of a module with a current version takes its counts when its map has come — GetSkillMap by
// the learner's action, and the open view of the skill graph of the version that answer names, as
// the skill map reads them (R34) —, counted by the function ./states of skill-map at the time of
// the device. A map that does not come, or a module with no skill graph, leaves its card with no
// bar; the next lists read — a retry, a connection — ask again for a map that failed, and never
// again for one that came.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { skillStates } from "@altnovatrail/skill-map/states";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import { readModuleMap } from "../skills/map.ts";
import { isSequential, type ModuleCard } from "./modules.ts";
import { type ChainPlace, chainPlace, countsOf, type SkillCounts } from "./states.ts";

/** What a card shows of a module's skills: their counts, and the place in a chain's. */
export interface Counted {
  readonly counts: SkillCounts;
  readonly chain?: ChainPlace;
}

/** The counts of a module's skills and its place in a chain, or none when it has no map to count. */
export async function countsOfModule(
  api: Api,
  views: OpenViews,
  profileId: string,
  moduleId: string,
  now: () => Date = () => new Date(),
): Promise<Counted | undefined> {
  const map = await readModuleMap(api, views, { profileId, moduleId, action: Action.LEARNING });
  if (map.graph === undefined) return undefined;
  const statuses = skillStates(map.graph.view, map.skillMap, now());
  const tiers = map.graph.skillTiers;
  return {
    counts: countsOf(statuses),
    ...(isSequential(tiers) ? { chain: chainPlace(map.graph.view, statuses, tiers) } : {}),
  };
}

/** A card's key: the profile, whose map it is, the module and its version. */
const keyOf = (profileId: string, card: ModuleCard) =>
  JSON.stringify([profileId, card.moduleId, card.digest]);

/** The cards, each with the counts of its skills once its map has come; undefined while none. */
export function useSkillCounts(
  api: Api,
  views: OpenViews,
  profileId: string,
  cards: readonly ModuleCard[] | undefined,
): readonly ModuleCard[] | undefined {
  const [counted, setCounted] = useState<ReadonlyMap<string, Counted>>(new Map());
  // The keys asked for and not failed: each map is asked once while it is on its way or has come.
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    for (const card of cards ?? []) {
      if (card.digest === undefined) continue;
      const key = keyOf(profileId, card);
      if (asked.current.has(key)) continue;
      asked.current.add(key);
      void countsOfModule(api, views, profileId, card.moduleId).then(
        (counts) => {
          if (mounted.current && counts !== undefined) {
            setCounted((held) => new Map(held).set(key, counts));
          }
        },
        () => asked.current.delete(key),
      );
    }
  }, [api, views, profileId, cards]);
  return useMemo(
    () =>
      cards?.map((card) => {
        const got = card.digest === undefined ? undefined : counted.get(keyOf(profileId, card));
        if (got === undefined) return card;
        return {
          ...card,
          skills: got.counts,
          ...(got.chain === undefined ? {} : { chain: got.chain }),
        };
      }),
    [cards, counted, profileId],
  );
}
