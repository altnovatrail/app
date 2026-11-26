// The cards of Home's modules (ModuleService in the contract): each module by the title
// and explanation language of the open view of its current version's manifest. A module with no
// current version for the learner is named by the manifest the cache keeps of an earlier version,
// or else by its ID, and shown unavailable; a manifest that cannot be had names the module by its
// ID too, and says so, so that the screen can ask again. A module whose skill graph is a chain is
// marked "in order", by the tiers of the open view of its current version's graph:
// the mark comes apart from the card, when the graph has come, so a graph slow to come holds no
// card back, and one that cannot be had marks nothing. Subjects says more of a module: the facts of
// its manifest — its subject, whom it is for, its version, authors and license — and its skills by
// tier, from the same graph. No DOM.
import type * as open from "@altnovatrail/spec/formatv0/open";
import type { OpenViews } from "../packages/views.ts";
import type { ChainPlace, SkillCounts } from "./states.ts";

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
  /** Its current version's skill graph is a chain: the mark "in order", once it is known. */
  readonly sequential?: true;
  /** How many of its skills have each state and mark, once its map has come. */
  readonly skills?: SkillCounts;
  /** The full ID of the skill its Continue works on, once its map has come. */
  readonly skill?: string;
  /** Its map is on its way: the card shows the shapes of its counts meanwhile. */
  readonly counting?: true;
  /** Where the learner stands in its chain of skills, once its map has come: a chain's alone. */
  readonly chain?: ChainPlace;
  /** It is solved on the sheet of a task from paper: Continue opens its page of tasks. */
  readonly sheet?: true;
  /** What the manifest of its current version says of it; none without a current version. */
  readonly about?: ModuleAbout;
  /** Its current version's skills by tier, once its graph has come; none for a module without one. */
  readonly skillList?: SkillList;
}

/** The facts of a module's manifest that Subjects shows, as the manifest writes them. */
export interface ModuleAbout {
  readonly subject: string;
  readonly ageCategories: readonly string[];
  readonly grades: readonly number[];
  readonly version: string;
  readonly authors: readonly string[];
  readonly license: string;
}

/** A module's skills, by the tiers of its graph, each tier named where the graph names it. */
export interface SkillList {
  /** Each tier by its number from 1 — none for the skills without one —, its name and its skills. */
  readonly tiers: readonly {
    readonly tier?: number;
    readonly name?: string;
    readonly skills: readonly string[];
  }[];
  /** How many skills it has. */
  readonly count: number;
  /** No skill has a verdict, and one at least a rubric: the kind "Feedback by criteria". */
  readonly rubric: boolean;
}

/**
 * The facts of a manifest that Subjects shows. The manifest is what api gave, read by its type and
 * not checked again here: one without its audience or its authors gives no facts, and its card
 * stands without them rather than not at all.
 */
export function aboutOf(manifest: open.Manifest): ModuleAbout | undefined {
  const { audience, authors } = manifest as Partial<open.Manifest>;
  if (audience?.age_categories === undefined || authors === undefined) return undefined;
  return {
    subject: manifest.subject,
    ageCategories: audience.age_categories,
    grades: audience.grades ?? [],
    version: manifest.version,
    authors: authors.map((author) => author.name),
    license: manifest.license,
  };
}

/**
 * The skills of a graph by its tiers, from the first, each tier's in the order of their titles; a
 * skill with no tier — none has one in a graph whose tiers module-kit did not compute — after them.
 */
export function skillListOf(
  graph: open.SkillGraph,
  tiers: Readonly<Record<string, number>>,
  compare: (a: string, b: string) => number = (a, b) => (a < b ? -1 : a > b ? 1 : 0),
): SkillList {
  const ids = Object.keys(graph.skills);
  const by = new Map<number, string[]>();
  for (const id of ids) {
    const tier = tiers[id] ?? Number.MAX_SAFE_INTEGER;
    by.set(tier, [...(by.get(tier) ?? []), (graph.skills[id] as open.Skill).title]);
  }
  const order = [...by.keys()].sort((a, b) => a - b);
  const kinds = ids.map((id) => (graph.skills[id] as open.Skill).assessability);
  return {
    tiers: order.map((tier) => {
      // The format numbers the tiers from 1 and names them in that order.
      const known = tier !== Number.MAX_SAFE_INTEGER;
      const name = known ? graph.tiers?.[tier - 1] : undefined;
      return {
        ...(known ? { tier } : {}),
        ...(name === undefined ? {} : { name }),
        skills: (by.get(tier) as string[]).sort(compare),
      };
    }),
    count: ids.length,
    rubric: kinds.includes("rubric") && !kinds.includes("verdict"),
  };
}

/** A module as the catalog or the list of connected modules gives it. */
export interface ModuleRef {
  readonly moduleId: string;
  readonly packageDigest: string;
  /** The list of connected modules says it is solved on the sheet; the catalog says nothing. */
  readonly onSheet?: boolean;
}

/**
 * Whether the tiers of a skill graph make it a chain: two skills or more, each in a tier of its own
 * — anchor skills have no tier. The tiers are those module-kit computed and api gives
 * with the graph, so the mark and the map's tiers never part.
 */
export function isSequential(tiers: Readonly<Record<string, number>>): boolean {
  const each = Object.values(tiers);
  return each.length >= 2 && new Set(each).size === each.length;
}

/** What a card takes from a package's skill graph: whether it is a chain, and its skills. */
export interface GraphFacts {
  readonly sequential: boolean;
  readonly skillList?: SkillList;
}

/**
 * Whether the skill graph of a package is a chain, by its tiers, and its skills; nothing for a
 * package with no graph and for a graph that cannot be had: the card is left as it is, and nothing
 * else waits for it.
 */
export function graphFactsOf(views: OpenViews, digest: string): Promise<GraphFacts> {
  return views.get(digest, "skill-graph").then(
    (graph) =>
      graph === undefined
        ? { sequential: false }
        : {
            sequential: isSequential(graph.skillTiers),
            skillList: skillListOf(graph.view, graph.skillTiers),
          },
    () => ({ sequential: false }),
  );
}

/** Whether the skill graph of a package is a chain, by its tiers; false where it cannot be had. */
export function sequentialOf(views: OpenViews, digest: string): Promise<boolean> {
  return graphFactsOf(views, digest).then((facts) => facts.sequential);
}

/** The manifests kept of earlier versions, read once for all the cards that need them. */
type Kept = () => Promise<ReadonlyMap<string, open.Manifest>>;

/** The facts of a current version's manifest, as a part of its card. */
function aboutPart(manifest: open.Manifest | undefined): { about?: ModuleAbout } {
  const about = manifest === undefined ? undefined : aboutOf(manifest);
  return about === undefined ? {} : { about };
}

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
    ...(module.onSheet === true ? { sheet: true as const } : {}),
    ...aboutPart(packageDigest === "" ? undefined : manifest),
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

/** Cards by their titles in the order of the screen's language, then by ID. */
export function byTitle(
  cards: readonly ModuleCard[],
  compare: (a: string, b: string) => number,
): ModuleCard[] {
  return [...cards].sort((a, b) => compare(a.title, b.title) || compare(a.moduleId, b.moduleId));
}
