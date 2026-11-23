// The progress of a profile in the section for adults in the browser: the way to it from the
// profile's page, the skill maps of the modules connected with the adult's view of a module's map,
// the traps that repeat from the first page alone, the attempts page by page with "Show more" and
// the focus, each with how it came out and the words of its reason code — an unknown code with the
// common words —, its lesson's title or ID and a solved attempt's skills in the module's language,
// a page that did not come and its retry, the pages with no profile chosen, and "Easier" and
// "Harder" at a module's level on its map — with api on connect-es's router and the open
// views on the device's memory.
import "@altnovatrail/skill-map";
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  ReasonCode,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  type GetProgressRequest,
  type GetProgressResponseSchema,
  type GetSkillMapRequest,
  type GetSkillMapResponseSchema,
  ProgressService,
  type SetModuleLevelRequest,
  type SetModuleLevelResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type { NovatrailSkillMap } from "@altnovatrail/skill-map";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { routeOf, useRoute } from "../app/router.ts";
import { dateTimeFormat, listFormat } from "../i18n/intl.ts";
import type { Language } from "../i18n/language.ts";
import { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { expectLoaded, expectLoading, held } from "../test/loading.ts";
import { AdultSection } from "./AdultSection.tsx";

const MATHS = "novatrail/olympiad-math";
const PHYSICS = "novatrail/physics";
const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
/** A newer version of olympiad maths, whose bands are titled anew. */
const D3 = `sha256:${"3".repeat(64)}`;

const OWNER = create(ProfileSchema, {
  profileId: "p1",
  owner: true,
  pseudonym: "Ёжик",
  ageCategory: "adult",
});

function view(json: unknown) {
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: "0.4" };
}

function manifest(id: string, title: string, explanation: string) {
  return { module_format_version: "0.4", id, version: "1.2.0", title, languages: { explanation } };
}

/** The bands of olympiad maths, from the easiest, titled in its explanation language. */
const BANDS = [
  { id: "g12", title: "Grades 1–2", grades: [1, 2] },
  { id: "g34", title: "Grades 3–4", grades: [3, 4] },
  { id: "g56", title: "Grades 5–6", grades: [5, 6] },
];

const MANIFESTS: Readonly<Record<string, ReturnType<typeof manifest> & { bands?: unknown }>> = {
  [D1]: { ...manifest(MATHS, "Olympiad maths", "en"), bands: BANDS },
  [D2]: manifest(PHYSICS, "Физика", "ru"),
  [D3]: {
    ...manifest(MATHS, "Olympiad maths", "en"),
    bands: BANDS.map((band) => ({ ...band, title: `${band.title}, new` })),
  },
};

const GRAPH = { skills: { counting: { title: "Counting", assessability: "verdict" } } };

const BEGUN = new Date(Date.UTC(2026, 10, 10, 9, 0));
const CLOSED = new Date(Date.UTC(2026, 10, 10, 9, 12));
const CHOSEN = new Date(Date.UTC(2026, 10, 10, 8, 59));
const at = (date: Date) => timestampFromDate(date);

type Page = MessageInitShape<typeof GetProgressResponseSchema>;

/** The first page: two traps, and attempts of each kind the screen words. */
const FIRST: Page = {
  repeatingTraps: [
    {
      trap: `${MATHS}/trap/off-by-one`,
      description: "Counts one too many",
      trapAdvice: "Count the gaps, not the posts",
      attemptCount: 3,
      lastClosedAt: at(CLOSED),
    },
    { trap: `${PHYSICS}/trap/units`, description: "Мешает единицы", attemptCount: 2 },
  ],
  attempts: [
    {
      task: `${MATHS}/task/counting-gaps-3`,
      moduleVersion: "1.2.0",
      closeReason: CloseReason.CORRECT,
      wrongAnswers: 0,
      begunAt: at(BEGUN),
      closedAt: at(CLOSED),
      chosenAt: at(CHOSEN),
      reasonCode: ReasonCode.CONSOLIDATION,
    },
    {
      task: `${MATHS}/task/counting-gaps-2`,
      moduleVersion: "1.1.0",
      lesson: `${MATHS}/lesson/counting-first-steps`,
      closeReason: CloseReason.SOLUTION_SHOWN,
      wrongAnswers: 4,
      begunAt: at(BEGUN),
      closedAt: at(CLOSED),
      chosenAt: at(CHOSEN),
      reasonCode: ReasonCode.SKILL_CHOSEN,
    },
    {
      task: `${PHYSICS}/task/levers-1`,
      moduleVersion: "0.3.0",
      closeReason: CloseReason.UNSPECIFIED,
      wrongAnswers: 1,
      begunAt: at(BEGUN),
    },
  ],
  nextPageToken: "page-2",
};

/** The second page: an attempt of a code this build does not know, and a trap api should not send. */
const SECOND: Page = {
  repeatingTraps: [{ trap: `${MATHS}/trap/late`, description: "Late", attemptCount: 2 }],
  attempts: [
    {
      task: `${MATHS}/task/counting-gaps-1`,
      moduleVersion: "1.0.0",
      closeReason: CloseReason.LEFT,
      wrongAnswers: 2,
      begunAt: at(BEGUN),
      closedAt: at(CLOSED),
      chosenAt: at(CHOSEN),
      reasonCode: 99 as ReasonCode,
    },
    {
      task: "not-a-full-id",
      moduleVersion: "1.0.0",
      closeReason: 42 as CloseReason,
      begunAt: at(BEGUN),
      chosenAt: at(CHOSEN),
      reasonCode: ReasonCode.ROTATION,
    },
  ],
  nextPageToken: "",
};

interface Setup {
  /** Each answer of GetProgress by its token; throwing makes it fail. */
  readonly pages?: Readonly<Record<string, (() => Page)[]>>;
  readonly connected?: { moduleId: string; packageDigest: string }[] | "fail";
  /** Whether GetSkillMap is refused, as for a module no longer connected. */
  readonly mapRefused?: () => boolean;
  /** Each answer of GetSkillMap in turn, the last for the rest; throwing makes it fail. */
  readonly skillMaps?: (() => SkillMap)[];
  /** What SetModuleLevel answers; throwing makes it fail. */
  readonly setLevel?: (request: SetModuleLevelRequest) => LevelSet | Promise<LevelSet>;
  /** What GetProgress and ListConnectedModules answer only once it is given. */
  readonly lists?: Promise<void>;
  /** What GetSkillMap answers only once it is given. */
  readonly map?: Promise<void>;
}

type SkillMap = MessageInitShape<typeof GetSkillMapResponseSchema>;
type LevelSet = MessageInitShape<typeof SetModuleLevelResponseSchema>;

/** The section at the route of the hash, as AccountGate shows it. */
function Section({ device }: { readonly device: Device }) {
  return (
    <AdultSection
      route={useRoute()}
      device={device}
      profiles={[OWNER]}
      onSaved={() => {}}
      onFailed={() => {}}
      onEraseAll={async () => "erased"}
      onLegal={() => {}}
    />
  );
}

function renderSection(setup: Setup = {}, language: Language = "en") {
  const { device } = memoryDevice();
  const progress: GetProgressRequest[] = [];
  const maps: GetSkillMapRequest[] = [];
  const levels: SetModuleLevelRequest[] = [];
  const skillMaps = [...(setup.skillMaps ?? [])];
  const pages = Object.fromEntries(
    Object.entries(setup.pages ?? { "": [() => FIRST], "page-2": [() => SECOND] }).map(
      ([token, answers]) => [token, [...answers]],
    ),
  );
  const routes = (router: ConnectRouter) => {
    router.service(ProgressService, {
      async getProgress(request) {
        progress.push(request);
        await setup.lists;
        const answers = pages[request.pageToken] ?? [];
        const answer = answers.length > 1 ? answers.shift() : answers[0];
        return answer?.() ?? {};
      },
      async getSkillMap(request) {
        maps.push(request);
        await setup.map;
        if (setup.mapRefused?.() === true) {
          throw new ConnectError("refused", Code.NotFound, undefined, [
            { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.NOT_FOUND }) },
          ]);
        }
        const next = skillMaps.length > 1 ? skillMaps.shift() : skillMaps[0];
        return next?.() ?? { packageDigest: D1, skills: [{ skill: "counting", evidenceCount: 2 }] };
      },
      setModuleLevel(request) {
        levels.push(request);
        return setup.setLevel?.(request) ?? {};
      },
    });
    router.service(ModuleService, {
      listConnectedModules: async () => {
        await setup.lists;
        if (setup.connected === "fail") throw new ConnectError("down", Code.Unavailable);
        return {
          modules: setup.connected ?? [
            { moduleId: PHYSICS, packageDigest: D2 },
            { moduleId: MATHS, packageDigest: D1 },
            { moduleId: "novatrail/gone", packageDigest: "" },
          ],
        };
      },
    });
    router.service(PackageService, {
      getManifest: (request) => ({ manifest: view(MANIFESTS[request.packageDigest]) }),
      getSkillGraph: (request) =>
        request.packageDigest === D1 || request.packageDigest === D3
          ? { skillGraph: view(GRAPH), skillTiers: { counting: 1 } }
          : {},
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
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <Section device={device} />
        </PackagesProvider>
      </ApiProvider>,
      language,
    ),
  );
  return { progress, maps, levels };
}

/** From the section's first page to the profile's progress. */
async function openProgress(name = "See the progress"): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: /^(Profile|Профиль): Ёжик$/ }));
  await userEvent.click(await screen.findByRole("button", { name }));
}

/** What a card's terms say, term by term. */
function termsOf(card: HTMLElement): Record<string, string> {
  const terms: Record<string, string> = {};
  for (const term of card.querySelectorAll("dt")) {
    terms[term.textContent ?? ""] = term.nextElementSibling?.textContent ?? "";
  }
  return terms;
}

const when = (date: Date, language: Language = "en") =>
  dateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(date);

afterEach(() => {
  window.location.hash = "";
});

describe("the progress of a profile", () => {
  it("opens from the profile's page, with the traps that repeat and the attempts, each with why it was given", async () => {
    window.location.hash = "#/adults";
    const { progress } = renderSection();
    await userEvent.click(screen.getByRole("button", { name: "Profile: Ёжик" }));
    const open = await screen.findByRole("button", { name: "See the progress" });
    expect(open).toHaveAccessibleDescription(
      "The skill maps, the attempts with why each task was given, and the traps that repeat",
    );
    await userEvent.click(open);
    expect(window.location.hash).toBe("#/adults/progress");
    expect(await screen.findByRole("heading", { level: 1, name: "Progress: Ёжик" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to the section" })).toBeTruthy();

    // The traps of the first page, in the language of their module.
    const traps = within(await screen.findByRole("region", { name: "Traps that repeat" }));
    const [first, second] = traps.getAllByRole("article") as [HTMLElement, HTMLElement];
    const heading = within(first).getByRole("heading", { level: 3, name: "Counts one too many" });
    expect(heading.lang).toBe("en");
    expect(termsOf(first)).toEqual({
      Module: "Olympiad maths",
      Advice: "Count the gaps, not the posts",
      "Found in": "3 closed attempts",
      "Last time": when(CLOSED),
    });
    expect(within(second).getByRole("heading", { level: 3, name: "Мешает единицы" }).lang).toBe(
      "ru",
    );
    expect(termsOf(second)).toEqual({ Module: "Физика", "Found in": "2 closed attempts" });

    // The attempts, newest first, as api gives them.
    const attempts = within(screen.getByRole("region", { name: "Attempts" }));
    const cards = attempts.getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "Task counting-gaps-3",
      "Task counting-gaps-2",
      "Task levers-1",
    ]);
    const [correct, lesson, open3] = cards as [HTMLElement, HTMLElement, HTMLElement];
    expect(termsOf(correct)).toEqual({
      Module: "Olympiad maths",
      Version: "1.2.0",
      Outcome: "Answered correctly at the first answer",
      "Wrong answers": "0",
      Begun: when(BEGUN),
      Closed: when(CLOSED),
      "Why it was given": "Consolidation: after a wrong answer, another task on the same skill",
      Chosen: when(CHOSEN),
    });
    expect(termsOf(lesson)).toMatchObject({
      Lesson: "counting-first-steps",
      Version: "1.1.0",
      Outcome: "Solution shown",
      "Wrong answers": "4",
      "Why its lesson was given":
        "The learner chose the skill on the skill map, and the program the task or lesson on it",
    });
    expect(termsOf(open3)).toEqual({
      Module: "Физика",
      Version: "0.3.0",
      Outcome: "Still going",
      "Wrong answers": "1",
      Begun: when(BEGUN),
      "Why it was given": "The learner began it again: the program chose nothing",
    });
    expect(within(open3).getByText("Физика").lang).toBe("ru");
    expect(progress).toEqual([expect.objectContaining({ profileId: "p1", pageToken: "" })]);
  });

  it("names a lesson by its title and a solved attempt's skills, in the module's language, and a lesson with no title by its ID", async () => {
    const page: Page = {
      attempts: [
        {
          task: `${PHYSICS}/task/levers-2`,
          moduleVersion: "0.3.0",
          lesson: `${PHYSICS}/lesson/levers-first`,
          lessonTitle: "Рычаги",
          closeReason: CloseReason.CORRECT,
          wrongAnswers: 1,
          skillTitles: ["Плечо силы", "Момент", "Равновесие"],
        },
        {
          task: `${MATHS}/task/counting-gaps-5`,
          moduleVersion: "1.2.0",
          lesson: `${MATHS}/lesson/counting-first-steps`,
          closeReason: CloseReason.DONE,
          skillTitles: ["Counting gaps"],
        },
        // Skills api should not send beside an attempt not solved, and a solved one with none.
        {
          task: `${MATHS}/task/counting-gaps-6`,
          moduleVersion: "1.2.0",
          closeReason: CloseReason.LEFT,
          skillTitles: ["Counting gaps"],
        },
        {
          task: `${MATHS}/task/counting-gaps-7`,
          moduleVersion: "1.2.0",
          closeReason: CloseReason.SOLUTION_SHOWN,
        },
      ],
    };
    const skills = ["Плечо силы", "Момент", "Равновесие"];
    for (const language of ["en", "ru"] as const) {
      window.location.hash = "#/adults";
      renderSection({ pages: { "": [() => page] } }, language);
      await openProgress(language === "en" ? "See the progress" : "Посмотреть прогресс");
      const attempts = within(
        await screen.findByRole("region", { name: language === "en" ? "Attempts" : "Попытки" }),
      );
      const [titled, untitled, left, shown] = attempts.getAllByRole("article") as [
        HTMLElement,
        HTMLElement,
        HTMLElement,
        HTMLElement,
      ];
      const [lesson, trained] = language === "en" ? ["Lesson", "Skills"] : ["Урок", "Навыки"];
      const dd = (card: HTMLElement, term: string) =>
        [...card.querySelectorAll("dt")].find((dt) => dt.textContent === term)
          ?.nextElementSibling as HTMLElement;
      // The titles in the module's language, once its manifest has named it; the list in the
      // screen's language, each title in the module's.
      await vi.waitFor(() => expect(dd(titled, lesson).lang).toBe("ru"));
      expect(termsOf(titled)).toMatchObject({
        [lesson]: "Рычаги",
        [trained]: listFormat(language).format(skills),
      });
      const list = dd(titled, trained);
      expect(list.lang).toBe("");
      expect(
        [...list.querySelectorAll("span")].map((span) => [span.lang, span.textContent]),
      ).toEqual(skills.map((skill) => ["ru", skill]));
      // No title: the lesson by its ID, in no language of the module's.
      expect(termsOf(untitled)).toMatchObject({
        [lesson]: "counting-first-steps",
        [trained]: "Counting gaps",
      });
      expect(dd(untitled, lesson).lang).toBe("");
      expect(dd(untitled, trained).querySelector("span")?.lang).toBe("en");
      expect(termsOf(left)[trained]).toBeUndefined();
      expect(termsOf(shown)[trained]).toBeUndefined();
      cleanup();
    }
  });

  it("shows the next page on Show more, with the focus on its first attempt, an unknown code in the common words, and no traps of it", async () => {
    window.location.hash = "#/adults";
    const { progress } = renderSection();
    await openProgress();
    const attempts = within(await screen.findByRole("region", { name: "Attempts" }));
    await userEvent.click(attempts.getByRole("button", { name: "Show more" }));
    const next = await attempts.findByRole("heading", { level: 3, name: "Task counting-gaps-1" });
    await vi.waitFor(() => expect(document.activeElement).toBe(next));
    expect(progress.map((request) => request.pageToken)).toEqual(["", "page-2"]);
    const cards = attempts.getAllByRole("article");
    expect(cards).toHaveLength(5);
    const [left, odd] = cards.slice(3) as [HTMLElement, HTMLElement];
    expect(termsOf(left)).toMatchObject({
      Outcome: "Left: another task was begun",
      "Why it was given": "This version of the app doesn't know this yet",
    });
    // An ID that is no full ID shows as it is, and a close reason this build does not know too.
    expect(within(odd).getByRole("heading").textContent).toBe("Task not-a-full-id");
    expect(termsOf(odd)).toMatchObject({
      Outcome: "This version of the app doesn't know this yet",
      "Why it was given":
        "In rotation: a skill given before comes round again, the one not given for longest first",
    });
    expect(termsOf(odd).Module).toBeUndefined();
    // The last page: no more to show; the traps are the first page's.
    expect(attempts.queryByRole("button", { name: "Show more" })).toBeNull();
    const traps = within(screen.getByRole("region", { name: "Traps that repeat" }));
    expect(traps.getAllByRole("article")).toHaveLength(2);
    expect(traps.queryByText("Late")).toBeNull();
  });

  it("leaves the focus on the last attempt when the next page brings none", async () => {
    window.location.hash = "#/adults";
    renderSection({ pages: { "": [() => FIRST], "page-2": [() => ({})] } });
    await openProgress();
    const attempts = within(await screen.findByRole("region", { name: "Attempts" }));
    await userEvent.click(attempts.getByRole("button", { name: "Show more" }));
    await vi.waitFor(() =>
      expect(attempts.queryByRole("button", { name: "Show more" })).toBeNull(),
    );
    const headings = attempts.getAllByRole("heading", { level: 3 });
    expect(headings).toHaveLength(3);
    await vi.waitFor(() => expect(document.activeElement).toBe(headings.at(-1)));
  });

  it("leaves the focus on the attempts' heading when neither page brings any", async () => {
    window.location.hash = "#/adults";
    renderSection({ pages: { "": [() => ({ nextPageToken: "page-2" })], "page-2": [() => ({})] } });
    await openProgress();
    const region = await screen.findByRole("region", { name: "Attempts" });
    await userEvent.click(within(region).getByRole("button", { name: "Show more" }));
    const heading = within(region).getByRole("heading", { level: 2, name: "Attempts" });
    await vi.waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("says what a next page that did not come came to, and asks for the same page again", async () => {
    window.location.hash = "#/adults";
    let down = true;
    const { progress } = renderSection({
      pages: {
        "": [() => FIRST],
        "page-2": [
          () => {
            if (down) throw new ConnectError("down", Code.Unavailable);
            return SECOND;
          },
        ],
      },
    });
    await openProgress();
    const attempts = within(await screen.findByRole("region", { name: "Attempts" }));
    const more = attempts.getByRole("button", { name: "Show more" });
    await userEvent.click(more);
    expect((await attempts.findByRole("alert")).textContent).toBe("No connection");
    expect(attempts.getAllByRole("article")).toHaveLength(3);
    down = false;
    await userEvent.click(more);
    await attempts.findByRole("heading", { level: 3, name: "Task counting-gaps-1" });
    expect(attempts.queryByRole("alert")).toBeNull();
    // The client's own retries asked for the second page more than once; the token was its own.
    expect(new Set(progress.map((request) => request.pageToken))).toEqual(new Set(["", "page-2"]));
    expect(progress.at(-1)?.pageToken).toBe("page-2");
  });

  it("says when there is nothing yet, and what a first page that did not come came to, with its retry", async () => {
    window.location.hash = "#/adults";
    let down = true;
    renderSection({
      pages: {
        "": [
          () => {
            if (down) throw new ConnectError("down", Code.Unavailable);
            return {};
          },
        ],
      },
      connected: [],
    });
    await openProgress();
    // What the first page came to stands under the attempts' heading, not the maps'.
    const failed = within(await screen.findByRole("region", { name: "Attempts" }));
    expect((await failed.findByRole("alert")).textContent).toBe("No connection");
    down = false;
    await userEvent.click(failed.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("No trap repeats yet")).toBeTruthy();
    expect(screen.getByText("No attempts yet")).toBeTruthy();
    expect(screen.getByText("No subjects are connected yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("stands with the shapes of its maps, traps and attempts while they are read, under their headings", async () => {
    window.location.hash = "#/adults";
    const { given, give } = held();
    renderSection({ lists: given });
    await openProgress();
    for (const name of ["Skill maps", "Traps that repeat", "Attempts"]) {
      expectLoading(await screen.findByRole("region", { name }), 4);
    }
    give();
    expect(await screen.findAllByRole("article")).not.toHaveLength(0);
    await vi.waitFor(() => expectLoaded(document));
  });

  it("stands with the shapes of a map while it is read, its way back as it is", async () => {
    window.location.hash = "#/adults";
    const { given, give } = held();
    renderSection({ map: given });
    await openProgress();
    const region = within(await screen.findByRole("region", { name: "Skill maps" }));
    const [, maths] = await region.findAllByRole("article");
    await userEvent.click(
      within(maths as HTMLElement).getByRole("button", { name: "Open the map" }),
    );
    expect(await screen.findByRole("button", { name: "Back to the progress" })).toBeTruthy();
    expectLoading(document, 9);
    give();
    await vi.waitFor(() => expect(document.querySelector("novatrail-skill-map")).not.toBeNull());
    expectLoaded(document);
  });

  it("opens a module's map in the adult's view, by an adult's action, and leads back", async () => {
    window.location.hash = "#/adults";
    const { maps } = renderSection();
    await openProgress();
    const region = within(await screen.findByRole("region", { name: "Skill maps" }));
    const cards = await region.findAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual([
      "novatrail/gone",
      "Olympiad maths",
      "Физика",
    ]);
    expect(within(cards[0] as HTMLElement).queryByRole("button")).toBeNull();
    await userEvent.click(
      within(cards[1] as HTMLElement).getByRole("button", { name: "Open the map" }),
    );
    expect(window.location.hash).toBe(`#/adults/progress/${encodeURIComponent(MATHS)}`);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Skill map: Olympiad maths" }),
    ).toBeTruthy();
    const element = await vi.waitFor(() => {
      const found = document.querySelector<NovatrailSkillMap>("novatrail-skill-map");
      if (found === null) throw new Error("no map yet");
      return found;
    });
    expect(element.getAttribute("view")).toBe("adult");
    expect(element.getAttribute("lang")).toBe("en");
    expect(element.getAttribute("heading-level")).toBe("2");
    expect(maps).toEqual([
      expect.objectContaining({ profileId: "p1", moduleId: MATHS, action: Action.ADULT }),
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Back to the progress" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Progress: Ёжик" })).toBeTruthy();
  });

  it("says what a list of modules and a map that did not come came to, and reads the map again", async () => {
    window.location.hash = "#/adults";
    renderSection({ connected: "fail" });
    await openProgress();
    const region = within(await screen.findByRole("region", { name: "Skill maps" }));
    expect((await region.findByRole("alert")).textContent).toBe("No connection");
    // The rest of the progress does not wait for the list: the modules are named by their IDs.
    const attempts = within(screen.getByRole("region", { name: "Attempts" }));
    const [first] = attempts.getAllByRole("article") as [HTMLElement];
    expect(termsOf(first).Module).toBe(MATHS);

    cleanup();
    let refused = true;
    window.location.hash = "#/adults";
    const { maps } = renderSection({ mapRefused: () => refused });
    await openProgress();
    const cards = within(await screen.findByRole("region", { name: "Skill maps" }));
    await userEvent.click(
      within(await cards.findByRole("article", { name: "Olympiad maths" })).getByRole("button"),
    );
    expect(await screen.findByText("This isn't there any more")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Skill map" })).toBeTruthy();
    expect(maps).toHaveLength(1);
    refused = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(document.querySelector("novatrail-skill-map")).not.toBeNull());
    expect(maps).toHaveLength(2);
  });

  it("is in the device's language, and its reasons in Russian", async () => {
    window.location.hash = "#/adults";
    renderSection({}, "ru");
    await openProgress("Посмотреть прогресс");
    expect(await screen.findByRole("heading", { level: 1, name: "Прогресс: Ёжик" })).toBeTruthy();
    const attempts = within(await screen.findByRole("region", { name: "Попытки" }));
    const [correct] = attempts.getAllByRole("article") as [HTMLElement];
    expect(termsOf(correct)).toMatchObject({
      Итог: "Верно с первого ответа",
      "Неверных ответов": "0",
      Начата: when(BEGUN, "ru"),
      "Почему дана": "Закрепление: после ошибки — ещё задача на тот же навык",
    });
    const traps = within(screen.getByRole("region", { name: "Повторяющиеся ловушки" }));
    expect(termsOf(traps.getAllByRole("article")[0] as HTMLElement)).toMatchObject({
      "Найдена в": "3 закрытых попытках",
    });
  });

  it("goes to the first page with no profile chosen, and from a map of more parts", async () => {
    for (const hash of [
      "#/adults/progress",
      `#/adults/progress/${encodeURIComponent(MATHS)}`,
      "#/adults/progress/a/b",
    ]) {
      window.location.hash = hash;
      const { device } = memoryDevice();
      const { unmount } = render(
        inLanguage(
          <PackagesProvider
            value={{
              views: new OpenViews({ api: {} as never, device, stale: () => {} }),
              checks: {} as PackageChecks,
              files: new DeviceFiles({ api: "https://api.example.org", withdrawn: () => {} }),
            }}
          >
            <AdultSection
              route={routeOf(window.location.hash)}
              device={device}
              profiles={[OWNER]}
              onSaved={() => {}}
              onFailed={() => {}}
              onEraseAll={async () => "erased"}
              onLegal={() => {}}
            />
          </PackagesProvider>,
        ),
      );
      await vi.waitFor(() => expect(window.location.hash).toBe("#/adults"));
      unmount();
    }
  });
});

describe("the adult's correction of a module's level", () => {
  const SET = new Date(Date.UTC(2026, 10, 16, 12, 0));
  const at34 = (): SkillMap => ({ packageDigest: D1, levelBand: "g34" });
  const day = (date: Date, language: Language = "en") =>
    dateTimeFormat(language, { dateStyle: "long" }).format(date);

  /** From the section's first page to the map of olympiad maths, with its level drawn. */
  async function openMap(setup: Setup, language: Language = "en") {
    window.location.hash = "#/adults";
    const held = renderSection(setup, language);
    await openProgress(language === "en" ? "See the progress" : "Посмотреть прогресс");
    const cards = within(
      await screen.findByRole("region", {
        name: language === "en" ? "Skill maps" : "Карты навыков",
      }),
    );
    await userEvent.click(
      within(await cards.findByRole("article", { name: "Olympiad maths" })).getByRole("button"),
    );
    const region = within(
      await screen.findByRole("region", { name: language === "en" ? "Level" : "Уровень" }),
    );
    return { ...held, region };
  }

  it("names the band of the level and the bands next to it, and sets the one pressed", async () => {
    const { region, levels } = await openMap({
      skillMaps: [at34],
      setLevel: () => ({ levelBand: "g56", levelSetAt: timestampFromDate(SET) }),
    });
    expect(region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 3–4");
    expect(region.getByText("Grades 3–4")).toHaveAttribute("lang", "en");
    expect(region.queryByText(/set by an adult/)).toBeNull();
    expect(region.getByRole("button", { name: "Easier: Grades 1–2" })).toBeVisible();
    await userEvent.click(region.getByRole("button", { name: "Harder: Grades 5–6" }));
    expect(levels).toEqual([
      expect.objectContaining({ profileId: "p1", moduleId: MATHS, band: "g56" }),
    ]);
    await vi.waitFor(() =>
      expect(region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 5–6"),
    );
    // At the highest band there is no Harder, and the focus is on the line of the level.
    expect(region.queryByRole("button", { name: /^Harder/ })).toBeNull();
    expect(region.getByRole("button", { name: "Easier: Grades 3–4" })).toBeVisible();
    expect(region.getByText(/^The level:/)).toHaveFocus();
    expect(region.getByText(/set by an adult/)).toHaveTextContent(
      `The level was set by an adult on ${day(SET)}`,
    );
    const element = document.querySelector<NovatrailSkillMap>("novatrail-skill-map");
    expect(element?.skillMap?.levelBand).toBe("g56");
  });

  it("offers the lowest band alone as Harder while the level stands below it, in Russian too", async () => {
    const { region, levels } = await openMap(
      {
        skillMaps: [() => ({ packageDigest: D1, levelSetAt: timestampFromDate(SET) })],
        setLevel: () => ({ levelBand: "g12", levelSetAt: timestampFromDate(SET) }),
      },
      "ru",
    );
    expect(region.getByText(/^Уровень:/)).toHaveTextContent("Уровень: ниже, чем Grades 1–2");
    expect(region.getByText(/^Уровень поставил взрослый/)).toHaveTextContent(
      `Уровень поставил взрослый: ${day(SET, "ru")}`,
    );
    expect(region.queryByRole("button", { name: /^Проще/ })).toBeNull();
    await userEvent.click(region.getByRole("button", { name: "Сложнее: Grades 1–2" }));
    expect(levels.map((request) => request.band)).toEqual(["g12"]);
    await vi.waitFor(() =>
      expect(region.getByText(/^Уровень:/)).toHaveTextContent("Уровень: Grades 1–2"),
    );
    expect(region.queryByRole("button", { name: /^Проще/ })).toBeNull();
  });

  it("reads the map again when the band is no longer next, and offers the bands next to the level it gives", async () => {
    const { region, maps, levels } = await openMap({
      skillMaps: [at34, () => ({ packageDigest: D1, levelBand: "g56" })],
      setLevel: () => {
        throw new ConnectError("refused", Code.FailedPrecondition, undefined, [
          { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.BAND_NOT_NEXT }) },
        ]);
      },
    });
    await userEvent.click(region.getByRole("button", { name: "Easier: Grades 1–2" }));
    expect(levels.map((request) => request.band)).toEqual(["g12"]);
    expect(await region.findByText(/changed meanwhile/)).toHaveTextContent(
      "The level had changed meanwhile. It shows here as it stands now",
    );
    expect(region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 5–6");
    expect(region.getByRole("button", { name: "Easier: Grades 3–4" })).toBeVisible();
    expect(region.queryByRole("button", { name: /^Harder/ })).toBeNull();
    expect(maps).toHaveLength(2);
    expect(maps[1]).toMatchObject({ moduleId: MATHS, action: Action.ADULT });
  });

  it("reads the map of the new version in place when the module's version changed meanwhile", async () => {
    const { region, maps } = await openMap({
      skillMaps: [at34, () => ({ packageDigest: D3, levelBand: "g12" })],
      setLevel: () => {
        throw new ConnectError("refused", Code.FailedPrecondition, undefined, [
          { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.BAND_NOT_NEXT }) },
        ]);
      },
    });
    await userEvent.click(region.getByRole("button", { name: "Harder: Grades 5–6" }));
    expect(await region.findByText(/changed meanwhile/)).toBeVisible();
    expect(region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 1–2, new");
    expect(region.getByText(/^The level:/)).toHaveFocus();
    expect(region.getByRole("button", { name: "Harder: Grades 3–4, new" })).toBeVisible();
    expect(maps).toHaveLength(2);
    const element = document.querySelector<NovatrailSkillMap>("novatrail-skill-map");
    expect(element?.skillMap?.packageDigest).toBe(D3);
  });

  it("says what a correction or the map read after it came to, and takes no press meanwhile", async () => {
    let answer: (set: LevelSet) => void = () => {};
    const { region, levels } = await openMap({
      skillMaps: [at34],
      setLevel: () => new Promise<LevelSet>((resolve) => (answer = resolve)),
    });
    const harder = region.getByRole("button", { name: "Harder: Grades 5–6" });
    // Two presses before any render, from the DOM itself: one request.
    harder.click();
    harder.click();
    await vi.waitFor(() => expect(harder).toHaveAttribute("aria-disabled", "true"));
    // Playwright presses no button marked disabled: a press meanwhile comes from the DOM too.
    harder.click();
    await vi.waitFor(() => expect(levels).toHaveLength(1));
    answer({ levelBand: "g34" });
    await vi.waitFor(() => expect(harder).toHaveAttribute("aria-disabled", "false"));
    // The band of the level named again: it stays, with no adult's day to tell.
    expect(region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 3–4");
    expect(region.queryByText(/set by an adult/)).toBeNull();

    cleanup();
    const failing = await openMap({
      skillMaps: [at34],
      setLevel: () => {
        throw new ConnectError("refused", Code.NotFound, undefined, [
          { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.NOT_FOUND }) },
        ]);
      },
    });
    await userEvent.click(failing.region.getByRole("button", { name: "Easier: Grades 1–2" }));
    expect(await failing.region.findByRole("alert")).toHaveTextContent("This isn't there any more");

    cleanup();
    const unread = await openMap({
      skillMaps: [
        at34,
        () => {
          throw new ConnectError("down", Code.Unavailable);
        },
      ],
      setLevel: () => {
        throw new ConnectError("refused", Code.FailedPrecondition, undefined, [
          { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.BAND_NOT_NEXT }) },
        ]);
      },
    });
    await userEvent.click(unread.region.getByRole("button", { name: "Easier: Grades 1–2" }));
    expect(await unread.region.findByRole("alert")).toHaveTextContent("No connection");
    expect(unread.region.getByText(/^The level:/)).toHaveTextContent("The level: Grades 3–4");
  });

  it("shows the day an adult set the level when the manifest does not name its band", async () => {
    window.location.hash = "#/adults";
    renderSection({
      skillMaps: [
        () => ({ packageDigest: D1, levelBand: "g78", levelSetAt: timestampFromDate(SET) }),
      ],
    });
    await openProgress();
    const cards = within(await screen.findByRole("region", { name: "Skill maps" }));
    await userEvent.click(
      within(await cards.findByRole("article", { name: "Olympiad maths" })).getByRole("button"),
    );
    expect(await screen.findByText(/^The level was set by an adult/)).toHaveTextContent(
      `The level was set by an adult on ${day(SET)}`,
    );
    expect(screen.queryByRole("region", { name: "Level" })).toBeNull();
  });

  it("shows no level for a module whose manifest has no bands", async () => {
    window.location.hash = "#/adults";
    renderSection({ skillMaps: [() => ({ packageDigest: D2, levelBand: "g34" })] });
    await openProgress();
    const cards = within(await screen.findByRole("region", { name: "Skill maps" }));
    await userEvent.click(
      within(await cards.findByRole("article", { name: "Физика" })).getByRole("button"),
    );
    expect(
      await screen.findByRole("heading", { level: 1, name: "Skill map: Физика" }),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Level" })).toBeNull();
  });
});
