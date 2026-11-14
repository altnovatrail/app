// The section for adults (R29 in docs/decisions.md; sections 3.8 and 3.10 of docs/architecture.md):
// its pages in the hash, `#/adults` the first and `#/adults/<page>` the others, in the language of
// the device (R10), below a bar that names the section, leads back to its first page and closes it.
// The first page holds the profiles of the account, each a page of its own, and the buttons of the
// device's language. The profile chosen in the section lives in memory, as the hash names no
// profile (R14): a profile's page with none chosen — after a reload — and a page this build does
// not know go to the first page in place of themselves. In E3 the section opens with no PIN: the
// account holds the owner's profile of the category `adult` alone; the PIN comes in front of it
// with E4 (section 3.10). A page of the account or the device — This device, `#/adults/device`,
// and Own AI key, `#/adults/own-key` (R47) — takes a part of the hash and a button on the first page; a page of one
// profile — its modules, `#/adults/modules`, and its progress, `#/adults/progress` with the map of
// each module below it, `#/adults/progress/<module>` (R35) — a part of the hash and a button on the
// profile's page. The license of a module's version, `#/adults/license/<digest>`,
// is a page of the section by the digest in the hash, opened from the profile's modules (R32). The
// legal pages are not the section's: they show before signing in too, and the first page leads to
// them (R31), and to the page of a text's next version, of which it tells (R46).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type ReactNode, useEffect, useId, useMemo, useState } from "react";
import type { Failure } from "../api/failure.ts";
import { PageBar } from "../app/PageBar.tsx";
import { ADULTS, HOME, navigate, type Route, redirect } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextVersions } from "../legal/NextVersions.tsx";
import { keyed } from "../ownkey/OwnKeyContext.tsx";
import { digestOf, ModuleLicense } from "../packages/LicensePage.tsx";
import type { Device } from "../storage/device.ts";
import { DevicePage } from "./DevicePage.tsx";
import { LICENSE_PART, MODULES_PAGE, ModulesPage } from "./ModulesPage.tsx";
import { OWN_KEY_PAGE, OwnKeyPage } from "./OwnKeyPage.tsx";
import { inOrder } from "./order.ts";
import { ProfilePage } from "./ProfilePage.tsx";
import { ProgressMap, ProgressPage } from "./ProgressPage.tsx";
import { PROGRESS_PART } from "./progress.ts";

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
 * The first page: the account's profiles, the owner's first, This device, its language, the way to
 * the legal pages, and the next versions of the texts, before the day they apply from (R46).
 */
export function SectionHome({
  profiles,
  onProfile,
  onLegal,
}: {
  readonly profiles: readonly Profile[];
  readonly onProfile: (profile: Profile) => void;
  /** Opens the legal pages — their list, or the page given. */
  readonly onLegal: (page?: Route) => void;
}) {
  const { language, words } = useLanguage();
  const sorted = useMemo(() => inOrder(profiles, language), [profiles, language]);
  const deviceHint = useId();
  const keyHint = useId();
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
      {/* The own key is the owner's as an adult learner: an account with no such profile has none. */}
      {profiles.some(keyed) ? (
        <>
          <h2>{words.text("ownkey.title")}</h2>
          <p id={keyHint}>{words.text("ownkey.hint")}</p>
          <div className="nt-buttons">
            <button type="button" aria-describedby={keyHint} onClick={() => navigate(OWN_KEY_PAGE)}>
              {words.text("ownkey.open")}
            </button>
          </div>
        </>
      ) : null}
      <h2>{words.text("adults.device-language")}</h2>
      <p>{words.text("adults.device-language-hint")}</p>
      <LanguageButtons />
      <h2>{words.text("legal.title")}</h2>
      <p id={legalHint}>{words.text("legal.hint")}</p>
      <div className="nt-buttons">
        <button type="button" aria-describedby={legalHint} onClick={() => onLegal()}>
          {words.text("legal.open")}
        </button>
      </div>
      <NextVersions storing={profiles.some((profile) => profile.workStorage)} onRead={onLegal} />
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
  onOpenOwner,
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
  /** Opens the legal pages — their list, or the page given —, whose bar comes back here. */
  readonly onLegal: (page?: Route) => void;
  /** Opens the owner profile as the learner, for its own key, while no learner is chosen. */
  readonly onOpenOwner?: () => void;
}) {
  const { words } = useLanguage();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const page = route.parts.join("/");
  const [first, ...rest] = route.parts;
  const digest = first === LICENSE_PART ? digestOf(rest) : undefined;
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
  } else if (page === OWN_KEY_PAGE.parts.join("/")) {
    shown = (
      <OwnKeyPage profiles={profiles} {...(onOpenOwner === undefined ? {} : { onOpenOwner })} />
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
  } else if (page === MODULES_PAGE.parts.join("/") && profile !== undefined) {
    shown = <ModulesPage key={profile.profileId} profile={profile} />;
  } else if (first === PROGRESS_PART && rest.length === 0 && profile !== undefined) {
    shown = <ProgressPage key={profile.profileId} profile={profile} />;
  } else if (first === PROGRESS_PART && rest.length === 1 && profile !== undefined) {
    const moduleId = rest[0] as string;
    shown = <ProgressMap key={moduleId} profile={profile} moduleId={moduleId} />;
  } else if (digest !== undefined) {
    // Back to the modules of the profile chosen; after a reload, with none chosen, the bar alone.
    shown = (
      <ModuleLicense
        key={digest}
        digest={digest}
        back={
          profile === undefined ? undefined : (
            <div className="nt-buttons">
              <button type="button" className="nt-secondary" onClick={() => navigate(MODULES_PAGE)}>
                {words.text("adults.modules-back")}
              </button>
            </div>
          )
        }
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
