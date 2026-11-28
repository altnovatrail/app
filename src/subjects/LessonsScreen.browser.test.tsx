// The lessons of a module, `#/lessons/<module>`: its title, how many are passed, its lessons in the
// author's order with those side by side in one group, each row's state and "Next" on the tile's
// lesson; a press opens its run begun or else the lesson by its ID in the player; "Home" goes back;
// a failure offers to try again, and the route with more parts than a module goes Home.
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  LearningService,
  LessonState,
  type ListLessonsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import {
  GetManifestResponseSchema,
  PackageService,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { LESSONS } from "../app/router.ts";
import { type LessonOpen, LessonProvider, useLessons } from "../lesson/LessonContext.tsx";
import { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { LessonsRoute } from "./LessonsScreen.tsx";

const MATH = "novatrail/olympiad-math";
const D1 = `sha256:${"1".repeat(64)}`;
const BEGUN = `${MATH}/lesson/patterns`;

const MANIFEST = {
  module_format_version: "0.4",
  id: MATH,
  version: "1.0.0",
  title: "Olympiad maths",
  languages: { explanation: "en" },
};

const LESSONS_GIVEN: MessageInitShape<typeof ListLessonsResponseSchema> = {
  lessons: [
    {
      lesson: `${MATH}/lesson/counting`,
      title: "Counting on",
      segments: 3,
      group: 0,
      state: LessonState.PASSED,
    },
    {
      lesson: BEGUN,
      title: "Number patterns",
      segments: 4,
      group: 1,
      state: LessonState.OPEN,
      endedSegments: [1],
    },
    { lesson: `${MATH}/lesson/days`, title: "Days and cycles", segments: 4, group: 2 },
    { lesson: `${MATH}/lesson/areas`, title: "Areas of shapes", segments: 3, group: 2 },
  ],
  tileLesson: BEGUN,
};

/** Shows what the player would open, as the route `#/lesson` takes it. */
function Chosen() {
  const chosen: LessonOpen | undefined = useLessons()?.chosen;
  return <output aria-label="chosen">{chosen === undefined ? "" : JSON.stringify(chosen)}</output>;
}

function show(
  parts: string[],
  lessons: () => MessageInitShape<typeof ListLessonsResponseSchema> = () => LESSONS_GIVEN,
) {
  // An empty hash is Home already: the page stands at its own.
  window.location.hash = `#/lessons/${parts.join("/")}`;
  const { device } = memoryDevice();
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, { listLessons: () => lessons() });
    router.service(ModuleService, {
      listConnectedModules: () => ({ modules: [{ moduleId: MATH, packageDigest: D1 }] }),
    });
    router.service(PackageService, {
      getManifest: () =>
        create(GetManifestResponseSchema, {
          manifest: {
            json: new TextEncoder().encode(JSON.stringify(MANIFEST)),
            moduleFormatVersion: "0.4",
          },
        }),
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
    pseudonym: "Sam",
    openLessonRuns: [{ lessonRunId: "run-1", lesson: BEGUN, packageDigest: D1 }],
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <LessonProvider learner={learner}>
            <LessonsRoute route={{ screen: LESSONS.screen, parts }} profileId="p1" />
            <Chosen />
          </LessonProvider>
        </PackagesProvider>
      </ApiProvider>,
    ),
  );
}

/** What the player would open, as the probe shows it. */
function chosen(): unknown {
  const text = screen.getByRole("status", { name: "chosen" }).textContent ?? "";
  return text === "" ? undefined : JSON.parse(text);
}

afterEach(() => {
  window.location.hash = "";
});

describe("the lessons of a module", () => {
  it("lists them in the author's order and groups, each with its state, the tile's marked", async () => {
    show([MATH]);
    expect(
      await screen.findByText("In the author's order, top to bottom · 1 of 4 passed"),
    ).toBeVisible();
    expect(screen.getByText("Olympiad maths", { selector: "span" })).toHaveAttribute("lang", "en");
    const any = screen.getByRole("region", { name: "Lessons in any order" });
    expect(within(any).getAllByRole("button")).toHaveLength(2);
    const begun = screen.getByRole("button", { name: /^Number patterns/ });
    expect(within(begun).getByText("Step 2 of 4")).toBeVisible();
    expect(within(begun).getByText("Next")).toBeVisible();
    expect(screen.getByRole("button", { name: /^Counting on/ })).not.toHaveTextContent("Next");
  });

  it("opens the lesson begun by its run, and a new one by its ID", async () => {
    show([MATH]);
    await userEvent.click(await screen.findByRole("button", { name: /^Number patterns/ }));
    expect(window.location.hash).toBe("#/lesson");
    expect(chosen()).toMatchObject({ kind: "run", run: { lessonRunId: "run-1" } });
    await userEvent.click(screen.getByRole("button", { name: /^Days and cycles/ }));
    await waitFor(() =>
      expect(chosen()).toEqual({ kind: "lesson", lesson: `${MATH}/lesson/days` }),
    );
  });

  it("goes Home by its way back", async () => {
    show([MATH]);
    await userEvent.click(await screen.findByRole("button", { name: "Home" }));
    expect(window.location.hash).toBe("#/home");
  });

  it("says when the module has no lessons, and offers to try again on a failure", async () => {
    let calls = 0;
    show([MATH], () => {
      calls += 1;
      if (calls === 1) throw new ConnectError("down", Code.Internal);
      return {};
    });
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("This module has no lessons for you")).toBeVisible();
  });

  it("goes Home in its own place with more parts than a module", async () => {
    show([MATH, "more"]);
    await waitFor(() => expect(window.location.hash).toBe("#/home"));
  });
});
