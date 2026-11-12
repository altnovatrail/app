// A module's skill map on a screen of app: the element <novatrail-skill-map> of skill-map with the
// map read (architecture 3.3 in spec; R34 in docs/decisions.md), in the screen's language — the
// learner's on the learner's screen, the device's in the section for adults —, its bands' headings
// at the level the screen gives. The view is the screen's: the learner's, whose Practise sends the
// skill chosen, or the adult's, which shows more and chooses nothing (R03 and R04 in skill-map).
// The element loads nothing and keeps nothing beyond its memory; a module with no skill graph has
// no map, and the screen says so. The heading of a map's screen is the module's title, here too.
import type { SkillMapView } from "@altnovatrail/skill-map";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Phrase } from "../i18n/Phrase.tsx";
import type { Words } from "../i18n/words.ts";
import type { HeadingLevel } from "./jsx.ts";
import type { ModuleMap } from "./map.ts";

/** The title of a module's map, "Skill map: {module}", or "Skill map" while its manifest is unknown. */
export function mapTitle(map: ModuleMap | undefined, words: Words): string {
  const manifest = map?.manifest;
  return manifest === undefined
    ? words.text("skillmap.title")
    : words.text("skillmap.module-title", { module: manifest.title });
}

/** The heading of a module's map: its title, the module's in its own language. */
export function MapHeading({ map }: { readonly map: ModuleMap | undefined }) {
  const { words } = useLanguage();
  const manifest = map?.manifest;
  if (manifest === undefined) return words.text("skillmap.title");
  return (
    <Phrase
      id="skillmap.module-title"
      values={{ module: <span lang={manifest.languages.explanation}>{manifest.title}</span> }}
    />
  );
}

export function ModuleSkillMap({
  map,
  view,
  headingLevel,
  onChoose,
}: {
  readonly map: ModuleMap;
  readonly view: SkillMapView;
  readonly headingLevel: HeadingLevel;
  /** The full ID of the skill the learner chose, for ChooseNext; the learner's view alone sends it. */
  readonly onChoose?: (skill: string, from: HTMLElement | undefined) => void;
}) {
  const { language, words } = useLanguage();
  const { graph, manifest, skillMap } = map;
  if (graph === undefined || manifest === undefined) return <p>{words.text("skillmap.none")}</p>;
  return (
    <novatrail-skill-map
      view={view}
      lang={language}
      heading-level={headingLevel}
      graph={graph.view}
      tiers={graph.skillTiers}
      manifest={manifest}
      skillMap={skillMap}
      {...(onChoose === undefined
        ? {}
        : {
            // The element sends the event from itself; the button pressed, Practise, is the focus in
            // its open shadow tree, if a press focused it — Safari's tap does not.
            onskillchoose: (event) => {
              const host = event.target instanceof Element ? event.target : undefined;
              const focused = host?.shadowRoot?.activeElement;
              onChoose(event.detail.skill, focused instanceof HTMLElement ? focused : undefined);
            },
          })}
    />
  );
}
