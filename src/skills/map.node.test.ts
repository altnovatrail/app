// The skill map of a module as app reads it, with no network: api is connect-es's router, the open
// views on the device's memory (R99 in spec; section 15 of the text of the contracts).
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  AnchorSkillHolding,
  GetSkillMapResponseSchema,
  ProgressService,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { OpenViews } from "../packages/views.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { offeredModules, readModuleMap } from "./map.ts";

const D1 = `sha256:${"1".repeat(64)}`;

function view(json: unknown) {
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: "0.4" };
}

const MANIFEST = {
  module_format_version: "0.4",
  id: "example/fair-shares",
  version: "1.0.0",
  title: "Fair shares",
  languages: { explanation: "en" },
};
const GRAPH = { skills: { halves: { title: "Halves", assessability: "verdict" } } };

async function harness(routes: (router: ConnectRouter) => void) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  return { api, views: new OpenViews({ api, device, stale: () => {} }) };
}

describe("readModuleMap", () => {
  it("reads the state by the action asked, and the graph with its tiers and the manifest by its digest", async () => {
    const asked: string[] = [];
    const { api, views } = await harness((router) => {
      router.service(ProgressService, {
        getSkillMap(request) {
          asked.push(`map ${request.profileId} ${request.moduleId} ${request.action}`);
          return { packageDigest: D1, skills: [{ skill: "halves", evidenceCount: 2 }] };
        },
      });
      router.service(PackageService, {
        getManifest(request) {
          asked.push(`manifest ${request.packageDigest}`);
          return { manifest: view(MANIFEST) };
        },
        getSkillGraph(request) {
          asked.push(`graph ${request.packageDigest}`);
          return { skillGraph: view(GRAPH), skillTiers: { halves: 1 } };
        },
      });
    });
    const request = { profileId: "p1", moduleId: "example/fair-shares", action: Action.LEARNING };
    const map = await readModuleMap(api, views, request);
    expect(map.skillMap.skills[0]?.evidenceCount).toBe(2);
    expect(map.graph).toEqual({ view: GRAPH, skillTiers: { halves: 1 } });
    expect(map.manifest).toEqual(MANIFEST);
    // The views come from the cache the second time; the state is asked anew, by an adult too.
    await readModuleMap(api, views, { ...request, action: Action.ADULT });
    expect(asked.sort()).toEqual([
      `graph ${D1}`,
      `manifest ${D1}`,
      "map p1 example/fair-shares 1",
      "map p1 example/fair-shares 2",
    ]);
  });

  it("has no graph for a module with none, and passes a refusal on", async () => {
    let refuse = false;
    const { api, views } = await harness((router) => {
      router.service(ProgressService, {
        getSkillMap() {
          if (refuse) {
            throw new ConnectError("refused", Code.NotFound, undefined, [
              { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.NOT_FOUND }) },
            ]);
          }
          return { packageDigest: D1 };
        },
      });
      router.service(PackageService, {
        getManifest: () => ({ manifest: view(MANIFEST) }),
        getSkillGraph: () => ({}),
      });
    });
    const request = { profileId: "p1", moduleId: "m", action: Action.LEARNING };
    const map = await readModuleMap(api, views, request);
    expect(map).not.toHaveProperty("graph");
    expect(map.manifest?.title).toBe("Fair shares");
    refuse = true;
    const failed = await readModuleMap(api, views, request).catch((reason: unknown) => reason);
    expect(failed).toBeInstanceOf(ApiError);
    expect((failed as ApiError).failure).toMatchObject({ kind: "refused", cause: Cause.NOT_FOUND });
  });
});

describe("offeredModules", () => {
  it("offers the modules of each anchor skill whose holding is unknown, once each, in the answer's order", () => {
    const answer = create(GetSkillMapResponseSchema, {
      anchorSkills: [
        {
          anchorSkill: "core.multiplication-table",
          holding: AnchorSkillHolding.UNKNOWN,
          teachingModules: ["novatrail/tables", "novatrail/arithmetic"],
        },
        {
          anchorSkill: "core.fractions-of-a-whole",
          holding: AnchorSkillHolding.HELD,
          teachingModules: ["novatrail/fractions"],
        },
        {
          anchorSkill: "core.linear-equations",
          holding: AnchorSkillHolding.NOT_HELD,
          teachingModules: ["novatrail/algebra"],
        },
        // A holding this build does not know is unknown, as the contract says.
        {
          anchorSkill: "core.division-with-remainder",
          holding: 9 as AnchorSkillHolding,
          teachingModules: ["novatrail/arithmetic", "novatrail/division"],
        },
      ],
    });
    expect(offeredModules(answer)).toEqual([
      "novatrail/tables",
      "novatrail/arithmetic",
      "novatrail/division",
    ]);
    expect(offeredModules(create(GetSkillMapResponseSchema, {}))).toEqual([]);
  });
});
