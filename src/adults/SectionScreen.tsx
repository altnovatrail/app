// A page of the section for adults, by the mockup's rules of style, as the mockup
// draws no such page: the top bar of a screen, its glass pill holding the page's
// heading — with "For grown-ups" under it on every page but the first — and "Back to the section"
// before it on every page but the first, and at the bar's other end "Close the section", which goes
// home; below it a column of reading whose groups are cards. A page drawn outside the section, as
// its tests draw one, has no bar.
import { createContext, type ReactNode, useContext } from "react";
import { IconButton } from "../app/IconButton.tsx";
import { ADULTS, HOME, navigate } from "../app/router.ts";
import { Screen, type ScreenLayout } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** Where in the section a page stands: its first page, or one of the others. */
export type SectionPlace = "first" | "inner";

const Place = createContext<SectionPlace | undefined>(undefined);

/** The section's place for the page below it. */
export const SectionPlaceProvider = Place.Provider;

export interface SectionScreenProps {
  readonly title: string;
  /** The heading in the bar's pill in place of the title and the section's name: a map's. */
  readonly heading?: ReactNode;
  /** `map` for a module's map in its frame; a column of reading otherwise. */
  readonly layout?: Extract<ScreenLayout, "adults" | "map">;
  readonly children?: ReactNode;
}

export function SectionScreen({ title, heading, layout = "adults", children }: SectionScreenProps) {
  const { words } = useLanguage();
  const place = useContext(Place);
  if (place === undefined) {
    return (
      <Screen title={title} layout={layout} heading={heading}>
        {children}
      </Screen>
    );
  }
  const first = place === "first";
  return (
    <Screen
      title={title}
      layout={layout}
      heading={
        heading ?? (
          <>
            <span className="nt-top-title">{title}</span>
            {first ? null : <span className="nt-top-sub">{words.text("adults.title")}</span>}
          </>
        )
      }
      bar={{
        back: first ? null : (
          <IconButton value="back" caption="adults.back" onClick={() => navigate(ADULTS)} />
        ),
        end: (
          <div className="nt-top-close nt-glass">
            <IconButton value="close" caption="adults.close" onClick={() => navigate(HOME)} />
          </div>
        ),
      }}
    >
      {children}
    </Screen>
  );
}
