// The profile's menu, everything of the learner's screens that is not a place: the pill of the
// learner chosen — the avatar, the pseudonym and a chevron — at the top right of Home, Subjects and
// the skill map, the avatar alone on a phone, and at the end of a lesson's and a task's bar; behind
// it, as a pop-over, who is learning now and "Switch learner"; "Settings", the section for adults,
// where each profile's hints are set; "Help", for an adult, which opens in the menu's own place with
// a way back; and "Sign out" last. The pill stands on each of those screens, so that an adult who
// hands the tablet over finds the switch on it.
import { type Ref, useEffect, useRef, useState } from "react";
import { useLearner } from "../account/AccountGate.tsx";
import { Avatar } from "../account/Avatar.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { legalPage } from "../legal/LegalPages.tsx";
import { ReadLegalSheet } from "../legal/LegalSheet.tsx";
import { isPageText, type PageText } from "../legal/texts.ts";
import { HelpView } from "./Help.tsx";
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
  opens = false,
  ref,
}: {
  readonly icon: IconValue;
  readonly text: string;
  readonly onPress: () => void;
  /** A chevron at its end: it leads further, to a page or into the menu. */
  readonly opens?: boolean;
  readonly ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button ref={ref} type="button" className="nt-menu-row" onClick={onPress}>
      <span className="nt-menu-icon">
        <Icon value={icon} />
      </span>
      <span className="nt-menu-label">{text}</span>
      {opens ? (
        <span className="nt-menu-more">
          <Icon value="more" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * What the menu holds: its rows, or Help in their place. The focus goes to Help's heading when it
 * opens and back to its row when the rows come back, as what it stood on is gone.
 */
function MenuBody({
  close,
  onSheet,
}: {
  readonly close: () => void;
  readonly onSheet: (page: PageText) => void;
}) {
  const chosen = useLearner();
  const { words } = useLanguage();
  const [help, setHelp] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const helpRow = useRef<HTMLButtonElement>(null);
  // The menu opens on its rows with the focus where the pop-over puts it; only a move between the
  // rows and Help takes it.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) (help ? heading : helpRow).current?.focus();
  }, [help]);
  if (chosen === undefined) return null;
  const { learner } = chosen;
  const show = (to: boolean) => {
    moved.current = true;
    setHelp(to);
  };
  if (help) {
    return (
      <>
        <button type="button" className="nt-menu-back" onClick={() => show(false)}>
          <Icon value="back" />
          {words.text("learner.back")}
        </button>
        <HelpView
          heading={heading}
          onPage={(page) => {
            close();
            if (isPageText(page)) onSheet(page);
            else chosen.openLegal(legalPage(page));
          }}
        />
      </>
    );
  }
  return (
    <>
      <p className="nt-menu-caption">{words.text("learner.now")}</p>
      <p className="nt-menu-current">
        <Avatar code={learner.avatar} size="menu" />
        <span className="nt-menu-who">
          <span className="nt-learner-name">{learner.pseudonym}</span>
          {learner.owner ? (
            <span className="nt-menu-whose">{words.text("learner.yours")}</span>
          ) : null}
        </span>
      </p>
      {/* Each that leaves closes the menu first: what it opens takes the screen's place. */}
      <MenuRow
        icon="switch-learner"
        text={words.text("learner.switch")}
        onPress={() => {
          close();
          chosen.switchLearner();
        }}
      />
      <hr />
      <MenuRow
        icon="settings"
        text={words.text("learner.settings")}
        opens
        onPress={() => {
          close();
          navigate(ADULTS);
        }}
      />
      {learner.ageCategory === "adult" ? (
        <MenuRow
          ref={helpRow}
          icon="help"
          text={words.text("icon.help")}
          opens
          onPress={() => show(true)}
        />
      ) : null}
      <hr />
      <MenuRow
        icon="sign-out"
        text={words.text("signout.button")}
        onPress={() => {
          close();
          chosen.signOut();
        }}
      />
    </>
  );
}

/** The pill of the learner chosen and its menu; none with no learner, as in a screen's own test. */
export function LearnerMenu() {
  const chosen = useLearner();
  const { words } = useLanguage();
  // The text of Help whose sheet stands over the screen, once the menu has closed.
  const [sheet, setSheet] = useState<PageText | undefined>(undefined);
  if (chosen === undefined) return null;
  const { pseudonym, avatar } = chosen.learner;
  return (
    <>
      <PopOver
        label={words.text("learner.menu")}
        buttonLabel={words.text("learner.menu-button", { pseudonym })}
        className="nt-learner-pill nt-glass"
        popClassName="nt-pop-menu nt-pop-profile"
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
        {(close) => <MenuBody close={close} onSheet={setSheet} />}
      </PopOver>
      {sheet === undefined ? null : (
        <ReadLegalSheet id={sheet} onClose={() => setSheet(undefined)} onPage={chosen.openLegal} />
      )}
    </>
  );
}

/**
 * The profile's pill on a screen of a lesson or a task that has no top bar of its own — a lesson's
 * end, a lesson or a task not read, a task already over —, as on every screen of the profile;
 * none with no learner.
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
