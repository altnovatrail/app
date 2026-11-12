import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import { ApiError } from "../api/failure.ts";
import type { OpenViews } from "../packages/views.ts";
import { byTitle, cardOf, cardsOf, isSequential, sequentialOf } from "./modules.ts";

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;

function manifest(title: string, explanation = "en"): open.Manifest {
  return { title, languages: { explanation } } as open.Manifest;
}

/** How often the cache of earlier manifests was read. */
const reads = { count: 0 };

/** Open views with what the test says api and the cache hold. */
function viewsOf(
  current: Record<string, open.Manifest | "fails">,
  kept: Record<string, open.Manifest> = {},
): OpenViews {
  return {
    async get(digest: string) {
      const found = current[digest];
      if (found === "fails") throw new ApiError({ kind: "offline" });
      return found === undefined ? undefined : { view: found, skillTiers: {} };
    },
    async keptManifests() {
      reads.count += 1;
      return new Map(Object.entries(kept));
    },
  } as unknown as OpenViews;
}

describe("the cards of modules", () => {
  it("name a module by its current manifest, in its explanation language", async () => {
    const views = viewsOf({ [D1]: manifest("Olympiad maths") });
    expect(await cardOf(views, { moduleId: "novatrail/olympiad-math", packageDigest: D1 })).toEqual(
      {
        moduleId: "novatrail/olympiad-math",
        digest: D1,
        title: "Olympiad maths",
        language: "en",
      },
    );
  });

  it("name one with no current version by a manifest kept of an earlier one, or by its ID", async () => {
    const views = viewsOf({}, { "novatrail/kept": manifest("Kept title", "ru") });
    expect(await cardOf(views, { moduleId: "novatrail/kept", packageDigest: "" })).toEqual({
      moduleId: "novatrail/kept",
      title: "Kept title",
      language: "ru",
    });
    reads.count = 0;
    const cards = await cardsOf(views, [
      { moduleId: "novatrail/kept", packageDigest: "" },
      { moduleId: "novatrail/none", packageDigest: "" },
    ]);
    expect(cards[1]).toEqual({ moduleId: "novatrail/none", title: "novatrail/none" });
    // The cache is read once for all the cards that need it.
    expect(reads.count).toBe(1);
  });

  it("name a module by its ID when its manifest cannot be had, saying so, and go by title in the language's order", async () => {
    const views = viewsOf({ [D1]: "fails", [D2]: manifest("Ёлки") });
    const cards = await cardsOf(views, [
      { moduleId: "z/fails", packageDigest: D1 },
      { moduleId: "a/fir", packageDigest: D2 },
      { moduleId: "b/no-part", packageDigest: `sha256:${"3".repeat(64)}` },
    ]);
    expect(cards[0]).toMatchObject({ title: "z/fails", unnamed: true });
    expect(cards[2]).not.toHaveProperty("unnamed");
    // The same title goes by the ID.
    const twins = byTitle(
      [
        { moduleId: "b", title: "Same" },
        { moduleId: "a", title: "Same" },
      ],
      new Intl.Collator("en").compare,
    );
    expect(twins.map((card) => card.moduleId)).toEqual(["a", "b"]);
    // Russian puts Cyrillic before Latin.
    expect(byTitle(cards, new Intl.Collator("ru").compare).map((card) => card.title)).toEqual([
      "Ёлки",
      "b/no-part",
      "z/fails",
    ]);
  });
});

describe('the mark "in order"', () => {
  it("is a chain's: two skills or more, each in a tier of its own (R58 in spec)", () => {
    expect(isSequential({ "counting-gaps": 1, "time-calendar": 2 })).toBe(true);
    expect(isSequential({ c: 3, a: 1, b: 2 })).toBe(true);
    expect(isSequential({ a: 1, b: 1, c: 2 })).toBe(false);
    // One skill, or none, is no chain.
    expect(isSequential({ a: 1 })).toBe(false);
    expect(isSequential({})).toBe(false);
  });

  it("is known by the tiers of a package's graph, and is not for a graph that does not come", async () => {
    const asked: string[] = [];
    const views = {
      async get(digest: string, kind: string) {
        asked.push(`${kind} ${digest}`);
        if (kind === "manifest") return { view: manifest("Chain"), skillTiers: {} };
        if (digest === D1) return { view: {}, skillTiers: { a: 1, b: 2 } };
        if (digest === D2) throw new ApiError({ kind: "offline" });
        return undefined;
      },
      async keptManifests() {
        return new Map();
      },
    } as unknown as OpenViews;
    expect(await sequentialOf(views, D1)).toBe(true);
    expect(await sequentialOf(views, D2)).toBe(false);
    expect(await sequentialOf(views, `sha256:${"3".repeat(64)}`)).toBe(false);
    // A card does not wait for the graph: it reads the manifest alone.
    asked.length = 0;
    const [card] = await cardsOf(views, [{ moduleId: "m/chain", packageDigest: D1 }]);
    expect(card).not.toHaveProperty("sequential");
    expect(asked).toEqual([`manifest ${D1}`]);
  });
});
