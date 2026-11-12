// The modules of a profile in the section for adults (R32 in docs/decisions.md; section 3.10 of
// docs/architecture.md), a page of the profile chosen, `#/adults/modules`: the modules connected to
// it, as ListConnectedModules gives them, each a card named by the manifest of its current version
// as My subjects names it, in the order of the screen's language, with the page of its license —
// LICENSE and NOTICE of that version, `#/adults/license/<digest>`, a page of the section too. A
// module with no current version has no files to show, and its card says it is unavailable.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useCallback, useId, useMemo } from "react";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { ADULTS, navigate, type Route } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { collator } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { CardHeading } from "../subjects/CardHeading.tsx";
import { byTitle, cardsOf, type ModuleCard } from "../subjects/modules.ts";

/** The page of the profile's modules: the profile chosen in the section. */
export const MODULES_PAGE: Route = { screen: ADULTS.screen, parts: ["modules"] };

/** The part of the hash before the digest of a version whose license the section shows. */
export const LICENSE_PART = "license";

/** The page of a version's license in the section, by the digest of its package. */
export function sectionLicense(digest: string): Route {
  return { screen: ADULTS.screen, parts: [LICENSE_PART, digest] };
}

/** A module's card, with the way to its license when it has a current version. */
function Card({ card }: { readonly card: ModuleCard }) {
  const { words } = useLanguage();
  const id = useId();
  const digest = card.digest;
  return (
    <li className="nt-card">
      <article aria-labelledby={id}>
        <CardHeading card={card} id={id} />
        {digest === undefined ? null : (
          <div className="nt-buttons">
            <button
              type="button"
              aria-describedby={id}
              onClick={() => navigate(sectionLicense(digest))}
            >
              {words.text("subjects.license")}
            </button>
          </div>
        )}
      </article>
    </li>
  );
}

export function ModulesPage({ profile }: { readonly profile: Profile }) {
  const { language, words } = useLanguage();
  const { views } = usePackages();
  const profileId = profile.profileId;
  const read = useCallback(
    async (api: Api) =>
      cardsOf(views, (await api.module.listConnectedModules({ profileId })).modules),
    [views, profileId],
  );
  const cards = useRequest(read);
  const compare = useMemo(() => collator(language).compare, [language]);
  let shown = null;
  if (cards.status === "failed") {
    shown = <ReadFailure failure={cards.failure} onRetry={cards.retry} />;
  } else if (cards.status === "done") {
    const sorted = byTitle(cards.value, compare);
    shown =
      sorted.length === 0 ? (
        <p>{words.text("subjects.none")}</p>
      ) : (
        <>
          {sorted.some((card) => card.unnamed === true) ? (
            <div role="status">
              <p>{words.text("subjects.unnamed")}</p>
              <button type="button" onClick={cards.retry}>
                {words.text("boot.retry")}
              </button>
            </div>
          ) : null}
          <ul className="nt-cards">
            {sorted.map((card) => (
              <Card key={card.moduleId} card={card} />
            ))}
          </ul>
        </>
      );
  }
  return (
    <Screen title={words.text("adults.modules-title", { pseudonym: profile.pseudonym })}>
      <p>{words.text("adults.modules-hint")}</p>
      {shown}
    </Screen>
  );
}
