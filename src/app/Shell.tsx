// The frame of Home, Subjects and the skill map, as the mockup's `home` (R148 spec; R79): from 600
// CSS px the side menu at the left — the mark, the places Home and Subjects, the cognitive map shut
// with "Soon" until it comes, and at its foot For grown-ups and Help —, on a phone the same five as a
// tab bar at the bottom and the mark at the top left; and at the top right the tutor, the
// notifications and the profile's menu at the edge. A place is a link of the hash, the page shown
// marked as current; For grown-ups and Help are pop-overs, hung beside the menu.
import { useLearner } from "../account/AccountGate.tsx";
import { DEVICE_PAGE } from "../adults/AdultSection.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { usePaper } from "../paper/PaperContext.tsx";
import { useAttempt } from "../task/AttemptContext.tsx";
import { Spark } from "./Brand.tsx";
import { AdultHelp, BESIDE_MENU } from "./Help.tsx";
import { HintModeChoice } from "./HintModeChoice.tsx";
import { BELOW_BAR } from "./hang.ts";
import { formatHash } from "./hash.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { LearnerMenu, MenuRow } from "./LearnerMenu.tsx";
import { NavCaption } from "./NavCaption.tsx";
import { PopOver } from "./PopOver.tsx";
import { ADULTS, HOME, navigate, PAPER, type Route, SUBJECTS, TASK } from "./router.ts";
import { APP_NAME } from "./Screen.tsx";

/** The places of the menu a route belongs to: a module's map is Subjects'. */
export type Place = "home" | "subjects";

/** The mark of NovaTrail, named by the app's name. */
function Mark({ className }: { readonly className: string }) {
  return (
    <span role="img" aria-label={APP_NAME} className={className}>
      <Spark />
    </span>
  );
}

/** A place of the menu: a link of the hash, its page marked as the current one. */
function PlaceLink({
  route,
  icon,
  text,
  current,
}: {
  readonly route: Route;
  readonly icon: IconValue;
  readonly text: string;
  readonly current: boolean;
}) {
  return (
    <a
      className="nt-nav-item"
      href={formatHash(route)}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        // The hash of the route, not a new entry of the history for the page already shown.
        event.preventDefault();
        navigate(route);
      }}
    >
      <NavCaption icon={icon} text={text} chosen={current} />
    </a>
  );
}

/**
 * For grown-ups (R76): whose settings it holds, the profile's hint mode, This device, the section's
 * other pages, and Sign out. A child's profile, which this build has not, would open it behind the
 * PIN (epic E4).
 */
export function GrownUps() {
  const chosen = useLearner();
  const { words } = useLanguage();
  if (chosen === undefined) return null;
  const title = words.text("adults.title");
  return (
    <PopOver
      label={title}
      className="nt-nav-item"
      popClassName="nt-pop-menu nt-pop-grown"
      beside
      gap={BESIDE_MENU}
      caption={<NavCaption icon="nav-grown" text={words.text("nav.grown")} />}
    >
      {(close) => (
        <>
          <h2 className="nt-pop-heading">{title}</h2>
          <p className="nt-pop-line">{words.text("grown.who")}</p>
          <HintModeChoice
            learner={chosen.learner}
            onSaved={chosen.onSaved}
            onFailed={chosen.onFailed}
          />
          <hr />
          {/* Each closes the pop-over first: what it opens takes the screen's place. */}
          <MenuRow
            icon="device"
            text={words.text("device.title")}
            onPress={() => {
              close();
              navigate(DEVICE_PAGE);
            }}
          />
          <MenuRow
            icon="settings"
            text={words.text("grown.section")}
            onPress={() => {
              close();
              navigate(ADULTS);
            }}
          />
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

/** The notifications: the place for them, a bell of R90 spec's list; nothing sends one yet. */
export function Bell() {
  const { words } = useLanguage();
  return (
    <PopOver
      icon="notifications"
      label={words.text("bell.title")}
      className="nt-top-round"
      popClassName="nt-pop-bell"
      gap={BELOW_BAR}
    >
      <h2 className="nt-pop-heading">{words.text("bell.title")}</h2>
      <div className="nt-bell-none">
        <span className="nt-bell-sign">
          <Icon value="notifications" />
        </span>
        <b>{words.text("bell.none")}</b>
        <span>{words.text("bell.later")}</span>
      </div>
    </PopOver>
  );
}

/**
 * The tutor's button at the top right and its panel (R67): where there is no work, the panel says
 * that the tutor is an AI and where it helps, and leads to the work — the attempt open, and a task
 * from paper. To an adult the tutor is neutral, its gradient sign; Pip is the children's (epic E4).
 */
export function HomeTutor() {
  const { words } = useLanguage();
  const open = useAttempt()?.attemptId;
  const paper = usePaper();
  const title = words.text("icon.tutor");
  return (
    <PopOver
      icon="tutor"
      label={title}
      className="nt-tutor-button nt-home-tutor"
      popClassName="nt-pop-tutor"
      gap={BELOW_BAR}
    >
      {(close) => (
        <>
          <div className="nt-tutor-home-head">
            <span className="nt-tutor-sign">
              <Icon value="tutor" />
            </span>
            <h2 className="nt-pop-heading">{title}</h2>
          </div>
          <p className="nt-tutor-bubble">{words.text("tutor-home.ai")}</p>
          <p className="nt-tutor-bubble">{words.text("tutor-home.where")}</p>
          <div className="nt-tutor-home-acts">
            {open === undefined ? null : (
              <button
                type="button"
                onClick={() => {
                  close();
                  navigate(TASK);
                }}
              >
                {words.text("task.continue")}
              </button>
            )}
            <button
              type="button"
              className="nt-secondary nt-icon-text"
              onClick={() => {
                close();
                paper?.clear();
                navigate(PAPER);
              }}
            >
              <Icon value="camera" />
              {words.text("subjects.paper")}
            </button>
          </div>
        </>
      )}
    </PopOver>
  );
}

/** The side menu, or the phone's tab bar, and the top right, for the place shown. */
export function ShellBar({ place }: { readonly place: Place }) {
  const { words } = useLanguage();
  const later = words.text("nav.cognitive-later");
  return (
    <>
      <nav className="nt-nav" aria-label={words.text("nav.title")}>
        <Mark className="nt-mark nt-nav-mark" />
        <PlaceLink
          route={HOME}
          icon="nav-home"
          text={words.text("nav.home")}
          current={place === "home"}
        />
        <PlaceLink
          route={SUBJECTS}
          icon="nav-subjects"
          text={words.text("nav.subjects")}
          current={place === "subjects"}
        />
        {/* Shut until it comes: in the order of the keyboard still, so that its "Soon" is read. */}
        <button type="button" className="nt-nav-item" aria-disabled="true" title={later}>
          <NavCaption icon="nav-cognitive" text={words.text("nav.cognitive")} />
          <span className="nt-soon">{words.text("nav.soon")}</span>
        </button>
        <span className="nt-nav-gap" />
        <GrownUps />
        <AdultHelp />
      </nav>
      <header className="nt-shell-top">
        <Mark className="nt-mark nt-top-mark" />
        <HomeTutor />
        <Bell />
        <LearnerMenu short />
      </header>
    </>
  );
}
