// "My subjects" in Chromium (section 3.10 of docs/architecture.md; R99 in spec): the cards by role
// and name, connecting and disconnecting, a module with no current version, an empty catalog and
// the refusals, with api on connect-es's router and the open views on the device's memory.
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Cause,
  ChoiceKind,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { LearningService } from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import {
  type ConnectedModuleSchema,
  ModuleService,
} from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import {
  GetManifestResponseSchema,
  PackageService,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { LessonProvider } from "../lesson/LessonContext.tsx";
import { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { openCache } from "../storage/cache.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { MySubjects } from "./MySubjects.tsx";

const MATH = "novatrail/olympiad-math";
const PHYSICS = "novatrail/physics";
const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D0 = `sha256:${"0".repeat(64)}`;

const LEARNER = create(ProfileSchema, { profileId: "p1", owner: true, pseudonym: "Ёжик" });

function manifest(id: string, title: string, explanation: string) {
  const json = {
    module_format_version: "0.4",
    id,
    version: "1.0.0",
    title,
    languages: { explanation },
  };
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: "0.4" };
}

const MANIFESTS: Readonly<Record<string, ReturnType<typeof manifest>>> = {
  [D1]: manifest(MATH, "Olympiad maths", "en"),
  [D2]: manifest(PHYSICS, "Физика", "ru"),
};

function refused(code: Code, cause: Cause): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

type Connected = MessageInitShape<typeof ConnectedModuleSchema>;

interface Setup {
  connected?: Connected[];
  catalog?: { moduleId: string; packageDigest: string }[];
  list?: () => void;
  connect?: (moduleId: string) => void | Promise<void>;
  /** Called on each manifest asked for; throwing makes it fail. */
  manifest?: (digest: string) => void;
  /** The attempt the learner has open. */
  attempt?: string;
  /** What the cache keeps before the screen opens. */
  seed?: (device: ReturnType<typeof memoryDevice>["device"]) => Promise<void>;
  /** The lesson runs the learner has open. */
  runs?: { lessonRunId: string; lesson: string; packageDigest: string }[];
}

async function renderSubjects(setup: Setup, language: "en" | "ru" = "en") {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  await setup.seed?.(device);
  let connected = setup.connected ?? [];
  const asked: string[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(ModuleService, {
      listConnectedModules(request) {
        asked.push(`list ${request.profileId}`);
        setup.list?.();
        return { modules: connected };
      },
      listCatalog(request) {
        asked.push(`catalog ${request.profileId}`);
        return { modules: setup.catalog ?? [] };
      },
      async connectModule(request) {
        asked.push(`connect ${request.moduleId}`);
        await setup.connect?.(request.moduleId);
        const digest = setup.catalog?.find((m) => m.moduleId === request.moduleId)?.packageDigest;
        connected = [...connected, { moduleId: request.moduleId, packageDigest: digest ?? "" }];
        return { modules: connected };
      },
      disconnectModule(request) {
        asked.push(`disconnect ${request.moduleId}`);
        connected = connected.filter((m) => m.moduleId !== request.moduleId);
        return { modules: connected };
      },
    });
    router.service(LearningService, {
      chooseNext() {
        asked.push("choose");
        return { choice: { kind: ChoiceKind.NOTHING } };
      },
    });
    router.service(PackageService, {
      getManifest(request) {
        setup.manifest?.(request.packageDigest);
        return create(GetManifestResponseSchema, {
          ...(MANIFESTS[request.packageDigest]
            ? { manifest: MANIFESTS[request.packageDigest] }
            : {}),
        });
      },
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const views = new OpenViews({ api, device, stale: () => {} });
  const packages = {
    views,
    checks: new PackageChecks(api, device),
    files: new DeviceFiles({ api: "https://api.example.org", withdrawn: () => {} }),
  };
  const rendered = render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <AttemptProvider
            learner={
              setup.attempt === undefined
                ? LEARNER
                : create(ProfileSchema, {
                    profileId: LEARNER.profileId,
                    pseudonym: LEARNER.pseudonym,
                    openAttempt: { attemptId: setup.attempt },
                  })
            }
          >
            {setup.runs === undefined ? (
              <MySubjects profileId={LEARNER.profileId} />
            ) : (
              <LessonProvider
                learner={create(ProfileSchema, {
                  profileId: LEARNER.profileId,
                  pseudonym: LEARNER.pseudonym,
                  openLessonRuns: setup.runs,
                })}
              >
                <MySubjects profileId={LEARNER.profileId} device={device} />
              </LessonProvider>
            )}
          </AttemptProvider>
        </PackagesProvider>
      </ApiProvider>,
      language,
    ),
  );
  return { asked, device, unmount: rendered.unmount };
}

/** The card of a module, by the title it is labelled by. */
async function card(title: string) {
  return within(await screen.findByRole("article", { name: title }));
}

describe("My subjects", () => {
  it("goes on with the task in progress, and offers none when there is none", async () => {
    const { unmount } = await renderSubjects({});
    await screen.findByRole("heading", { name: "Connected" });
    expect(screen.queryByRole("button", { name: "Continue the task" })).toBeNull();
    unmount();
    await renderSubjects({ attempt: "a1" });
    expect(
      await screen.findByRole("heading", { name: "There is a task in progress" }),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Continue the task" }));
    expect(window.location.hash).toBe("#/task");
    window.location.hash = "";
  });

  it("takes no second press while a connection is under way, and keeps the focus where it was", async () => {
    let answer: () => void = () => {};
    const { asked } = await renderSubjects({
      catalog: [
        { moduleId: MATH, packageDigest: D1 },
        { moduleId: PHYSICS, packageDigest: D2 },
      ],
      connect: () => new Promise<void>((resolve) => (answer = resolve)),
    });
    const maths = (await card("Olympiad maths")).getByRole("button", { name: "Connect" });
    await userEvent.click(maths);
    expect(maths).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(maths);
    // A press the browser lets through, as a screen reader's would: aria-disabled does not stop it.
    (await card("Физика")).getByRole("button", { name: "Connect" }).click();
    answer();
    await vi.waitFor(() => expect(asked).toEqual(["list p1", "catalog p1", `connect ${MATH}`]));
  });

  it("drops the lists of a screen gone before they came", async () => {
    const { unmount, asked } = await renderSubjects({});
    unmount();
    await vi.waitFor(() => expect(asked).toEqual(["list p1", "catalog p1"]));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("names a module by its ID when its manifest did not come, and asks again on a retry", async () => {
    let fail = true;
    let asked = 0;
    await renderSubjects({
      catalog: [{ moduleId: MATH, packageDigest: D1 }],
      manifest: () => {
        asked += 1;
        if (fail) throw new ConnectError("down", Code.Unavailable);
      },
    });
    expect(await screen.findByRole("article", { name: MATH })).toBeTruthy();
    expect(
      screen.getByText("The names of some modules didn't come").closest("[role=status]"),
    ).not.toBeNull();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("article", { name: "Olympiad maths" })).toBeTruthy();
    expect(screen.queryByText("The names of some modules didn't come")).toBeNull();
    expect(asked).toBeGreaterThan(1);
  });

  it("shows a language tag Intl cannot read as it is, rather than falling over", async () => {
    const bad = `sha256:${"9".repeat(64)}`;
    await renderSubjects({
      catalog: [{ moduleId: "novatrail/odd", packageDigest: bad }],
      seed: async (device) => {
        const cache = await openCache(device);
        await cache?.put(bad, "manifest", {
          json: manifest("novatrail/odd", "Odd", "en_US").json,
          version: "0.4",
        });
      },
    });
    expect((await card("Odd")).getByText("Explanation language: en_US")).toBeTruthy();
  });

  it("connects a module from the catalog, and disconnects it", async () => {
    const { asked } = await renderSubjects({
      catalog: [
        { moduleId: MATH, packageDigest: D1 },
        { moduleId: PHYSICS, packageDigest: D2 },
      ],
    });
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(await screen.findByText("No subjects are connected yet")).toBeTruthy();
    const catalog = within(screen.getByRole("region", { name: "Catalog" }));
    // The card in Russian says so to an English screen; the English one does not.
    const physics = await card("Физика");
    expect(physics.getByRole("heading", { level: 3 })).toHaveAttribute("lang", "ru");
    expect(physics.getByText("Explanation language: Russian")).toBeTruthy();
    const maths = await card("Olympiad maths");
    expect(maths.queryByText(/Explanation language/)).toBeNull();
    const connect = maths.getByRole("button", { name: "Connect" });
    expect(connect).toHaveAccessibleDescription("Olympiad maths");
    // Titles in the order of the language: Latin before Cyrillic in English.
    expect(catalog.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Olympiad maths",
      "Физика",
    ]);

    await userEvent.click(connect);
    const connected = await card("Olympiad maths");
    const disconnect = connected.getByRole("button", { name: "Disconnect" });
    // The focus went with the card to its new place.
    await vi.waitFor(() => expect(document.activeElement).toBe(disconnect));
    expect(screen.queryByText("No subjects are connected yet")).toBeNull();
    expect(catalog.queryByRole("article", { name: "Olympiad maths" })).toBeNull();

    await userEvent.click(disconnect);
    expect(await screen.findByText("No subjects are connected yet")).toBeTruthy();
    const back = (await card("Olympiad maths")).getByRole("button", { name: "Connect" });
    await vi.waitFor(() => expect(document.activeElement).toBe(back));
    expect(asked).toEqual(["list p1", "catalog p1", `connect ${MATH}`, `disconnect ${MATH}`]);
  });

  it("names a module with no current version by the manifest kept of an earlier one, or by its ID", async () => {
    await renderSubjects(
      {
        connected: [
          { moduleId: MATH, packageDigest: "" },
          { moduleId: "novatrail/gone", packageDigest: "" },
        ],
        seed: async (device) => {
          const cache = await openCache(device);
          await cache?.put(D0, "manifest", { json: MANIFESTS[D1]?.json, version: "0.4" });
        },
      },
      "ru",
    );
    const maths = await card("Olympiad maths");
    expect(maths.getByText("Язык объяснений: английский")).toBeTruthy();
    expect(maths.getByText("Сейчас недоступен")).toBeTruthy();
    expect((await card("novatrail/gone")).getByText("Сейчас недоступен")).toBeTruthy();
    expect(await screen.findByText("В каталоге пока нет модулей для этого профиля")).toBeTruthy();
    expect((await card("novatrail/gone")).getByRole("button", { name: "Отключить" })).toBeTruthy();
  });

  it("opens the license of a version from its card, connected or not, and has none without one", async () => {
    await renderSubjects(
      {
        connected: [
          { moduleId: MATH, packageDigest: D1 },
          { moduleId: "novatrail/gone", packageDigest: "" },
        ],
        catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
      },
      "ru",
    );
    const physics = (await card("Физика")).getByRole("button", { name: "Лицензия" });
    expect(physics).toHaveAccessibleDescription("Физика");
    expect((await card("novatrail/gone")).queryByRole("button", { name: "Лицензия" })).toBeNull();
    await userEvent.click((await card("Olympiad maths")).getByRole("button", { name: "Лицензия" }));
    expect(window.location.hash).toBe(`#/license/sha256%3A${"1".repeat(64)}`);
    window.location.hash = "";
  });

  it("tells a connection api refused, and offers to try again when it does not answer", async () => {
    let down = true;
    await renderSubjects({
      catalog: [{ moduleId: MATH, packageDigest: D1 }],
      list: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
      },
      connect: () => {
        throw refused(Code.FailedPrecondition, Cause.NO_CURRENT_VERSION);
      },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "No connection" }, { timeout: 15_000 }),
    ).toBeTruthy();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await userEvent.click((await card("Olympiad maths")).getByRole("button", { name: "Connect" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "This version of the module is no longer given",
    );
  }, 30_000);

  it("shows a failure no screen words otherwise, with a retry", async () => {
    await renderSubjects({
      list: () => {
        throw new ConnectError("gone", Code.Unimplemented);
      },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "There is a new version of the app" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("the lessons open", () => {
  it("names each by its title on this device, or by its module, and goes on with it", async () => {
    const kept = { lessonRunId: "r1", lesson: `${MATH}/lesson/gaps-and-posts`, packageDigest: D1 };
    const bare = { lessonRunId: "r2", lesson: `${PHYSICS}/lesson/levers`, packageDigest: D2 };
    await renderSubjects({
      runs: [kept, bare],
      seed: async (device) => {
        const profile = await addProfile(device, "p1");
        await profile?.saveLesson({
          lessonId: kept.lesson,
          digest: D1,
          passageId: "r1",
          view: { id: "gaps-and-posts", title: "Gaps and posts", segments: [{ task: "t" }] },
          place: 1,
          demo: {},
        });
      },
    });
    const section = within(await screen.findByRole("region", { name: "A lesson in progress" }));
    const title = await section.findByRole("heading", { level: 3, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toHaveAttribute("lang", "en");
    const other = await section.findByRole("heading", { level: 3, name: "A lesson: Физика" });
    expect(other.querySelector("[lang]")).toHaveAttribute("lang", "ru");
    const buttons = section.getAllByRole("button", { name: "Continue the lesson" });
    expect(buttons[1]).toHaveAccessibleDescription("A lesson: Физика");
    await userEvent.click(buttons[0] as HTMLButtonElement);
    expect(window.location.hash).toBe("#/lesson");
    window.location.hash = "";
  });

  it("shows no lesson when the learner has none open", async () => {
    await renderSubjects({ runs: [] });
    await screen.findByRole("heading", { level: 1, name: "My subjects" });
    expect(screen.queryByRole("region", { name: "A lesson in progress" })).toBeNull();
  });
});

describe("the way to what the engine chose", () => {
  it("keeps what Something else came to, once the attempt it closed is gone", async () => {
    const { asked } = await renderSubjects({ attempt: "a1" });
    await userEvent.click(await screen.findByRole("button", { name: "Something else" }));
    await userEvent.click(screen.getByRole("button", { name: "Go on" }));
    expect(await screen.findByText("There is nothing more to offer for now")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Continue the task" })).toBeNull();
    expect(screen.getByRole("button", { name: "What's next" })).toBeVisible();
    expect(asked).toContain("choose");
  });
});
