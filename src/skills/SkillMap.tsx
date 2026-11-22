// A module's skill map on a screen of app: the element <novatrail-skill-map> of skill-map with the
// map read (R34), in the screen's language — the learner's on the learner's screen, the device's in
// the section for adults —, its bands' headings at the level the screen gives. The view is the
// screen's: the learner's, whose Practise sends the skill chosen, or the adult's, which shows more
// and chooses nothing (R03 and R04 skill-map). The element loads nothing and keeps nothing beyond
// its memory; a module with no skill graph has no map, and the screen says so. The heading of a
// map's screen is the module's title, here too.
import type { SkillMapView } from "@altnovatrail/skill-map";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
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

/** The widths of the tiles of a map's bands while it is read, none alike in a band: their keys. */
const BANDS = [
  ["7.5rem", "9rem", "6.5rem"],
  ["8.5rem", "7rem"],
  ["6rem", "9.5rem", "8rem", "7rem"],
] as const;

/** A map while it is read: its bands' headings and rows of tiles, as the element draws them. */
export function MapLoading() {
  return (
    <Loading>
      {BANDS.map((tiles) => (
        <div key={tiles.join()} className="nt-map-loading">
          <Sk width="8rem" height="1.125rem" radius="0.3125rem" />
          <div className="nt-map-loading-tiles">
            {tiles.map((width) => (
              <Sk key={width} width={width} height="2.75rem" radius="0.5rem" />
            ))}
          </div>
        </div>
      ))}
    </Loading>
  );
}

/**
 * The heading of a module's map in its top bar, as the mockup's title (R63): "Skill map" and, on a
 * line under it, the module's title in its own language. The screen names the heading by its
 * title, "Skill map: {module}", where the eye has the line break.
 */
export function MapBarHeading({ map }: { readonly map: ModuleMap | undefined }) {
  const { words } = useLanguage();
  const manifest = map?.manifest;
  return (
    <>
      <span className="nt-top-title">{words.text("skillmap.title")}</span>
      {manifest === undefined ? null : (
        <span className="nt-top-sub" lang={manifest.languages.explanation}>
          {manifest.title}
        </span>
      )}
    </>
  );
}
