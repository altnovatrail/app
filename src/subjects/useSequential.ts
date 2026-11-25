// What the cards of a screen take from their modules' skill graphs: the cards show at once, and
// each of a module with a current version takes, when its graph has come — from the shared cache or
// from api —, the mark "in order" where the graph is a chain and its skills by tier, which Subjects
// shows. A graph that does not come leaves its card as it is.
import { useEffect, useMemo, useState } from "react";
import type { OpenViews } from "../packages/views.ts";
import { type GraphFacts, graphFactsOf, type ModuleCard } from "./modules.ts";

/** The cards, each with what its graph gives once it has come; undefined while there are none. */
export function useSequential(
  views: OpenViews,
  cards: readonly ModuleCard[] | undefined,
): readonly ModuleCard[] | undefined {
  // By digest: a package's graph never changes, so what it gave once holds.
  const [facts, setFacts] = useState<ReadonlyMap<string, GraphFacts>>(new Map());
  const digests = [
    ...new Set((cards ?? []).flatMap((card) => (card.digest === undefined ? [] : [card.digest]))),
  ]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(" ");
  useEffect(() => {
    let current = true;
    for (const digest of digests === "" ? [] : digests.split(" ")) {
      void graphFactsOf(views, digest).then((got) => {
        if (current) setFacts((held) => new Map(held).set(digest, got));
      });
    }
    return () => {
      current = false;
    };
  }, [views, digests]);
  return useMemo(
    () =>
      cards?.map((card) => {
        const got = card.digest === undefined ? undefined : facts.get(card.digest);
        if (got === undefined) return card;
        return {
          ...card,
          ...(got.sequential ? { sequential: true as const } : {}),
          ...(got.skillList === undefined ? {} : { skillList: got.skillList }),
        };
      }),
    [cards, facts],
  );
}
