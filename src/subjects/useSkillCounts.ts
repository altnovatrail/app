// The states of the skills on the cards of the modules connected: the cards show at once, and
// each of a module with a current version takes its counts when its map has come — GetSkillMap by
// the learner's action, and the open view of the skill graph of the version that answer names, as
// the skill map reads them —, counted by the function ./states of skill-map at the time of
// the device; from the same map and graph, the skills its choice of tasks offers, by tier and
// suggested. A map that does not come, or a module with no skill graph, leaves its card with no
// bar; a map on its way gives its card the mark that it is being counted, for the card's skeleton.
// The next lists read — a retry, a connection — ask again for a map that failed, and never
// again for one that came.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { skillStates } from "@altnovatrail/skill-map/states";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import { readModuleMap } from "../skills/map.ts";
import type { ModuleCard, SkillPicks } from "./modules.ts";
import { countsOf, picksOf, type SkillCounts } from "./states.ts";

/** What a card shows of a module's skills: their counts, and the choice of its task skill. */
export interface Counted {
  readonly counts: SkillCounts;
  readonly picks: SkillPicks;
}

/** The counts of a module's skills and the choice of its task skill, or none with no map to count. */
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
  return {
    counts: countsOf(statuses),
    picks: picksOf(moduleId, map.graph.view, statuses, map.graph.skillTiers),
  };
}

/** The set without the key. */
function withoutKey(keys: ReadonlySet<string>, key: string): ReadonlySet<string> {
  const left = new Set(keys);
  left.delete(key);
  return left;
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
  // A map that came with no skill graph is null: its card is settled, with no bar.
  const [counted, setCounted] = useState<ReadonlyMap<string, Counted | null>>(new Map());
  // The keys whose map failed: their cards are settled until the next lists read asks again.
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
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
      setFailed((held) => (held.has(key) ? withoutKey(held, key) : held));
      void countsOfModule(api, views, profileId, card.moduleId).then(
        (counts) => {
          if (mounted.current) setCounted((held) => new Map(held).set(key, counts ?? null));
        },
        () => {
          asked.current.delete(key);
          if (mounted.current) setFailed((held) => new Set(held).add(key));
        },
      );
    }
  }, [api, views, profileId, cards]);
  return useMemo(
    () =>
      cards?.map((card) => {
        if (card.digest === undefined) return card;
        const key = keyOf(profileId, card);
        const got = counted.get(key);
        if (got === undefined) return failed.has(key) ? card : { ...card, counting: true as const };
        if (got === null) return card;
        return { ...card, skills: got.counts, picks: got.picks };
      }),
    [cards, counted, failed, profileId],
  );
}
