// The section for adults (R29 in docs/decisions.md; sections 3.8 and 3.10 of docs/architecture.md):
// its pages in the hash, `#/adults` the first and `#/adults/<page>` the others, in the language of
// the device (R10), below a bar that names the section, leads back to its first page and closes it.
// The first page holds the profiles of the account, each a page of its own, and the buttons of the
// device's language. The profile chosen in the section lives in memory, as the hash names no
// profile (R14): a profile's page with none chosen — after a reload — and a page this build does
// not know go to the first page in place of themselves. In E3 the section opens with no PIN: the
// account holds the owner's profile of the category `adult` alone; the PIN comes in front of it
// with E4 (section 3.10). The pages to come — This device, the own key, the progress — each take
// a part of the hash and a button on the first page.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { ADULTS, HOME, navigate, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { collator } from "../i18n/intl.ts";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ProfilePage } from "./ProfilePage.tsx";

/** A profile's page: the one chosen in the section. */
export const PROFILE_PAGE: Route = { screen: ADULTS.screen, parts: ["profile"] };

/** The bar above each page of the section: its name, the way to its first page, and out of it. */
function SectionBar({ first }: { readonly first: boolean }) {
  const { words } = useLanguage();
  return (
    <header className="nt-bar">
      <p>{words.text("adults.title")}</p>
      {first ? null : (
        <button type="button" className="nt-secondary" onClick={() => navigate(ADULTS)}>
          {words.text("adults.back")}
        </button>
      )}
      <button type="button" className="nt-secondary" onClick={() => navigate(HOME)}>
        {words.text("adults.close")}
      </button>
    </header>
  );
}

/** The first page: the account's profiles, the owner's first, and the language of this device. */
export function SectionHome({
  profiles,
  onProfile,
}: {
  readonly profiles: readonly Profile[];
  readonly onProfile: (profile: Profile) => void;
}) {
  const { language, words } = useLanguage();
  const sorted = useMemo(() => {
    const order = collator(language);
    return [...profiles].sort(
      (a, b) => Number(b.owner) - Number(a.owner) || order.compare(a.pseudonym, b.pseudonym),
    );
  }, [profiles, language]);
  return (
    <Screen title={words.text("adults.title")}>
      <h2>{words.text("adults.profiles")}</h2>
      <ul className="nt-buttons">
        {sorted.map((profile) => (
          <li key={profile.profileId}>
            <button type="button" onClick={() => onProfile(profile)}>
              {words.text("adults.profile", { pseudonym: profile.pseudonym })}
            </button>
          </li>
        ))}
      </ul>
      <h2>{words.text("adults.device-language")}</h2>
      <p>{words.text("adults.device-language-hint")}</p>
      <LanguageButtons />
    </Screen>
  );
}

export function AdultSection({
  route,
  profiles,
  onSaved,
  onFailed,
}: {
  readonly route: Route;
  /** The profiles of the account, as the session has them now. */
  readonly profiles: readonly Profile[];
  /** api changed a profile on a page of the section. */
  readonly onSaved: (profile: Profile) => void;
  /** A request of a page of the section did not go through. */
  readonly onFailed: (failure: Failure) => void;
}) {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const page = route.parts.join("/");
  const profile = profiles.find((each) => each.profileId === chosen);
  let shown: ReactNode;
  if (page === "") {
    shown = (
      <SectionHome
        profiles={profiles}
        onProfile={(each) => {
          setChosen(each.profileId);
          navigate(PROFILE_PAGE);
        }}
      />
    );
  } else if (page === "profile" && profile !== undefined) {
    shown = (
      <ProfilePage
        key={profile.profileId}
        profile={profile}
        onSaved={onSaved}
        onFailed={onFailed}
      />
    );
  }
  const known = shown !== undefined;
  useEffect(() => {
    if (!known) redirect(ADULTS);
  }, [known]);
  if (!known) return null;
  return (
    <>
      <SectionBar first={page === ""} />
      {shown}
    </>
  );
}
