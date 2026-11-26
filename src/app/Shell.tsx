// The frame of Home, Subjects and the skill map, as the mockup's `home`: from 600
// CSS px a row at the top — at its left a pill of the places, Home and Subjects, the cognitive map
// shut with "Soon" until it comes; at its right a pill of the tutor, shut until it comes too, the
// notifications and the profile's menu, which holds Settings and Help —, on a phone the three places as a tab bar at the
// bottom and the mark at the top left. A place is a link of the hash, the page shown marked as
// current.
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Spark } from "./Brand.tsx";
import { BELOW_BAR } from "./hang.ts";
import { formatHash } from "./hash.ts";
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";
import { LearnerMenu } from "./LearnerMenu.tsx";
import { captionHidden, NavCaption } from "./NavCaption.tsx";
import { PopOver } from "./PopOver.tsx";
import { HOME, navigate, type Route, SUBJECTS } from "./router.ts";
import { APP_NAME } from "./Screen.tsx";
import { useTooltip } from "./Tooltip.tsx";

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
  const tooltip = useTooltip<HTMLAnchorElement>(text, { needed: captionHidden });
  return tooltip.wrap(
    <a
      ref={tooltip.host}
      className="nt-nav-item"
      href={formatHash(route)}
      onFocus={tooltip.onFocus}
      onBlur={tooltip.onBlur}
      aria-current={current ? "page" : undefined}
      onClick={(event) => {
        // The hash of the route, not a new entry of the history for the page already shown.
        event.preventDefault();
        navigate(route);
      }}
    >
      <NavCaption icon={icon} text={text} chosen={current} />
    </a>,
  );
}

/**
 * The cognitive map, shut until it comes: in the order of the keyboard still, so that its "Soon" is
 * read, and named at every width by a tooltip of why it waits.
 */
function ShutPlace() {
  const { words } = useLanguage();
  const tooltip = useTooltip<HTMLButtonElement>(words.text("nav.cognitive-later"));
  return tooltip.wrap(
    <button
      ref={tooltip.host}
      type="button"
      className="nt-nav-item"
      aria-disabled="true"
      onFocus={tooltip.onFocus}
      onBlur={tooltip.onBlur}
    >
      <NavCaption icon="nav-cognitive" text={words.text("nav.cognitive")} />{" "}
      <span className="nt-soon">{words.text("nav.soon")}</span>
    </button>,
  );
}

/**
 * The notifications: the place for them, a bell of spec's closed list of icon buttons; nothing sends
 * one yet.
 */
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
 * The tutor at the top right, shut until it comes, as the cognitive map: in its place and in the
 * keyboard's order, named, its tooltip saying it comes later; it opens nothing.
 */
function ShutTutor() {
  const { words } = useLanguage();
  const tooltip = useTooltip<HTMLButtonElement>(words.text("tutor-home.later"));
  return tooltip.wrap(
    <button
      ref={tooltip.host}
      type="button"
      className="nt-icon-only nt-top-round"
      aria-disabled="true"
      aria-label={words.text("icon.tutor")}
      onFocus={tooltip.onFocus}
      onBlur={tooltip.onBlur}
    >
      <Icon value="tutor" />
    </button>,
  );
}

/** The row of places, or the phone's tab bar, and the top right, for the place shown. */
export function ShellBar({ place }: { readonly place: Place }) {
  const { words } = useLanguage();
  return (
    <div className="nt-shell-bar">
      <nav className="nt-nav" aria-label={words.text("nav.title")}>
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
        <ShutPlace />
      </nav>
      <header className="nt-shell-top">
        <Mark className="nt-mark nt-top-mark" />
        <div className="nt-top-pills">
          <ShutTutor />
          <Bell />
          <LearnerMenu />
        </div>
      </header>
    </div>
  );
}
