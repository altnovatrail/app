// Subjects, a place of the side menu (R99 spec; R79): the catalog of the server, as the mockup's
// `subjects` (R148 spec). The modules connected to the profile come first, by their count, each a
// card with its title in its own explanation language and, when that is not the screen's, a line
// that names it — the mark "Connected", the way to its skill map, Disconnect and the page of its
// license (R32) —; the others below, "More on this server", each with Connect and its license. Each
// list is in the order of the screen's language, and the focus goes with a card to its new place.
// The manifest has no words of what a module teaches: the card says what it holds of the module, not
// the mockup's sample lines.
import { useId, useMemo } from "react";
import type { Failure } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { Icon } from "../app/Icon.tsx";
import { navigate } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { ReadFailed } from "../boot/Screens.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { licenseRoute } from "../packages/LicensePage.tsx";
import { moduleMapRoute } from "../skills/SkillMapScreen.tsx";
import { CardHeading } from "./CardHeading.tsx";
import { ModuleTile } from "./ModuleTile.tsx";
import { byTitle, type ModuleCard } from "./modules.ts";
import { type CardAction, useModules } from "./useModules.ts";

/** A module's card of the catalog, its buttons described by its title. */
function Card({
  card,
  action,
  pending,
  onPress,
  onLicense,
}: {
  readonly card: ModuleCard;
  readonly action: CardAction;
  readonly pending: boolean;
  readonly onPress: (moduleId: string) => void;
  readonly onLicense: ((digest: string) => void) | undefined;
}) {
  const { words } = useLanguage();
  const id = useId();
  const digest = card.digest;
  const own = action === "disconnect";
  return (
    <li className="nt-card nt-module nt-catalog-card">
      <article aria-labelledby={id}>
        <div className="nt-module-head">
          <ModuleTile moduleId={card.moduleId} title={card.title} />
          <div>
            <CardHeading card={card} id={id} />
          </div>
        </div>
        <div className="nt-catalog-foot">
          {own ? (
            <p className="nt-connected-mark">
              <Icon value="state-mastered" />
              {words.text("catalog.is-connected")}
            </p>
          ) : null}
          <div className="nt-buttons">
            {/* A module connected with a current version has its map. */}
            {own && digest !== undefined ? (
              <button
                type="button"
                className="nt-link nt-icon-text"
                aria-describedby={id}
                onClick={() => navigate(moduleMapRoute(card.moduleId))}
              >
                <Icon value="skill-map" />
                {words.text("skillmap.title")}
              </button>
            ) : null}
            {/* Not disabled while a press is under way: a disabled button would drop the focus. */}
            <button
              type="button"
              className={own ? "nt-link" : "nt-icon-text"}
              aria-describedby={id}
              aria-disabled={pending}
              data-module={card.moduleId}
              data-action={action}
              onClick={() => {
                if (!pending) onPress(card.moduleId);
              }}
            >
              {own ? null : <Icon value="add" />}
              {words.text(own ? "subjects.disconnect" : "subjects.connect")}
            </button>
            {digest === undefined || onLicense === undefined ? null : (
              <button
                type="button"
                className="nt-link"
                aria-describedby={id}
                onClick={() => onLicense(digest)}
              >
                {words.text("subjects.license")}
              </button>
            )}
          </div>
        </div>
      </article>
    </li>
  );
}

export interface CatalogScreenProps {
  /** The modules connected, as cards; none while they come. */
  readonly connected: readonly ModuleCard[] | undefined;
  /** The catalog's modules, connected ones too; none while they come. */
  readonly catalog: readonly ModuleCard[] | undefined;
  /** What the last connection or disconnection came to, when it did not answer. */
  readonly failure?: Failure | undefined;
  /** A connection or disconnection under way. */
  readonly pending?: boolean;
  readonly onConnect: (moduleId: string) => void;
  readonly onDisconnect: (moduleId: string) => void;
  /** Asks for the lists again: offered when the names of some modules did not come. */
  readonly onRetry?: () => void;
  /** Opens the page of a version's license, by its digest; no button without it. */
  readonly onLicense?: (digest: string) => void;
}

/** The screen itself, from what its container has read. */
export function CatalogScreen({
  connected,
  catalog,
  failure,
  pending = false,
  onConnect,
  onDisconnect,
  onRetry,
  onLicense,
}: CatalogScreenProps) {
  const { language, words } = useLanguage();
  const connectedId = useId();
  const moreId = useId();
  const compare = useMemo(() => collator(language).compare, [language]);
  const own = new Set(connected?.map((card) => card.moduleId));
  const mine = connected === undefined ? undefined : byTitle(connected, compare);
  const more =
    catalog === undefined
      ? undefined
      : byTitle(
          catalog.filter((card) => !own.has(card.moduleId)),
          compare,
        );
  const unnamed = [...(mine ?? []), ...(more ?? [])].some((card) => card.unnamed === true);
  return (
    <Screen title={words.text("catalog.title")} layout="reference">
      <p className="nt-home-sub">{words.text("catalog.sub")}</p>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      {unnamed && onRetry !== undefined ? (
        <div role="status">
          <p>{words.text("subjects.unnamed")}</p>
          <button type="button" onClick={onRetry}>
            {words.text("boot.retry")}
          </button>
        </div>
      ) : null}
      <section aria-labelledby={connectedId}>
        <h2 id={connectedId} className="nt-caps">
          {words.text("catalog.connected", { count: mine?.length ?? 0 })}
        </h2>
        {mine === undefined ? null : mine.length === 0 ? (
          <p>{words.text("subjects.none")}</p>
        ) : (
          <ul className="nt-cards nt-catalog">
            {mine.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="disconnect"
                pending={pending}
                onPress={onDisconnect}
                onLicense={onLicense}
              />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby={moreId}>
        <h2 id={moreId} className="nt-caps">
          {words.text("catalog.more")}
        </h2>
        {more === undefined ? null : more.length === 0 ? (
          <p>{words.text("subjects.catalog-empty")}</p>
        ) : (
          <ul className="nt-cards nt-catalog">
            {more.map((card) => (
              <Card
                key={card.moduleId}
                card={card}
                action="connect"
                pending={pending}
                onPress={onConnect}
                onLicense={onLicense}
              />
            ))}
          </ul>
        )}
      </section>
    </Screen>
  );
}

/** Subjects of the learner chosen: what api says is connected and in the catalog. */
export function SubjectsPage({ profileId }: { readonly profileId: string }) {
  const modules = useModules(profileId, true);
  if (modules.failed !== undefined) {
    return <ReadFailed failure={modules.failed} onRetry={modules.retry} />;
  }
  return (
    <CatalogScreen
      connected={modules.connected}
      catalog={modules.catalog}
      failure={modules.failure}
      pending={modules.pending}
      onRetry={modules.retry}
      onLicense={(digest) => navigate(licenseRoute(digest))}
      onConnect={modules.connect}
      onDisconnect={modules.disconnect}
    />
  );
}
