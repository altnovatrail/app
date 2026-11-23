// The counts of the skills on the cards: each map asked once for a profile, module and
// version; a map that failed asked again with the next cards; and another profile's counts never
// shown on a card of the same module.
import { GetSkillMapResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import type { ModuleCard } from "./modules.ts";
import { useSkillCounts } from "./useSkillCounts.ts";

const DIGEST = `sha256:${"1".repeat(64)}`;
const GRAPH = { skills: { a: { title: "A", assessability: "verdict" } } };

/** api whose GetSkillMap answers by profile, by the function given, and counts each call. */
function setup(answer: (profileId: string) => "ready" | "fail") {
  const calls: string[] = [];
  const api = {
    progress: {
      getSkillMap: async ({ profileId }: { profileId: string }) => {
        calls.push(profileId);
        if (answer(profileId) === "fail") throw new Error("down");
        return create(GetSkillMapResponseSchema, {
          packageDigest: DIGEST,
          skills: [{ skill: "a" }],
        });
      },
    },
  } as unknown as Api;
  const views = {
    get: async (_digest: string, kind: string) =>
      kind === "skill-graph"
        ? { view: GRAPH, skillTiers: { a: 1 } }
        : { view: { title: "M", languages: { explanation: "en" } } },
  } as unknown as OpenViews;
  return { api, views, calls };
}

const cards = (): ModuleCard[] => [{ moduleId: "m", digest: DIGEST, title: "M" }];

describe("the counts of the skills on the cards", () => {
  it("asks each map once, and again with the next cards only for one that failed", async () => {
    let down = true;
    const { api, views, calls } = setup(() => (down ? "fail" : "ready"));
    const { result, rerender } = renderHook(({ list }) => useSkillCounts(api, views, "p1", list), {
      initialProps: { list: cards() },
    });
    await waitFor(() => expect(calls).toEqual(["p1"]));
    expect(result.current?.[0]?.skills).toBeUndefined();
    down = false;
    rerender({ list: cards() });
    await waitFor(() => expect(result.current?.[0]?.skills?.["ready-to-start"]).toBe(1));
    rerender({ list: cards() });
    expect(calls).toEqual(["p1", "p1"]);
  });

  it("never shows one profile's counts on another's card of the same module", async () => {
    const { api, views, calls } = setup((profileId) => (profileId === "p1" ? "ready" : "fail"));
    const list = cards();
    const { result, rerender } = renderHook(
      ({ profileId }) => useSkillCounts(api, views, profileId, list),
      { initialProps: { profileId: "p1" } },
    );
    await waitFor(() => expect(result.current?.[0]?.skills).toBeDefined());
    rerender({ profileId: "p2" });
    expect(result.current?.[0]?.skills).toBeUndefined();
    await waitFor(() => expect(calls).toEqual(["p1", "p2"]));
    expect(result.current?.[0]?.skills).toBeUndefined();
  });
});
