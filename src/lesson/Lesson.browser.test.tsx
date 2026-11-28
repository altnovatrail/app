// The lesson player in the browser, with the canvas element itself: the path of the
// lesson of the format's example, gaps-and-posts — an explanation with its picture and list, a
// worked example and its demo, a task of the run and an explanation —, a task segment that begins
// no attempt while the lessons are remade, the place after a restart and on another device, the
// bar, the task left, and every end of a run — with api
// on connect-es's router and the storage on the device's memory. The lessons are synthetic, after
// the format's examples.
import "@altnovatrail/canvas";
import {
  Cause,
  ChoiceKind,
  EndedSegmentsSchema,
  type Refusal,
  RefusalSchema,
  RunEndReason,
  RunEndSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type BeginAttemptRequest,
  type CompleteLessonRequest,
  LearningService,
  LessonState,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import type { CanvasElement, DemoState } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { KeyHolder } from "../ownkey/holder.ts";
import { KeyHolderProvider } from "../ownkey/OwnKeyContext.tsx";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import { OpenViews } from "../packages/views.ts";
import type { Device } from "../storage/device.ts";
import { addProfile, openProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { expectLoaded, expectLoading, held } from "../test/loading.ts";
import { Lesson } from "./Lesson.tsx";
import type { LessonOpen, RunRef } from "./LessonContext.tsx";

// The tablet's layout, where the row stands beside the open panel: on a phone its sheet hides the row.
beforeEach(async () => {
  await page.viewport(1194, 834);
});

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const MANIFEST: open.Manifest = {
  module_format_version: "0.4",
  id: "example/with-lessons",
  version: "1.0.0",
  title: "With lessons",
  subject: "mathematics",
  audience: { age_categories: ["adult"] },
  languages: { explanation: "en" },
  authors: [{ name: "NovaTrail" }],
  license: "Apache-2.0",
};

const GAPS_ID = "example/with-lessons/lesson/gaps-and-posts";
const NEXT_ID = "example/with-lessons/lesson/rows";

/** The lesson of the format's example gaps-and-posts.yaml, shortened. */
const GAPS: open.Lesson = {
  id: "gaps-and-posts",
  title: "Gaps and posts",
  segments: [
    {
      explanation: [
        { text: "A fence has posts and gaps between them." },
        {
          picture: "fence-posts-and-gaps.png",
          alt: "A fence of four posts",
          width: 400,
          height: 100,
        },
        { numbered_list: ["Count the gaps.", "Add one for the posts."] },
      ],
    },
    {
      worked_example: {
        statement: [{ text: "A path is 20 m long, with a tree every 5 m. How many trees?" }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        demo: [
          { text: "20 ÷ 5 = 4 gaps." },
          { text: "One tree more than gaps." },
          { text: "5 trees." },
        ],
      },
    },
    { task: "gaps-ladder-1" },
    { explanation: [{ text: "Each time, count the gaps first." }] },
  ],
};

/** The lesson of remainders-on-a-workbook.yaml: a worked example on a workbook, then its task. */
const REMAINDERS: open.Lesson = {
  id: "remainders",
  title: "Remainders",
  segments: [
    {
      worked_example: {
        statement: [{ text: "Share 23 sweets among 4 children." }],
        canvas: { kind: "workbook" },
        lines: [
          {
            line: [
              { text: "23 ÷ 4 =" },
              { binding: "box", value: "5" },
              { text: "r" },
              { binding: "box", value: "3" },
            ],
          },
        ],
        demo: [
          { text: "4 × 5 = 20." },
          { fill: { line: 1, box: 1 } },
          { fill: { line: 1, box: 2 } },
        ],
      },
    },
    { task: "remainders-1" },
  ],
};

function refused(code: Code, cause: Cause, data?: Refusal["data"]): ConnectError {
  const refusal = create(RefusalSchema, { cause, ...(data === undefined ? {} : { data }) });
  return new ConnectError("refused", code, undefined, [{ desc: RefusalSchema, value: refusal }]);
}

const runEnded = (reason: RunEndReason) =>
  refused(Code.FailedPrecondition, Cause.RUN_ENDED, {
    case: "runEnd",
    value: create(RunEndSchema, { reason }),
  });

const endedSegments = (cause: Cause, places: number[]) =>
  refused(Code.FailedPrecondition, cause, {
    case: "endedSegments",
    value: create(EndedSegmentsSchema, { places }),
  });

interface Setup {
  readonly lesson?: open.Lesson;
  /** The task segments that ended, as api keeps them. */
  readonly ended?: number[];
  /** Throws in place of the run, by the count of the reads before. */
  readonly run?: (reads: number) => void;
  /** What the player opens; the run r1 when left out. */
  readonly open?: LessonOpen;
  /** The package has no manifest api gives. */
  readonly noManifest?: boolean;
  /** "Lesson done" answers with no end. */
  readonly noEnd?: boolean;
  /** The engine's choice the end of the run gives. */
  readonly endChoice?: { choiceId: string; kind: ChoiceKind };
  /** The module's lessons do not come. */
  readonly noLessons?: boolean;
  /** The run comes without its lesson. */
  readonly noLesson?: boolean;
  /** Throws in place of "lesson done", once for each call it is given. */
  readonly complete?: (request: CompleteLessonRequest) => void;
  readonly device?: Device;
  /** The state of the lesson the device keeps. */
  readonly kept?: { place: number; demo?: Record<number, unknown>; passageId?: string };
  /** The profile's database does not open. */
  readonly noDatabase?: boolean;
  /** The owner's own key is held for p1. */
  readonly ownKey?: boolean;
  /** What the run's reads answer only once it is given. */
  readonly runHeld?: Promise<void>;
}

const RUN: RunRef = { lessonRunId: "r1", lesson: GAPS_ID, packageDigest: D1 };

async function renderLesson(setup: Setup = {}) {
  const device = setup.device ?? memoryDevice().device;
  if (setup.device === undefined) await setAccount(device, "account-1");
  if (setup.noDatabase === true) {
    const connect = device.connect.bind(device);
    device.connect = (name, schema, create) =>
      name.startsWith("novatrail-profile-")
        ? Promise.resolve(undefined)
        : connect(name, schema, create);
  }
  const lesson = setup.lesson ?? GAPS;
  const id = `example/with-lessons/lesson/${lesson.id}`;
  if (setup.kept !== undefined) {
    const profile = await addProfile(device, "p1");
    await profile?.saveLesson({
      lessonId: id,
      digest: D1,
      passageId: setup.kept.passageId ?? "r1",
      view: lesson,
      place: setup.kept.place,
      demo: (setup.kept.demo ?? {}) as Record<number, DemoState>,
    });
  }
  const ended = [...(setup.ended ?? [])];
  const asked: string[] = [];
  // The provider each request that may give a choice named, by the request: "" on platform AI.
  const providers: string[] = [];
  const begun: BeginAttemptRequest[] = [];
  let reads = 0;
  const runOf = () => ({
    lessonRunId: "r1",
    ...(setup.noLesson === true
      ? {}
      : { lesson: { json: encode(lesson), moduleFormatVersion: "0.4" } }),
    packageDigest: D1,
    endedSegments: [...ended],
  });
  const routes = (router: ConnectRouter) => {
    router.service(LearningService, {
      async getLessonRun(request) {
        asked.push(`run ${request.lessonRunId}`);
        await setup.runHeld;
        providers.push(`run ${request.ownKeyProvider}`);
        setup.run?.(reads++);
        return { run: runOf() };
      },
      openLesson(request) {
        asked.push(`open lesson ${request.choiceId}`);
        providers.push(`open ${request.ownKeyProvider}`);
        setup.run?.(reads++);
        return { run: runOf() };
      },
      // The module's lessons: this one, then one not begun, the next at its end.
      listLessons: () => {
        if (setup.noLessons === true) throw new ConnectError("down", Code.Internal);
        return {
          lessons: [
            { lesson: GAPS_ID, title: "Gaps", segments: 5, state: LessonState.OPEN },
            { lesson: NEXT_ID, title: "Rows", segments: 3, group: 1, state: LessonState.NEW },
          ],
          tileLesson: GAPS_ID,
        };
      },
      completeLesson(request) {
        asked.push("lesson done");
        providers.push(`done ${request.ownKeyProvider}`);
        setup.complete?.(request);
        return setup.noEnd === true
          ? {}
          : {
              end: {
                reason: RunEndReason.PASSED,
                ...(setup.endChoice === undefined ? {} : { choice: setup.endChoice }),
              },
            };
      },
      // No task segment begins an attempt while the lessons are remade.
      beginAttempt(request) {
        begun.push(request);
        return {};
      },
    });
    router.service(PackageService, {
      getManifest: () =>
        setup.noManifest === true
          ? {}
          : { manifest: { json: encode(MANIFEST), moduleFormatVersion: "0.4" } },
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const check = vi.fn(async () => {});
  const picture = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: { check } as unknown as PackageChecks,
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn: () => {},
      fetch: async () => new Response(picture),
    }),
  };
  const began: RunRef[] = [];
  const endedRuns: string[] = [];
  const holder = new KeyHolder({
    read: async () =>
      setup.ownKey === true
        ? { provider: "anthropic", name: "Anthropic", key: "sk-ant-synthetic-0000", last4: "0000" }
        : undefined,
    keep: async () => "saved",
    drop: async () => {},
  });
  await holder.open("p1");
  const rendered = render(
    inLanguage(
      <ApiProvider value={api}>
        <KeyHolderProvider holder={holder}>
          <PackagesProvider value={packages}>
            <Lesson
              profileId="p1"
              open={setup.open ?? { kind: "run", run: RUN }}
              device={device}
              onBegan={(run) => began.push(run)}
              onEnded={(runId) => endedRuns.push(runId)}
            />
          </PackagesProvider>
        </KeyHolderProvider>
      </ApiProvider>,
    ),
  );
  /** The state of the lesson the device keeps now. */
  const kept = async () => {
    const profile = await openProfile(device, "p1");
    return profile?.readLesson(id, D1, "r1");
  };
  return {
    device,
    asked,
    providers,
    begun,
    check,
    began,
    endedRuns,
    kept,
    unmount: rendered.unmount,
  };
}

/** The segments, in their pop-over, which the line under the lesson's title opens if it is shut. */
async function segments() {
  if (screen.queryByRole("dialog", { name: "Segments of the lesson" }) === null) {
    await userEvent.click(
      screen.getByRole("button", { name: /: segments of the lesson$/ }) as HTMLElement,
    );
  }
  const dialog = await screen.findByRole("dialog", { name: "Segments of the lesson" });
  return within(within(dialog).getByRole("navigation"));
}
const chip = async (n: number) => (await segments()).getAllByRole("button")[n - 1] as HTMLElement;
/** The segments' pop-over shut by Escape, the focus back on its line. */
const shut = () => userEvent.keyboard("{Escape}");
const continueButton = () => screen.findByRole("button", { name: "Continue" });
const canvas = () => document.querySelector("novatrail-canvas") as CanvasElement;

/** A button of the element's own row, by its label. */
async function canvasButton(label: string): Promise<HTMLButtonElement> {
  let found: HTMLButtonElement | undefined;
  await waitFor(() => {
    const buttons = [...(canvas().shadowRoot?.querySelectorAll("button") ?? [])];
    found = buttons.find((button) => button.textContent?.trim() === label) as
      | HTMLButtonElement
      | undefined;
    expect(found).toBeDefined();
  });
  return found as HTMLButtonElement;
}
const REMADE = "This task is being remade with the lessons";

describe("the lesson player", () => {
  it("walks the lesson of the format's example: explanation, worked example, and a task being remade", async () => {
    const { begun, kept, asked, endedRuns, began } = await renderLesson();
    const title = await screen.findByRole("heading", { level: 1, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toHaveAttribute("lang", "en");
    expect(began).toEqual([RUN]);
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");
    // The explanation: its paragraph, its picture by an address blob: and its numbered list.
    expect(
      screen.getByText("A fence has posts and gaps between them.").closest("[lang]"),
    ).toHaveAttribute("lang", "en");
    const picture = await screen.findByRole("img", { name: "A fence of four posts" });
    expect(picture.getAttribute("src")).toMatch(/^blob:/);
    const list = screen.getByText("Count the gaps.").closest("ol") as HTMLOListElement;
    expect(
      within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Count the gaps.", "Add one for the posts."]);
    // The bar: the chip shown in bold and current, the others later, none passed yet.
    expect((await segments()).getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    expect(await chip(1)).toHaveAccessibleName("1 Explanation now");
    expect(await chip(2)).toHaveAccessibleName("2 Worked example Not open yet");
    expect(await chip(3)).toHaveAccessibleName("3 Task Not open yet");
    expect(await chip(3)).toHaveAttribute("aria-disabled", "true");
    expect((await kept())?.place).toBe(1);
    // The chip shown goes nowhere.
    await userEvent.click(await chip(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");

    // The worked example: a new element, its demo from the beginning; Continue stands at once.
    expect((await continueButton()).closest("novatrail-canvas")).toBeNull();
    await userEvent.click(await continueButton());
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("Worked example · 2 of 4");
    expect(document.activeElement).toBe(heading);
    // A segment passed shows a tick, its place still in its name.
    expect(await chip(1)).toHaveAccessibleName("1 Explanation passed");
    expect(await chip(2)).toHaveAccessibleName("2 Worked example now");
    await shut();
    expect((await kept())?.place).toBe(2);
    await waitFor(() => expect(canvas().workedExample).toBeDefined());
    expect(canvas().demoState).toEqual({ opened: 0, hidden: false });
    // Its Continue is the element's child, in its row after Next and Demo.
    const inRow = await continueButton();
    expect(inRow.parentElement).toBe(canvas());
    expect(inRow.assignedSlot?.name).toBe("actions");
    for (let i = 0; i < 3; i += 1) await userEvent.click(await canvasButton("Next"));
    await waitFor(async () =>
      expect((await kept())?.demo[2]).toEqual({ opened: 3, hidden: false }),
    );
    await userEvent.click(await canvasButton("Demo"));
    await waitFor(async () => expect((await kept())?.demo[2]).toEqual({ opened: 3, hidden: true }));
    // The state goes back to the element as the same object the event gave.
    expect(canvas().demoState).toEqual({ opened: 3, hidden: true });

    // The task: no attempt begins while the lessons are remade, and no Continue stands.
    await userEvent.click(await continueButton());
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 3 of 4");
    expect(await screen.findByText(REMADE)).toBeVisible();
    expect((await kept())?.place).toBe(3);
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(begun).toEqual([]);
    expect(asked).toEqual(["run r1"]);
    expect(endedRuns).toEqual([]);
  });

  it("stands with its bar and the shapes of its title, its line and a segment while the run is read", async () => {
    const { given, give } = held();
    await renderLesson({ runHeld: given });
    expect(screen.getByRole("heading", { level: 1, name: "Lesson" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave the lesson" })).toBeTruthy();
    expectLoading(document, 6);
    give();
    expect(await screen.findByRole("heading", { level: 1, name: "Gaps and posts" })).toBeTruthy();
    expectLoaded(document);
  });

  it("opens after a restart at its place, the demo as it was", async () => {
    const { asked, begun } = await renderLesson({
      kept: { place: 3, demo: { 2: { opened: 3, hidden: true } } },
    });
    expect(await screen.findByText(REMADE)).toBeVisible();
    // Off to the example and back: Continue leads to the place.
    await userEvent.click(await chip(2));
    await waitFor(() => expect(canvas().demoState).toEqual({ opened: 3, hidden: true }));
    await userEvent.click(await continueButton());
    expect(await screen.findByText(REMADE)).toBeVisible();
    expect(asked).toEqual(["run r1"]);
    expect(begun).toEqual([]);
  });
  it("opens on another device after the last task that ended, goes past it, and ends the lesson", async () => {
    const { kept, asked, endedRuns } = await renderLesson({ ended: [3] });
    await screen.findByText("Each time, count the gaps first.");
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");
    await waitFor(async () => expect((await kept())?.place).toBe(4));
    // The task that ended does not open again, and says why.
    expect(await chip(3)).toHaveAttribute("aria-disabled", "true");
    expect(await chip(3)).toHaveAccessibleName("3 Task This task is over");
    (await chip(3)).click();
    expect(await screen.findByText("3 Task: already over", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");
    // Back to the example: its demo from the beginning; Continue leads to the place, past the task.
    await userEvent.click(await chip(2));
    await waitFor(() => expect(canvas().demoState).toEqual({ opened: 0, hidden: false }));
    await userEvent.click(await continueButton());
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");

    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    expect(asked).toContain("lesson done");
    expect(await kept()).toBeUndefined();
    expect(endedRuns).toEqual(["r1"]);
    expect(screen.getByRole("button", { name: "Back to Home" })).toBeVisible();
  });
  it("drops the state of another run under the same key, and a demo the element would refuse", async () => {
    const other = await renderLesson({ kept: { place: 4, passageId: "r0" } });
    await screen.findByText("A fence has posts and gaps between them.");
    await waitFor(async () => expect((await other.kept())?.place).toBe(1));
    other.unmount();

    // A demo kept for a segment that is no example is no state of any element either.
    await renderLesson({
      kept: { place: 2, demo: { 1: { opened: 0, hidden: false }, 2: { opened: 9, hidden: true } } },
    });
    await waitFor(() => expect(canvas().workedExample).toBeDefined());
    expect(canvas().demoState).toEqual({ opened: 0, hidden: false });
  });

  it("plays a worked example on a workbook, and stops at its task being remade", async () => {
    const { kept, begun } = await renderLesson({ lesson: REMAINDERS });
    await waitFor(() => expect(canvas().workedExample?.canvas.kind).toBe("workbook"));
    await userEvent.click(await canvasButton("Next"));
    await userEvent.click(await canvasButton("Next"));
    await waitFor(async () =>
      expect((await kept())?.demo[1]).toEqual({ opened: 2, hidden: false }),
    );
    await userEvent.click(await continueButton());
    expect(await screen.findByText(REMADE)).toBeVisible();
    expect((await kept())?.place).toBe(2);
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(begun).toEqual([]);
  });
  it("names the own key's provider with every request of the run that may give a choice", async () => {
    for (const ownKey of [false, true]) {
      const { providers, unmount } = await renderLesson({
        lesson: REMAINDERS,
        ended: [2],
        open: { kind: "choice", choiceId: "c1" },
        ownKey,
      });
      await userEvent.click(await continueButton());
      expect(await screen.findByText("Lesson complete")).toBeVisible();
      const named = ownKey ? "anthropic" : "";
      expect(providers).toContain(`open ${named}`);
      expect(providers).toContain(`done ${named}`);
      expect(providers.every((each) => each.endsWith(` ${named}`))).toBe(true);
      unmount();
    }
  });
  it("sends lesson done again after no answer, and goes to the task left when api refuses", async () => {
    let offline = true;
    const { asked } = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        if (offline) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("No connection")).toBeVisible();
    offline = false;
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(asked.filter((a) => a === "lesson done").length).toBeGreaterThan(1);
  });

  it("opens the first task not ended when lesson done is refused", async () => {
    await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw endedSegments(Cause.SEGMENTS_NOT_ENDED, []);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("The lesson has a task to finish")).toBeVisible();
    expect(await screen.findByText(REMADE)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 3 of 4");
  });

  it.each([
    [RunEndReason.UNCHECKED, "This version of the module is no longer given", true],
    [RunEndReason.NOT_SUITABLE, "This lesson doesn't suit this profile any more", false],
    [RunEndReason.ABANDONED, "The lesson wasn't opened for 30 days", false],
    [RunEndReason.UNSPECIFIED, "This lesson is over", false],
  ])(
    "ends a run api ended, %s, with its words, and erases its state",
    async (reason, text, checks) => {
      const { check, kept, endedRuns } = await renderLesson({
        kept: { place: 2 },
        run: () => {
          throw runEnded(reason);
        },
      });
      expect(await screen.findByRole("heading", { level: 1, name: text })).toBeVisible();
      await waitFor(async () => expect(await kept()).toBeUndefined());
      expect(endedRuns).toEqual(["r1"]);
      expect(check).toHaveBeenCalledTimes(checks ? 1 : 0);
    },
  );

  it("ends a run api ended at lesson done, under the lesson's title", async () => {
    const { kept } = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw runEnded(RunEndReason.ABANDONED);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("The lesson wasn't opened for 30 days")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    expect(await kept()).toBeUndefined();
  });

  it("opens a run by an engine's choice, and names it by the lesson's full ID", async () => {
    const { asked, began } = await renderLesson({ open: { kind: "choice", choiceId: "c1" } });
    await screen.findByText("A fence has posts and gaps between them.");
    expect(asked[0]).toBe("open lesson c1");
    expect(began).toEqual([RUN]);
  });

  it("says why a segment not reached does not open", async () => {
    await renderLesson();
    await screen.findByText("A fence has posts and gaps between them.");
    (await chip(4)).click();
    // The line names the chip pressed: under the heading of segment 1, not said of that one.
    expect(await screen.findByText("4 Explanation: not open yet", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 1 of 4");
  });

  it("leaves a run api does not know, and reads one again after a failure", async () => {
    window.location.hash = "#/lesson";
    const gone = await renderLesson({
      run: () => {
        throw refused(Code.NotFound, Cause.NOT_FOUND);
      },
    });
    await waitFor(() => expect(gone.endedRuns).toEqual(["r1"]));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
    gone.unmount();

    let failing = true;
    await renderLesson({
      run: () => {
        if (failing) throw new ConnectError("no", Code.Internal);
      },
    });
    const retry = await screen.findByRole("button", { name: "Try again" });
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveClass("nt-secondary");
    failing = false;
    await userEvent.click(retry);
    await screen.findByText("A fence has posts and gaps between them.");
  });

  it("goes back to Home from a run that did not come", async () => {
    window.location.hash = "#/lesson";
    await renderLesson({
      run: () => {
        throw new ConnectError("down", Code.Unavailable);
      },
    });
    await screen.findByRole("heading", { level: 1, name: "No connection" });
    await userEvent.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(window.location.hash).toBe("#/home");
    window.location.hash = "";
  });

  it("opens again after its last task ended on the task that ended, Continue lesson done", async () => {
    const { asked } = await renderLesson({ lesson: REMAINDERS, ended: [2], kept: { place: 2 } });
    expect(await screen.findByText("This task is over", { selector: "p" })).toBeVisible();
    expect(asked).not.toContain("open a1");
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
  });

  it("ends the run api ended while lesson done was refused with nothing of what ended", async () => {
    const { kept, endedRuns } = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw refused(Code.FailedPrecondition, Cause.SEGMENTS_NOT_ENDED);
      },
      run: (reads) => {
        if (reads > 0) throw runEnded(RunEndReason.NOT_SUITABLE);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("This lesson doesn't suit this profile any more")).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Gaps and posts");
    await waitFor(async () => expect(await kept()).toBeUndefined());
    expect(endedRuns).toEqual(["r1"]);
  });
  it("says why the run was not read again, and keeps the lesson open", async () => {
    await renderLesson({
      kept: { place: 4 },
      ended: [3],
      complete: () => {
        throw refused(Code.FailedPrecondition, Cause.SEGMENTS_NOT_ENDED);
      },
      run: (reads) => {
        if (reads > 0) throw new ConnectError("down", Code.Unavailable);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("No connection", { selector: "p" })).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Explanation · 4 of 4");
  });
  it("says when the device does not keep the lesson, and leaves it sending nothing", async () => {
    window.location.hash = "#/lesson";
    const { asked } = await renderLesson({ noDatabase: true });
    expect(await screen.findByText("Your work isn't saved on this device")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Leave the lesson" }));
    expect(window.location.hash).toBe("#/home");
    expect(asked).toEqual(["run r1"]);
    window.location.hash = "";
  });

  it("asks the run when a refusal of lesson done says nothing of what ended", async () => {
    const { asked } = await renderLesson({
      kept: { place: 4 },
      complete: () => {
        throw refused(Code.FailedPrecondition, Cause.SEGMENTS_NOT_ENDED);
      },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByText(REMADE)).toBeVisible();
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Task · 3 of 4");
    expect(asked.filter((a) => a === "run r1")).toHaveLength(2);
  });

  it("keeps the state by the run's full ID when the manifest does not come, with no lang", async () => {
    const { kept } = await renderLesson({ noManifest: true });
    const title = await screen.findByRole("heading", { level: 1, name: "Gaps and posts" });
    expect(title.querySelector("[lang]")).toBeNull();
    await userEvent.click(await continueButton());
    await waitFor(async () => expect((await kept())?.place).toBe(2));
  });

  it("says it keeps nothing of a run by a choice whose manifest does not come", async () => {
    await renderLesson({ open: { kind: "choice", choiceId: "c1" }, noManifest: true });
    expect(await screen.findByText("Your work isn't saved on this device")).toBeVisible();
  });

  it("ends a run by a choice api ended, and reads a run without its lesson as a failure", async () => {
    const ended = await renderLesson({
      open: { kind: "choice", choiceId: "c1" },
      run: () => {
        throw runEnded(RunEndReason.PASSED);
      },
    });
    expect(await screen.findByRole("heading", { level: 1, name: "Lesson complete" })).toBeVisible();
    expect(ended.endedRuns).toEqual([]);
    ended.unmount();

    await renderLesson({ noLesson: true });
    expect(await screen.findByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("offers the module's next lesson and its tasks at the end, however the run ended", async () => {
    const chosen = await renderLesson({
      kept: { place: 4 },
      ended: [3],
      endChoice: { choiceId: "c3", kind: ChoiceKind.LESSON },
    });
    await userEvent.click(await continueButton());
    expect(await screen.findByRole("button", { name: "Next lesson" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Solve" })).toHaveClass("nt-secondary");
    expect(screen.getByRole("button", { name: "Back to Home" })).toHaveClass("nt-secondary");
    chosen.unmount();

    await renderLesson({
      kept: { place: 2 },
      run: () => {
        throw refused(Code.FailedPrecondition, Cause.RUN_ENDED, {
          case: "runEnd",
          value: create(RunEndSchema, {
            reason: RunEndReason.ABANDONED,
            choice: { choiceId: "c4", kind: ChoiceKind.TASK },
          }),
        });
      },
    });
    expect(await screen.findByRole("button", { name: "Next lesson" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Solve" })).toBeVisible();
  });

  it("opens the next lesson, and with no lessons come gives Solve alone, which says a failure", async () => {
    window.location.hash = "";
    const ended = await renderLesson({ kept: { place: 4 }, ended: [3] });
    await userEvent.click(await continueButton());
    await userEvent.click(await screen.findByRole("button", { name: "Next lesson" }));
    expect(window.location.hash).toBe("#/lesson");
    ended.unmount();

    await renderLesson({ kept: { place: 4 }, ended: [3], noLessons: true });
    await userEvent.click(await continueButton());
    const solve = await screen.findByRole("button", { name: "Solve" });
    expect(screen.queryByRole("button", { name: "Next lesson" })).toBeNull();
    expect(solve).not.toHaveClass("nt-secondary");
    // api answers no choice here: the failure stands under the buttons.
    await userEvent.click(solve);
    expect(await screen.findByRole("alert")).toBeVisible();
  });

  it("takes lesson done with no end for a lesson passed", async () => {
    await renderLesson({ kept: { place: 4 }, ended: [3], noEnd: true });
    await userEvent.click(await continueButton());
    expect(await screen.findByText("Lesson complete")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Solve" })).toBeVisible();
  });
});
