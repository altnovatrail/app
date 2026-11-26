// Settings, the section for adults: its pages in the hash, `#/adults` the first and `#/adults/<page>`
// the others, in the language of the device, drawn as a device's settings by SectionScreen. Its
// list holds what an adult sets — the profiles of the account, the owner's first, each a page of its
// own, then This device, the device's language and the own key; under it a quiet link Privacy, to
// the legal pages, as Connecticut's law asks a link with the word in the settings — the legal texts
// and Accessibility are otherwise Help's. From 600 CSS px the list stands beside the page, and the first page shows the page of
// the profile chosen — the learner's, else the owner's — beside it, below 600 the list alone. The
// profile chosen in the section lives in memory, as the hash names no profile: a profile's page with
// none chosen — after a reload — and a page this build does not know go to the first page in place
// of themselves. The section opens with no PIN: the account holds the owner's profile of the
// category `adult` alone. A page of the account or the device — This device, `#/adults/device`, its
// language, `#/adults/language`, and Own AI key, `#/adults/own-key` — takes a part of the hash and a
// row of the list.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Avatar } from "../account/Avatar.tsx";
import type { Failure } from "../api/failure.ts";
import { Icon } from "../app/Icon.tsx";
import { useNarrow } from "../app/narrow.ts";
import { ADULTS, navigate, type Route, redirect } from "../app/router.ts";
import { NAMES } from "../i18n/LanguageButtons.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LANGUAGES } from "../i18n/language.ts";
import { keyed } from "../ownkey/OwnKeyContext.tsx";
import type { Device } from "../storage/device.ts";
import { DevicePage } from "./DevicePage.tsx";
import { OWN_KEY_PAGE, OwnKeyPage } from "./OwnKeyPage.tsx";
import { inOrder } from "./order.ts";
import { ProfilePage } from "./ProfilePage.tsx";
import { Group, LinkRow, TileIcon } from "./rows.tsx";
import { type SectionPlace, SectionPlaceProvider, SectionScreen } from "./SectionScreen.tsx";

/** A profile's page: the one chosen in the section. */
export const PROFILE_PAGE: Route = { screen: ADULTS.screen, parts: ["profile"] };
/** The page This device. */
export const DEVICE_PAGE: Route = { screen: ADULTS.screen, parts: ["device"] };
/** The page of the device's language. */
export const LANGUAGE_PAGE: Route = { screen: ADULTS.screen, parts: ["language"] };

/**
 * The section's list: the account's profiles, the owner's first, This device, its language and the
 * own key, and under them the quiet link Privacy, to the legal pages. `shown` is the page beside it:
 * its row is marked so.
 */
export function SectionList({
  profiles,
  shown,
  onProfile,
  onLegal,
}: {
  readonly profiles: readonly Profile[];
  /** The page beside the list: a part of the hash, or a profile's ID. */
  readonly shown?: string;
  readonly onProfile: (profile: Profile) => void;
  /** Opens the list of the legal pages, whose bar comes back here. */
  readonly onLegal: () => void;
}) {
  const { language, words } = useLanguage();
  const sorted = useMemo(() => inOrder(profiles, language), [profiles, language]);
  return (
    <>
      <Group label={words.text("adults.profiles")} className="nt-set-profiles">
        {sorted.map((profile) => (
          <LinkRow
            key={profile.profileId}
            label={profile.pseudonym}
            sub={words.text(profile.owner ? "learner.yours" : "choose.learner")}
            lead={<Avatar code={profile.avatar} size="choice" />}
            current={shown === profile.profileId}
            onPress={() => onProfile(profile)}
          />
        ))}
      </Group>
      <Group label={words.text("device.title")}>
        <LinkRow
          label={words.text("device.title")}
          lead={<TileIcon icon="set-device" tile="grey" />}
          current={shown === "device"}
          onPress={() => navigate(DEVICE_PAGE)}
        />
        <LinkRow
          label={words.text("language.title")}
          value={NAMES[language]}
          lead={<TileIcon icon="set-language" tile="blue" />}
          current={shown === "language"}
          onPress={() => navigate(LANGUAGE_PAGE)}
        />
        {/* The own key is the owner's as an adult learner: an account with no such profile has none. */}
        {profiles.some(keyed) ? (
          <LinkRow
            label={words.text("ownkey.title")}
            lead={<TileIcon icon="set-key" tile="orange" />}
            current={shown === "own-key"}
            onPress={() => navigate(OWN_KEY_PAGE)}
          />
        ) : null}
      </Group>
      <p className="nt-set-foot">
        <button type="button" className="nt-link" onClick={onLegal}>
          {words.text("adults.privacy")}
        </button>
      </p>
    </>
  );
}

/**
 * The device's language: a row for each, by its own name in its own language, the one chosen
 * pressed and ticked. They are buttons, not a choice of a form: a press changes the screen at once
 * (WCAG 3.2.2).
 */
export function LanguagePage() {
  const { language, words, choose } = useLanguage();
  return (
    <SectionScreen title={words.text("language.title")}>
      <Group
        title={words.text("adults.device-language")}
        note={<p>{words.text("adults.device-language-hint")}</p>}
      >
        {LANGUAGES.map((tag) => (
          <button
            key={tag}
            type="button"
            className="nt-set-row"
            lang={tag}
            aria-pressed={tag === language}
            onClick={() => choose(tag)}
          >
            <span className="nt-set-text">
              <span className="nt-set-label">{NAMES[tag]}</span>
            </span>
            <span className="nt-set-ticked">
              <Icon value="ticked" />
            </span>
          </button>
        ))}
      </Group>
    </SectionScreen>
  );
}

export function AdultSection({
  route,
  device,
  profiles,
  learner,
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
  /** The learner chosen, whose page the section shows first beside its list; none, the owner's. */
  readonly learner?: string;
  /** api changed a profile on a page of the section. */
  readonly onSaved: (profile: Profile) => void;
  /** A request of a page of the section did not go through. */
  readonly onFailed: (failure: Failure) => void;
  /** "Erase everything on this device", on the page This device: it signs out too. */
  readonly onEraseAll: () => Promise<"erased" | "left" | "failed">;
  /** Opens the list of the legal pages, whose bar comes back here. */
  readonly onLegal: () => void;
  /** Opens the owner profile as the learner, for its own key, while no learner is chosen. */
  readonly onOpenOwner?: () => void;
}) {
  const { words } = useLanguage();
  const narrow = useNarrow();
  const [chosen, setChosen] = useState<string | undefined>(undefined);
  const page = route.parts.join("/");
  // Beside the list the first page is a profile's: the one chosen, else the learner's, else the owner's.
  const besideList = page === "" && !narrow;
  const fallback =
    profiles.find((each) => each.profileId === learner) ??
    profiles.find((each) => each.owner) ??
    profiles[0];
  const profile =
    profiles.find((each) => each.profileId === chosen) ?? (besideList ? fallback : undefined);
  const profilePage = page === "profile" || besideList;
  let shown: ReactNode;
  let up: SectionPlace["up"];
  if (page === "" && (narrow || profile === undefined)) {
    shown = <SectionScreen title={words.text("learner.settings")} />;
  } else if (page === "device") {
    shown = <DevicePage device={device} profiles={profiles} onEraseAll={onEraseAll} />;
  } else if (page === LANGUAGE_PAGE.parts.join("/")) {
    shown = <LanguagePage />;
  } else if (page === OWN_KEY_PAGE.parts.join("/")) {
    shown = (
      <OwnKeyPage profiles={profiles} {...(onOpenOwner === undefined ? {} : { onOpenOwner })} />
    );
  } else if (profilePage && profile !== undefined) {
    shown = (
      <ProfilePage
        key={profile.profileId}
        profile={profile}
        device={device}
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
  const list = (
    <SectionList
      profiles={profiles}
      shown={profilePage ? profile?.profileId : page}
      onLegal={onLegal}
      onProfile={(each) => {
        setChosen(each.profileId);
        navigate(PROFILE_PAGE);
      }}
    />
  );
  return (
    <SectionPlaceProvider value={{ first: page === "", list, ...(up === undefined ? {} : { up }) }}>
      {shown}
    </SectionPlaceProvider>
  );
}
