// The section for adults (R29 in docs/decisions.md; sections 3.8 and 3.10 of docs/architecture.md):
// its pages in the hash, `#/adults` the first and `#/adults/<page>` the others, in the language of
// the device (R10), each below the top bar of SectionScreen, which leads back to its first page and
// closes the section, and with its groups as cards, by the mockup's rules of style (R68).
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
import { Avatar } from "../account/Avatar.tsx";
import type { Failure } from "../api/failure.ts";
import { Icon } from "../app/Icon.tsx";
import { ADULTS, navigate, type Route, redirect } from "../app/router.ts";
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
import { SectionPlaceProvider, SectionScreen } from "./SectionScreen.tsx";

/** A profile's page: the one chosen in the section. */
export const PROFILE_PAGE: Route = { screen: ADULTS.screen, parts: ["profile"] };
/** The page This device (R04; section 3.2). */
export const DEVICE_PAGE: Route = { screen: ADULTS.screen, parts: ["device"] };

/**
 * A group of a page as a card: its heading, the line of what it is, and what it holds — its button,
 * which that line describes, or the content given.
 */
function Group({
  id,
  title,
  hint,
  action,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly hint?: string;
  /** The group's one button: its words and what it does. */
  readonly action?: { readonly text: string; readonly onPress: () => void };
  readonly children?: ReactNode;
}) {
  const hintId = `${id}-hint`;
  return (
    <section className="nt-group" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {hint === undefined ? null : (
        <p id={hintId} className="nt-hint">
          {hint}
        </p>
      )}
      {action === undefined ? null : (
        <div className="nt-buttons">
          <button
            type="button"
            aria-describedby={hint === undefined ? undefined : hintId}
            onClick={action.onPress}
          >
            {action.text}
          </button>
        </div>
      )}
      {children}
    </section>
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
  const id = useId();
  return (
    <SectionScreen title={words.text("adults.title")}>
      <Group id={`${id}-profiles`} title={words.text("adults.profiles")}>
        <ul className="nt-rows">
          {sorted.map((profile) => (
            <li key={profile.profileId} className="nt-row-item">
              <button
                type="button"
                className="nt-row"
                aria-label={words.text("adults.profile", { pseudonym: profile.pseudonym })}
                onClick={() => onProfile(profile)}
              >
                <Avatar code={profile.avatar} size="menu" />
                <span className="nt-row-value">{profile.pseudonym}</span>
                <Icon value="more" />
              </button>
            </li>
          ))}
        </ul>
      </Group>
      <Group
        id={`${id}-device`}
        title={words.text("device.title")}
        hint={words.text("device.hint")}
        action={{ text: words.text("device.open"), onPress: () => navigate(DEVICE_PAGE) }}
      />
      {/* The own key is the owner's as an adult learner: an account with no such profile has none. */}
      {profiles.some(keyed) ? (
        <Group
          id={`${id}-key`}
          title={words.text("ownkey.title")}
          hint={words.text("ownkey.hint")}
          action={{ text: words.text("ownkey.open"), onPress: () => navigate(OWN_KEY_PAGE) }}
        />
      ) : null}
      <Group
        id={`${id}-language`}
        title={words.text("adults.device-language")}
        hint={words.text("adults.device-language-hint")}
      >
        <LanguageButtons />
      </Group>
      <Group
        id={`${id}-legal`}
        title={words.text("legal.title")}
        hint={words.text("legal.hint")}
        action={{ text: words.text("legal.open"), onPress: () => onLegal() }}
      />
      <NextVersions storing={profiles.some((profile) => profile.workStorage)} onRead={onLegal} />
    </SectionScreen>
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
        device={device}
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
        frame={SectionScreen}
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
    <SectionPlaceProvider value={page === "" ? "first" : "inner"}>{shown}</SectionPlaceProvider>
  );
}
