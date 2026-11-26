// A page of Settings, the section for adults, drawn as a device's settings. From 600 CSS px the
// section's list stands at the left — the profiles, then what is the device's and the account's,
// under "Settings" and its close — and the page beside it, under its bar: its heading in the
// middle, its way back to the page above it where it has one, and its action — a profile's Save
// — at the end. Below 600 the list is the first page, under its heading and its close, and each
// other page stands alone under its bar, whose way back leads to the list or to the page above.
// A page drawn outside the section, as its tests draw one, has neither the list nor the bar's way
// back. A page with changes not saved is asked before the close or the way back leaves it.
import { createContext, type ReactNode, useContext } from "react";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useNarrow } from "../app/narrow.ts";
import { ADULTS, HOME, navigate, type Route } from "../app/router.ts";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useLeave } from "./leave.tsx";

/** Where a page stands in the section: the list, a page of it, or a page under one of those. */
export interface SectionPlace {
  /** The list itself, the first page below 600 CSS px. */
  readonly first: boolean;
  /** The list, for the side from 600 CSS px and for the first page below. */
  readonly list: ReactNode;
  /** The page above this one, and its name. */
  readonly up?: { readonly route: Route; readonly name: string };
}

const Place = createContext<SectionPlace | undefined>(undefined);

/** The section's place for the page below it. */
export const SectionPlaceProvider = Place.Provider;

export interface SectionScreenProps {
  readonly title: string;
  /** What stands at the end of the page's bar: a profile's Save. */
  readonly action?: ReactNode;
  readonly children?: ReactNode;
}

/** The close of the section: home, as from any page of it. */
function Close() {
  const leave = useLeave();
  return (
    <div className="nt-top-close nt-glass">
      <IconButton
        value="close"
        caption="adults.close"
        onClick={() => leave(() => navigate(HOME))}
      />
    </div>
  );
}

export function SectionScreen({ title, action, children }: SectionScreenProps) {
  const { words } = useLanguage();
  const place = useContext(Place);
  const narrow = useNarrow();
  const leave = useLeave();
  if (place === undefined) {
    return (
      <Screen title={title} layout="settings" head={{ close: action }}>
        {children}
      </Screen>
    );
  }
  const settings = words.text("learner.settings");
  if (narrow && place.first) {
    return (
      <Screen title={settings} layout="settings-list" head={{ close: <Close /> }}>
        {place.list}
      </Screen>
    );
  }
  const up = place.up ?? (narrow ? { route: ADULTS, name: settings } : undefined);
  return (
    <Screen
      title={title}
      layout="settings"
      before={
        narrow ? undefined : (
          <nav className="nt-set-side" aria-label={settings}>
            <div className="nt-set-side-head">
              <p className="nt-set-side-title" aria-hidden="true">
                {settings}
              </p>
              <Close />
            </div>
            {place.list}
          </nav>
        )
      }
      head={{
        back:
          up === undefined ? undefined : (
            <button
              type="button"
              className="nt-set-back"
              aria-label={words.text("adults.back-to", { name: up.name })}
              onClick={() => leave(() => navigate(up.route))}
            >
              <span className="nt-set-back-icon">
                <Icon value="back" />
              </span>
              <span>{up.name}</span>
            </button>
          ),
        close: action,
      }}
    >
      {children}
    </Screen>
  );
}
