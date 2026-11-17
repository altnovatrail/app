// app's screens against the interface mockup (R58 in docs/decisions.md): each entry draws a screen
// as the screen tests do, synthetic and with no api, at each size of the mockup, and compares its
// regions with the mockup's state of the same name in the same engine. An entry with `until` is a
// screen whose task of epic E5 has not come yet: its differences are reported in mockup/out/ and
// not held. Once that task has brought it to the mockup, `until` goes, and every difference but
// those a region's `differs` names fails the test.
import {
  ProfileSchema,
  QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  LegalService,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import "@altnovatrail/canvas";
import "../src/theme/theme.css";
import { ChooseScreen } from "../src/account/ChooseScreen.tsx";
import { InviteScreen, type TextsRead } from "../src/account/InviteScreen.tsx";
import { OwnerProfileScreen } from "../src/account/OwnerProfileScreen.tsx";
import { ApiProvider } from "../src/api/ApiContext.tsx";
import { Example } from "../src/lesson/Example.tsx";
import { ContinueButton, LessonScreen } from "../src/lesson/LessonScreen.tsx";
import { NextStep } from "../src/next/NextStep.tsx";
import { SignInScreen } from "../src/signin/SignInScreen.tsx";
import { SubjectsScreen } from "../src/subjects/MySubjects.tsx";
import type { ModuleCard } from "../src/subjects/modules.ts";
import type { SkillCounts } from "../src/subjects/states.ts";
import { NO_VERDICTS } from "../src/task/attempt.ts";
import { initialState } from "../src/task/steps.ts";
import { TaskScreen } from "../src/task/TaskScreen.tsx";
import { routedApi } from "../src/test/api.ts";
import { inLanguage } from "../src/test/language.tsx";
import { type Device, type Difference, type Region, SIZES } from "./regions.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    mockupCompare: (
      state: string,
      device: Device,
      regions: readonly Region[],
    ) => Promise<Difference[]>;
  }
}

interface Compared {
  /** The state of the mockup's table «Screens and states». */
  readonly state: string;
  readonly draw: () => ReactNode;
  readonly regions: readonly Region[];
  /** The task of epic E5 that brings the screen to the mockup, while it has not. */
  readonly until?: string;
  /** What a screen that draws in an effect waits for before it is read: its last element shown. */
  readonly settle?: () => Promise<unknown>;
  /** The sizes it is compared at, when not both. */
  readonly devices?: readonly Device[];
}

const noMedia = () => Promise.reject(new Error("no file in this test"));

/** The task screen on a squared sheet, on my own, with nothing written: the canvas's bar of tools. */
function sheetTask() {
  return inLanguage(
    <TaskScreen
      task={{
        id: "rungs",
        statement: [{ text: "The rungs are 30 cm apart." }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        items: [{ text: "How many rungs?", answer_slots: [{ binding: "anywhere" }] }],
      }}
      manifest={undefined}
      steps={[]}
      catalog={undefined}
      state={initialState("self")}
      mode="self"
      verdicts={NO_VERDICTS}
      filled={[[false]]}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={false}
      blink={false}
      panelOpen={false}
      onHistoryChange={() => {}}
      onMode={() => {}}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onChoose={() => {}}
      onCheck={() => {}}
      onHint={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
    />,
  );
}

/** A lesson's worked example before Next, its Continue in the canvas's row. */
function workedExample() {
  return inLanguage(
    <LessonScreen
      title="Gaps and posts"
      language="en"
      course={{ kinds: ["explanation", "example", "task"], ended: new Set() }}
      place={2}
      shown={2}
      unsaved={false}
      pending={false}
      onGoTo={() => {}}
      onNote={() => {}}
      onLeave={() => {}}
    >
      <Example
        example={{
          statement: [{ text: "A path is 20 m long, with a tree every 5 m." }],
          canvas: { kind: "handwriting_sheet", grid: "squares" },
          demo: [{ text: "20 ÷ 5 = 4 gaps." }, { text: "5 trees." }],
        }}
        manifest={undefined}
        media={noMedia}
        demo={undefined}
        onDemo={() => {}}
        actions={<ContinueButton slot="actions" pending={false} onContinue={() => {}} />}
      />
    </LessonScreen>,
  );
}

/**
 * The element's own buttons drawn, its shadow tree holding the toolbar, and the page scrolled to
 * the element's top, where the mockup's sheet stands: the bar's band is then the window's.
 */
async function barDrawn() {
  let element: Element | null = null;
  await waitFor(() => {
    element = document.querySelector("novatrail-canvas");
    expect(element?.shadowRoot?.querySelector('[role="toolbar"] button')).toBeTruthy();
  });
  (element as Element | null)?.scrollIntoView({ block: "start" });
}

/**
 * Why the canvas's bar stands elsewhere than the mockup has it, the sheet scrolled to the top: the
 * screen keeps its padding of 16 around the element (R59), till the task screen and the lesson are
 * drawn as the mockup, T84 and T85; and "Draw with finger" with its line, 57 px, comes only in pen
 * mode (R29 in canvas), so the bar is that much lower and its top half of it further down.
 */
const PLACED =
  'the screen\'s padding of 16, R59; "Draw with finger" only in pen mode, R29 in canvas';

/** A button the bar shows by its icon alone: the font of its caption, out of sight, is not drawn. */
const ICON_ALONE = "the caption is out of sight (R60; R84 in canvas)";

/** The canvas's bar of glass, its first tool and the zoom (R84 in canvas). */
const BAR: readonly Region[] = [
  {
    name: "the tool bar",
    mockup: { css: 'div.glass:has(> button[aria-label="Zoom in"])' },
    app: { role: "toolbar", name: "Sheet buttons" },
    differs: { what: ["x", "y", "height", "font-size"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "the pen, the tool in use",
    mockup: { role: "button", name: "Pen" },
    app: { role: "radio", name: "Pen" },
    differs: { what: ["x", "y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "Zoom in",
    mockup: { role: "button", name: "Zoom in" },
    app: { role: "button", name: "Zoom in" },
    differs: { what: ["x", "y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
  },
];

/** The privacy policy and the terms of use in force, synthetic, as the agreement's step reads them. */
const ACCOUNT_TEXTS: TextsRead = {
  status: "done",
  value: {
    texts: (["privacy-policy", "terms-of-use"] as const).map((id) =>
      create(LegalTextSchema, {
        id,
        version: 1,
        inForceSince: "2026-11-11",
        body: "# A text\n\nIts words.\n",
        summary: "In short, its words.",
        summaryLanguage: "en",
      }),
    ),
    next: [],
  },
  retry: () => {},
};

/** The way in: the sign-in, and nothing comes of Google's window. */
function signIn() {
  return inLanguage(<SignInScreen onSignIn={() => new Promise(() => {})} onLegal={() => {}} />);
}

/** The invite code, and nothing comes of "Create account". */
function invite() {
  return inLanguage(
    <InviteScreen
      texts={ACCOUNT_TEXTS}
      onCreate={() => new Promise(() => {})}
      onLegal={() => {}}
    />,
  );
}

/** The owner's profile, and nothing comes of "Continue". */
function owner() {
  return inLanguage(<OwnerProfileScreen onCreate={() => new Promise(() => {})} />);
}

/** api by the routing transport: no legal text has a next version. */
const NO_NEXT = routedApi((router) => router.service(LegalService, { getLegalTexts: () => ({}) }));

/** A synthetic code, typed. */
async function codeTyped() {
  await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), "NOVA2026");
}

/** The code typed and taken on to the statement and the texts. */
async function agreeing() {
  await codeTyped();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Create your account" });
}

/**
 * Why the column of the way in stands elsewhere than the mockup has it: it stands in the middle of
 * the frame's height, as the mockup's, but its heading keeps the words of the terms of section 3.8
 * — one line where the mockup's has two —, the code's step has no "Back", which in the mockup signs
 * out, and the statement's texts stand in place below it (R27; R46), so the column is of another
 * height (R61).
 */
const CENTRED =
  "the headings' words of section 3.8, no Back from the code, the texts in place below (R27; R46; R61)";

/** The way to the legal pages: one button that names them all (R31), not the mockup's two. */
const LEGAL_WAY: Region = {
  name: "the way to the legal texts",
  mockup: { css: '.ph-signfoot button:text-is("Privacy Policy")' },
  app: { role: "button", name: "Privacy and legal information" },
  followsText: "centre",
  differs: { what: ["x", "font-weight"], by: "one button to the legal pages (R31)" },
};

/** The art of the way in, at the left from 600 and a band on the phone's first step. */
const ART: Region = {
  name: "the art",
  mockup: { css: ".ph-art" },
  app: { css: ".nt-art" },
};

/** The art on the steps after the sign-in: at the left from 600, and none on the phone. */
const ART_LATER: Region = {
  ...ART,
  differs: { what: ["missing"], by: "the art is a band above the sign-in alone on a phone" },
};

/** The disabled or enabled primary button of a step, and what stands above it in the column. */
function primary(mockup: string, app: string): Region {
  return {
    name: `the primary button, ${app}`,
    mockup: { role: "button", name: mockup },
    app: { role: "button", name: app },
    differs: { what: ["y"], by: CENTRED },
  };
}

const SIGN_IN: readonly Region[] = [
  ART,
  {
    name: "the heading",
    mockup: { text: "Learn anything" },
    app: { role: "heading", name: "Sign in" },
    followsText: "start",
    differs: { what: ["y", "height"], by: CENTRED },
  },
  {
    name: "the line for grown-ups",
    mockup: { css: 'div:has(> span:text("Accounts are for grown-ups"))' },
    app: { css: ".nt-note" },
    differs: { what: ["y"], by: CENTRED },
  },
  LEGAL_WAY,
];

const CODE: Region = {
  name: "the code",
  mockup: { role: "button", name: "Invite code" },
  app: { role: "textbox", name: "Invite code" },
  // Eight boxes in the mockup, one field here, whose edge is the one «Contrast» asks of a field.
  differs: {
    what: ["y", "width", "border", "radius", "font-size"],
    by: `${CENTRED}; one field, its edge by «Contrast»`,
  },
};

const AGREE: readonly Region[] = [
  ART_LATER,
  {
    name: "Back",
    mockup: { css: '.ph-signcol button:text-is("Back")' },
    app: { role: "button", name: "Back" },
    followsText: "start",
    contrast: [{ property: "colour", mockup: "#0071e3", app: "#0066cc" }],
    differs: { what: ["y"], by: CENTRED },
  },
  {
    name: "the ticks",
    mockup: { css: 'div:has(> button[role="checkbox"]):has(> div > button[role="checkbox"])' },
    app: { css: ".nt-ticks" },
    differs: { what: ["y", "height"], by: `${CENTRED}; the browser's own checkbox, 44 high (R61)` },
  },
  LEGAL_WAY,
];

/** The owner's column: its heading, the avatar, its button, the card of the fields. */
const OWNER: readonly Region[] = [
  {
    name: "the heading",
    mockup: { css: ".ph-owncol > div:first-child" },
    app: { role: "heading", name: "Your learner profile" },
    followsText: "centre",
  },
  {
    name: "the avatar",
    mockup: { css: 'span:has(> svg[width="50"])' },
    app: { css: ".nt-avatar-profile" },
  },
  {
    name: "the fields",
    mockup: { css: "div:has(> label)" },
    app: { css: ".nt-rows" },
  },
];

/** Why the avatars stand lower: 12 below their button, and the phone's sheet with its × (R59; R60). */
const AVATARS_HUNG = "the pop-over 12 below its button, the phone's sheet with its × (R59; R60)";

const WAY_IN: readonly Compared[] = [
  {
    state: "signin",
    draw: signIn,
    regions: [...SIGN_IN, primary("Continue with Google", "Sign in with Google")],
  },
  {
    state: "signin-signing",
    draw: signIn,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Sign in with Google" })),
    regions: [...SIGN_IN, primary("Signing in with Google…", "Signing in with Google…")],
  },
  {
    state: "invite",
    draw: invite,
    regions: [ART_LATER, CODE, primary("Continue", "Continue"), LEGAL_WAY],
  },
  {
    state: "invite-filled",
    draw: invite,
    settle: codeTyped,
    regions: [ART_LATER, CODE, primary("Continue", "Continue"), LEGAL_WAY],
  },
  {
    state: "agree",
    draw: invite,
    settle: agreeing,
    regions: [...AGREE, primary("Create account", "Create account")],
  },
  {
    state: "agree-ticked",
    draw: invite,
    settle: async () => {
      await agreeing();
      await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
      await userEvent.click(
        screen.getByRole("checkbox", { name: "I accept the Privacy Policy and the Terms of Use" }),
      );
    },
    regions: [...AGREE, primary("Create account", "Create account")],
  },
  {
    state: "owner",
    draw: owner,
    regions: [
      ...OWNER,
      {
        name: "Continue",
        mockup: { role: "button", name: "Continue" },
        app: { role: "button", name: "Continue" },
      },
    ],
  },
  {
    state: "owner-avatars",
    draw: owner,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Choose an avatar" })),
    regions: [
      ...OWNER,
      {
        name: "the avatars",
        mockup: { role: "radiogroup", name: "Avatar" },
        app: { role: "dialog", name: "Choose an avatar" },
        differs: { what: ["y", "height"], by: AVATARS_HUNG },
      },
      {
        name: "the first avatar",
        mockup: { role: "radio", name: "Peak" },
        app: { role: "button", name: "Peak" },
        differs: { what: ["y"], by: AVATARS_HUNG },
      },
    ],
  },
  {
    state: "owner-countries",
    draw: owner,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Country Choose a country" })),
    regions: [
      ...OWNER,
      {
        name: "the countries",
        mockup: { role: "listbox", name: "Country" },
        app: { role: "dialog", name: "Country" },
        differs: {
          what: ["x", "y", "height"],
          by: "every country of the part consent-age/, not the mockup's five, hung from the row («Where it differs»)",
        },
      },
    ],
  },
  {
    state: "owner-filled",
    draw: owner,
    settle: async () => {
      await userEvent.type(screen.getByRole("textbox", { name: "Pseudonym" }), "Sam");
      await userEvent.click(screen.getByRole("button", { name: "Choose an avatar" }));
      await userEvent.click(screen.getByRole("button", { name: "Wave" }));
      await userEvent.click(screen.getByRole("button", { name: "Country Choose a country" }));
      await userEvent.click(screen.getByRole("button", { name: "United States" }));
    },
    regions: [
      ...OWNER,
      {
        name: "Continue",
        mockup: { role: "button", name: "Continue" },
        app: { role: "button", name: "Continue" },
      },
    ],
  },
  {
    state: "who",
    draw: () =>
      inLanguage(
        <ApiProvider value={NO_NEXT}>
          <ChooseScreen
            profiles={[
              create(ProfileSchema, {
                profileId: "p1",
                owner: true,
                pseudonym: "Sam",
                avatar: "wave",
              }),
            ]}
            first={false}
            onChoose={() => {}}
            onSignOut={() => {}}
            onLegal={() => {}}
          />
        </ApiProvider>,
      ),
    regions: [
      {
        name: "the heading",
        mockup: { text: "Who’s learning?" },
        app: { role: "heading", name: "Who is learning?" },
        followsText: "centre",
      },
      {
        name: "Sign out",
        mockup: { role: "button", name: "Sign out" },
        app: { role: "button", name: "Sign out" },
        followsText: "end",
      },
      {
        name: "the owner's profile",
        mockup: { css: "button.pf:not(.ph-addp)" },
        app: { css: ".nt-learners > li:first-child" },
      },
      {
        name: "Add a learner",
        mockup: { css: "button.ph-addp" },
        app: { css: ".nt-learner-add" },
      },
      {
        name: "the line at the foot",
        mockup: { text: "Each learner has a made-up name" },
        app: { text: "Each learner has a made-up name" },
      },
    ],
  },
];

/** The counts of a module's skills: the five states, then the two marks. */
function counts(states: readonly number[], rubric = 0): SkillCounts {
  const [mastered = 0, review = 0, progress = 0, ready = 0, locked = 0] = states;
  return {
    mastered,
    "time-to-review": review,
    "in-progress": progress,
    "ready-to-start": ready,
    locked,
    "feedback-by-criteria": rubric,
    "not-assessed": 0,
  };
}

/** The mockup's three modules of the first slice, with the states of their skills. */
const MODULES: readonly ModuleCard[] = [
  {
    moduleId: "novatrail/olympiad-math",
    title: "Olympiad maths 1–6",
    skills: counts([14, 3, 6, 9, 13]),
  },
  {
    moduleId: "novatrail/school-math-3",
    title: "School maths · grade 3",
    skills: counts([20, 2, 4, 6, 4]),
  },
  { moduleId: "novatrail/short-essays", title: "Short essays", skills: counts([], 18) },
].map((card, i) => ({ ...card, digest: `sha256:${String(i + 1).repeat(64)}`, language: "en" }));

/** api by the routing transport: nothing is asked of it until a press. */
const QUIET = routedApi(() => {});

/** The home screen with the mockup's three modules, a fifth of today's tutor time used. */
function home() {
  return inLanguage(
    <ApiProvider value={QUIET}>
      <SubjectsScreen
        connected={MODULES}
        catalog={MODULES}
        quota={create(QuotaShareSchema, { profilePercent: 20 })}
        next={<NextStep profileId="p1" />}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    </ApiProvider>,
  );
}

/**
 * Why the home screen stands lower and its cards are of other heights than the mockup's: app's
 * screen keeps the heading "My subjects" of section 3.8 and the bar of the learner above it, where
 * the mockup greets the learner by name under its own bar (T83); the card of what comes next holds
 * the engine's way, "What's next", which names no lesson before it is pressed (R24), not the
 * mockup's lesson and its picture; the modules connected are "Connected" of section 3.10, with
 * Disconnect and License beside their map, the catalog below them in place of "Add a module".
 */
const HOME_PLACED =
  'the heading of section 3.8 and the bar above it (T83); "What\'s next" names no lesson (R24); Disconnect and License on a card (section 3.10)';

/** A card or a bar, whose words are its own regions': the size of its own text is not drawn. */
const NO_TEXT = "no text of its own: the body's 14 px (R11)";

const HOME: readonly Region[] = [
  {
    name: "the heading",
    mockup: { text: "Hi, Sam" },
    app: { role: "heading", name: "My subjects" },
    followsText: "start",
    differs: { what: ["y", "height", "font-size"], by: HOME_PLACED },
  },
  {
    name: "the card of what comes next",
    mockup: { css: ".ph-next" },
    app: { css: ".nt-next-up" },
    differs: { what: ["y", "height", "font-size"], by: `${HOME_PLACED}; ${NO_TEXT}` },
  },
  {
    name: "A task from my paper",
    mockup: { css: ".ph-paper" },
    app: { css: ".nt-paper" },
    differs: { what: ["y", "height", "font-size"], by: `${HOME_PLACED}; ${NO_TEXT}` },
  },
  {
    name: "the first module",
    mockup: { css: ".ph-grid > .mc:first-child" },
    app: { css: ".nt-module:first-child" },
    differs: { what: ["y", "height", "font-size"], by: `${HOME_PLACED}; ${NO_TEXT}` },
  },
  {
    name: "its bar",
    mockup: { css: '.ph-grid > .mc:first-child span[style*="height: 8px"]' },
    app: { css: ".nt-module:first-child .nt-skills-bar" },
    differs: { what: ["y", "font-size"], by: `${HOME_PLACED}; ${NO_TEXT}` },
  },
];

/** The legend standing below the modules, from 600 CSS px. */
const LEGEND: Region = {
  name: "the legend",
  mockup: { css: ".ph-legend" },
  app: { css: ".nt-legend" },
  differs: { what: ["y"], by: HOME_PLACED },
};

const SCREENS: readonly Compared[] = [
  ...WAY_IN,
  { state: "home", devices: ["ipad"], draw: home, regions: [...HOME, LEGEND] },
  { state: "home", devices: ["phone"], draw: home, regions: HOME },
  { state: "home-legend", devices: ["ipad"], draw: home, regions: [LEGEND] },
  {
    state: "home-legend",
    devices: ["phone"],
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "What the marks mean" })),
    regions: [
      {
        name: "the sheet of the legend",
        mockup: { css: ".ph-legend.on" },
        app: { role: "dialog", name: "What the marks mean" },
      },
    ],
  },
  ...(["task-pill", "task-empty"] as const).map((state) => ({
    state,
    draw: sheetTask,
    settle: barDrawn,
    regions: BAR,
  })),
  { state: "task", devices: ["ipad"], draw: sheetTask, settle: barDrawn, regions: BAR },
  {
    state: "example",
    devices: ["ipad"],
    draw: workedExample,
    settle: barDrawn,
    regions: [
      {
        name: "the row of Next, Demo and Continue",
        mockup: { css: 'div.glass:has(> button:text-is("Next"))' },
        app: { css: ".tools.row" },
        followsText: "centre",
        // Its words are its buttons', compared below.
        differs: { what: ["font-size"], by: "no text of its own (R84 in canvas)" },
      },
      {
        name: "Next",
        mockup: { role: "button", name: "Next" },
        app: { role: "button", name: "Next" },
        followsText: "start",
      },
      {
        name: "Continue",
        mockup: { role: "button", name: "Continue" },
        app: { role: "button", name: "Continue" },
        followsText: "end",
      },
    ],
  },
];

describe.each(Object.keys(SIZES) as Device[])("on %s", (device) => {
  const compared = SCREENS.filter((screen) => screen.devices?.includes(device) ?? true);
  it.each(compared)("$state as the mockup", async ({ state, draw, regions, until, settle }) => {
    const [width, height] = SIZES[device];
    await page.viewport(width, height);
    render(draw());
    // As the mockup's page sets data-ready: the screen drawn, its fonts loaded, a frame painted.
    await settle?.();
    await document.fonts.ready;
    await new Promise((painted) => requestAnimationFrame(painted));
    const differences = await commands.mockupCompare(state, device, regions);
    if (until === undefined) expect(differences.filter((d) => d.by === undefined)).toEqual([]);
  });
});
