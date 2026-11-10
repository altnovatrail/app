// The open views, the check of packages and the files of a device part, with no network: api is
// connect-es's router, and fetch the test's own (section 15 of the text of the contracts).
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  CheckPackagesResponseSchema,
  GetManifestResponseSchema,
  GetSkillGraphResponseSchema,
  GetSolvingStepsResponseSchema,
  GetTechniquesResponseSchema,
  type OpenViewSchema,
  PackageService,
  PackageStatus,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { PAUSES } from "../api/interceptors.ts";
import { openCache } from "../storage/cache.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { DAY, memoryDevice } from "../test/device.ts";
import { checkPackages, keptDigests, LATER_MS, PackageChecks, type Timer } from "./checks.ts";
import { DeviceFiles, FileError, fileUrl } from "./files.ts";
import { FORMATS, OpenViews } from "./views.ts";

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D3 = `sha256:${"3".repeat(64)}`;
const MANIFEST = { module_format_version: "0.4", id: "probe", version: "1.0.0" };
const TASK = {
  id: "probe",
  statement: [{ text: "Write the answer." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
} as const;

function view(json: unknown, version = "0.4"): MessageInitShape<typeof OpenViewSchema> {
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: version };
}

function refused(code: Code, cause: Cause): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

async function harness(routes: (router: ConnectRouter) => void) {
  const setup = memoryDevice();
  await setAccount(setup.device, "account-1");
  const sleeps: number[] = [];
  const on = {
    stale: vi.fn(),
    accountGone: async () => {},
    noAccess: async () => {},
    withdrawn: vi.fn(),
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const stale = vi.fn();
  const gone = new Set<string>();
  const views = new OpenViews({
    api,
    device: setup.device,
    stale,
    withdrawn: (digest) => gone.has(digest),
  });
  return { ...setup, api, views, withdrawn: on.withdrawn, stale, sleeps, gone };
}

describe("OpenViews", () => {
  it("takes a view from api once, reads it by the types of the format, and keeps it in the cache", async () => {
    let calls = 0;
    const { views } = await harness(({ service }) =>
      service(PackageService, {
        getManifest(request) {
          calls += 1;
          expect(request.packageDigest).toBe(D1);
          return create(GetManifestResponseSchema, { manifest: view(MANIFEST) });
        },
      }),
    );
    expect(await views.get(D1, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect(await views.get(D1, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect(calls).toBe(1);
    expect(FORMATS).toEqual(["0.4"]);
  });

  it("gives each kind with what comes beside it, and keeps a part the module has not", async () => {
    const calls: string[] = [];
    const { views } = await harness(({ service }) =>
      service(PackageService, {
        getSkillGraph() {
          calls.push("graph");
          return create(GetSkillGraphResponseSchema, {
            skillGraph: view({ skills: [] }),
            skillTiers: { "counting-gaps": 0 },
          });
        },
        getTechniques() {
          calls.push("techniques");
          return create(GetTechniquesResponseSchema, {});
        },
        getSolvingSteps() {
          calls.push("steps");
          return create(GetSolvingStepsResponseSchema, { solvingSteps: view({ steps: [] }) });
        },
      }),
    );
    expect(await views.get(D1, "skill-graph")).toEqual({
      view: { skills: [] },
      skillTiers: { "counting-gaps": 0 },
    });
    expect(await views.get(D1, "techniques")).toBeUndefined();
    expect(await views.get(D1, "techniques")).toBeUndefined();
    expect(await views.get(D1, "solving-steps")).toEqual({ view: { steps: [] }, skillTiers: {} });
    expect(await views.get(D1, "skill-graph")).toMatchObject({
      skillTiers: { "counting-gaps": 0 },
    });
    expect(calls).toEqual(["graph", "techniques", "steps"]);
  });

  it("offers a reload for a version of the format the build does not read, and keeps nothing of it", async () => {
    let calls = 0;
    const { views, stale } = await harness(({ service }) =>
      service(PackageService, {
        getManifest() {
          calls += 1;
          return create(GetManifestResponseSchema, { manifest: view(MANIFEST, "0.5") });
        },
      }),
    );
    for (let i = 0; i < 2; i++) {
      const error = await views.get(D1, "manifest").catch((reason: unknown) => reason);
      expect((error as ApiError).failure).toEqual({ kind: "stale" });
    }
    expect(stale).toHaveBeenCalledTimes(2);
    expect(calls).toBe(2);
  });

  it("asks CheckPackages when api no longer gives the version, and repeats a digest not known yet", async () => {
    let calls = 0;
    const { views, withdrawn, sleeps } = await harness(({ service }) =>
      service(PackageService, {
        getManifest(request) {
          if (request.packageDigest === D1) {
            throw refused(Code.FailedPrecondition, Cause.VERSION_NOT_GIVEN);
          }
          calls += 1;
          if (calls < 3) throw refused(Code.Unavailable, Cause.PACKAGE_UNKNOWN);
          return create(GetManifestResponseSchema, { manifest: view(MANIFEST) });
        },
      }),
    );
    const error = await views.get(D1, "manifest").catch((reason: unknown) => reason);
    expect((error as ApiError).failure).toMatchObject({
      kind: "refused",
      cause: Cause.VERSION_NOT_GIVEN,
    });
    expect(withdrawn).toHaveBeenCalledOnce();
    expect(await views.get(D2, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect(sleeps).toEqual([500, 1000]);
  });

  it("refuses bytes that are no JSON and keeps none of them, and goes on without a cache before sign-in", async () => {
    let calls = 0;
    const { views } = await harness(({ service }) =>
      service(PackageService, {
        getManifest() {
          calls += 1;
          return create(GetManifestResponseSchema, {
            manifest: { json: new Uint8Array([0x7b]), moduleFormatVersion: "0.4" },
          });
        },
      }),
    );
    const error = await views.get(D1, "manifest").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure).toEqual({ kind: "invalid" });
    await views.get(D1, "manifest").catch(() => {});
    expect(calls).toBe(2);

    const bare = memoryDevice();
    const { api } = await harness(({ service }) =>
      service(PackageService, {
        getManifest: () => create(GetManifestResponseSchema, { manifest: view(MANIFEST) }),
      }),
    );
    const signedOut = new OpenViews({ api, device: bare.device, stale: () => {} });
    expect(await signedOut.get(D1, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect(bare.backend.databases.size).toBe(0);
  });
});

describe("OpenViews.keptManifests", () => {
  it("finds the latest manifest the cache keeps of each module, with no request, in a version the build reads", async () => {
    const { views, device } = await harness(() => {});
    const cache = await openCache(device);
    const keep = (digest: string, json: unknown, version = "0.4") =>
      cache?.put(digest, "manifest", {
        json: new TextEncoder().encode(JSON.stringify(json)),
        version,
      });
    await keep(D1, { ...MANIFEST, version: "1.2.0", title: "Older" });
    await keep(D2, { ...MANIFEST, version: "1.10.0", title: "Newer" });
    await keep(D3, { ...MANIFEST, version: "9.0.0", title: "Unread" }, "0.5");
    await keep(`sha256:${"4".repeat(64)}`, { ...MANIFEST, id: "other", version: "9.0.0" });
    await cache?.put(`sha256:${"5".repeat(64)}`, "manifest", {});
    await keep(`sha256:${"6".repeat(64)}`, { id: "probe", title: "No version" });
    // The same version again, and a shorter one of the same numbers: neither is later.
    await keep(`sha256:${"8".repeat(64)}`, { ...MANIFEST, version: "1.10.0", title: "Same" });
    await keep(`sha256:${"a".repeat(64)}`, { ...MANIFEST, version: "1.10", title: "Short" });
    await cache?.put(`sha256:${"b".repeat(64)}`, "manifest", {
      json: new TextEncoder().encode(JSON.stringify({ ...MANIFEST, version: "99.0.0" })),
    });
    await cache?.put(`sha256:${"7".repeat(64)}`, "manifest", {
      json: new TextEncoder().encode("null"),
      version: "0.4",
    });
    const kept = await views.keptManifests();
    expect(kept.get("probe")?.title).toBe("Newer");
    expect(kept.get("other")?.version).toBe("9.0.0");
    expect(kept.has("absent")).toBe(false);
  });

  it("finds none before sign-in, with no cache", async () => {
    const setup = memoryDevice();
    const { views } = await harness(() => {});
    const bare = new OpenViews({
      api: views["options"].api,
      device: setup.device,
      stale: () => {},
    });
    expect((await bare.keptManifests()).size).toBe(0);
  });
});

describe("OpenViews and what the cache keeps", () => {
  it("asks api anew for a view kept in a version the build no longer reads", async () => {
    const { views, device } = await harness(({ service }) =>
      service(PackageService, {
        getManifest: () => create(GetManifestResponseSchema, { manifest: view(MANIFEST) }),
      }),
    );
    const cache = await openCache(device);
    await cache?.put(D1, "manifest", { json: new Uint8Array([1]), version: "0.3" });
    expect(await views.get(D1, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect((await cache?.get(D1, "manifest"))?.version).toBe("0.4");
  });

  it("keeps no view of a package this tab has learnt is withdrawn", async () => {
    const { views, device, gone } = await harness(({ service }) =>
      service(PackageService, {
        getManifest: () => create(GetManifestResponseSchema, { manifest: view(MANIFEST) }),
        getTechniques: () => create(GetTechniquesResponseSchema, {}),
      }),
    );
    gone.add(D1);
    expect(await views.get(D1, "manifest")).toEqual({ view: MANIFEST, skillTiers: {} });
    expect(await views.get(D1, "techniques")).toBeUndefined();
    expect(await (await openCache(device))?.digests()).toEqual([]);
  });

  it("gives no connection once its own deadline is over, with no header for it", async () => {
    const { views } = await harness(({ service }) =>
      service(PackageService, {
        getManifest: (_, context) =>
          new Promise((_resolve, reject) =>
            context.signal.addEventListener("abort", () => reject(context.signal.reason)),
          ),
      }),
    );
    views.timeoutMs = 20;
    const error = await views.get(D2, "manifest").catch((reason: unknown) => reason);
    expect((error as ApiError).failure).toEqual({ kind: "offline" });
  });
});

describe("CheckPackages", () => {
  async function kept() {
    let asked: string[] = [];
    let statuses: Record<string, PackageStatus> = {};
    const setup = await harness(({ service }) =>
      service(PackageService, {
        checkPackages(request) {
          asked = request.packageDigests;
          return create(CheckPackagesResponseSchema, {
            packages: request.packageDigests.map((packageDigest) => ({
              packageDigest,
              status: statuses[packageDigest] ?? PackageStatus.GIVEN,
            })),
          });
        },
      }),
    );
    const cache = await openCache(setup.device);
    await cache?.put(D1, "manifest", { json: new Uint8Array([1]), version: "0.4" });
    const profile = await addProfile(setup.device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: D2, task: TASK });
    await profile?.beginAttempt({ attemptId: "gone", digest: D3 });
    return {
      ...setup,
      cache,
      profile,
      asked: () => asked,
      answer: (given: Record<string, PackageStatus>) => {
        statuses = given;
      },
    };
  }

  it("names every digest whose open views the device keeps, in the cache and in the profiles", async () => {
    const { device } = await kept();
    expect(await keptDigests(device)).toEqual([D1, D2]);
    expect(await keptDigests(memoryDevice().device)).toEqual([]);
  });

  it("erases the views of a digest no longer given, and names the ones not known yet", async () => {
    const setup = await kept();
    setup.answer({ [D1]: PackageStatus.NOT_GIVEN, [D2]: PackageStatus.UNKNOWN });
    expect(await checkPackages(setup.api, setup.device)).toEqual({
      withdrawn: [D1],
      unknown: [D2],
    });
    expect(setup.asked()).toEqual([D1, D2]);
    expect(await setup.cache?.get(D1, "manifest")).toBeUndefined();
    expect((await setup.profile?.readAttempt("a1"))?.attempt.digest).toBe(D2);
  });

  it("asks nothing with nothing kept", async () => {
    const { api } = await harness(() => {});
    expect(await checkPackages(api, memoryDevice().device)).toEqual({ withdrawn: [], unknown: [] });
  });

  it("checks one at a time, once more after one under way, and later while api knows a digest not", async () => {
    const setup = await kept();
    const timers: [() => void, number][] = [];
    const timer: Timer = {
      set: (run, ms) => timers.push([run, ms]),
      clear: vi.fn(),
    };
    const spy = vi.spyOn(setup.api.package, "checkPackages");
    const checks = new PackageChecks(setup.api, setup.device, timer);
    setup.answer({ [D2]: PackageStatus.UNKNOWN });
    const first = checks.check();
    const second = checks.check();
    expect(second).toBe(first);
    await first;
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(timers.length).toBeGreaterThan(0));
    expect(timers[0]?.[1]).toBe(LATER_MS);
    expect(checks.withdrawn.size).toBe(0);
    setup.answer({});
    timers[0]?.[0]();
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
    checks.stop();
    expect(timer.clear).toHaveBeenCalled();
    checks.start();
    expect(DAY).toBeGreaterThan(LATER_MS);
  });

  it("asks nothing later when the check failed", async () => {
    const { api, device } = await harness(({ service }) =>
      service(PackageService, {
        checkPackages() {
          throw new ConnectError("no", Code.PermissionDenied);
        },
      }),
    );
    await (await openCache(device))?.put(D1, "manifest", {
      json: new Uint8Array([1]),
      version: "0.4",
    });
    const set = vi.fn();
    const checks = new PackageChecks(api, device, { set, clear: () => {} });
    await checks.check();
    expect(set).not.toHaveBeenCalled();
  });
});

describe("the files of a device part", () => {
  const API = "https://api.example.org";

  it("are at api's address by the digest and the path, each segment percent-encoded", () => {
    expect(fileUrl(`${API}/`, D1, "media/fence posts/№1.png")).toBe(
      `${API}/packages/sha256-${"1".repeat(64)}/device/media/fence%20posts/%E2%84%961.png`,
    );
    expect(() => fileUrl(API, "sha1:ab", "LICENSE")).toThrow(FileError);
    for (const path of ["media/../../x", "media/./x", "media//x", "/LICENSE"]) {
      expect(() => fileUrl(API, D1, path)).toThrow("not a path of the device part");
    }
  });

  function files(answers: (Response | Error)[]) {
    const fetcher = vi.fn<typeof fetch>(async () => {
      const next = answers.shift();
      if (next instanceof Error) throw next;
      return next ?? new Response(null, { status: 500 });
    });
    const sleeps: number[] = [];
    const withdrawn = vi.fn();
    const device = new DeviceFiles({
      api: API,
      withdrawn,
      fetch: fetcher,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    return { device, fetcher, sleeps, withdrawn };
  }

  const failureOf = (call: Promise<unknown>) =>
    call.then(
      () => undefined,
      (reason: unknown) => (reason as FileError).failure,
    );

  it("gives a file as a Blob, with no header of app's, and media by their path from media/", async () => {
    const { device, fetcher } = files([new Response("png"), new Response("pic")]);
    expect(await (await device.file(D1, "LICENSE")).text()).toBe("png");
    expect(fetcher.mock.calls[0]).toEqual([
      `${API}/packages/sha256-${"1".repeat(64)}/device/LICENSE`,
    ]);
    expect(await (await device.media(D1)("fence.png")).text()).toBe("pic");
    expect(String(fetcher.mock.calls[1]?.[0])).toMatch(/\/device\/media\/fence\.png$/);
  });

  it("tells a path the part has not, and a version api no longer gives, which asks CheckPackages", async () => {
    const missing = files([new Response(null, { status: 404 })]);
    expect(await failureOf(missing.device.file(D1, "media/x.png"))).toBe("missing");
    const gone = files([new Response(null, { status: 410 })]);
    expect(await failureOf(gone.device.file(D1, "media/x.png"))).toBe("withdrawn");
    expect(gone.withdrawn).toHaveBeenCalledOnce();
    expect(missing.withdrawn).not.toHaveBeenCalled();
  });

  it("repeats a 503 after the time Retry-After names, and gives up past api's limit or without it", async () => {
    const busy = () => new Response(null, { status: 503, headers: { "Retry-After": "2" } });
    const going = files([busy(), busy(), new Response("ok")]);
    expect(await (await going.device.file(D1, "NOTICE")).text()).toBe("ok");
    expect(going.sleeps).toEqual([2000, 2000]);
    const long = files(Array.from({ length: 20 }, busy));
    expect(await failureOf(long.device.file(D1, "NOTICE"))).toBe("offline");
    expect(long.sleeps.reduce((a, b) => a + b, 0)).toBe(30_000);
    const bare = files(Array.from({ length: 10 }, () => new Response(null, { status: 503 })));
    expect(await failureOf(bare.device.file(D1, "NOTICE"))).toBe("offline");
    expect(bare.sleeps).toEqual([...PAUSES]);
    const mixed = files([busy(), new TypeError("Failed to fetch"), new Response("ok")]);
    expect(await (await mixed.device.file(D1, "NOTICE")).text()).toBe("ok");
    expect(mixed.sleeps).toEqual([2000, 500]);
    const odd = files([new Response(null, { status: 500 })]);
    expect(await failureOf(odd.device.file(D1, "NOTICE"))).toBe("unknown");
  });

  it("repeats a network that fails after a growing pause, then gives no connection", async () => {
    const down = files(Array.from({ length: 10 }, () => new TypeError("Failed to fetch")));
    expect(await failureOf(down.device.file(D1, "NOTICE"))).toBe("offline");
    expect(down.sleeps).toEqual([...PAUSES]);
    const back = files([new TypeError("Failed to fetch"), new Response("ok")]);
    expect(await (await back.device.file(D1, "NOTICE")).text()).toBe("ok");
  });
});
