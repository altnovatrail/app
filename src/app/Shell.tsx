// The frame of Home, Subjects and the skill map, as the mockup's `home`: from 600
// CSS px a row at the top — at its left a pill of the places, Home and Subjects, the cognitive map
// shut with "Soon" until it comes; at its right a pill of the ring of tutor time (TutorTime.tsx), the
// tutor, shut until it comes too, the notifications — the next versions of the legal texts — and the profile's menu, which holds Settings and Help —, on a phone the three places as a tab bar at the
// bottom and the mark at the top left. A place is a link of the hash, the page shown marked as
// current.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useLearner } from "../account/AccountGate.tsx";
import { useRequest } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { nextPage } from "../legal/LegalPages.tsx";
import { dayText, pageNext, readLegal, versionsOf } from "../legal/texts.ts";
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
import { TutorTime } from "./TutorTime.tsx";

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

/** Where this device keeps the notices the bell has shown: a text's ID and version each. */
const SEEN = "novatrail.bell.seen";

function seenHere(): readonly string[] {
  try {
    const kept: unknown = JSON.parse(window.localStorage.getItem(SEEN) ?? "[]");
    return Array.isArray(kept) ? kept.filter((each) => typeof each === "string") : [];
  } catch {
    return [];
  }
}

function keepSeen(seen: readonly string[]): void {
  try {
    window.localStorage.setItem(SEEN, JSON.stringify(seen));
  } catch {
    // A device that keeps nothing shows the dot again next time; nothing else depends on it.
  }
}

/** Marks what the bell shows as seen once its pop-over is open. */
function Seen({ onSeen }: { readonly onSeen: () => void }) {
  const seen = useRef(onSeen);
  useEffect(() => seen.current(), []);
  return null;
}

/**
 * The notifications, a bell of spec's closed list of icon buttons: the next version of each legal
 * text that is a page, with the day it applies from, the version in force till then and the way to
 * its page, and, while a profile of the account keeps its works on the server, that this can be
 * turned off in Settings before then. A red dot, and the button's description, while a notice is
 * one this device has not shown; opened, the dot goes. An api that gives no next version, or a
 * read that failed, leaves "Nothing new yet".
 */
export function Bell() {
  const { language, words } = useLanguage();
  const chosen = useLearner();
  const id = useId();
  const read = useCallback(
    async (api: Api) => {
      const legal = await readLegal(api, language);
      return pageNext(legal.next).map((next) => ({
        next,
        current: versionsOf(legal, next.id).current,
      }));
    },
    [language],
  );
  const answer = useRequest(read);
  const news = answer.status === "done" ? answer.value : [];
  const keys = news.map(({ next }) => `${next.id}@${next.version}`);
  const [seen, setSeen] = useState(seenHere);
  const fresh = keys.filter((key) => !seen.includes(key)).length;
  const see = () => {
    const all = [...new Set([...seenHere(), ...keys])];
    keepSeen(all);
    setSeen(all);
  };
  return (
    <>
      <PopOver
        icon="notifications"
        label={words.text("bell.title")}
        className={fresh > 0 ? "nt-top-round nt-bell-new" : "nt-top-round"}
        describedBy={fresh > 0 ? `${id}-new` : undefined}
        popClassName="nt-pop-bell"
        gap={BELOW_BAR}
      >
        <h2 className="nt-pop-heading">{words.text("bell.title")}</h2>
        {news.length === 0 ? (
          <div className="nt-bell-none">
            <span className="nt-bell-sign">
              <Icon value="notifications" />
            </span>
            <b>{words.text("bell.none")}</b>
            <span>{words.text("bell.later")}</span>
          </div>
        ) : (
          <>
            <Seen onSeen={see} />
            {news.map(({ next, current }) => {
              const name = words.text(`legal.${next.id}`);
              const version = String(next.version);
              return (
                <div key={next.id} className="nt-bell-item">
                  <span className="nt-bell-tile">
                    <Icon value="bell-text" />
                  </span>
                  <span className="nt-bell-text">
                    <b>{words.text("bell.next-title", { text: name, version })}</b>
                    <span>
                      {words.text("bell.next-when", {
                        date: dayText(language, next.inForceSince),
                      })}
                      {current === undefined
                        ? null
                        : ` ${words.text("bell.next-until", { version: String(current.version) })}`}
                    </span>
                    {chosen?.storing === true ? (
                      <span>{words.text("bell.next-storage")}</span>
                    ) : null}
                    <button
                      type="button"
                      className="nt-bell-read"
                      aria-label={words.text("legal.next-open", { text: name, version })}
                      onClick={() => chosen?.openLegal(nextPage(next.id))}
                    >
                      {words.text("legal.next-read", { version })}
                    </button>
                  </span>
                </div>
              );
            })}
          </>
        )}
      </PopOver>
      {fresh > 0 ? (
        <span id={`${id}-new`} hidden>
          {words.text("bell.new", { count: String(fresh) })}
        </span>
      ) : null}
    </>
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
          <TutorTime />
          <ShutTutor />
          <Bell />
          <LearnerMenu />
        </div>
      </header>
    </div>
  );
}
