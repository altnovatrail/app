// The profile's menu (R148 spec; R63, R79): the pill of the learner chosen — the avatar, the
// pseudonym and a chevron — at the top right of Home, Subjects and the skill map, the avatar alone
// on a phone, and behind it, as a pop-over, who is learning now, "Switch learner" and "Sign out":
// the hint mode and This device are For grown-ups' there (Shell.tsx). In a lesson and on the task
// screen the menu holds the hint mode and "For grown-ups" too, as their bars have no row of places.
// The pill stands on each of those screens, so that an adult who hands the tablet over finds the
// switch on it.
import { useLearner } from "../account/AccountGate.tsx";
import { Avatar } from "../account/Avatar.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { HintModeChoice } from "./HintModeChoice.tsx";
import { BELOW_BAR } from "./hang.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { PopOver } from "./PopOver.tsx";
import { ADULTS, navigate } from "./router.ts";

/** A row of a menu: its icon and its words, a target of the menu's whole width. */
export function MenuRow({
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

/**
 * The pill of the learner chosen and its menu, `short` beside the row of places; none with no
 * learner, as in a screen's own test.
 */
export function LearnerMenu({ short = false }: { readonly short?: boolean }) {
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
            <span className="nt-menu-who">
              <span className="nt-learner-name">{pseudonym}</span>
              {learner.owner ? (
                <span className="nt-menu-whose">{words.text("learner.yours")}</span>
              ) : null}
            </span>
            <span className="nt-menu-tick">
              <Icon value="ticked" />
            </span>
          </p>
          <hr />
          {short ? null : (
            <>
              <HintModeChoice
                learner={learner}
                onSaved={chosen.onSaved}
                onFailed={chosen.onFailed}
              />
              <hr />
            </>
          )}
          {/* Each closes the menu first: what it opens takes the screen's place. */}
          <MenuRow
            icon="switch-learner"
            text={words.text("learner.switch")}
            onPress={() => {
              close();
              chosen.switchLearner();
            }}
          />
          {short ? null : (
            <MenuRow
              icon="grown"
              text={words.text("adults.title")}
              onPress={() => {
                close();
                navigate(ADULTS);
              }}
            />
          )}
          <MenuRow
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
 * (R63, R64, R65); none with no learner.
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
