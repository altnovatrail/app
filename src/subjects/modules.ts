// The cards of "My subjects" (section 3.10 of docs/architecture.md; R99 in spec; ModuleService in
// the contract): each module by the title and explanation language of the open view of its current
// version's manifest. A module with no current version for the learner is named by the manifest the
// cache keeps of an earlier version, or else by its ID, and shown unavailable; a manifest that cannot
// be had names the module by its ID too, and says so, so that the screen can ask again. No DOM.
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { OpenViews } from "../packages/views.ts";

export interface ModuleCard {
  readonly moduleId: string;
  /** The digest of the package of its current version; none when it has none for the learner. */
  readonly digest?: string;
  /** What it is called: its manifest's title, or its ID. */
  readonly title: string;
  /** The explanation language of the title's manifest, the `lang` of the title; none for an ID. */
  readonly language?: string;
  /** The manifest of its current version did not come: the ID stands in until a retry. */
  readonly unnamed?: true;
}

/** A module as the catalog or the list of connected modules gives it. */
export interface ModuleRef {
  readonly moduleId: string;
  readonly packageDigest: string;
}

/** The manifests kept of earlier versions, read once for all the cards that need them. */
type Kept = () => Promise<ReadonlyMap<string, open.Manifest>>;

/** The card of a module. */
export async function cardOf(
  views: OpenViews,
  module: ModuleRef,
  kept?: Kept,
): Promise<ModuleCard> {
  const { moduleId, packageDigest } = module;
  let manifest: open.Manifest | undefined;
  let unnamed = false;
  if (packageDigest === "") {
    manifest = (await (kept ?? (() => views.keptManifests()))().catch(() => undefined))?.get(
      moduleId,
    );
  } else {
    try {
      manifest = (await views.get(packageDigest, "manifest"))?.view;
    } catch {
      unnamed = true;
    }
  }
  return {
    moduleId,
    ...(packageDigest === "" ? {} : { digest: packageDigest }),
    title: manifest?.title ?? moduleId,
    ...(manifest === undefined ? {} : { language: manifest.languages.explanation }),
    ...(unnamed ? { unnamed: true as const } : {}),
  };
}

/** The cards of modules; the cache of earlier manifests is read once, and only if one needs it. */
export async function cardsOf(
  views: OpenViews,
  modules: readonly ModuleRef[],
): Promise<ModuleCard[]> {
  let read: Promise<ReadonlyMap<string, open.Manifest>> | undefined;
  const kept: Kept = () => {
    read ??= views.keptManifests();
    return read;
  };
  return Promise.all(modules.map((module) => cardOf(views, module, kept)));
}

/** Cards by their titles in the order of the screen's language, then by ID (section 3.8). */
export function byTitle(
  cards: readonly ModuleCard[],
  compare: (a: string, b: string) => number,
): ModuleCard[] {
  return [...cards].sort((a, b) => compare(a.title, b.title) || compare(a.moduleId, b.moduleId));
}
