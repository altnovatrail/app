// The element <novatrail-skill-map> in React's JSX, as skill-map has it (architecture 3.3 in spec;
// R04 in skill-map; section 3.1 of docs/architecture.md). The element's own types are the
// package's: its properties take the open views by the types of the copy of @altnovatrail/spec the
// package names, 0.15.0 for skill-map 0.1.5, and GetSkillMap's answer by app's own contracts. App
// gives them its views by its own copy, 0.17.9, so ElementTakesViews below holds the two copies
// to one type, both ways: a form that drifted between them is a type error here, in ci-lint (R73
// in spec; R34). React 19 sets a property the element has, and listens for an event by the name
// after `on`, as the element sends it: lower case. `view`, `lang` and `heading-level` are
// attributes. `lang` is no option, and one of the build's languages, which the map's own words
// have: without it the map would speak English on a screen in another language.

import type { GetSkillMapResponse } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type { NovatrailSkillMap, SkillChooseEvent, SkillMapView } from "@altnovatrail/skill-map";
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { Key, Ref } from "react";
import type { Language } from "../i18n/language.ts";

/** True when each type is assignable to the other. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Holds<T extends true> = T;

/** The element's data, by the types of app's copy of spec and its contracts. */
export interface SkillMapData {
  readonly graph: open.SkillGraph | null;
  readonly tiers: Readonly<Record<string, number>> | null;
  readonly manifest: open.Manifest | null;
  readonly skillMap: GetSkillMapResponse | null;
}

/** The element takes the views of app's copy of spec, and gives back the same: one type, both ways. */
export type ElementTakesViews = Holds<
  Mutual<Pick<NovatrailSkillMap, keyof SkillMapData>, SkillMapData>
>;

/** The levels of headings the element's bands take. */
export type HeadingLevel = "2" | "3" | "4" | "5" | "6";

/** What app gives the element in JSX. */
export interface SkillMapProps extends Partial<SkillMapData> {
  readonly key?: Key;
  readonly ref?: Ref<NovatrailSkillMap>;
  /** The learner's view, with the choice of a skill, or the adult's, with the details. */
  readonly view: SkillMapView;
  /** The language of the map's own words: the screen's (section 3.8). */
  readonly lang: Language;
  /** The level of the bands' headings, by the map's place on the screen (WCAG 1.3.1). */
  readonly "heading-level"?: HeadingLevel;
  readonly onskillchoose?: (event: SkillChooseEvent) => void;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "novatrail-skill-map": SkillMapProps;
    }
  }
}
