// The modules of a profile in the section for adults (R32 in docs/decisions.md; section 3.10 of
// docs/architecture.md), a page of the profile chosen, `#/adults/modules`: the modules connected to
// it, as ListConnectedModules gives them, each a card named by the manifest of its current version
// as My subjects names it, in the order of the screen's language, with the page of its license —
// LICENSE and NOTICE of that version, `#/adults/license/<digest>`, a page of the section too. A
// module with no current version has no files to show, and its card says it is unavailable.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { ReadFailure } from "../api/ReadFailure.tsx";
import { ADULTS, navigate, type Route } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ModuleCardItem, ModuleCardList, useConnectedCards } from "../subjects/ModuleCards.tsx";

/** The page of the profile's modules: the profile chosen in the section. */
export const MODULES_PAGE: Route = { screen: ADULTS.screen, parts: ["modules"] };

/** The part of the hash before the digest of a version whose license the section shows. */
export const LICENSE_PART = "license";

/** The page of a version's license in the section, by the digest of its package. */
export function sectionLicense(digest: string): Route {
  return { screen: ADULTS.screen, parts: [LICENSE_PART, digest] };
}

export function ModulesPage({ profile }: { readonly profile: Profile }) {
  const { words } = useLanguage();
  const cards = useConnectedCards(profile.profileId);
  let shown = null;
  if (cards.status === "failed") {
    shown = <ReadFailure failure={cards.failure} onRetry={cards.retry} />;
  } else if (cards.status === "done") {
    shown =
      cards.value.length === 0 ? (
        <p>{words.text("subjects.none")}</p>
      ) : (
        <ModuleCardList
          cards={cards.value}
          onRetry={cards.retry}
          render={(card) => {
            const digest = card.digest;
            return (
              <ModuleCardItem
                key={card.moduleId}
                card={card}
                {...(digest === undefined
                  ? {}
                  : {
                      action: {
                        text: words.text("subjects.license"),
                        onPress: () => navigate(sectionLicense(digest)),
                      },
                    })}
              />
            );
          }}
        />
      );
  }
  return (
    <Screen title={words.text("adults.modules-title", { pseudonym: profile.pseudonym })}>
      <p>{words.text("adults.modules-hint")}</p>
      {shown}
    </Screen>
  );
}
