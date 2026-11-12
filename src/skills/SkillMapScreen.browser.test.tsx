// The skill map in Chromium (R34; section 3.10 of docs/architecture.md; architecture 3.3 in spec):
// the element of skill-map in JSX, the list of the maps of the modules connected, a module's map
// with the learner's view in the learner's language, Practise to ChooseNext with the skill and to
// what the engine gives, the question while an attempt is open, nothing to give, the modules that
// teach an anchor skill whose holding is unknown with Connect, a module with no skill graph and a
// refusal — with api on connect-es's router and the open views on the device's memory.
import "@altnovatrail/skill-map";
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  ChoiceKind,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type ChooseNextRequest,
  LearningService,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import {
  type ConnectedModuleSchema,
  ModuleService,
} from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  AnchorSkillHolding,
  type GetSkillMapRequest,
  type GetSkillMapResponseSchema,
  ProgressService,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type { NovatrailSkillMap, SkillChooseEvent } from "@altnovatrail/skill-map";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { SKILL_MAP } from "../app/router.ts";
import { LessonProvider } from "../lesson/LessonContext.tsx";
import { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { AttemptProvider, useAttempt } from "../task/AttemptContext.tsx";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { moduleMapRoute, SkillMapRoute } from "./SkillMapScreen.tsx";

const SHARES = "example/fair-shares";
const TABLES = "novatrail/tables";
const GONE = "novatrail/gone";
const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
const D3 = `sha256:${"3".repeat(64)}`;

function view(json: unknown) {
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: "0.4" };
}

function manifest(id: string, title: string, explanation = "en") {
  return { module_format_version: "0.4", id, version: "1.0.0", title, languages: { explanation } };
}

/** Two skills of tier 1, one of them on an anchor skill of the shared taxonomy. */
const GRAPH = {
  skills: {
    counting: { title: "Counting", assessability: "verdict" },
    halves: {
      title: "Halves",
      assessability: "verdict",
      prerequisites: ["core.multiplication-table"],
    },
  },
};
const TIERS = { counting: 1, halves: 1 };

const MANIFESTS: Readonly<Record<string, ReturnType<typeof manifest>>> = {
  [D1]: manifest(SHARES, "Fair shares"),
  [D2]: manifest(TABLES, "Таблица умножения", "ru"),
  [D3]: manifest("example/no-graph", "No graph"),
};

function refused(code: Code, cause: Cause): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

type SkillMap = MessageInitShape<typeof GetSkillMapResponseSchema>;

/** The anchor skill of the graph unknown, taught by a module of the catalog and one gone from it. */
const UNKNOWN: SkillMap = {
  packageDigest: D1,
  anchorSkills: [
    {
      anchorSkill: "core.multiplication-table",
      holding: AnchorSkillHolding.UNKNOWN,
      teachingModules: [TABLES, GONE],
    },
  ],
};

interface Setup {
  readonly connected?: MessageInitShape<typeof ConnectedModuleSchema>[];
  /** Each answer of GetSkillMap in turn, the last for the rest; throwing makes it fail. */
  readonly maps?: (() => SkillMap)[];
  /** What Practise gives. */
  readonly choice?: () =>
    | { kind: ChoiceKind; choiceId?: string }
    | Promise<{ kind: ChoiceKind; choiceId?: string }>;
  /** The attempt the learner has open outside a lesson. */
  readonly attempt?: string;
  readonly connect?: () => void;
}

/** The attempt open, as the task screen would take it. */
function Probe() {
  return <p data-testid="probe">{`attempt ${useAttempt()?.attemptId ?? "none"}`}</p>;
}

async function renderMap(
  route: { screen: string; parts: readonly string[] },
  setup: Setup = {},
  language: "en" | "ru" = "en",
) {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  if (setup.attempt !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({
      attemptId: setup.attempt,
      digest: D1,
      task: {
        id: "t",
        statement: [{ text: "A." }],
        canvas: { kind: "handwriting_sheet" },
        items: [{ answer_slots: [{ binding: "choice", options: ["1", "2"] }] }],
      },
    });
  }
  const maps: GetSkillMapRequest[] = [];
  const chosen: ChooseNextRequest[] = [];
  const asked: string[] = [];
  const answers = setup.maps ?? [() => ({ packageDigest: D1 })];
  const routes = (router: ConnectRouter) => {
    router.service(ProgressService, {
      getSkillMap(request) {
        maps.push(request);
        const answer = answers[Math.min(maps.length, answers.length) - 1];
        return answer?.() ?? {};
      },
    });
    router.service(ModuleService, {
      listConnectedModules: () => ({ modules: setup.connected ?? [] }),
      listCatalog() {
        asked.push("catalog");
        return { modules: [{ moduleId: TABLES, packageDigest: D2 }] };
      },
      connectModule(request) {
        asked.push(`connect ${request.moduleId}`);
        setup.connect?.();
        return { modules: [{ moduleId: request.moduleId, packageDigest: D2 }] };
      },
    });
    router.service(LearningService, {
      async chooseNext(request) {
        chosen.push(request);
        return { choice: (await setup.choice?.()) ?? { kind: ChoiceKind.NOTHING } };
      },
      beginAttempt: () => ({ attempt: { attemptId: "a9", packageDigest: D1 } }),
    });
    router.service(PackageService, {
      getManifest: (request) => ({ manifest: view(MANIFESTS[request.packageDigest]) }),
      getSkillGraph: (request) =>
        request.packageDigest === D1 ? { skillGraph: view(GRAPH), skillTiers: TIERS } : {},
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: new PackageChecks(api, device),
    files: new DeviceFiles({ api: "https://api.example.org", withdrawn: () => {} }),
  };
  const learner = create(ProfileSchema, {
    profileId: "p1",
    ...(setup.attempt === undefined ? {} : { openAttempt: { attemptId: setup.attempt } }),
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <AttemptProvider learner={learner}>
            <LessonProvider learner={learner}>
              <SkillMapRoute route={route} profileId="p1" device={device} />
              <Probe />
            </LessonProvider>
          </AttemptProvider>
        </PackagesProvider>
      </ApiProvider>,
      language,
    ),
  );
  return { device, maps, chosen, asked };
}

/** The element on the screen, once it has drawn its map. */
async function drawn(): Promise<NovatrailSkillMap> {
  return vi.waitFor(() => {
    const element = document.querySelector("novatrail-skill-map");
    if (element?.shadowRoot?.querySelector("button.tile") == null) throw new Error("no map yet");
    return element;
  });
}

/** Opens a skill on the map, and presses its Practise. */
async function practise(element: NovatrailSkillMap, title: string): Promise<HTMLButtonElement> {
  const root = element.shadowRoot as ShadowRoot;
  const tile = [...root.querySelectorAll<HTMLButtonElement>("button.tile")].find((button) =>
    button.textContent?.startsWith(title),
  );
  tile?.click();
  const button = await vi.waitFor(() => {
    const found = root.querySelector<HTMLButtonElement>("button.practise");
    if (found === null || !found.isConnected) throw new Error("no Practise yet");
    return found;
  });
  button.focus();
  button.click();
  return button;
}

afterEach(() => {
  window.location.hash = "";
});

describe("<novatrail-skill-map> in JSX", () => {
  it("is the registered element, with its data as properties and its view and language as attributes", () => {
    const ref = createRef<NovatrailSkillMap>();
    const tiers = { counting: 1 };
    render(
      <novatrail-skill-map ref={ref} view="learner" lang="ru" heading-level="2" tiers={tiers} />,
    );
    const element = ref.current;
    expect(element).toBeInstanceOf(
      customElements.get("novatrail-skill-map") as CustomElementConstructor,
    );
    expect(element?.tiers).toBe(tiers);
    expect(element?.hasAttribute("tiers")).toBe(false);
    expect(["view", "lang", "heading-level"].map((name) => element?.getAttribute(name))).toEqual([
      "learner",
      "ru",
      "2",
    ]);
  });

  it("hands the choice of a skill to the listener named in lower case", () => {
    const chose = vi.fn<(event: SkillChooseEvent) => void>();
    const ref = createRef<NovatrailSkillMap>();
    render(<novatrail-skill-map ref={ref} view="learner" lang="en" onskillchoose={chose} />);
    const detail = { skill: `${SHARES}/skill/counting` };
    ref.current?.dispatchEvent(new CustomEvent("skillchoose", { detail }));
    expect(chose.mock.calls[0]?.[0].detail).toEqual(detail);
  });

  it("takes no element without its view or language, nor a language the build has not", () => {
    // Never rendered: tsc checks them, and an unused directive would fail ci-lint.
    const none = () => (
      // @ts-expect-error -- lang is no option: the map would speak English on any screen.
      <novatrail-skill-map view="learner" />
    );
    const other = () => (
      // @ts-expect-error -- "child" is no view of the map.
      <novatrail-skill-map view="child" lang="en" />
    );
    const german = () => (
      // @ts-expect-error -- "de" is no language of the build.
      <novatrail-skill-map view="adult" lang="de" />
    );
    expect([typeof none, typeof other, typeof german]).toEqual([
      "function",
      "function",
      "function",
    ]);
  });
});

describe("the list of maps", () => {
  it("offers the map of each module connected with a current version, and the way home", async () => {
    await renderMap(SKILL_MAP, {
      connected: [
        { moduleId: SHARES, packageDigest: D1 },
        { moduleId: GONE, packageDigest: "" },
      ],
    });
    expect(screen.getByRole("heading", { level: 1, name: "Skill map" })).toBeVisible();
    const gone = within(await screen.findByRole("article", { name: GONE }));
    expect(gone.getByText("Not available now")).toBeVisible();
    expect(gone.queryByRole("button")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Open the map" }));
    expect(window.location.hash).toBe("#/skill-map/example%2Ffair-shares");
    expect(screen.getByRole("button", { name: "Open the map" })).toHaveAccessibleDescription(
      "Fair shares",
    );
    expect(screen.queryByRole("button", { name: "All skill maps" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back to My subjects" }));
    expect(window.location.hash).toBe("#/home");
  });

  it("says when no subject is connected, and goes to the list from a route it does not know", async () => {
    await renderMap(SKILL_MAP);
    expect(await screen.findByText("No subjects are connected yet")).toBeVisible();
    window.location.hash = "#/skill-map/a/b";
    await renderMap({ ...SKILL_MAP, parts: ["a", "b"] });
    await waitFor(() => expect(window.location.hash).toBe("#/skill-map"));
  });
});

describe("a module's map", () => {
  it("gives the element the learner's view in the learner's language, by the learner's action", async () => {
    const { maps } = await renderMap(moduleMapRoute(SHARES), {}, "ru");
    const element = await drawn();
    expect(element.getAttribute("view")).toBe("learner");
    expect(element.getAttribute("lang")).toBe("ru");
    expect(element.getAttribute("heading-level")).toBe("2");
    expect(element.graph).toEqual(GRAPH);
    expect(element.tiers).toEqual(TIERS);
    expect(element.manifest?.id).toBe(SHARES);
    expect(element.skillMap?.packageDigest).toBe(D1);
    expect(maps[0]).toMatchObject({ profileId: "p1", moduleId: SHARES, action: Action.LEARNING });
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Карта навыков: Fair shares");
    expect(within(heading).getByText("Fair shares")).toHaveAttribute("lang", "en");
    expect(document.title).toBe("Карта навыков: Fair shares — NovaTrail");
    // The map's own words are Russian, and its bands' headings are below the screen's.
    expect(element.shadowRoot?.querySelector("h2")).not.toBeNull();
    expect(screen.queryByRole("heading", { name: "Модули, которые можно подключить" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Все карты навыков" }));
    expect(window.location.hash).toBe("#/skill-map");
  });

  it("asks the engine for the skill chosen, with its full ID, and begins the task it gives", async () => {
    const { chosen } = await renderMap(moduleMapRoute(SHARES), {
      choice: () => ({ kind: ChoiceKind.TASK, choiceId: "c1" }),
    });
    await practise(await drawn(), "Counting");
    await waitFor(() => expect(window.location.hash).toBe("#/task"));
    expect(screen.getByTestId("probe")).toHaveTextContent("attempt a9");
    expect(chosen).toHaveLength(1);
    expect(chosen[0]?.skill).toBe(`${SHARES}/skill/counting`);
    expect(chosen[0]?.idempotencyKey).not.toBe("");
  });

  it("says when there is nothing to give for the skill", async () => {
    await renderMap(moduleMapRoute(SHARES));
    await practise(await drawn(), "Counting");
    expect(
      await screen.findByText("There is nothing more to offer for now", {
        selector: "[role=status]",
      }),
    ).toBeVisible();
    expect(window.location.hash).toBe("");
  });

  it("says a choice is under way, and takes no other press of Practise meanwhile", async () => {
    let give: (choice: { kind: ChoiceKind }) => void = () => {};
    const { chosen } = await renderMap(moduleMapRoute(SHARES), {
      choice: () => new Promise((resolve) => (give = resolve)),
    });
    const element = await drawn();
    const button = await practise(element, "Counting");
    expect(
      await screen.findByText("Opening what's next…", { selector: "[role=status]" }),
    ).toBeVisible();
    button.click();
    expect(chosen).toHaveLength(1);
    give({ kind: ChoiceKind.NOTHING });
    expect(
      await screen.findByText("There is nothing more to offer for now", {
        selector: "[role=status]",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Opening what's next…")).toBeNull();
    expect(chosen).toHaveLength(1);
  });

  it("gives the focus back to Practise on Go on, when the choice leaves the learner on the map", async () => {
    await renderMap(moduleMapRoute(SHARES), { attempt: "a1" });
    const element = await drawn();
    const button = await practise(element, "Counting");
    await userEvent.click(await screen.findByRole("button", { name: "Go on" }));
    await screen.findByText("There is nothing more to offer for now", {
      selector: "[role=status]",
    });
    expect(element.shadowRoot?.activeElement).toBe(button);
    expect(element).toHaveFocus();
  });

  it("asks first while an attempt is open, gives the focus back on Cancel, and closes it on Go on", async () => {
    const { chosen, device } = await renderMap(moduleMapRoute(SHARES), {
      attempt: "a1",
      choice: () => ({ kind: ChoiceKind.LESSON, choiceId: "c2" }),
    });
    const element = await drawn();
    const button = await practise(element, "Counting");
    const goOn = await screen.findByRole("button", { name: "Go on" });
    await waitFor(() => expect(goOn).toHaveFocus());
    expect(
      screen.getByRole("group", {
        name: "The task in progress closes, and it can't be gone back to",
      }),
    ).toBeVisible();
    expect(chosen).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("button", { name: "Go on" })).toBeNull();
    expect(element.shadowRoot?.activeElement).toBe(button);
    button.click();
    await userEvent.click(await screen.findByRole("button", { name: "Go on" }));
    await waitFor(() => expect(window.location.hash).toBe("#/lesson"));
    expect(chosen[0]?.skill).toBe(`${SHARES}/skill/counting`);
    expect(screen.getByTestId("probe")).toHaveTextContent("attempt none");
    // The attempt closed, its work on the device went with it.
    expect(await (await openProfile(device, "p1"))?.readAttempt("a1")).toBeUndefined();
  });

  it("offers the modules that teach an anchor skill whose holding is unknown, and connects one", async () => {
    const { asked, maps } = await renderMap(moduleMapRoute(SHARES), {
      maps: [
        () => UNKNOWN,
        () => ({
          packageDigest: D1,
          anchorSkills: [
            {
              anchorSkill: "core.multiplication-table",
              holding: AnchorSkillHolding.NOT_HELD,
              teachingSkills: [`${TABLES}/skill/tables`],
            },
          ],
        }),
      ],
    });
    const offered = within(await screen.findByRole("region", { name: "Modules to connect" }));
    const tables = within(await offered.findByRole("article", { name: "Таблица умножения" }));
    expect(tables.getByRole("heading", { name: "Таблица умножения" })).toHaveAttribute(
      "lang",
      "ru",
    );
    expect(tables.getByText("Explanation language: Russian")).toBeVisible();
    // A module the catalog no longer gives is named by its ID, with no way to connect it.
    const gone = within(offered.getByRole("article", { name: GONE }));
    expect(gone.getByText("Not available now")).toBeVisible();
    expect(gone.queryByRole("button")).toBeNull();
    await userEvent.click(tables.getByRole("button", { name: "Connect" }));
    const done = await offered.findByText("Connected: it is in My subjects now");
    expect(done).toHaveFocus();
    expect(asked).toEqual(["catalog", `connect ${TABLES}`]);
    // The map's state is read again in place: the anchor skill is no longer unknown on it.
    await waitFor(() => expect(maps).toHaveLength(2));
    const element = await drawn();
    await waitFor(() =>
      expect(element.skillMap?.anchorSkills[0]?.holding).toBe(AnchorSkillHolding.NOT_HELD),
    );
    expect(screen.getByRole("region", { name: "Modules to connect" })).toBeVisible();
  });

  it("says what a connection came to when it fails, and offers it again", async () => {
    let fail = true;
    await renderMap(moduleMapRoute(SHARES), {
      maps: [() => UNKNOWN],
      connect: () => {
        if (fail) throw new ConnectError("down", Code.Internal);
      },
    });
    const connect = await screen.findByRole("button", { name: "Connect" });
    await userEvent.click(connect);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This version of the app doesn't know this yet",
    );
    fail = false;
    await userEvent.click(connect);
    expect(await screen.findByText("Connected: it is in My subjects now")).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers nothing beside an anchor skill held or not held", async () => {
    const { asked } = await renderMap(moduleMapRoute(SHARES), {
      maps: [
        () => ({
          packageDigest: D1,
          anchorSkills: [
            {
              anchorSkill: "core.multiplication-table",
              holding: AnchorSkillHolding.HELD,
              teachingModules: [TABLES],
            },
          ],
        }),
      ],
    });
    await drawn();
    expect(screen.queryByRole("region", { name: "Modules to connect" })).toBeNull();
    expect(asked).toEqual([]);
  });

  it("says a module has no map without a skill graph", async () => {
    await renderMap(moduleMapRoute("example/no-graph"), { maps: [() => ({ packageDigest: D3 })] });
    expect(await screen.findByText("This subject has no skill map")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Skill map: No graph");
    expect(document.querySelector("novatrail-skill-map")).toBeNull();
  });

  it("says what a refusal came to, and reads the map again on Try again", async () => {
    let refuse = true;
    const { maps } = await renderMap(moduleMapRoute(SHARES), {
      maps: [
        () => {
          if (refuse) throw refused(Code.NotFound, Cause.NOT_FOUND);
          return { packageDigest: D1 };
        },
      ],
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("This isn't there any more");
    expect(screen.getByRole("heading", { level: 1, name: "Skill map" })).toBeVisible();
    refuse = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await drawn();
    expect(maps).toHaveLength(2);
  });
});
