// The mark "in order" on the cards of a screen (R06 and R34 in docs/decisions.md; section 3.4 of
// docs/architecture.md): the cards show at once, and each of a module whose current version's skill
// graph is a chain takes the mark when its graph has come, from the shared cache or from api. A
// graph that does not come leaves its card as it is.
import { useEffect, useMemo, useState } from "react";
import type { OpenViews } from "../packages/views.ts";
import { type ModuleCard, sequentialOf } from "./modules.ts";

/** The cards, each marked once its graph is known to be a chain; undefined while there are none. */
export function useSequential(
  views: OpenViews,
  cards: readonly ModuleCard[] | undefined,
): readonly ModuleCard[] | undefined {
  // By digest: a package's graph never changes, so a mark once known holds.
  const [chains, setChains] = useState<ReadonlySet<string>>(new Set());
  const digests = [
    ...new Set((cards ?? []).flatMap((card) => (card.digest === undefined ? [] : [card.digest]))),
  ]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .join(" ");
  useEffect(() => {
    let current = true;
    for (const digest of digests === "" ? [] : digests.split(" ")) {
      void sequentialOf(views, digest).then((chain) => {
        if (current && chain) setChains((held) => new Set([...held, digest]));
      });
    }
    return () => {
      current = false;
    };
  }, [views, digests]);
  return useMemo(
    () =>
      cards?.map((card) =>
        card.digest !== undefined && chains.has(card.digest)
          ? { ...card, sequential: true as const }
          : card,
      ),
    [cards, chains],
  );
}
