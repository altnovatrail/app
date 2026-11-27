// Home and Subjects in the browser: on Home what comes next, the lessons open, a card
// for each module connected with the states of its skills, the legend, the task from paper, and no
// line of the tutor time, which is the frame's ring; on Subjects the cards by role and name, connecting and
// disconnecting, a module with no current version, an empty catalog and the refusals; with api on
// connect-es's router and the open views on the device's memory.
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
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
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
import { expectLoaded, expectLoading } from "../test/loading.ts";
import { MySubjects } from "./MySubjects.tsx";
import { CatalogScreen, SubjectsPage } from "./SubjectsPage.tsx";

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
    subject: "mathematics",
    audience: { age_categories: ["under_13"], grades: [1, 2, 3, 4, 5, 6] },
    languages: { explanation },
    authors: [{ name: "The NovaTrail authors" }],
    license: "Apache-2.0",
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
  /** Subjects, the catalog's page, in place of Home. */
  page?: "subjects";
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
  /** Called on ChooseNext, by the skill asked for; throwing makes it fail. It gives nothing. */
  choose?: (skill: string) => void;
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
      chooseNext(request) {
        asked.push("choose");
        setup.choose?.(request.skill);
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
            {setup.page === "subjects" ? (
              <SubjectsPage profileId={LEARNER.profileId} />
            ) : setup.runs === undefined ? (
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

describe("Home", () => {
  it("goes on with the task in progress, and offers none when there is none", async () => {
    const { unmount } = await renderSubjects({});
    await screen.findByText("Nothing to begin yet: no subject is connected");
    expect(screen.queryByRole("button", { name: "Continue the task" })).toBeNull();
    unmount();
    await renderSubjects({ attempt: "a1" });
    const next = within(await screen.findByRole("region", { name: "Next up" }));
    expect(
      await next.findByRole("heading", { level: 3, name: "There is a task in progress" }),
    ).toBeVisible();
    const button = next.getByRole("button", { name: "Continue the task" });
    expect(button).toHaveAccessibleDescription("There is a task in progress");
    // Beside the attempt, no way to what the engine chooses, which would close it.
    expect(next.queryByRole("button", { name: "What's next" })).toBeNull();
    expect(next.queryByRole("button", { name: "Something else" })).toBeNull();
    await userEvent.click(button);
    expect(window.location.hash).toBe("#/task");
    window.location.hash = "";
  });

  it("drops the list of a screen gone before it came, and reads no catalog", async () => {
    const { unmount, asked } = await renderSubjects({});
    unmount();
    await vi.waitFor(() => expect(asked).toEqual(["list p1"]));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("names a module by its ID when its manifest did not come, and asks again on a retry", async () => {
    let fail = true;
    await renderSubjects({
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      manifest: () => {
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
  });

  it("leaves the tutor being an AI to the tutor's panel, with no part of its own below the lists", async () => {
    await renderSubjects({ connected: [], catalog: [] }, "ru");
    await screen.findByText("Пока нечего начинать: ни один предмет не подключён");
    expect(screen.queryByRole("region", { name: "Наставник — это ИИ" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Как безопасно пользоваться наставником" }),
    ).toBeNull();
  });

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

describe("Subjects", () => {
  it("takes no second press while a connection is under way, and keeps the focus where it was", async () => {
    let answer: () => void = () => {};
    const { asked } = await renderSubjects({
      page: "subjects",
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

  it("names a module by its ID when its manifest did not come, and asks again on a retry", async () => {
    let fail = true;
    let asked = 0;
    await renderSubjects({
      page: "subjects",
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
      page: "subjects",
      catalog: [{ moduleId: "novatrail/odd", packageDigest: bad }],
      seed: async (device) => {
        const cache = await openCache(device);
        await cache?.put(bad, "manifest", {
          json: manifest("novatrail/odd", "Odd", "en_US").json,
          version: "0.4",
        });
      },
    });
    expect((await card("Odd")).getByText(/· In en_US$/)).toBeTruthy();
  });

  it("connects a module from the catalog, and disconnects it", async () => {
    const { asked } = await renderSubjects({
      page: "subjects",
      catalog: [
        { moduleId: MATH, packageDigest: D1 },
        { moduleId: PHYSICS, packageDigest: D2 },
      ],
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Subjects" })).toBeTruthy();
    expect(await screen.findByText("No subjects are connected yet")).toBeTruthy();
    const more = within(screen.getByRole("region", { name: "More on this server" }));
    // The card in Russian says so to an English screen; the English one does not.
    const physics = await card("Физика");
    expect(physics.getByRole("heading", { level: 3 })).toHaveAttribute("lang", "ru");
    expect(physics.getByText("Mathematics · Grades 1–6 · In Russian")).toBeTruthy();
    const maths = await card("Olympiad maths");
    expect(maths.getByText("Mathematics · Grades 1–6")).toBeTruthy();
    const connect = maths.getByRole("button", { name: "Connect" });
    expect(connect).toHaveAccessibleDescription("Olympiad maths");
    // Titles in the order of the language: Latin before Cyrillic in English.
    expect(more.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Olympiad maths",
      "Физика",
    ]);

    // A card of the catalog has no Disconnect in its About.
    await userEvent.click(maths.getByRole("button", { name: "About the module" }));
    expect(screen.getByRole("dialog", { name: "About the module" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Disconnect" })).toBeNull();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(connect);
    const mine = within(await screen.findByRole("region", { name: "Connected · 1" }));
    const about = await mine.findByRole("button", { name: "About the module" });
    expect(about).toHaveAccessibleDescription("Olympiad maths");
    // The focus went with the card to its new place: its About, which holds Disconnect.
    await vi.waitFor(() => expect(document.activeElement).toBe(about));
    expect(screen.queryByText("No subjects are connected yet")).toBeNull();
    expect(more.queryByRole("article", { name: "Olympiad maths" })).toBeNull();

    await userEvent.click(about);
    const disconnect = within(screen.getByRole("dialog", { name: "About the module" })).getByRole(
      "button",
      { name: "Disconnect" },
    );
    await userEvent.click(disconnect);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("No subjects are connected yet")).toBeTruthy();
    const back = await within(
      await more.findByRole("article", { name: "Olympiad maths" }),
    ).findByRole("button", { name: "Connect" });
    await vi.waitFor(() => expect(document.activeElement).toBe(back));
    // The lists are not read again; the map of the module connected is read for its squares.
    expect(asked.filter((call) => !call.startsWith("map "))).toEqual([
      "list p1",
      "catalog p1",
      `connect ${MATH}`,
      `disconnect ${MATH}`,
    ]);
  });

  it("names a module with no current version by the manifest kept of an earlier one, or by its ID", async () => {
    await renderSubjects(
      {
        page: "subjects",
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
    expect(maths.getByText("Язык: английский")).toBeTruthy();
    expect(maths.getByText("Сейчас недоступен")).toBeTruthy();
    // No map for a module with no current version.
    expect(maths.queryByRole("button", { name: "Карта навыков" })).toBeNull();
    expect((await card("novatrail/gone")).getByText("Сейчас недоступен")).toBeTruthy();
    expect(await screen.findByText("В каталоге пока нет модулей для этого профиля")).toBeTruthy();
    // Disconnect stands in its About, with no facts: no manifest names them.
    await userEvent.click((await card("novatrail/gone")).getByRole("button", { name: "О модуле" }));
    const about = within(screen.getByRole("dialog", { name: "О модуле" }));
    expect(about.getByRole("button", { name: "Отключить" })).toBeTruthy();
    expect(about.queryByRole("term")).toBeNull();
  });

  it("names the facts of a module's manifest in its About, its license among them, and has no button of the license", async () => {
    await renderSubjects(
      {
        page: "subjects",
        connected: [{ moduleId: MATH, packageDigest: D1 }],
        catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
      },
      "ru",
    );
    const physics = await card("Физика");
    expect(physics.queryByRole("button", { name: "Лицензия" })).toBeNull();
    const about = physics.getByRole("button", { name: "О модуле" });
    expect(about).toHaveAccessibleDescription("Физика");
    await userEvent.click(about);
    const dialog = within(screen.getByRole("dialog", { name: "О модуле" }));
    expect(
      dialog
        .getAllByRole("term")
        .map((term) => [term.textContent, term.nextElementSibling?.textContent]),
    ).toEqual([
      ["Версия", "1.0.0"],
      ["Авторы", "The NovaTrail authors"],
      ["Для кого", "1–6 класс"],
      ["Язык объяснений", "русский"],
      ["Лицензия", "Apache-2.0"],
    ]);
    expect(dialog.getByText("Apache-2.0")).toHaveAttribute("lang", "en");
    expect(dialog.queryByRole("button", { name: "Отключить" })).toBeNull();
  });

  it("names three of a module's skills, and the rest by tier in a pop-over with the way to its map", async () => {
    await renderSubjects({
      page: "subjects",
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
      tiers: { [D1]: SKILL_TIERS, [D2]: { a: 1 } },
      graphs: {
        [D1]: { ...SKILLS, tiers: ["Basics", "Patterns"] },
        [D2]: { skills: { a: { title: "Сила", assessability: "verdict" } } },
      },
    });
    const maths = await card("Olympiad maths");
    expect(await maths.findByText("Skills · 6")).toBeVisible();
    // A tier's skills by title, the first tier first.
    expect(
      maths
        .getAllByRole("listitem")
        .slice(0, 3)
        .map((item) => item.textContent),
    ).toEqual(["Counting", "Days and cycles", "Halves"]);
    const rest = maths.getByRole("button", { name: "+3 more" });
    expect(rest).toHaveAccessibleDescription("Olympiad maths");
    await userEvent.click(rest);
    const dialog = within(screen.getByRole("dialog", { name: "Skills · 6" }));
    expect(dialog.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
      "Basics",
      "Patterns",
      "Tier 3",
    ]);
    expect(dialog.getByText("Sums of rows")).toBeTruthy();
    await userEvent.click(dialog.getByRole("button", { name: "Open the skill map" }));
    expect(window.location.hash).toBe(`#/skill-map/${encodeURIComponent(MATH)}`);
    window.location.hash = "";
    // A module of one skill names it, with no chip of the rest, and says how many beside Connect.
    const physics = await card("Физика");
    expect(await physics.findByText("Сила")).toHaveAttribute("lang", "ru");
    expect(physics.queryByRole("button", { name: /more/ })).toBeNull();
    expect(physics.getByText("1 skill")).toBeVisible();
  });

  it("leads from a module connected to its skill map", async () => {
    await renderSubjects({ page: "subjects", connected: [{ moduleId: MATH, packageDigest: D1 }] });
    const map = (await card("Olympiad maths")).getByRole("button", { name: "Skill map" });
    expect(map).toHaveAccessibleDescription("Olympiad maths");
    await userEvent.click(map);
    expect(window.location.hash).toBe(`#/skill-map/${encodeURIComponent(MATH)}`);
    window.location.hash = "";
  });

  it("marks a module whose skill graph is a chain, connected or not, and no other", async () => {
    await renderSubjects(
      {
        page: "subjects",
        connected: [{ moduleId: MATH, packageDigest: D1 }],
        catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
        tiers: { [D1]: { "counting-gaps": 1, "time-calendar": 2 }, [D2]: { a: 1, b: 1 } },
      },
      "ru",
    );
    // The mark comes once the graph has, after the card.
    expect(
      await (await card("Olympiad maths")).findByText(
        "Математика · 1–6 класс · По порядку · Язык: английский",
      ),
    ).toBeVisible();
    expect(
      await (await card("Физика")).findByText("Математика · 1–6 класс · Адаптивный"),
    ).toBeVisible();
  });

  it("tells a connection api refused, and offers to try again when it does not answer", async () => {
    let down = true;
    await renderSubjects({
      page: "subjects",
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
    // The first in Next up, with its Continue; the others a press away each, below it.
    const next = within(await screen.findByRole("region", { name: "Next up" }));
    const title = await next.findByRole("heading", { level: 3, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toHaveAttribute("lang", "en");
    const go = next.getByRole("button", { name: "Continue the lesson" });
    expect(go).toHaveAccessibleDescription("Gaps and posts");
    expect(next.getByText("Also begun:")).toBeVisible();
    const other = next.getByRole("button", { name: "A lesson: Физика" });
    expect(other.querySelector("[lang]")).toHaveAttribute("lang", "ru");
    await userEvent.click(go);
    expect(window.location.hash).toBe("#/lesson");
    window.location.hash = "";
    await userEvent.click(other);
    expect(window.location.hash).toBe("#/lesson");
    window.location.hash = "";
  });

  it("shows no lesson when the learner has none open", async () => {
    await renderSubjects({ runs: [] });
    await screen.findByText("Nothing to begin yet: no subject is connected");
    expect(screen.queryByRole("button", { name: "Continue the lesson" })).toBeNull();
    expect(screen.queryByText("Also begun:")).toBeNull();
  });
});

describe("the tutor time", () => {
  it("is not Home's: its card of what comes next has no line or bar of it, and Home asks no share", async () => {
    const { asked } = await renderSubjects({
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      quota: () => ({ profilePercent: 40 }),
    });
    expect(await screen.findByRole("article", { name: "Olympiad maths" })).toBeTruthy();
    const card = await screen.findByRole("region", { name: "Next up" });
    expect(card.textContent).not.toMatch(/Tutor time|40/);
    expect(document.querySelector(".nt-quota-bar")).toBeNull();
    // The ring of the frame's top right asks it, not Home.
    expect(asked.filter((each) => each.startsWith("quota"))).toEqual([]);
  });
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
  it("are on a card connected as its map has them, by the learner's action, on Home and on Subjects", async () => {
    const setup = {
      connected: [{ moduleId: MATH, packageDigest: D1 }],
      catalog: [{ moduleId: PHYSICS, packageDigest: D2 }],
      tiers: { [D1]: SKILL_TIERS },
      graphs: { [D1]: SKILLS },
      maps: { [MATH]: STATED },
    };
    const { asked, unmount } = await renderSubjects(setup);
    const math = await card("Olympiad maths");
    const dots = await math.findByRole("img", { name: ALL_STATES });
    // A square for each skill in the colour of its state, in the order of the legend.
    const squares = [...dots.children] as HTMLElement[];
    expect(squares.map((square) => square.dataset.state)).toEqual([
      "mastered",
      "time-to-review",
      "in-progress",
      "ready-to-start",
      "locked",
      "feedback-by-criteria",
    ]);
    expect(getComputedStyle(squares[0] as HTMLElement).backgroundColor).toBe("rgb(48, 161, 78)");
    expect(getComputedStyle(dots).columnGap).toBe("2px");
    expect(math.getByText("Adaptive")).toBeVisible();
    expect(math.getByText("1 of 5 mastered")).toBeVisible();
    expect(math.getByText("1 skill to review")).toBeVisible();
    expect(asked).toContain(`map ${MATH} 1`);
    unmount();
    // On Subjects the same squares, with the counts beside how many are mastered; none on a card
    // of the catalog, whose module is not the learner's.
    const subjects = await renderSubjects({ ...setup, page: "subjects" });
    const mine = await card("Olympiad maths");
    expect(await mine.findByRole("img", { name: ALL_STATES })).toBeVisible();
    expect(mine.getByText("1 of 5 mastered · 1 to review · 1 in progress")).toBeVisible();
    expect((await card("Физика")).queryByRole("img")).toBeNull();
    expect(subjects.asked).toContain(`map ${MATH} 1`);
    expect(subjects.asked.some((call) => call.startsWith(`map ${PHYSICS}`))).toBe(false);
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

  it("are the mark of criteria for a module whose skills have a rubric and no verdict, with no strip below", async () => {
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
    expect(
      math.getByText("2 навыка, у каждого — критерии · Язык объяснений: английский"),
    ).toBeVisible();
    const squares = [...math.getByRole("img").children] as HTMLElement[];
    expect(squares.map((square) => square.dataset.state)).toEqual([
      "feedback-by-criteria",
      "feedback-by-criteria",
    ]);
    expect(math.queryByText("Наставник выбирает")).toBeNull();
    expect(math.queryByText("Текущий навык")).toBeNull();
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

describe("a card's Continue on a skill to work on", () => {
  const setup = {
    connected: [{ moduleId: MATH, packageDigest: D1 }],
    tiers: { [D1]: SKILL_TIERS },
    graphs: { [D1]: SKILLS },
    maps: { [MATH]: STATED },
  };
  const toMap = `#/skill-map/${encodeURIComponent(MATH)}`;

  async function pressContinue() {
    const math = await card("Olympiad maths");
    await math.findByRole("img", { name: ALL_STATES });
    await userEvent.click(math.getByRole("button", { name: "Continue" }));
  }

  it("asks the engine for the skill, and opens the map when it gives nothing", async () => {
    const choose = vi.fn();
    await renderSubjects({ ...setup, choose });
    await pressContinue();
    await waitFor(() => expect(window.location.hash).toBe(toMap));
    expect(choose).toHaveBeenCalledWith(`${MATH}/skill/patterns`);
    window.location.hash = "";
  });

  it("opens the map when the engine's choice fails", async () => {
    await renderSubjects({
      ...setup,
      choose: () => {
        throw new ConnectError("down", Code.Unavailable);
      },
    });
    await pressContinue();
    await waitFor(() => expect(window.location.hash).toBe(toMap));
    window.location.hash = "";
  });

  it("opens the map, asking the engine nothing, with another attempt open", async () => {
    const choose = vi.fn();
    await renderSubjects({ ...setup, attempt: "a1", choose });
    await pressContinue();
    expect(window.location.hash).toBe(toMap);
    expect(choose).not.toHaveBeenCalled();
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

  it("opens the camera of a new page from Tasks from my paper", async () => {
    await renderSubjects({}, "ru");
    const paper = within(await screen.findByRole("region", { name: "Задачи с моей бумаги" }));
    const button = paper.getByRole("button", { name: "Открыть камеру" });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(window.location.hash).toBe("#/paper");
    window.location.hash = "";
  });
});

describe("Subjects while its lists are read", () => {
  it("stands with the shapes of the cards and of the count under their headings", () => {
    const screenOf = (lists: { connected?: []; catalog?: [] }) =>
      inLanguage(
        <CatalogScreen
          connected={lists.connected}
          catalog={lists.catalog}
          onConnect={() => {}}
          onDisconnect={() => {}}
        />,
      );
    const { rerender } = render(screenOf({}));
    expect(screen.getByRole("heading", { level: 1, name: "Subjects" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "More on this server" })).toBeTruthy();
    expect(screen.getAllByRole("status").filter((s) => s.textContent === "Loading")).toHaveLength(
      2,
    );
    expectLoading(document, 14);
    rerender(screenOf({ connected: [], catalog: [] }));
    expect(screen.getByRole("heading", { level: 2, name: "Connected · 0" })).toBeTruthy();
    expectLoaded(document);
  });
});
