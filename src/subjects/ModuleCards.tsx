// The cards of modules as the skill map and the section for adults list them (sections 3.8 and
// 3.10 of docs/architecture.md; R32, R34 and R35 in docs/decisions.md): each card named by
// CardHeading, with one button described by its title, in the order of the screen's language, the
// mark "in order" coming when its graph has, and a retry when some names did not come. My subjects
// keeps cards of its own: two lists, a button that moves its card between them, and the focus with
// it. The modules connected to a profile are read here for the screens that list them.
import { type ReactNode, useCallback, useId, useMemo } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { CardHeading } from "./CardHeading.tsx";
import { byTitle, cardsOf, type ModuleCard } from "./modules.ts";
import { useSequential } from "./useSequential.ts";

/** The cards of the modules connected to a profile, by ListConnectedModules, and a retry. */
export function useConnectedCards(profileId: string) {
  const { views } = usePackages();
  const read = useCallback(
    async (api: Api) =>
      cardsOf(views, (await api.module.listConnectedModules({ profileId })).modules),
    [views, profileId],
  );
  return useRequest(read);
}

/** What a card's button does: its words, whether a press is under way, and the press. */
export interface CardAction {
  readonly text: string;
  readonly pending?: boolean;
  readonly onPress: () => void;
}

/** A card of a module, with its button described by its title; a card with no action has none. */
export function ModuleCardItem({
  card,
  action,
}: {
  readonly card: ModuleCard;
  readonly action?: CardAction;
}) {
  const id = useId();
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <CardHeading card={card} id={id} />
        {action === undefined ? null : (
          <div className="nt-buttons">
            {/* Not disabled while a press is under way: a disabled button would drop the focus. */}
            <button
              type="button"
              aria-describedby={id}
              aria-disabled={action.pending === true}
              data-module={card.moduleId}
              onClick={() => {
                if (action.pending !== true) action.onPress();
              }}
            >
              {action.text}
            </button>
          </div>
        )}
      </article>
    </li>
  );
}

/** The cards of modules in the order of the screen's language, and a retry when names are missing. */
export function ModuleCardList({
  cards,
  onRetry,
  render,
}: {
  readonly cards: readonly ModuleCard[];
  readonly onRetry: () => void;
  readonly render: (card: ModuleCard) => ReactNode;
}) {
  const { language, words } = useLanguage();
  const { views } = usePackages();
  const compare = useMemo(() => collator(language).compare, [language]);
  const sorted = byTitle(useSequential(views, cards) ?? cards, compare);
  return (
    <>
      {sorted.some((card) => card.unnamed === true) ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <ul className="nt-cards">{sorted.map(render)}</ul>
    </>
  );
}
