// The choice of the learner, as the mockup's `who` (sections 3.2 and 3.6 of docs/architecture.md;
// R46 and R61 in docs/decisions.md; R148 in spec): each profile by its avatar and pseudonym, the
// owner's with no PIN while the account has no child; "Add a learner" shown but not open, with the
// line why, until a child's profile comes with a parent's consent (epic E4). Above, the way into the
// section for adults and the sign-out; below, on the first sign-in, the line that learners' work is
// kept here, and the next versions of the legal texts, which the adult sees here at each start.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useId, useState } from "react";
import { Brand } from "../app/Brand.tsx";
import { Icon } from "../app/Icon.tsx";
import { ADULTS, navigate, type Route } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { NextVersions } from "../legal/NextVersions.tsx";
import { siteStorage } from "../storage/browser.ts";
import { Avatar } from "./Avatar.tsx";

/** What the browser said of keeping the site's data. */
type Kept = "granted" | "refused";

/** Asks the browser to keep the site's data: no browser that cannot is asked. */
async function persist(): Promise<Kept> {
  return (await siteStorage.persist()) ? "granted" : "refused";
}

export interface ChooseScreenProps {
  readonly profiles: readonly Profile[];
  readonly first: boolean;
  readonly onChoose: (profile: Profile) => void;
  readonly onSignOut: () => void;
  /** Opens a legal page, whose bar comes back here. */
  readonly onLegal: (page: Route) => void;
}

export function ChooseScreen({ profiles, first, onChoose, onSignOut, onLegal }: ChooseScreenProps) {
  const { words } = useLanguage();
  const id = useId();
  const [kept, setKept] = useState<Kept | undefined>(undefined);
  return (
    <Screen
      title={words.text("choose.title")}
      layout="profiles"
      before={
        <div className="nt-profiles-top">
          <button type="button" className="nt-link" onClick={() => navigate(ADULTS)}>
            {words.text("adults.title")}
          </button>
          <Brand className="nt-brand" />
          <button type="button" className="nt-link" onClick={onSignOut}>
            {words.text("signout.button")}
          </button>
        </div>
      }
      after={<p className="nt-profiles-foot">{words.text("choose.foot")}</p>}
    >
      <p className="nt-lead">{words.text("choose.intro")}</p>
      <ul className="nt-learners">
        {profiles.map((profile) => (
          <li key={profile.profileId}>
            {/* Named by the pseudonym alone; whose profile it is, its description. */}
            <button
              type="button"
              className="nt-learner"
              aria-describedby={`${id}-${profile.profileId}`}
              onClick={() => onChoose(profile)}
            >
              <Avatar code={profile.avatar} size="large" />
              <span className="nt-learner-name">{profile.pseudonym}</span>
            </button>
            <p id={`${id}-${profile.profileId}`} className="nt-learner-line">
              {words.text(profile.owner ? "choose.owner" : "choose.learner")}
            </p>
          </li>
        ))}
        <li className="nt-learner-add">
          <button type="button" className="nt-learner" disabled aria-describedby={`${id}-add`}>
            <span className="nt-avatar nt-avatar-large nt-avatar-add">
              <Icon value="add" />
            </span>
            <span className="nt-learner-name">{words.text("choose.add")}</span>
          </button>
          <p id={`${id}-add`} className="nt-learner-line">
            {words.text("choose.add-why")}
          </p>
        </li>
      </ul>
      {first ? (
        <section className="nt-persist">
          <p>{words.text("persist.line")}</p>
          {kept === undefined ? (
            <button
              type="button"
              className="nt-secondary"
              onClick={() => void persist().then(setKept)}
            >
              {words.text("persist.ask")}
            </button>
          ) : null}
          <p role="status">{kept === undefined ? null : words.text(`persist.${kept}`)}</p>
        </section>
      ) : null}
      <NextVersions storing={profiles.some((profile) => profile.workStorage)} onRead={onLegal} />
    </Screen>
  );
}
