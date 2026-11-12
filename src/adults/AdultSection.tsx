// The section for adults (R29 in docs/decisions.md; sections 3.8 and 3.10 of docs/architecture.md):
// its pages in the hash, `#/adults` the first and `#/adults/<page>` the others, in the language of
// the device (R10), below a bar that names the section, leads back to its first page and closes it.
// The first page holds the profiles of the account, each a page of its own, and the buttons of the
// device's language. The profile chosen in the section lives in memory, as the hash names no
// profile (R14): a profile's page with none chosen — after a reload — and a page this build does
// not know go to the first page in place of themselves. In E3 the section opens with no PIN: the
// account holds the owner's profile of the category `adult` alone; the PIN comes in front of it
// with E4 (section 3.10). A page of the account or the device — This device, `#/adults/device`,
// and the own key to come — takes a part of the hash and a button on the first page; a page of one
// profile — the progress to come — a part of the hash and a button on the profile's page. The
// legal pages are not the section's: they show before signing in too, and the first page leads to
// them (R31).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { PageBar } from "../app/PageBar.tsx";
import { ADULTS, HOME, navigate, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Device } from "../storage/device.ts";
import { DevicePage } from "./DevicePage.tsx";
import { inOrder } from "./order.ts";
import { ProfilePage } from "./ProfilePage.tsx";

/** A profile's page: the one chosen in the section. */
export const PROFILE_PAGE: Route = { screen: ADULTS.screen, parts: ["profile"] };
/** The page This device (R04; section 3.2). */
export const DEVICE_PAGE: Route = { screen: ADULTS.screen, parts: ["device"] };

/** The bar above each page of the section: its name, the way to its first page, and out of it. */
function SectionBar({ first }: { readonly first: boolean }) {
  const { words } = useLanguage();
  return (
    <PageBar
      title={words.text("adults.title")}
      {...(first ? {} : { back: { text: words.text("adults.back"), to: ADULTS } })}
      close={{ text: words.text("adults.close"), to: HOME }}
    />
  );
}

/**
 * The first page: the account's profiles, the owner's first, This device, its language, and the
 * way to the legal pages.
 */
export function SectionHome({
  profiles,
  onProfile,
  onLegal,
}: {
  readonly profiles: readonly Profile[];
  readonly onProfile: (profile: Profile) => void;
  readonly onLegal: () => void;
}) {
  const { language, words } = useLanguage();
  const sorted = useMemo(() => inOrder(profiles, language), [profiles, language]);
  const deviceHint = useId();
  const legalHint = useId();
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
      <h2>{words.text("device.title")}</h2>
      <p id={deviceHint}>{words.text("device.hint")}</p>
      <div className="nt-buttons">
        <button type="button" aria-describedby={deviceHint} onClick={() => navigate(DEVICE_PAGE)}>
          {words.text("device.open")}
        </button>
      </div>
      <h2>{words.text("adults.device-language")}</h2>
      <p>{words.text("adults.device-language-hint")}</p>
      <LanguageButtons />
      <h2>{words.text("legal.title")}</h2>
      <p id={legalHint}>{words.text("legal.hint")}</p>
      <div className="nt-buttons">
        <button type="button" aria-describedby={legalHint} onClick={onLegal}>
          {words.text("legal.open")}
        </button>
      </div>
    </Screen>
  );
}

export function AdultSection({
  route,
  device,
  profiles,
  onSaved,
  onFailed,
  onEraseAll,
  onLegal,
}: {
  readonly route: Route;
  readonly device: Device;
  /** The profiles of the account, as the session has them now. */
  readonly profiles: readonly Profile[];
  /** api changed a profile on a page of the section. */
  readonly onSaved: (profile: Profile) => void;
  /** A request of a page of the section did not go through. */
  readonly onFailed: (failure: Failure) => void;
  /** "Erase everything on this device", on the page This device: the sign-out, and more. */
  readonly onEraseAll: () => Promise<"erased" | "left" | "failed">;
  /** Opens the legal pages, whose bar comes back here. */
  readonly onLegal: () => void;
}) {
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const page = route.parts.join("/");
  const profile = profiles.find((each) => each.profileId === chosen);
  let shown: ReactNode;
  if (page === "") {
    shown = (
      <SectionHome
        profiles={profiles}
        onLegal={onLegal}
        onProfile={(each) => {
          setChosen(each.profileId);
          navigate(PROFILE_PAGE);
        }}
      />
    );
  } else if (page === "device") {
    shown = <DevicePage device={device} profiles={profiles} onEraseAll={onEraseAll} />;
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
