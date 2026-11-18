// A profile's avatar and its choice (R61 and R68 in docs/decisions.md; R98 and R148 spec): the
// avatar shown, and below it "Choose an avatar" — "Change the avatar" once one is given — opening the
// set in a pop-over centred below it (R59), each a picture with its name. A choice closes it. The
// owner's profile chooses so, and a profile's page in the section for adults changes one so.
import { PopOver } from "../app/PopOver.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Avatar } from "./Avatar.tsx";
import { AVATARS, type AvatarCode } from "./avatars.ts";

export function AvatarChoice({
  code,
  onChoose,
}: {
  /** The avatar shown: none or empty for none chosen, or a code this build may not know. */
  readonly code: string | undefined;
  readonly onChoose: (code: AvatarCode) => void;
}) {
  const { words } = useLanguage();
  const none = code === undefined || code === "";
  return (
    <>
      <Avatar code={code} size="profile" />
      <PopOver
        label={words.text(none ? "profile.avatar-choose" : "profile.avatar-change")}
        className="nt-link"
        centred
        popClassName="nt-pop-avatars"
      >
        {(close) => (
          <ul className="nt-avatars">
            {AVATARS.map((each) => (
              <li key={each.code}>
                <button
                  type="button"
                  className="nt-avatar-option"
                  aria-pressed={each.code === code}
                  onClick={() => {
                    onChoose(each.code);
                    close();
                  }}
                >
                  <Avatar code={each.code} size="choice" />
                  <span>{words.text(`avatar.${each.code}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopOver>
    </>
  );
}
