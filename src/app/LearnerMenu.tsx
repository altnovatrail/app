// The profile's menu (R148 in spec; R63 in docs/decisions.md; section 3.10 of docs/architecture.md):
// the pill of the learner chosen — the avatar, the pseudonym and a chevron — at the top of the home
// screen and of the skill map, and behind it, as a pop-over, who is learning now, "Switch learner",
// "For grown-ups" and "Sign out", the buttons of the profile's header (section 3.6). The pill stands
// on each of those screens, so that an adult who hands the tablet over finds the switch on it.
import { useLearner } from "../account/AccountGate.tsx";
import { Avatar } from "../account/Avatar.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { BELOW_BAR } from "./hang.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { PopOver } from "./PopOver.tsx";
import { ADULTS, navigate } from "./router.ts";

/** A row of the menu: its icon and its words, a target of the menu's whole width. */
function Row({
  icon,
  text,
  onPress,
}: {
  readonly icon: IconValue;
  readonly text: string;
  readonly onPress: () => void;
}) {
  return (
    <button type="button" className="nt-menu-row" onClick={onPress}>
      <span className="nt-menu-icon">
        <Icon value={icon} />
      </span>
      {text}
    </button>
  );
}

/** The pill of the learner chosen and its menu; none with no learner, as in a screen's own test. */
export function LearnerMenu() {
  const chosen = useLearner();
  const { words } = useLanguage();
  if (chosen === undefined) return null;
  const { learner } = chosen;
  const { pseudonym, avatar } = learner;
  return (
    <PopOver
      label={words.text("learner.menu")}
      buttonLabel={words.text("learner.menu-button", { pseudonym })}
      className="nt-learner-pill nt-glass"
      popClassName="nt-pop-menu"
      gap={BELOW_BAR}
      caption={
        <>
          <Avatar code={avatar} size="pill" />
          <span className="nt-learner-name">{pseudonym}</span>
          <span className="nt-learner-chevron">
            <Icon value="menu-open" />
          </span>
        </>
      }
    >
      {(close) => (
        <>
          <p className="nt-menu-caption">{words.text("learner.now")}</p>
          <p className="nt-menu-current">
            <Avatar code={avatar} size="menu" />
            <span className="nt-learner-name">{pseudonym}</span>
            <span className="nt-menu-tick">
              <Icon value="ticked" />
            </span>
          </p>
          <hr />
          {/* Each closes the menu first: what it opens takes the screen's place. */}
          <Row
            icon="switch-learner"
            text={words.text("learner.switch")}
            onPress={() => {
              close();
              chosen.switchLearner();
            }}
          />
          <Row
            icon="grown"
            text={words.text("adults.title")}
            onPress={() => {
              close();
              navigate(ADULTS);
            }}
          />
          <Row
            icon="sign-out"
            text={words.text("signout.button")}
            onPress={() => {
              close();
              chosen.signOut();
            }}
          />
        </>
      )}
    </PopOver>
  );
}

/**
 * The profile's pill on a screen of a lesson or a task that has no top bar of its own — a lesson's
 * end, a lesson or a task not read, a task already over —, as on every screen of the profile
 * (section 3.6; R64, R65); none with no learner.
 */
export function ProfilePill({ className }: { readonly className: string }) {
  const chosen = useLearner();
  if (chosen === undefined) return null;
  return (
    <header className={className}>
      <LearnerMenu />
    </header>
  );
}
