// The choice of the learner, as the mockup's `who` (R08, R61; R148 spec): each profile by its
// avatar and pseudonym, the owner's with no PIN while the account has no child; "Add a learner"
// shown but not open, with the line why, until a child's profile comes with a parent's consent.
// Above, the way into the section for adults and the sign-out. On the first sign-in it asks the
// browser to keep the site's data, with no line of its own: the adult who just signed in is the one
// who sees Firefox's prompt (R04).
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useEffect, useId } from "react";
import { Brand } from "../app/Brand.tsx";
import { Icon } from "../app/Icon.tsx";
import { ADULTS, navigate } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { siteStorage } from "../storage/browser.ts";
import { Avatar } from "./Avatar.tsx";

export interface ChooseScreenProps {
  readonly profiles: readonly Profile[];
  readonly first: boolean;
  readonly onChoose: (profile: Profile) => void;
  readonly onSignOut: () => void;
}

export function ChooseScreen({ profiles, first, onChoose, onSignOut }: ChooseScreenProps) {
  const { words } = useLanguage();
  const id = useId();
  useEffect(() => {
    if (first) void siteStorage.persist();
  }, [first]);
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
    </Screen>
  );
}
