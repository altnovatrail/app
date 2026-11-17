// "My subjects" in the browser (section 3.10 of docs/architecture.md; R99 in spec): the cards by role
// and name, connecting and disconnecting, a module with no current version, an empty catalog and
// the refusals, and the line of the tutor time — the profile's share, the cap reached, and none
// with no share or no GetQuota or a share that did not come —, with api on connect-es's router
// and the open views on the device's memory.
import {
  AccountService,
  ProfileSchema,
  type QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
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
  GetSkillGraphResponseSchema,
  PackageService,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  GetSkillMapResponseSchema,
  ProgressService,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
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
  /** The tiers of the skill graph of each version that has one. */
  tiers?: Record<string, Record<string, number>>;
  /** The skills of the skill graph of a version, by its digest: none but the tiers' without it. */
  graphs?: Record<string, unknown>;
  /** What GetSkillMap gives for a module, by its ID; without it, a module has no map. */
  maps?: Record<string, MessageInitShape<typeof GetSkillMapResponseSchema>>;
  /** The share GetQuota gives; throwing makes it fail. Without it, api has no GetQuota. */
  quota?: () => MessageInitShape<typeof QuotaShareSchema>;
}

async function renderSubjects(setup: Setup, language: "en" | "ru" = "en") {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  await setup.seed?.(device);
  let connected = setup.connected ?? [];
  const asked: string[] = [];
  const stale = vi.fn();
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
    const quota = setup.quota;
    if (quota !== undefined) {
      router.service(AccountService, {
        getQuota(request) {
          asked.push(`quota ${request.profileId} ${request.action}`);
          return { share: quota() };
        },
      });
    }
    router.service(LearningService, {
      chooseNext() {
        asked.push("choose");
        return { choice: { kind: ChoiceKind.NOTHING } };
      },
    });
    router.service(ProgressService, {
      getSkillMap(request) {
        asked.push(`map ${request.moduleId} ${request.action}`);
        const map = setup.maps?.[request.moduleId];
        if (map === undefined) throw new ConnectError("no map", Code.NotFound);
        return map;
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
      getSkillGraph(request) {
        const tiers = setup.tiers?.[request.packageDigest];
        return create(GetSkillGraphResponseSchema, {
          ...(tiers === undefined
            ? {}
            : {
                skillGraph: {
                  json: new TextEncoder().encode(
                    JSON.stringify(setup.graphs?.[request.packageDigest] ?? { skills: {} }),
                  ),
                  moduleFormatVersion: "0.4",
                },
                skillTiers: tiers,
              }),
        });
      },
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, accountGone: async () => {}, noAccess: async () => {} },
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
  return { asked, device, stale, unmount: rendered.unmount };
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
    // The map of the module connected is read for its card; the lists are not read again.
    expect(asked.filter((call) => !call.startsWith("map "))).toEqual([
      "list p1",
      "catalog p1",
      `connect ${MATH}`,
      `disconnect ${MATH}`,
    ]);
    expect(asked).toContain(`map ${MATH} 1`);
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

  it("marks a module whose skill graph is a chain, connected or not, and no other", async () => {
    await renderSubjects(
      {
        connected: [{ moduleId: MATH, packageDigest: D1 }],
        catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
        tiers: { [D1]: { "counting-gaps": 1, "time-calendar": 2 }, [D2]: { a: 1, b: 1 } },
      },
      "ru",
    );
    // The mark comes once the graph has, after the card.
    expect(await (await card("Olympiad maths")).findByText("По порядку")).toBeVisible();
    expect((await card("Физика")).queryByText("По порядку")).toBeNull();
  });

  it("leads to the skill map and the essays beside the engine's way", async () => {
    await renderSubjects({ connected: [], catalog: [] });
    await screen.findByRole("heading", { name: "Connected" });
    await userEvent.click(screen.getByRole("button", { name: "Skill map" }));
    expect(window.location.hash).toBe("#/skill-map");
    // Beside it, the essays this device keeps (R53).
    await userEvent.click(screen.getByRole("button", { name: "My essays" }));
    expect(window.location.hash).toBe("#/essays");
    window.location.hash = "";
  });

  it("says below the lists that the tutor is an AI, and leads to the page on using it safely", async () => {
    await renderSubjects({ connected: [], catalog: [] }, "ru");
    const section = within(await screen.findByRole("region", { name: "Наставник — это ИИ" }));
    expect(section.getByText(/компьютерная программа, а не человек/)).toBeVisible();
    await userEvent.click(
      section.getByRole("button", { name: "Как безопасно пользоваться наставником" }),
    );
    expect(window.location.hash).toBe("#/tutor");
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

describe("the tutor time", () => {
  /** The line of the tutor time, if the screen shows one. */
  const line = () => screen.queryByText(/^(Tutor time today|Today's tutor time|Время наставника)/);

  it("says, at the foot of the card of what comes next, how much of today's the profile has used, and never the account's", async () => {
    const { asked } = await renderSubjects({
      quota: () => ({ profilePercent: 40, accountPercent: 90 }),
    });
    const card = within(await screen.findByRole("region", { name: "Next up" }));
    const said = await card.findByText("Tutor time today: 40% used");
    const next = card.getByRole("button", { name: "What's next" });
    expect(said.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    // Its bar beside the words, as long as the share, which the words alone name.
    const bar = said.querySelector<HTMLElement>(".nt-quota-bar");
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect((bar?.firstElementChild as HTMLElement | null)?.style.inlineSize).toBe("40%");
    expect(screen.queryByText(/90/)).toBeNull();
    // By the learner's action, ACTION_LEARNING.
    expect(asked).toContain("quota p1 1");
  });

  it("says, once a cap is reached, that the tutor's time is over and when it comes back", async () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    await renderSubjects(
      {
        quota: () => ({
          profilePercent: 100,
          capReached: true,
          nextFamilyDay: timestampFromDate(midnight),
        }),
      },
      "ru",
    );
    const time = dateTimeFormat("ru", { timeStyle: "short" }).format(midnight);
    expect(
      await screen.findByText(
        `Время наставника на сегодня кончилось. Оно вернётся завтра в ${time}`,
      ),
    ).toBeVisible();
    // The bar beside it full, whatever share the profile's own was.
    const fill = document.querySelector<HTMLElement>(".nt-quota-bar > span");
    expect(fill?.style.inlineSize).toBe("100%");
  });

  it("fills the bar once the account's cap is reached, with the profile's own share below it", async () => {
    await renderSubjects({ quota: () => ({ profilePercent: 20, capReached: true }) });
    const card = within(await screen.findByRole("region", { name: "Next up" }));
    await waitFor(() =>
      expect(
        card
          .getByRole("button", { name: "What's next" })
          .closest("section")
          ?.querySelector(".nt-quota"),
      ).toBeTruthy(),
    );
    expect(screen.queryByText("Tutor time today: 20% used")).toBeNull();
    expect(document.querySelector<HTMLElement>(".nt-quota-bar > span")?.style.inlineSize).toBe(
      "100%",
    );
  });

  it("is no line while platform AI is closed to the account, nor from an api with no GetQuota", async () => {
    const { asked, unmount } = await renderSubjects({ quota: () => ({}) });
    await screen.findByRole("heading", { name: "Connected" });
    await vi.waitFor(() => expect(asked).toContain("quota p1 1"));
    expect(line()).toBeNull();
    unmount();
    // No GetQuota at all: no line, and no offer to reload.
    const { stale } = await renderSubjects({ catalog: [{ moduleId: MATH, packageDigest: D1 }] });
    expect(await screen.findByRole("article", { name: "Olympiad maths" })).toBeTruthy();
    expect(line()).toBeNull();
    expect(stale).not.toHaveBeenCalled();
  });

  it("holds nothing back when the share did not come: the lists stand, with no line and no alert", async () => {
    const { asked } = await renderSubjects({
      catalog: [{ moduleId: MATH, packageDigest: D1 }],
      quota: () => {
        throw new ConnectError("down", Code.Unavailable);
      },
    });
    expect(await screen.findByRole("article", { name: "Olympiad maths" })).toBeTruthy();
    // The client's own repeats asked again, and then gave up.
    await vi.waitFor(() =>
      expect(asked.filter((each) => each.startsWith("quota"))).toHaveLength(5),
    );
    expect(line()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "My subjects" })).toBeVisible();
  });

  it("is asked again with the lists, when a retry brings them after both failed", async () => {
    let down = true;
    await renderSubjects({
      catalog: [{ moduleId: MATH, packageDigest: D1 }],
      list: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
      },
      quota: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
        return { profilePercent: 40 };
      },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "No connection" }, { timeout: 15_000 }),
    ).toBeTruthy();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Tutor time today: 40% used")).toBeTruthy();
  }, 30_000);
});

/** Six skills of one graph, one in each state and one with a rubric. */
const SKILLS = {
  skills: {
    counting: { title: "Counting", assessability: "verdict" },
    halves: { title: "Halves", assessability: "verdict" },
    patterns: { title: "Patterns", assessability: "verdict", prerequisites: ["counting"] },
    rows: { title: "Sums of rows", assessability: "verdict", prerequisites: ["patterns"] },
    cycles: { title: "Days and cycles", assessability: "verdict" },
    words: { title: "Wording", assessability: "rubric" },
  },
};
const SKILL_TIERS = { counting: 1, halves: 1, patterns: 2, rows: 3, cycles: 1, words: 1 };
/** Counting mastered, Halves due for review, Patterns practised, the rest not begun. */
const STATED: MessageInitShape<typeof GetSkillMapResponseSchema> = {
  packageDigest: D1,
  skills: [
    { skill: "counting", evidenceCount: 4, masteryBand: "b1" },
    { skill: "halves", evidenceCount: 3, masteryBand: "b1", reviewDue: true },
    { skill: "patterns", evidenceCount: 2 },
    { skill: "rows" },
    { skill: "cycles" },
  ],
};
const ALL_STATES =
  "All the skills: Mastered: 1, Time to review: 1, In progress: 1, Ready to start: 1, Locked: 1, Feedback by criteria: 1";

describe("the states of the skills", () => {
  it("are on a card connected as its map has them, by the learner's action, and none in the catalog", async () => {
    const { asked } = await renderSubjects({
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
      tiers: { [D1]: SKILL_TIERS },
      graphs: { [D1]: SKILLS },
      maps: { [MATH]: STATED },
    });
    const math = await card("Olympiad maths");
    const bar = await math.findByRole("img", { name: ALL_STATES });
    // Each segment in the colour of its state, as long as its share of the five with a verdict.
    const segments = [...bar.children] as HTMLElement[];
    expect(segments.map((segment) => segment.dataset.state)).toEqual([
      "mastered",
      "time-to-review",
      "in-progress",
      "ready-to-start",
      "locked",
    ]);
    expect(segments.map((segment) => segment.style.inlineSize)).toEqual(Array(5).fill("20%"));
    expect(getComputedStyle(segments[0] as HTMLElement).backgroundColor).toBe("rgb(48, 161, 78)");
    expect(getComputedStyle(bar).columnGap).toBe("2px");
    expect(math.getByText("1 of 5 mastered · 1 time to review")).toBeVisible();
    expect(asked).toContain(`map ${MATH} 1`);
    expect((await card("Физика")).queryByRole("img")).toBeNull();
    expect(asked.some((call) => call.startsWith(`map ${PHYSICS}`))).toBe(false);
  });

  it("are the ones the skill map draws on the same graph and answer", async () => {
    await import("@altnovatrail/skill-map");
    const { ModuleSkillMap } = await import("../skills/SkillMap.tsx");
    const map = {
      skillMap: create(GetSkillMapResponseSchema, STATED),
      graph: { view: SKILLS, skillTiers: SKILL_TIERS },
      manifest: JSON.parse(new TextDecoder().decode(MANIFESTS[D1]?.json)),
    } as Parameters<typeof ModuleSkillMap>[0]["map"];
    render(inLanguage(<ModuleSkillMap map={map} view="learner" headingLevel="2" />));
    const element = document.querySelector("novatrail-skill-map");
    const words = {
      Mastered: 0,
      "Time to review": 0,
      "In progress": 0,
      "Ready to start": 0,
      Locked: 0,
      "Feedback by criteria": 0,
    };
    await waitFor(() => {
      const tiles = [...(element?.shadowRoot?.querySelectorAll("button[aria-expanded]") ?? [])];
      expect(tiles).toHaveLength(6);
      for (const word of Object.keys(words) as (keyof typeof words)[]) {
        words[word] = tiles.filter((tile) => tile.textContent?.includes(word)).length;
      }
    });
    // "Time to review" is no part of "Mastered", nor any word of another: each tile has one.
    expect(words).toEqual({
      Mastered: 1,
      "Time to review": 1,
      "In progress": 1,
      "Ready to start": 1,
      Locked: 1,
      "Feedback by criteria": 1,
    });
  });

  it("are a mark in place of the bar for a module whose skills have a rubric and no verdict", async () => {
    await renderSubjects(
      {
        connected: [{ moduleId: MATH, packageDigest: D1 }],
        tiers: { [D1]: { a: 1, b: 1 } },
        graphs: {
          [D1]: {
            skills: {
              a: { title: "A", assessability: "rubric" },
              b: { title: "B", assessability: "rubric" },
            },
          },
        },
        maps: { [MATH]: { packageDigest: D1 } },
      },
      "ru",
    );
    const math = await card("Olympiad maths");
    expect(await math.findByText("Отзыв по критериям")).toBeVisible();
    expect(math.getByText("2 навыка, у каждого — критерии")).toBeVisible();
    expect(math.queryByRole("img")).toBeNull();
  });

  it("are nothing on the card of a module whose graph has no skill", async () => {
    const { asked } = await renderSubjects({
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      tiers: { [D1]: {} },
      maps: { [MATH]: { packageDigest: D1 } },
    });
    const math = await card("Olympiad maths");
    await waitFor(() => expect(asked).toContain(`map ${MATH} 1`));
    expect(math.queryByRole("img")).toBeNull();
    expect(math.queryByText("Not assessed")).toBeNull();
  });

  it("leave the card as it is when its map does not come, and lead to the module's map", async () => {
    const { asked } = await renderSubjects({ connected: [{ moduleId: MATH, packageDigest: D1 }] });
    const math = await card("Olympiad maths");
    await waitFor(() => expect(asked).toContain(`map ${MATH} 1`));
    expect(math.queryByRole("img")).toBeNull();
    const map = math.getByRole("button", { name: "Skill map" });
    expect(map).toHaveAccessibleDescription("Olympiad maths");
    await userEvent.click(map);
    expect(window.location.hash).toBe(`#/skill-map/${encodeURIComponent(MATH)}`);
    window.location.hash = "";
  });
});

describe("the legend and the task from paper", () => {
  it("stand below the modules from 600 CSS px, and on a phone open from a button as a sheet", async () => {
    await page.viewport(1194, 834);
    const { unmount } = await renderSubjects({
      connected: [{ moduleId: MATH, packageDigest: D1 }],
    });
    const legend = within(await screen.findByRole("region", { name: "What the marks mean" }));
    expect(legend.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Mastered",
      "Time to review",
      "In progress",
      "Ready to start",
      "Locked",
      "Feedback by criteria",
      "Not assessed",
    ]);
    expect(screen.queryByRole("button", { name: "What the marks mean" })).toBeNull();
    unmount();
    await page.viewport(390, 844);
    try {
      await renderSubjects({ connected: [{ moduleId: MATH, packageDigest: D1 }] });
      await card("Olympiad maths");
      expect(screen.queryByRole("region", { name: "What the marks mean" })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: "What the marks mean" }));
      const sheet = within(await screen.findByRole("dialog", { name: "What the marks mean" }));
      expect(sheet.getAllByRole("listitem")).toHaveLength(7);
    } finally {
      await page.viewport(1194, 834);
    }
  });

  it("is no legend with no module connected", async () => {
    await renderSubjects({ connected: [] });
    await screen.findByText("No subjects are connected yet");
    expect(screen.queryByRole("region", { name: "What the marks mean" })).toBeNull();
  });

  it("shows A task from my paper, disabled, with the line why", async () => {
    await renderSubjects({}, "ru");
    const paper = within(await screen.findByRole("region", { name: "Задача с моей бумаги" }));
    const button = paper.getByRole("button", { name: "Открыть камеру" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(
      "Будет позже: решать задачи со страницы своей книги пока нельзя",
    );
  });
});
