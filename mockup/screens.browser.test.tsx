// app's screens against the interface mockup: each entry draws a screen as the screen tests
// do, synthetic and with no api, at each size of the mockup, and compares its regions with the
// mockup's state of the same name in the same engine. An entry with `until` is a screen not brought
// to the mockup yet: its differences are reported in mockup/out/ and not held. Without it, every
// difference but those a region's `differs` names fails the test.
import {
  AccountService,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  SubmissionEnd,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RunEndReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { DebugService } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import {
  LearningService,
  LessonState,
  ListLessonsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import {
  LegalService,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import { PackageService } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { ProgressService } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import type { ConnectRouter } from "@connectrpc/connect";
import { render, screen, waitFor, within } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import "@altnovatrail/canvas";
import "../src/theme/theme.css";
import { LearnerProvider } from "../src/account/AccountGate.tsx";
import { ChooseScreen } from "../src/account/ChooseScreen.tsx";
import { InviteScreen, type TextsRead } from "../src/account/InviteScreen.tsx";
import { OwnerProfileScreen } from "../src/account/OwnerProfileScreen.tsx";
import { AdultSection } from "../src/adults/AdultSection.tsx";
import { ApiProvider } from "../src/api/ApiContext.tsx";
import type { Api } from "../src/api/client.ts";
import { Icon } from "../src/app/Icon.tsx";
import { HOME as HOME_ROUTE, type Route, useRoute } from "../src/app/router.ts";
import { type Place, ShellBar } from "../src/app/Shell.tsx";
import { Waiting } from "../src/app/Waiting.tsx";
import { LegalPages } from "../src/legal/LegalPages.tsx";
import { Example } from "../src/lesson/Example.tsx";
import { Explanation } from "../src/lesson/Explanation.tsx";
import { LessonEnd } from "../src/lesson/Lesson.tsx";
import { LessonNext } from "../src/lesson/LessonNext.tsx";
import { ContinueButton, LessonScreen } from "../src/lesson/LessonScreen.tsx";
import { KeyHolder } from "../src/ownkey/holder.ts";
import { KeyHolderProvider } from "../src/ownkey/OwnKeyContext.tsx";
import { DeviceFiles } from "../src/packages/files.ts";
import { type Packages, PackagesProvider } from "../src/packages/PackagesContext.tsx";
import { OpenViews } from "../src/packages/views.ts";
import { SignInScreen } from "../src/signin/SignInScreen.tsx";
import { MapScreen } from "../src/skills/SkillMapScreen.tsx";
import type { HintGiven } from "../src/solving/Hint.tsx";
import type { KeptKey } from "../src/storage/profile.ts";
import { LessonsRoute, lessonsRoute } from "../src/subjects/LessonsScreen.tsx";
import { HomeScreen } from "../src/subjects/MySubjects.tsx";
import type {
  ModuleAbout,
  ModuleCard,
  SkillList,
  SkillPick,
  SkillPicks,
} from "../src/subjects/modules.ts";
import { CatalogScreen } from "../src/subjects/SubjectsPage.tsx";
import type { SkillCounts, SkillStatus } from "../src/subjects/states.ts";
import { Task } from "../src/task/TaskRoute.tsx";
import { routedApi } from "../src/test/api.ts";
import { memoryDevice } from "../src/test/device.ts";
import { inLanguage } from "../src/test/language.tsx";
import { fakeSpeech, voice } from "../src/test/speech.ts";
import { SpeechProvider, VoicingProvider } from "../src/voice/VoicingContext.tsx";
import { DEVICES, type Device, type Difference, type Region, SIZES } from "./regions.ts";

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
  /** Why the screen is not brought to the mockup yet, in words: its differences are reported, not held. */
  readonly until?: string;
  /** What a screen that draws in an effect waits for before it is read: its last element shown. */
  readonly settle?: () => Promise<unknown>;
  /** The sizes it is compared at, when not both. */
  readonly devices?: readonly Device[];
}

/**
 * The mockup draws Ask in the bottom row of a module's task and of a lesson, as app does on a task
 * from paper, with no round button of the tutor at the right edge; app still draws that button there
 * (Д58).
 */
const TUTOR_IN_ROW =
  "Ask in the bottom row of a task and a lesson, in place of the tutor's round button (Д58)";

const noMedia = () => Promise.reject(new Error("no file in this test"));

/** The mockup's first task of olympiad maths, on a squared sheet: the dots in rows. */
const DOTS: open.Task = {
  id: "dots",
  statement: [
    {
      text: "Row 1 has 2 dots, row 2 has 5 dots, and row 3 has 8 dots: each row has 3 more dots than the row before. How many dots are there in row 10?",
    },
  ],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
  givens: ["Row 1 has 2 dots.", "Each row has 3 more dots than the row before."],
  unknown: "How many dots there are in row 10.",
};

/** The mockup's hint on its first task before a wrong answer: a technique and the leading question. */
const DOTS_HINT: HintGiven = {
  techniques: [],
  question: "How many steps of 3 are there from row 1 to row 10?",
};

/** The mockup's first rung on its first task, after "32", and the same in other words. */
const DOTS_RUNG = "Count the steps again: from row 1 to row 10, how many times are 3 dots added?";
const DOTS_ALT =
  "Write rows 1 to 4 and their dots in a table. By row 4, how many 3s have been added?";

/**
 * What a screen says aloud by, as a learner's: a voice for English on this device, so that Read
 * aloud is on, as the mockup's.
 */
function speaking(children: ReactNode) {
  return (
    <SpeechProvider value={fakeSpeech([voice("English", "en-GB")]).speech}>
      <VoicingProvider
        profile={create(ProfileSchema, { profileId: "p1" })}
        device={memoryDevice().device}
        place="lesson"
        onSaved={() => {}}
        onFailed={() => {}}
      >
        {children}
      </VoicingProvider>
    </SpeechProvider>
  );
}

/** Read aloud is on once the device's record of voicing is read. */
async function readAloudOn() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Read aloud" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    ),
  );
}

/** The mockup's lesson of olympiad maths, at a segment: its four segments, none ended. */
function lesson(place: number, children: ReactNode) {
  return inLanguage(
    speaking(
      <LessonScreen
        title="Number patterns"
        language="en"
        module="Olympiad maths 1–6"
        course={{ kinds: ["explanation", "example", "task", "task"], ended: new Set() }}
        place={place}
        shown={place}
        unsaved={false}
        pending={false}
        {...(place === 1 ? { onContinue: () => {} } : {})}
        onGoTo={() => {}}
        onNote={() => {}}
        onLeave={() => {}}
      >
        {children}
      </LessonScreen>,
    ),
  );
}

/** The lesson's explanation, its paragraphs and its list; Continue in the row below it. */
function explanation() {
  return lesson(
    1,
    <Explanation
      parts={[
        {
          text: "Some rows of numbers grow by the same amount each time: 1, 3, 5, 7, … grows by 2.",
        },
        { text: "To find a number far along the row, count the steps from the first number." },
        { numbered_list: ["Find what is added each time.", "Count the steps.", "Add the amount."] },
      ]}
      language="en"
      media={noMedia}
    />,
  );
}

/** A lesson's worked example, its parts open so far; its Continue in the canvas's row. */
function workedExample(opened = 0) {
  return () =>
    lesson(
      2,
      <Example
        example={{
          statement: [{ text: "One square takes 4 matches. How many do 6 squares in a row take?" }],
          canvas: { kind: "handwriting_sheet", grid: "squares" },
          demo: [
            { text: "Each new square adds 3 matches." },
            { text: "From 1 square to 6 there are 5 steps." },
            { text: "4 + 5 × 3 = 19." },
            { text: "Answer: 19 matches." },
          ],
        }}
        manifest={undefined}
        media={noMedia}
        demo={opened === 0 ? undefined : { opened, hidden: false }}
        onDemo={() => {}}
        actions={<ContinueButton slot="actions" pending={false} onContinue={() => {}} />}
      />,
    );
}

/** The end of the lesson, done: the module's tile, its title, its next lesson and Solve. */
function lessonEnd() {
  return inLanguage(
    <ApiProvider value={LESSONS_API}>
      <LessonEnd
        reason={RunEndReason.PASSED}
        title="Number patterns"
        language="en"
        module={{ id: "olympiad-math", title: "Olympiad maths 1–6" }}
        next={
          <LessonNext
            profileId="p1"
            moduleId={OLYMPIAD}
            lesson={`${OLYMPIAD}/lesson/number-patterns`}
          />
        }
      />
    </ApiProvider>,
  );
}

/** The element's own buttons drawn, its shadow tree holding the toolbar. */
async function canvasDrawn() {
  await waitFor(() =>
    expect(
      document
        .querySelector("novatrail-canvas")
        ?.shadowRoot?.querySelector('[role="toolbar"] button'),
    ).toBeTruthy(),
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
 * Why the canvas's bar stands lower than the mockup has it, the sheet scrolled to the top: the line
 * of "Read aloud" and the voicing stands above the element, where the mockup has the statement's card
 * and its speaker (В74 in run/QUESTIONS.md).
 */
const PLACED = "canvas places its bar 6 above the mockup's";

/** A button the bar shows by its icon alone: the font of its caption, out of sight, is not drawn. */
const ICON_ALONE = "the caption is out of sight";

/** The canvas's bar of glass on a task from paper, its first tool and the hand. */
const SHEET_BAR: readonly Region[] = [
  {
    name: "the tool bar",
    mockup: { css: 'div.glass:has(> button[aria-label="Hand"])' },
    app: { role: "toolbar", name: "Task from paper buttons" },
    differs: { what: ["y", "font-size"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "the pen, the tool in use",
    mockup: { role: "button", name: "Pen" },
    app: { role: "radio", name: "Pen" },
    differs: { what: ["y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "the hand",
    mockup: { role: "button", name: "Hand" },
    app: { role: "radio", name: "Hand" },
    differs: { what: ["y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
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
    // The policy's next version, as the mockup's, which its sheet names.
    next: [
      create(LegalTextSchema, {
        id: "privacy-policy",
        version: 2,
        inForceSince: "2026-11-27",
        body: "# A text\n\nIts new words.\n",
        summary: "In short, its new words.",
        summaryLanguage: "en",
      }),
    ],
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
      onSignOut={() => {}}
    />,
  );
}

/** The owner's profile, and nothing comes of "Continue". */
function owner() {
  return inLanguage(<OwnerProfileScreen onCreate={() => new Promise(() => {})} />);
}

/** api by the routing transport: no legal text has a next version. */

/** The mockup's code, synthetic, of api's form, pasted as its boxes take it. */
async function codeTyped() {
  await userEvent.fill(screen.getByRole("textbox", { name: "Invite code" }), "N7VA-K2QM-9XB4-ZD3H");
}

/** The code typed and taken on to the statement and the texts. */
async function agreeing() {
  await codeTyped();
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Create your account" });
}

/**
 * Why a part of a step's card stands lower or higher than the mockup's: the card stands where the
 * mockup's does, but its words are app's own, without the mockup's full stops, so what follows
 * them moves.
 */
const SHIFTED = "app's own words, without the mockup's full stops";

/** The way to the legal pages, at the card's foot: one button that names them all. */
const LEGAL_WAY: Region = {
  name: "the way to the legal texts",
  mockup: { role: "button", name: "Privacy and legal information" },
  app: { role: "button", name: "Privacy and legal information" },
  followsText: "centre",
  differs: { what: ["y"], by: SHIFTED },
};

/** The sky's trail to the spark: at the left from 600, and small above the phone's first step. */
const ART: Region = {
  name: "the trail",
  mockup: { css: ".ph-sky" },
  app: { css: ".nt-sky" },
};

/** The trail on the steps after the sign-in: at the left from 600, and none on the phone. */
const ART_LATER: Region = {
  ...ART,
  differs: { what: ["missing"], by: "the trail stands above the sign-in alone on a phone" },
};

/** The card of a step on the sky. */
const CARD: Region = {
  name: "the card",
  mockup: { css: ".ph-card" },
  app: { css: ".nt-welcome .nt-column" },
  differs: { what: ["height"], by: SHIFTED },
};

/** The primary button of a step, and what stands above it in the card. */
function primary(mockup: string, app: string): Region {
  return {
    name: `the primary button, ${app}`,
    mockup: { role: "button", name: mockup },
    app: { role: "button", name: app },
    differs: { what: ["y"], by: SHIFTED },
  };
}

const SIGN_IN: readonly Region[] = [
  ART,
  CARD,
  {
    name: "the heading",
    mockup: { css: '.ph-card > div:text-is("Sign in")' },
    app: { role: "heading", name: "Sign in" },
    followsText: "start",
  },
  {
    name: "the line for grown-ups",
    mockup: { css: 'div:has(> span:text("Accounts are for grown-ups"))' },
    app: { css: ".nt-note" },
    differs: { what: ["y"], by: SHIFTED },
  },
  LEGAL_WAY,
];

/** "Back" at the top of a step's card: from the code it signs out, from the statement to the code. */
const BACK: Region = {
  name: "Back",
  mockup: { css: '.ph-card button:text-is("Back")' },
  app: { role: "button", name: "Back" },
  followsText: "start",
};

/** A step's heading, as each side words it, and the line below it, given as app words it. */
function heading(mockup: string, app: string, lead: string): Region[] {
  return [
    {
      name: "the heading",
      mockup: { css: `.ph-card > div:text-is("${mockup}")` },
      app: { role: "heading", name: app },
      followsText: "start",
    },
    {
      name: "the line below the heading",
      mockup: { css: `.ph-card > div:text-is("${lead}.")` },
      app: { css: ".nt-welcome .nt-lead" },
      followsText: "start",
    },
  ];
}

/** Why a box is ringed in one and not the other: app rings it while its field has the focus. */
const FOCUSED =
  "app rings the box the next character goes to while the field has the focus, the last once the code is whole";

/**
 * The code's four boxes of four characters, the row and its first and last box: empty, the
 * mockup rings the first, and filled, none, where app rings the box of the field's caret.
 */
function code(filled: boolean): Region[] {
  const ring: Pick<Region, "differs"> = { differs: { what: ["border"], by: FOCUSED } };
  return [
    BACK,
    ...heading(
      "You’re invited",
      "You're invited",
      "NovaTrail is in a closed preview. Enter the code from your invitation",
    ),
    {
      name: "the code",
      mockup: { css: ".ph-codes" },
      app: { css: ".nt-code-shown" },
    },
    {
      name: "the code's first box",
      mockup: { css: ".ph-codes > .ph-code >> nth=0" },
      app: { css: ".nt-code-shown > .nt-code-box >> nth=0" },
      ...(filled ? {} : ring),
    },
    {
      name: "the code's last box",
      mockup: { css: ".ph-codes > .ph-code >> nth=-1" },
      app: { css: ".nt-code-shown > .nt-code-box >> nth=-1" },
      ...(filled ? ring : {}),
    },
  ];
}

/** The line below the boxes: how to give the code. */
const CODE_HINT: Region = {
  name: "the code's hint",
  mockup: { text: "Tap the boxes to paste the code from your invitation" },
  app: { text: "Tap the boxes to paste the code from your invitation" },
  followsText: "start",
};

/** The mockup's line once the code is filled, which app never says before api has answered. */
const CODE_ACCEPTED: Region = {
  name: "the code's line once filled",
  mockup: { text: "Code accepted" },
  app: { text: "Code accepted" },
  differs: {
    what: ["missing"],
    by: "api alone takes a code, on Create account: app keeps its hint until then",
  },
};

/**
 * Why a tick's mark differs: it holds no words, so its font size draws nothing; and unticked, app
 * draws the ring alone, where the mockup draws its tick in white too.
 */
const NO_WORDS = "the mark holds no words";
const RING_ALONE = "unticked, app draws the ring alone, with no tick in it";

/** The statement's step: its ticks, round, each mark of 24 in a target of 44, and the note below. */
function agree(ticked: boolean): Region[] {
  const mark: Pick<Region, "differs"> = {
    differs: ticked
      ? { what: ["font-size"], by: NO_WORDS }
      : { what: ["font-size", "colour"], by: `${NO_WORDS}; ${RING_ALONE}` },
  };
  return [
    ART_LATER,
    CARD,
    BACK,
    ...heading(
      "Create your account",
      "Create your account",
      "One account holds your own profile and your children’s. Only you sign in",
    ),
    {
      name: "the ticks",
      mockup: { css: 'div:has(> button[role="checkbox"]):has(> div > button[role="checkbox"])' },
      app: { css: ".nt-ticks" },
    },
    {
      name: "the statement's tick",
      mockup: { css: 'button[role="checkbox"] > span:first-child >> nth=0' },
      app: { css: ".nt-tick-mark >> nth=0" },
      ...mark,
    },
    {
      name: "the texts' tick",
      mockup: { css: 'button[role="checkbox"] > span:first-child >> nth=1' },
      app: { css: ".nt-tick-mark >> nth=1" },
      ...mark,
    },
    {
      name: "the note on the texts' language",
      mockup: { text: "Each text is in English, the one in force" },
      app: { text: "Each text is in English, the one in force" },
      followsText: "start",
    },
    LEGAL_WAY,
  ];
}

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
    mockup: { css: 'span:has(> svg[width="54"])' },
    app: { css: ".nt-avatar-profile" },
  },
  {
    name: "the fields",
    mockup: { css: "div:has(> label)" },
    app: { css: ".nt-rows" },
  },
];

/** Why the avatars stand lower: 12 below their button, and the phone's sheet with its ×. */
const AVATARS_HUNG = "the pop-over 12 below its button, the phone's sheet with its ×";

/**
 * The policy and the terms in force, synthetic, and the policy's next version, as api gives them;
 * and a fifth of today's tutor time used, renewing tomorrow at 08:00, as the mockup's ring has it.
 */
function legalRoutes(router: ConnectRouter) {
  router.service(AccountService, {
    getQuota: () => {
      const renews = new Date();
      renews.setDate(renews.getDate() + 1);
      renews.setHours(8, 0, 0, 0);
      return { share: { profilePercent: 20, nextFamilyDay: timestampFromDate(renews) } };
    },
  });
  router.service(LegalService, {
    getLegalTexts: () => ({
      texts: [
        create(LegalTextSchema, {
          id: "privacy-policy",
          version: 2,
          inForceSince: "2026-11-11",
          body: "# Privacy policy\n\nIts words.\n",
          summary: "In short, what is kept, why, and for how long.",
          summaryLanguage: "en",
        }),
        create(LegalTextSchema, {
          id: "terms-of-use",
          version: 1,
          inForceSince: "2026-11-10",
          body: "# Terms of use\n\nIts words.\n",
          summary: "In short, the agreement between the adult and the operator.",
          summaryLanguage: "en",
        }),
      ],
      nextTexts: [
        create(LegalTextSchema, {
          id: "privacy-policy",
          version: 3,
          inForceSince: "2026-11-27",
          body: "# Privacy policy\n\nIts next words.\n",
          summary: "In short, what changes.",
          summaryLanguage: "en",
        }),
      ],
    }),
  });
}

const LEGAL_API = routedApi(legalRoutes);

/** A legal page, opened from home, its text read. */
function legalShown(page: string) {
  const route: Route = { screen: "legal", parts: [page] };
  return () =>
    inLanguage(
      <ApiProvider value={LEGAL_API}>
        <LegalPages route={route} back={HOME_ROUTE} />
      </ApiProvider>,
    );
}

/** A text's sheet over the statement, opened by its name's link, as the mockup's. */
function sheetOver(link: string) {
  return async () => {
    await agreeing();
    await userEvent.click(screen.getByRole("link", { name: link }));
    await screen.findByRole("dialog", { name: link });
  };
}

/**
 * Why the page Accessibility differs from the mockup's sheet: the way back to the list of the legal
 * pages, which the mockup has no list for, before the heading; the whole page open, as it is one of
 * its own. The texts' sheets give the texts api gives, where the mockup's are a sample.
 */
const LISTED = "the way back to the list of the legal pages before the heading";
const OPEN = 'the whole page open, not behind "Read the full text"';
const FROM_API = "the texts come from api, the mockup's are a sample (its «Where it differs»)";

/** The sheet, its heading, the chip under it and its close, of a legal page of that heading. */
function sheetOf(title: string): readonly Region[] {
  return [
    {
      name: "the sheet",
      mockup: { css: ".ph-legal" },
      app: { css: "main.nt-sheet > .nt-column" },
      differs: { what: ["height", "font-size"], by: `${OPEN}; its text at 15, as the gist's` },
    },
    {
      name: "the heading",
      mockup: { css: ".ph-legal > div:first-child > div > span:first-child" },
      app: { role: "heading", name: title },
      followsText: "start",
      differs: { what: ["x"], by: LISTED },
    },
    {
      name: "the chip",
      mockup: { css: ".ph-legal .ph-chip" },
      app: { css: ".nt-version-chip" },
      followsText: "start",
      // On a phone the way back leaves the chip less room, and its words wrap.
      differs: { what: ["x", "height"], by: LISTED },
    },
    {
      name: "the close",
      mockup: { css: ".ph-legal .ib" },
      app: { role: "button", name: "Close" },
      differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
    },
    {
      name: "Read the full text",
      mockup: { role: "button", name: "Read the full text" },
      app: { role: "button", name: "Read the full text" },
      differs: { what: ["missing"], by: OPEN },
    },
  ];
}

/** A text's sheet over the screen: its card, head, gist, and its foot. */
function textSheet(title: string): readonly Region[] {
  return [
    {
      name: "the sheet",
      mockup: { css: ".ph-legal" },
      app: { css: "dialog.nt-legal-sheet" },
      differs: { what: ["y", "height"], by: FROM_API },
    },
    {
      name: "the heading",
      mockup: { css: ".ph-legal > div:first-child > div > span:first-child" },
      app: { role: "heading", name: title },
      followsText: "start",
    },
    {
      name: "the chip",
      mockup: { css: ".ph-legal .ph-chip" },
      app: { css: ".nt-legal-sheet .nt-version-chip" },
      followsText: "start",
    },
    {
      name: "the close",
      mockup: { css: ".ph-legal .ib" },
      app: { role: "button", name: "Close" },
      differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
    },
    {
      name: "the gist's caption",
      mockup: { css: ".ph-legal > div:nth-child(2)" },
      app: { css: ".nt-legal-sheet .nt-sheet-caption" },
      followsText: "start",
    },
    {
      name: "the gist",
      mockup: { css: ".ph-gist" },
      app: { css: ".nt-legal-gist" },
      differs: { what: ["y", "height"], by: FROM_API },
    },
    {
      name: "the English text in force",
      mockup: { text: "The English text is the one in force" },
      app: { css: ".nt-in-force" },
      differs: { what: ["missing"], by: "the line is on a screen in another language alone" },
    },
    {
      name: "Read the full text",
      mockup: { role: "button", name: "Read the full text" },
      app: { role: "button", name: "Read the full text" },
      differs: { what: ["y"], by: FROM_API },
      // The link's blue of app, ACCENT_TEXT below, which is defined after this list is drawn.
      contrast: [{ property: "colour", mockup: "#0071e3", app: "#0066cc" }],
    },
  ];
}

const LEGAL_TEXTS: readonly Compared[] = [
  {
    state: "legal-privacy",
    draw: invite,
    settle: sheetOver("Privacy Policy"),
    regions: [
      ...textSheet("Privacy Policy"),
      {
        name: "the next version",
        mockup: { css: '.ph-legal > div[style*="F5F5F7"]' },
        app: { css: ".nt-legal-sheet .nt-sheet-note" },
        differs: {
          what: ["y", "height"],
          by: `${FROM_API}; the way to the next version's page in it`,
        },
      },
    ],
  },
  {
    state: "legal-terms",
    draw: invite,
    settle: sheetOver("Terms of Use"),
    regions: textSheet("Terms of Use"),
  },
  {
    state: "legal-access",
    draw: legalShown("accessibility"),
    regions: [
      ...sheetOf("Accessibility").filter((region) => region.name !== "Read the full text"),
      {
        name: "the standard's caption",
        mockup: { css: ".ph-legal > div:nth-child(2)" },
        app: { css: "h2.nt-sheet-caption:first-of-type" },
        followsText: "start",
      },
      {
        name: "the standard",
        mockup: { css: ".ph-gist" },
        app: { css: "h2.nt-sheet-caption:first-of-type + p" },
        differs: { what: ["height"], by: "the words of the accessibility standard" },
      },
    ],
  },
];

/**
 * Why the spark differs in its colour and size of text: app draws the name's mark, `Spark`, in the
 * text's colour at 1em, where the mockup gives its SVG a fill and a size of its own — the same fill
 * and 36 either way.
 */
const MARK = "the name's mark, Spark, drawn in the text's colour at 1em: the mockup's fill and 36";

/** The wait on a ground, once its spark has come. */
function waiting(ground: "sky" | "page"): Compared {
  return {
    state: ground === "sky" ? "wait" : "wait-home",
    draw: () => inLanguage(<Waiting ground={ground} />),
    settle: () => screen.findByText("Loading"),
    regions: [
      {
        name: "the spark's halo",
        mockup: { css: ".ph-waitspark" },
        app: { css: ".nt-wait-spark" },
        differs: { what: ["colour", "font-size"], by: MARK },
      },
      {
        name: "the spark",
        mockup: { css: ".ph-waitspark > svg" },
        app: { css: ".nt-wait-spark svg" },
        differs: { what: ["colour", "font-size"], by: MARK },
      },
    ],
  };
}

const WAY_IN: readonly Compared[] = [
  waiting("sky"),
  waiting("page"),
  {
    state: "signin",
    draw: signIn,
    regions: [...SIGN_IN, primary("Sign in with Google", "Sign in with Google")],
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
    regions: [
      ART_LATER,
      CARD,
      ...code(false),
      CODE_HINT,
      primary("Continue", "Continue"),
      LEGAL_WAY,
    ],
  },
  {
    state: "invite-filled",
    draw: invite,
    settle: codeTyped,
    regions: [
      ART_LATER,
      CARD,
      ...code(true),
      CODE_ACCEPTED,
      primary("Continue", "Continue"),
      LEGAL_WAY,
    ],
  },
  {
    state: "agree",
    draw: invite,
    settle: agreeing,
    regions: [...agree(false), primary("Create account", "Create account")],
  },
  {
    state: "agree-ticked",
    draw: invite,
    settle: async () => {
      await agreeing();
      await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
      await userEvent.click(
        screen.getByRole("checkbox", {
          name: "I agree to the Terms of Use and the Privacy Policy",
        }),
      );
    },
    regions: [...agree(true), primary("Create account", "Create account")],
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
        />,
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
        name: "Start, on the owner's card",
        mockup: { css: "button.pf:not(.ph-addp) .ph-pstart" },
        app: { css: ".nt-learners > li:first-child .nt-learner-start" },
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

const OLYMPIAD = "novatrail/olympiad-math";

/** The states of the mockup's skills by their letters: mastered, review, in progress, start, locked. */
const STATUS: Record<string, SkillStatus> = {
  m: "mastered",
  r: "time-to-review",
  p: "in-progress",
  s: "ready-to-start",
  l: "locked",
};

/** The mockup's skills of olympiad maths, tier by tier, each `title:state`. */
const OLYMPIAD_TIERS: readonly (readonly [string, string])[] = [
  [
    "Tier 1 · Basics",
    "Counting on:m|Even and odd:m|Perimeter:m|Comparing numbers:m|Shapes and sides:m|Measuring length:m|Clocks:m|Coins and change:r|Left and right:m|Simple sequences:m|Counting figures:m|Adding in your head:m",
  ],
  [
    "Tier 2 · Patterns",
    "Number patterns:r|Days and cycles:p|Areas of shapes:r|Arithmetic tricks:m|Parity:m|Ordering:m|Enumeration:p|Gaps and boundaries:s|Cubes and paper:s|Symmetry:p|Matchstick puzzles:s|Calendar and age:p",
  ],
  [
    "Tier 3 · Reasoning",
    "Sums of rows:p|Unknowns by balance:s|Pigeonhole principle:l|Knights and liars:l|Grid figures:l|Parts and shares:s|Logic puzzles:p|Overlapping groups:s|Working backwards:s|Motion problems:s|Divisibility:s",
  ],
  [
    "Tier 4 · Olympiad",
    "Staircases:l|Weighing and pouring:l|Winning strategies:l|Percentages:l|Ratios and sharing:l|Remainders and cycles:l|Invariants:l|Colouring arguments:l|Handshakes:l|Extreme principle:l",
  ],
];

/** A module's choice of a task skill, from its tiers: the first three to suggest, as app picks them. */
function picksOf(moduleId: string, tiers: readonly (readonly [string, string])[]): SkillPicks {
  const grouped = tiers.map(([name, list]) => ({
    name,
    skills: list.split("|").map((each): SkillPick => {
      const [title = "", state = "s"] = each.split(":");
      const id = title.toLowerCase().replaceAll(" ", "-");
      return { skill: `${moduleId}/skill/${id}`, title, status: STATUS[state] ?? "ready-to-start" };
    }),
  }));
  const all = grouped.flatMap((tier) => tier.skills);
  const order: readonly SkillStatus[] = ["time-to-review", "in-progress", "ready-to-start"];
  return {
    suggested: order.flatMap((state) => all.filter((each) => each.status === state)).slice(0, 3),
    tiers: grouped,
  };
}

/** The mockup's two modules of the first slice: the states of their skills, the lesson each tile names. */
const MODULES: readonly ModuleCard[] = [
  {
    moduleId: OLYMPIAD,
    title: "Olympiad maths 1–6",
    skills: counts([14, 3, 6, 9, 13]),
    picks: picksOf(OLYMPIAD, OLYMPIAD_TIERS),
    lesson: {
      lesson: `${OLYMPIAD}/lesson/number-patterns`,
      title: "Number patterns",
      step: 2,
      segments: 4,
      open: true,
    },
  },
  {
    moduleId: "novatrail/short-essays",
    title: "Short essays",
    skills: counts([], 18),
    picks: picksOf("novatrail/short-essays", [
      ["Tier 1", "Topic sentence:s|Order of ideas:s|Linking words:s"],
    ]),
    lesson: {
      lesson: "novatrail/short-essays/lesson/first-sentences",
      title: "First sentences",
      step: 1,
      segments: 3,
      open: true,
    },
  },
].map((card, i) => ({ ...card, digest: `sha256:${String(i + 1).repeat(64)}`, language: "en" }));

/** A lesson of the mockup's list: its title, its state, its steps and its group. */
function listed(title: string, state: LessonState, segments: number, group: number) {
  return {
    lesson: `${OLYMPIAD}/lesson/${title.toLowerCase().replaceAll(" ", "-")}`,
    title,
    segments,
    group,
    state,
    // The lesson begun goes on at its second step, as the tile on Home has it.
    endedSegments: state === LessonState.OPEN ? [1] : [],
  };
}

/** The mockup's lessons of olympiad maths, in the author's order, and the one Home's tile names. */
const OLYMPIAD_LESSONS = create(ListLessonsResponseSchema, {
  lessons: [
    listed("Counting on", LessonState.PASSED, 3, 0),
    listed("Even and odd", LessonState.PASSED, 3, 0),
    listed("Clocks", LessonState.PASSED, 4, 0),
    listed("Number patterns", LessonState.OPEN, 4, 1),
    listed("Days and cycles", LessonState.NEW, 4, 2),
    listed("Areas of shapes", LessonState.NEW, 3, 2),
    listed("Sums of rows", LessonState.NEW, 5, 3),
    listed("Pigeonhole principle", LessonState.NEW, 4, 4),
  ],
  tileLesson: `${OLYMPIAD}/lesson/number-patterns`,
});

/** api of the lessons' page and the lesson's end: the frame's, olympiad maths connected, its lessons. */
const LESSONS_API = routedApi((router) => {
  legalRoutes(router);
  router.service(LearningService, { listLessons: () => OLYMPIAD_LESSONS });
  router.service(ModuleService, {
    listConnectedModules: () => ({
      modules: [{ moduleId: OLYMPIAD, packageDigest: `sha256:${"1".repeat(64)}` }],
    }),
  });
});

/** The package of olympiad maths on the device: its manifest alone. */
const OLYMPIAD_PACKAGE = {
  views: {
    get: async (_digest: string, kind: string) =>
      kind === "manifest"
        ? {
            view: {
              module_format_version: "0.4",
              id: OLYMPIAD,
              version: "1.0.0",
              title: "Olympiad maths 1–6",
              languages: { explanation: "en" },
            },
          }
        : undefined,
  },
} as unknown as Packages;

/** api by the routing transport: nothing is asked of it until a press. */
const QUIET = routedApi(() => {});

/** The learner of the mockup, Sam, the owner: an adult, with an avatar of the set. */
const SAM = {
  learner: create(ProfileSchema, {
    profileId: "p1",
    owner: true,
    pseudonym: "Sam",
    avatar: "wave",
    ageCategory: "adult",
  }),
  switchLearner: () => {},
  signOut: () => {},
  openLegal: () => {},
  onSaved: () => {},
  onFailed: () => {},
};

/** A card or a bar, whose words are its own regions': the size of its own text is not drawn. */
const NO_TEXT = "no text of its own: the body's 14 px";

/** The accent as the words of a link or a row on the pop-over's glass (the README's «Contrast»). */
const ACCENT_TEXT = [{ property: "colour", mockup: "#0071e3", app: "#0066cc" }] as const;

/** The tutor's panel: 344 at the right of the iPad, a sheet over the lower half of the phone. */
const PANEL: Region = {
  name: "the tutor's panel",
  mockup: { css: ".ph-tutor" },
  app: { css: "aside.nt-tutor-panel" },
  differs: { what: ["font-size"], by: NO_TEXT },
};

/** The panel's head: the tutor's sign and name, the quota's line, the speaker. */
const PANEL_HEAD: Region = {
  name: "the panel's head",
  mockup: { css: ".ph-tuthead" },
  app: { css: ".nt-tutor-head" },
  differs: { what: ["font-size"], by: NO_TEXT },
};

/** Hint at the panel's foot. */
const HINT_ACT: Region = {
  name: "Hint, at the panel's foot",
  mockup: { css: '.ph-tutor button:text-is("Hint")' },
  app: { css: '.nt-tutor-acts button:text-is("Hint")' },
  followsText: "start",
  contrast: ACCENT_TEXT,
};

/** "Explain differently" beside it, once a rung is said. */
const EXPLAIN_ACT: Region = {
  name: "Explain differently",
  mockup: { css: '.ph-tutor button:text-is("Explain differently")' },
  app: { css: '.nt-tutor-acts button:text-is("Explain differently")' },
  followsText: "start",
  contrast: ACCENT_TEXT,
};

/**
 * Why "Explain differently" is not in sight once said: app shows it only while it takes a press,
 * where the mockup greys it.
 */
const EXPLAINED =
  'app hides "Explain differently" while it takes no press, where the mockup greys it';

/** "Report a problem" under the tutor's newest words. */
const REPORT_OPEN: Region = {
  name: "Report a problem",
  mockup: { css: '.ph-tutor button:text-is("Report a problem") >> nth=-1' },
  app: { css: "button.nt-report-open" },
  followsText: "start",
};

/** The phone's grabber, at the top of the sheet. */
const GRABBER: Region = {
  name: "the grabber",
  mockup: { css: ".ph-grab" },
  app: { css: ".nt-tutor-grab" },
  differs: {
    what: ["colour", "radius", "font-size", "font-weight"],
    by: "app's grabber shows the icon of what it does, Full screen or Half screen, of the closed list of buttons without a caption, where the mockup draws a bar",
  },
};

/**
 * Why the panel's foot, and what scrolls above it, stand lower on a task of a module: the mockup's
 * question field is under the foot on every screen, where app has it on a task from paper alone.
 */
const NO_FIELD = "the mockup's question field under the foot, app's on a task from paper alone";

/** The regions the question field's room moves: the foot's buttons and the report under the words. */
const OVER_FIELD = new Set([HINT_ACT.name, EXPLAIN_ACT.name, REPORT_OPEN.name]);

/**
 * The panel's regions on a task of a module: the grabber on a phone, and Hint at the foot on a phone
 * alone, since from 600 px the row's Hint stands beside the open panel on both sides.
 */
function panelOf(device: Device, ...regions: readonly Region[]): readonly Region[] {
  const phone = device === "phone";
  return [
    PANEL,
    ...regions
      .filter((region) => phone || region !== HINT_ACT)
      .map((region) => (OVER_FIELD.has(region.name) ? differing(region, ["y"], NO_FIELD) : region)),
    ...(phone ? [GRABBER] : []),
  ];
}

/** The verdict's card, 460 wide above the row. */
function card(why?: string): Region {
  return {
    name: "the verdict's card",
    mockup: { css: ".ph-verdict" },
    app: { css: ".nt-card-verdict" },
    differs:
      why === undefined
        ? { what: ["font-size"], by: NO_TEXT }
        : { what: ["x", "y", "height", "font-size"], by: `${why}; ${NO_TEXT}` },
  };
}

/** The card's title, as its words follow. */
const CARD_TITLE: Region = {
  name: "the card's title",
  mockup: { css: ".ph-vtext > span:first-child" },
  app: { css: ".nt-card-title" },
  followsText: "start",
};

/** A screen in the frame of the row of places, as App lays it, for the learner Sam; its bell tells of the policy's next version. */
function framed(place: Place, child: ReactNode, api: Api = LEGAL_API) {
  return inLanguage(
    <ApiProvider value={api}>
      <LearnerProvider value={SAM}>
        <div className="nt-shell">
          <ShellBar place={place} />
          {child}
        </div>
      </LearnerProvider>
    </ApiProvider>,
  );
}

/**
 * Home with the mockup's three modules, a fifth of today's tutor time used in the ring of its frame;
 * "History" stands for the solving history's pop-over, which reads the device's pages.
 */
function home() {
  return framed("home", <OwnHome />);
}

/** Home whose modules keep the task skill chosen on them, as MySubjects has api keep it. */
function OwnHome() {
  const [cards, setCards] = useState(MODULES);
  return (
    <HomeScreen
      connected={cards}
      onTaskSkill={(card, skill) =>
        setCards((all) =>
          all.map((each) =>
            each.moduleId === card.moduleId ? { ...each, taskSkill: skill } : each,
          ),
        )
      }
      onFile={() => {}}
      pages={
        <button type="button" className="nt-paper-pages nt-icon-text">
          <Icon value="history" />
          History
        </button>
      }
    />
  );
}

/** The lessons of olympiad maths, from the row of its lesson on Home. */
function lessonsPage() {
  return framed(
    "home",
    <PackagesProvider value={OLYMPIAD_PACKAGE}>
      <LessonsRoute route={lessonsRoute(OLYMPIAD)} profileId="p1" />
    </PackagesProvider>,
    LESSONS_API,
  );
}

/** The row of places from 600, the tab bar on a phone, and the pills at the right: Home's frame. */
function frameOf(device: Device): readonly Region[] {
  return [
    {
      name: device === "ipad" ? "the row of places" : "the tab bar",
      mockup: { css: "nav.nt-nav" },
      app: { css: "nav.nt-nav" },
      differs: { what: ["font-size"], by: NO_TEXT },
    },
    {
      name: "Home, the place shown",
      mockup: { css: 'nav button[aria-current="page"]' },
      app: { css: 'nav a[aria-current="page"]' },
    },
    {
      name: "the cognitive map, shut",
      mockup: { css: "nav button:has-text('Cognitive map')" },
      app: { css: "nav button:has-text('Cognitive map')" },
    },
    {
      name: "the tutor, shut",
      mockup: { css: '.nt-top-pills button[aria-disabled="true"]' },
      app: { css: '.nt-top-pills button[aria-disabled="true"]' },
      differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
    },
    {
      name: "the pills at the right",
      mockup: { css: ".nt-top-pills" },
      app: { css: ".nt-top-pills" },
      followsText: "end",
      differs: { what: ["font-size"], by: NO_TEXT },
    },
    PILL,
  ];
}

/** The first module's two tiles: its lesson, shut while the lessons are remade, and its tasks, with Solve. */
const TILES: readonly Region[] = [
  {
    name: "the tile of its lesson",
    mockup: { css: '.nt-subject:first-child .nt-mode[data-mode="lesson"]' },
    app: { css: '.nt-subject:first-child .nt-way[data-mode="lesson"]' },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "the lesson's title",
    mockup: { css: '.nt-subject:first-child [data-mode="lesson"] .nt-mode-title' },
    app: { css: '.nt-subject:first-child [data-mode="lesson"] .nt-way-title' },
    followsText: "start",
  },
  {
    name: "Continue",
    mockup: { css: '.nt-subject:first-child [data-mode="lesson"] .nt-mode-go' },
    app: { css: '.nt-subject:first-child [data-mode="lesson"] .nt-way-go' },
  },
  {
    name: "the tile of its tasks",
    mockup: { css: '.nt-subject:first-child .nt-mode[data-mode="tasks"]' },
    app: { css: '.nt-subject:first-child .nt-way[data-mode="tasks"]' },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "the row of the task skill",
    mockup: { css: '.nt-subject:first-child [data-mode="tasks"] button.nt-mode-row' },
    app: { css: '.nt-subject:first-child [data-mode="tasks"] button.nt-way-row' },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Solve",
    mockup: { css: '.nt-subject:first-child [data-mode="tasks"] .nt-mode-go' },
    app: { css: '.nt-subject:first-child [data-mode="tasks"] .nt-way-go' },
  },
];

const HOME: readonly Region[] = [
  {
    name: "the heading",
    mockup: { css: "h1" },
    app: { role: "heading", name: "Home" },
    followsText: "start",
  },
  {
    name: "A task from my paper",
    mockup: { css: ".nt-paper" },
    app: { css: ".nt-paper" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "From a file",
    mockup: { css: "button.nt-paper-file" },
    app: { css: "button.nt-paper-file" },
  },
  {
    name: "the first module",
    mockup: { css: ".nt-subject:first-child" },
    app: { css: ".nt-subject:first-child" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "its squares",
    mockup: { css: ".nt-subject:first-child .nt-dots" },
    app: { css: ".nt-subject:first-child .nt-dots" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  ...TILES,
];

/** The legend standing below the modules, from 600 CSS px. */
const LEGEND: Region = {
  name: "the legend",
  mockup: { css: ".nt-legend" },
  app: { css: ".nt-legend" },
};

/** The profile's pill, whose width follows the pseudonym; on a phone its avatar alone. */
const PILL: Region = {
  name: "the profile's pill",
  mockup: { role: "button", name: "Sam, profile menu" },
  app: { role: "button", name: "Sam, profile menu" },
  followsText: "end",
};

/**
 * Why a colour of a pop-over is read lighter: it is a modal dialog, which makes what it stands on
 * inert, out of the reading's reach, so its glass is read over white.
 */
const OVER_INERT = "a modal dialog, over nothing the reading takes";

/** A pop-over of the frame, by its name on either side. */
function popOver(name: string, mockup: string, app = mockup): Region {
  return {
    name,
    mockup: { css: `div.nt-pop[aria-label="${mockup}"]` },
    app: { role: "dialog", name: app },
    differs: { what: ["background", "border", "font-size"], by: `${OVER_INERT}; ${NO_TEXT}` },
  };
}

/**
 * Why which tasks to solve stands elsewhere on the iPad: with no room under its tile in the window,
 * app's modal dialog stands from the window's top and hangs from the tile's start, as each of its
 * pop-overs; the mockup's hangs under the tile, at its end, past the window's edge.
 */
const PICK_PLACED = "a modal dialog kept in the window, hung from its tile's start";

/** Which tasks to solve, open from the first module's tile: the tutor's choice and the skills. */
const PICK: readonly Region[] = [
  {
    name: "which tasks to solve",
    mockup: { css: 'div.nt-pop.nt-pick[aria-label="Which tasks to solve?"]' },
    app: { role: "dialog", name: "Which tasks to solve?" },
    differs: { what: ["background", "border", "font-size"], by: `${OVER_INERT}; ${NO_TEXT}` },
  },
  {
    name: "its title",
    mockup: { css: ".nt-pick-title" },
    app: { css: ".nt-pick-title" },
    followsText: "start",
  },
  {
    name: "the tutor chooses",
    mockup: { css: "button.nt-pick-ai" },
    app: { css: "button.nt-pick-ai" },
    differs: { what: ["background"], by: OVER_INERT },
  },
  {
    name: "a skill suggested",
    mockup: { css: ".nt-pick-group:first-of-type button.nt-pick-chip:first-child" },
    app: { css: ".nt-pick-group:first-of-type button.nt-pick-chip:first-child" },
    differs: { what: ["background"], by: OVER_INERT },
  },
];

/** The lessons of a module: Home back, the heading, the module, and the rows of its groups. */
const LESSONS: readonly Region[] = [
  {
    name: "Home, back",
    mockup: { css: 'main button:text-is("Home")' },
    app: { css: "button.nt-back-link" },
    followsText: "start",
  },
  {
    name: "the heading",
    mockup: { css: 'h1:text-is("Lessons of the module")' },
    app: { role: "heading", name: "Lessons of the module" },
    followsText: "start",
  },
  {
    name: "the module",
    mockup: { css: "main h1 + span" },
    app: { css: "p.nt-lessons-module" },
    followsText: "start",
  },
  {
    name: "the first group",
    mockup: { css: "main section:first-of-type" },
    app: { css: "section.nt-lessons-group:first-of-type" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "the lesson begun",
    mockup: { css: 'button[aria-label^="Number patterns"]' },
    app: { css: 'button.nt-lessons-row:has(.nt-lessons-sub[data-state="begun"])' },
  },
  {
    name: "the last lesson",
    mockup: { css: 'button[aria-label^="Pigeonhole principle"]' },
    app: { css: "section.nt-lessons-group:last-of-type button.nt-lessons-row" },
  },
];

/**
 * Why Help stands taller than the mockup: its first item says that the AI checks a task from
 * paper and a program the rest, a line the mockup has not taken yet.
 */
const AI_CHECKS = "the line that the AI checks a task from paper, which the mockup has not";

/** The adult's Help in the profile's menu, in its rows' place, with the way back to them. */
const HELP: readonly Region[] = [
  PILL,
  {
    ...popOver("the profile's menu on Help", "Help", "Profile menu"),
    differs: {
      what: ["background", "border", "font-size", "height"],
      by: `${OVER_INERT}; ${NO_TEXT}; ${AI_CHECKS}`,
    },
  },
  {
    name: "back to the menu",
    mockup: { role: "button", name: "Profile" },
    app: { role: "button", name: "Profile" },
    followsText: "start",
    differs: { what: ["background"], by: OVER_INERT },
  },
  {
    name: "The tutor is an AI",
    mockup: { css: 'div.nt-pop span:text-is("The tutor is an AI")' },
    app: { css: ".nt-help-item:first-of-type > b" },
    followsText: "start",
    differs: { what: ["y"], by: AI_CHECKS },
  },
  {
    name: "Privacy Policy",
    mockup: { role: "button", name: "Privacy Policy" },
    app: { role: "button", name: "Privacy Policy" },
    followsText: "start",
    differs: { what: ["background"], by: OVER_INERT },
  },
];

/**
 * Why a row of the phone's sheet is of another white: the mockup's sheet is white at 0.98 and shows
 * what lies under it, where app's card of what comes next stands taller, its way to what comes
 * next at its foot.
 */
const SHEET_SEES_THROUGH = "the mockup's sheet at 0.98 shows Home under it, of other heights";

/** The profile's menu, open: who is learning, Switch learner, Settings, Help and Sign out. */
const MENU: readonly Region[] = [
  PILL,
  popOver("the profile's menu", "Profile", "Profile menu"),
  ...["Switch learner", "Settings", "Help", "Sign out"].map(
    (name): Region => ({
      name,
      mockup: { role: "button", name },
      app: { role: "button", name },
      differs: { what: ["background"], by: SHEET_SEES_THROUGH },
    }),
  ),
];

/** The notifications, open: nothing new yet. */
const BELL: readonly Region[] = [
  {
    name: "the bell",
    mockup: { role: "button", name: "Notifications" },
    app: { role: "button", name: "Notifications" },
    differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
  },
  popOver("the notifications", "Notifications"),
];

/** The ring of tutor time at the top right, a fifth used, and its pop-over. */
const QUOTA: readonly Region[] = [
  {
    name: "the ring of tutor time",
    mockup: { role: "button", name: "Tutor time: 20% used today" },
    app: { role: "button", name: "Tutor time: 20% used today" },
    differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
  },
  {
    ...popOver("the pop-over of tutor time", "Tutor time"),
    differs: {
      what: ["x", "y", "height", "background", "border", "font-size"],
      by: `the mockup's DEMO row of shares at its foot, which app has not; ${OVER_INERT}; ${NO_TEXT}`,
    },
  },
];

/** The facts of a module of the mockup's Subjects: its subject and grades, by the NovaTrail authors. */
function aboutOf(subject: string, grades: number[]): ModuleAbout {
  return {
    subject,
    ageCategories: ["under_13"],
    grades,
    version: "0.1.0",
    authors: ["The NovaTrail authors"],
    license: "Apache-2.0",
  };
}

/** Skills of a module by tier: the three the mockup's card names first, and the rest to its count. */
function skillsOf(named: string[], count: number, rubric = false): SkillList {
  const rest = Array.from({ length: count - named.length }, (_, i) => `Skill ${i + 1}`);
  return { tiers: [{ tier: 1, skills: [...named, ...rest] }], count, rubric };
}

/** Subjects, the catalog, with the three modules connected and the check board to connect. */
function subjects() {
  const about: readonly Pick<ModuleCard, "about" | "skillList">[] = [
    {
      about: aboutOf("mathematics", [1, 2, 3, 4, 5, 6]),
      skillList: skillsOf(["Number patterns", "Logic puzzles", "Perimeter"], 45),
    },
    {
      about: aboutOf("mathematics", [3]),
      skillList: skillsOf(["Numbers to 1000", "Multiplying by 6–9", "Hours and minutes"], 36),
    },
    {
      about: { ...aboutOf("writing", []), ageCategories: ["from_13_to_consent", "adult"] },
      skillList: skillsOf(["Topic sentence", "Order of ideas", "Linking words"], 18, true),
    },
  ];
  const connected = MODULES.map((card, i) => ({ ...card, ...about[i] }));
  const board: ModuleCard = {
    moduleId: "novatrail/check-board",
    title: "Introductory block",
    digest: `sha256:${"4".repeat(64)}`,
    language: "en",
    about: { ...aboutOf("mathematics", []), ageCategories: ["adult"] },
    skillList: skillsOf(["Arithmetic", "Word problems", "Equations"], 3),
  };
  return framed(
    "subjects",
    <CatalogScreen
      connected={connected}
      catalog={[...connected, board]}
      onConnect={() => {}}
      onDisconnect={() => {}}
    />,
  );
}

/**
 * Why a card of Subjects is shorter than the mockup's: a module's manifest has no words of what it
 * teaches, and skill-map keeps the titles of the anchor skills it builds on to itself.
 */
const NO_ABOUT =
  "a manifest has no words of what a module teaches, and the anchor skills it builds on are not named";

const SUBJECTS_REGIONS: readonly Region[] = [
  {
    name: "the heading",
    mockup: { css: 'h1:text-is("Subjects")' },
    app: { role: "heading", name: "Subjects" },
    followsText: "start",
  },
  {
    name: "the first module connected",
    mockup: { css: 'div[data-card="Olympiad maths 1–6"]' },
    app: { css: "section:first-of-type .nt-catalog-card:first-child" },
    differs: { what: ["height", "font-size"], by: `${NO_ABOUT}; ${NO_TEXT}` },
  },
];

/** A module's skill map in the mockup's frame, the map itself a line: skill-map draws it. */
function skillMap(title: string) {
  return () =>
    framed(
      "subjects",
      <MapScreen
        title={`Skill map: ${title}`}
        profileId="p1"
        module={{ moduleId: "novatrail/olympiad-math", title, language: "en" }}
      >
        <p>Choose a skill on the map to practise it.</p>
      </MapScreen>,
    );
}

/** The skill map's head and its frame. */
const MAP: readonly Region[] = [
  {
    name: "Subjects, back",
    mockup: { css: 'button:text-is("Subjects")' },
    app: { css: "button.nt-back-link" },
    followsText: "start",
  },
  {
    name: "the heading",
    mockup: { css: 'h1:text-is("Skill map")' },
    app: { role: "heading", name: "Skill map" },
    followsText: "start",
  },
  {
    name: "the module",
    mockup: { css: 'button[aria-label^="Module: "]' },
    app: { css: "button.nt-module-pill" },
    followsText: "start",
  },
  {
    name: "the frame",
    mockup: { css: ".ph-mapframe" },
    app: { css: ".nt-map-frame" },
    differs: {
      what: ["y", "height", "font-size"],
      by: `the legend above the frame is skill-map's, inside it; ${NO_TEXT}`,
    },
  },
];

/** The lesson's top bar: its pill, Back that leaves the lesson, and its heading of two lines. */
const LESSON_BAR: readonly Region[] = [
  {
    name: "the top bar",
    mockup: { css: 'div.glass:has(> button[aria-label="Leave the lesson"])' },
    app: { css: ".nt-top-pill" },
    followsText: "start",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Leave the lesson",
    mockup: { css: 'div.glass > button[aria-label="Leave the lesson"]' },
    app: { css: '.nt-top-pill button[aria-label="Leave the lesson"]' },
    differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
  },
  {
    name: "the heading, which opens the segments",
    mockup: { css: "button.ph-ttl" },
    app: { css: ".nt-top-heading" },
    followsText: "start",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "the lesson's title",
    mockup: { css: "button.ph-ttl > span:first-child" },
    app: { css: ".nt-top-heading .nt-top-title" },
    followsText: "start",
  },
];

/** The row of glass at the bottom, and its Continue. */
const LESSON_ROW: readonly Region[] = [
  {
    name: "the row",
    mockup: { css: ".ph-row" },
    app: { css: ".nt-lesson-row" },
    followsText: "centre",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Continue",
    mockup: { role: "button", name: "Continue" },
    app: { role: "button", name: "Continue" },
    followsText: "centre",
  },
];

/** The format gives a segment no title of its own: the caption is its kind. */
const NO_SEGMENT_TITLE = "a segment has no title in the format";

/** The explanation's card of reading, its caption and Read aloud. */
const EXPLANATION: readonly Region[] = [
  {
    name: "the card",
    mockup: { css: ".ph-read" },
    app: { css: '.nt-segment-body[data-kind="explanation"]' },
  },
  {
    name: "its caption",
    mockup: { css: '.ph-read span:text-is("Explanation")' },
    app: { css: ".nt-segment-body > h2" },
    followsText: "start",
  },
  {
    name: "Read aloud",
    mockup: { css: '.ph-read button[aria-label="Read aloud"]' },
    app: { css: '.nt-segment-body button[aria-label="Read aloud"]' },
    differs: { what: ["y", "font-size", "font-weight"], by: `${NO_SEGMENT_TITLE}; ${ICON_ALONE}` },
  },
];

/** Why the pop-over is shorter: the mockup's DEMO switch of the tutor's time is not the app's. */
const NO_DEMO = 'the mockup\'s switch "DEMO Tutor time used up" (its README, the last row)';

/** The segments' pop-over, its first segment and the way out of the lesson. */
const SEGMENTS: readonly Region[] = [
  {
    name: "the pop-over",
    mockup: { css: 'div.glass.nt-pop:has(nav[aria-label="Segments of the lesson"])' },
    app: { role: "dialog", name: "Segments of the lesson" },
    differs: { what: ["y", "height", "font-size"], by: `${NO_DEMO}; ${NO_TEXT}` },
  },
  {
    name: "the first segment",
    mockup: { css: 'nav[aria-label="Segments of the lesson"] > button:first-of-type' },
    app: { css: ".nt-segment-list > li:first-child > button" },
    differs: { what: ["y", "font-size", "font-weight"], by: `${NO_DEMO}; ${NO_TEXT}` },
  },
  {
    name: "Leave the lesson, in the pop-over",
    mockup: { css: 'div.nt-pop button.row:text-is("Leave the lesson")' },
    app: { css: ".nt-segments-leave" },
    followsText: "start",
    differs: { what: ["y"], by: NO_DEMO },
  },
];

/**
 * Why the canvas's row is wider on a phone: it keeps the line between Demo and the lesson's
 * Continue, which the mockup's phone hides; and why Next is paler with every part open: canvas pales
 * a button that does not act by its colour, the mockup by its opacity.
 */
const ROW_LINE = "the canvas's row keeps its line on a phone";
const PALE = "canvas pales a button that does not act by its colour, not its opacity";

/** The canvas's row of a worked example on a device, all its parts open or not. */
function exampleRow(device: Device, open = false): readonly Region[] {
  const phone = device === "phone";
  return EXAMPLE_ROW.map((region) => {
    const what: ("x" | "colour")[] = [];
    const by: string[] = [];
    if (phone && region.name !== EXAMPLE_ROW[0]?.name) {
      what.push("x");
      by.push(ROW_LINE);
    }
    if (open && region.name === "Next") {
      what.push("colour");
      by.push(PALE);
    }
    return what.length === 0 ? region : { ...region, differs: { what, by: by.join("; ") } };
  });
}

/** The canvas's row of a worked example: Next, Demo and the lesson's Continue. */
const EXAMPLE_ROW: readonly Region[] = [
  {
    name: "the row of Next, Demo and Continue",
    mockup: { css: 'div.glass:has(> button:text-is("Next"))' },
    app: { css: ".tools.row" },
    followsText: "centre",
    // Its words are its buttons', compared below.
    differs: { what: ["font-size"], by: "no text of its own" },
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
];

/** The end of the lesson: its card, the tile, the title, the line and the two ways on. */
const LESSON_END: readonly Region[] = [
  {
    name: "the card",
    mockup: { css: ".ph-endcard" },
    app: { css: ".nt-end > .nt-column" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "the module's tile",
    mockup: { css: ".ph-endcard > span:first-child" },
    app: { css: ".nt-end-tile" },
    differs: { what: ["font-size", "font-weight"], by: "the letter is drawn by CSS" },
  },
  {
    name: "the lesson's title",
    mockup: { css: ".ph-endcard h1" },
    app: { css: ".nt-end h1" },
    followsText: "centre",
  },
  {
    name: "Lesson complete",
    mockup: { css: '.ph-endcard span:text-is("Lesson complete")' },
    app: { css: ".nt-end-done" },
    followsText: "centre",
  },
  {
    name: "Next lesson",
    mockup: { role: "button", name: "Next lesson" },
    app: { role: "button", name: "Next lesson" },
  },
  {
    name: "Solve",
    mockup: { role: "button", name: "Solve" },
    app: { role: "button", name: "Solve" },
  },
  {
    name: "Back to Home",
    mockup: { role: "button", name: "Back to Home" },
    app: { role: "button", name: "Back to Home" },
    contrast: ACCENT_TEXT,
  },
];

/** A region that differs as well by what `what` and `by` name. */
function differing(
  region: Region,
  what: NonNullable<Region["differs"]>["what"],
  by: string,
): Region {
  return {
    ...region,
    differs: {
      what: [...(region.differs?.what ?? []), ...what],
      by: region.differs === undefined ? by : `${by}; ${region.differs.by}`,
    },
  };
}

/** "Try again" in the card of "Not yet". */
const TRY_AGAIN: Region = {
  name: "Try again",
  mockup: { css: '.ph-verdict button:text-is("Try again")' },
  app: { role: "button", name: "Try again" },
  followsText: "end",
  contrast: ACCENT_TEXT,
};

/** Settings, the section for adults, at the hash: Sam's account, its owner alone. */
function SettingsDrawn() {
  const route = useRoute();
  return (
    <AdultSection
      route={route.screen === "adults" ? route : { screen: "adults", parts: [] }}
      device={memoryDevice().device}
      profiles={[SAM.learner]}
      onSaved={() => {}}
      onFailed={() => {}}
      onEraseAll={async () => "erased"}
      onLegal={() => {}}
    />
  );
}

/** Settings from its page given: its list, or a page of it. */
function settings(route: readonly string[] = []) {
  return () => {
    window.location.hash = `#/adults${route.map((part) => `/${part}`).join("")}`;
    return inLanguage(
      <ApiProvider value={QUIET}>
        <SettingsDrawn />
      </ApiProvider>,
    );
  };
}

/** The api of the own key's page: Anthropic alone takes one, as the mockup draws it. */
const KEY_API = routedApi((router) =>
  router.service(AccountService, {
    listOwnKeyProviders: () => ({ providers: [{ provider: "anthropic", name: "Anthropic" }] }),
  }),
);

/** The own key's page with Sam's profile open: a key connected and kept, or none. */
function ownKey(connected: boolean) {
  return () => {
    window.location.hash = "#/adults/own-key";
    // A synthetic key: no provider issued it.
    let kept: KeptKey | undefined = connected
      ? { provider: "anthropic", name: "Anthropic", key: "sk-ant-synthetic-7f3a", last4: "7f3a" }
      : undefined;
    const holder = new KeyHolder({
      read: async () => kept,
      keep: async (_, key) => {
        kept = key;
        return "saved";
      },
      drop: async () => {
        kept = undefined;
      },
    });
    void holder.open(SAM.learner.profileId);
    return inLanguage(
      <ApiProvider value={KEY_API}>
        <KeyHolderProvider holder={holder}>
          <SettingsDrawn />
        </KeyHolderProvider>
      </ApiProvider>,
    );
  };
}

/** Why the page's heading is wider than the mockup's: it names whose page it is. */
const WHOSE =
  "the heading of a profile's page says whose it is, \"Profile: Sam\", the mockup's the name";
/** Why a row's words are not the mockup's: app keeps the words of its documents. */
const APP_WORDS =
  'app\'s own words: "This device", "Pseudonym", "Default mode", the mockup\'s "This iPad", "Name", "Each task begins"';
/** Why the close is not the mockup's: app's close of its closed list of icon buttons, on every sheet. */
const CLOSE = "app's close of its closed list of icon buttons, its glass ring a shadow";
/** Why Save waiting for a change is darker than the mockup's: its words keep the contrast of text. */
const SAVE_WAITS =
  "Save waiting for a change keeps the contrast of text, 4.5:1, the mockup's the grey of a switched-off control";

/** The section's list: its heading, its close, the owner's row and the groups of the device and of the texts. */
function listOf(device: Device): readonly Region[] {
  const side = device === "ipad" ? ".nt-set-side" : "main.nt-settings-list";
  return [
    {
      name: "the heading Settings",
      mockup: { css: ".st-sidehead h1" },
      app: { css: device === "ipad" ? ".nt-set-side-title" : "main h1" },
      followsText: "start",
    },
    {
      name: "the close",
      mockup: { role: "button", name: "Close the settings" },
      app: { role: "button", name: "Close the settings" },
      differs: { what: ["border", "font-size", "font-weight"], by: CLOSE },
    },
    {
      name: "the owner's row",
      mockup: { css: ".st-side .st-prof" },
      app: { css: `${side} .nt-set-profiles .nt-set-row` },
    },
    {
      name: "the group of the device, the language and the key",
      mockup: { css: ".st-side > .st-group:nth-child(3)" },
      app: { css: `${side} > section:nth-of-type(2) > .nt-set-group` },
      differs: {
        what: ["height"],
        by: "the own key is the owner's as an adult learner: Sam's account has it",
      },
    },
    {
      name: "the quiet link Privacy",
      mockup: { css: ".st-side > button" },
      app: { css: `${side} > p.nt-set-foot > button` },
    },
  ];
}

/**
 * A profile's page beside the list or alone: its bar, Save — waiting for a change, or lit by one —,
 * its avatar and its group of hints.
 */
const profilePage = (lit: boolean): readonly Region[] => [
  {
    name: "the page's heading",
    mockup: { css: ".st-bar h2" },
    app: { css: "main h1" },
    followsText: "centre",
    differs: { what: ["x"], by: WHOSE },
  },
  {
    name: "Save",
    mockup: { css: ".st-save" },
    app: { css: ".nt-set-save" },
    followsText: "end",
    ...(lit ? { contrast: ACCENT_TEXT } : { differs: { what: ["colour"], by: SAVE_WAITS } }),
  },
  {
    name: "the avatar",
    mockup: { css: ".st-av-big" },
    app: { css: ".nt-set-hero .nt-avatar" },
  },
  {
    name: "the group Hints",
    mockup: { css: ".st-col > .st-sec:nth-child(3) > .st-group" },
    app: { css: "form > section:nth-of-type(2) > .nt-set-group" },
    differs: { what: ["y"], by: APP_WORDS },
  },
];

const SETTINGS: readonly Compared[] = [
  ...DEVICES.map(
    (device): Compared => ({
      state: "settings",
      devices: [device],
      draw: settings(),
      regions: [...listOf(device), ...(device === "ipad" ? profilePage(false) : [])],
    }),
  ),
  {
    state: "settings-profile",
    draw: settings(),
    settle: async () => {
      // The phone's list leads to the page; on the iPad it stands beside the list.
      const row = screen.queryByRole("button", { name: "Sam Your profile", current: false });
      if (document.querySelector(".nt-set-side") === null && row !== null)
        await userEvent.click(row);
      await userEvent.click(await screen.findByRole("radio", { name: "Questions only" }));
    },
    regions: profilePage(true),
  },
  {
    state: "settings-unsaved",
    draw: settings(),
    settle: async () => {
      const row = screen.queryByRole("button", { name: "Sam Your profile", current: false });
      if (document.querySelector(".nt-set-side") === null && row !== null)
        await userEvent.click(row);
      await userEvent.click(await screen.findByRole("radio", { name: "Questions only" }));
      // The phone's page leaves by its way back, the iPad's by the close: the question is the same.
      const back = document.querySelector<HTMLElement>(".nt-set-back");
      await userEvent.click(back ?? screen.getByRole("button", { name: "Close the settings" }));
    },
    regions: [
      {
        name: "the question, Save changes?",
        mockup: { role: "alertdialog", name: "Save changes?" },
        app: { role: "alertdialog", name: "Save changes?" },
        differs: { what: ["font-size"], by: NO_TEXT },
      },
      {
        name: "its Save",
        mockup: { css: "[role=alertdialog] button:nth-of-type(1)" },
        app: { css: "[role=alertdialog] button.nt-unsaved-save" },
      },
      {
        name: "its Don’t Save",
        mockup: { css: "[role=alertdialog] button:nth-of-type(2)" },
        app: { css: "[role=alertdialog] button.nt-unsaved-drop" },
      },
    ],
  },
  {
    state: "settings-device",
    draw: settings(["device"]),
    regions: [
      {
        name: "the page's heading",
        mockup: { css: ".st-bar h2" },
        app: { css: "main h1" },
        followsText: "centre",
        differs: { what: ["x"], by: APP_WORDS },
      },
    ],
  },
];

/** The page's heading, in the middle of its bar. */
const KEY_HEADING: Region = {
  name: "the page's heading",
  mockup: { css: ".st-bar h2" },
  app: { css: "main h1" },
  followsText: "centre",
};

/** The group under the key's form or its actions: what happens to the key, four rows. */
const ABOUT_KEY: Region = {
  name: "the group About the key",
  mockup: { css: ".st-col > .st-sec:last-child > .st-group" },
  app: { css: ".nt-set-about > .nt-set-group" },
};

const OWN_KEY: readonly Compared[] = [
  {
    state: "settings-key",
    draw: ownKey(false),
    settle: () => screen.findByRole("button", { name: "AI provider Anthropic" }),
    regions: [
      KEY_HEADING,
      {
        name: "the group of the provider and the key",
        mockup: { css: ".st-col > .st-sec:nth-child(1) > .st-group" },
        app: { css: "form > section:nth-of-type(1) > .nt-set-group" },
      },
      {
        name: "the switch Keep on this device",
        mockup: { css: ".st-col > .st-sec:nth-child(2) .st-switch" },
        app: { css: "form > section:nth-of-type(2) .nt-set-switch" },
      },
      {
        name: "Connect, waiting for a key",
        mockup: { css: ".st-col > .st-sec:nth-child(3) .st-action" },
        app: { css: "form > section:nth-of-type(3) .nt-set-action" },
        followsText: "centre",
      },
      ABOUT_KEY,
    ],
  },
  {
    state: "settings-key-on",
    draw: ownKey(true),
    settle: () => screen.findByText("Key ending in 7f3a"),
    regions: [
      KEY_HEADING,
      {
        name: "the key connected",
        mockup: { css: ".st-col > .st-sec:nth-child(1) > .st-group" },
        app: { css: '.nt-set-group:has(> [role="status"])' },
      },
      {
        name: "Remove key",
        mockup: { role: "button", name: "Remove key" },
        app: { role: "button", name: "Remove key" },
        followsText: "centre",
      },
      ABOUT_KEY,
    ],
  },
];

/** A task of the olympiad module with a choice: which month comes after November. */
const MONTHS: open.Task = {
  id: "months",
  statement: [{ text: "The year begins in January. Which month comes after November?" }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "choice", options: ["October", "December", "January"] }] }],
};

/** How api answers a module's task as the mockup's states draw it. */
interface ModuleDrawn {
  readonly task?: open.Task;
  /** The learner's own task skill: none while the tutor picks. */
  readonly own?: string;
  /** The answer to a Check; none, and Check waits for ever. */
  readonly answer?: "not-yet" | "correct" | "unchecked";
  /** The Check goes on to a later model while it is read. */
  readonly closer?: boolean;
  /** An essay's feedback to its submission, and the criteria Done gives. */
  readonly essay?: { readonly feedback: string; readonly criteria: readonly string[] };
}

/** The skills of the olympiad module as api gives them: its graph, its tiers and the learner's map. */
function olympiadSkills() {
  const skills: Record<string, { title: string; assessability: string; prerequisites?: string[] }> =
    {};
  const tiers: Record<string, number> = {};
  const stated: {
    skill: string;
    evidenceCount?: number;
    masteryBand?: string;
    reviewDue?: boolean;
  }[] = [];
  let first = "";
  OLYMPIAD_TIERS.forEach(([, list], tier) => {
    for (const each of list.split("|")) {
      const [title = "", state = "s"] = each.split(":");
      const id = title.toLowerCase().replaceAll(" ", "-");
      if (first === "" && state === "s") first = id;
      skills[id] = {
        title,
        assessability: "verdict",
        ...(state === "l" ? { prerequisites: [first] } : {}),
      };
      tiers[id] = tier + 1;
      stated.push(
        state === "m" || state === "r"
          ? {
              skill: id,
              evidenceCount: 4,
              masteryBand: "b1",
              ...(state === "r" ? { reviewDue: true } : {}),
            }
          : state === "p"
            ? { skill: id, evidenceCount: 2 }
            : { skill: id },
      );
    }
  });
  return { skills, tiers, stated };
}

const MODULE_DIGEST = `sha256:${"1".repeat(64)}`;

/** api of a module's task on the sheet, as the mockup's states have it. */
function moduleApi({ task = DOTS, own, answer, closer = false, essay }: ModuleDrawn) {
  const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
  const { skills, tiers, stated } = olympiadSkills();
  const taskSkill =
    own === undefined ? "" : `${OLYMPIAD}/skill/${own.toLowerCase().replaceAll(" ", "-")}`;
  const verdict = answer === "correct" ? "correct" : "not_yet";
  const value = task === MONTHS ? (answer === "correct" ? "December" : "October") : "32";
  return routedApi((router) => {
    // Sam has the debug right, as the mockup draws its button at the row's start.
    router.service(DebugService, { getDebug: () => ({}) });
    router.service(AccountService, { getQuota: () => ({ share: { profilePercent: 30 } }) });
    router.service(LearningService, {
      getOpenAttempt: (request) => ({
        attempt: {
          start: {
            attemptId: request.attemptId,
            task: { json: encode(task), moduleFormatVersion: "0.4" },
            packageDigest: MODULE_DIGEST,
          },
        },
      }),
    });
    router.service(AttemptService, {
      async submitWork() {
        if (answer === undefined) return new Promise<never>(() => {});
        if (answer === "unchecked") {
          const renews = new Date(Date.now() + 3 * 3_600_000);
          return { outcome: { cause: Cause.QUOTA, nextFamilyDay: timestampFromDate(renews) } };
        }
        return {
          items: [{ verdict, answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict, value }] }],
          wrongAnswers: answer === "correct" ? 0 : 1,
          ...(answer === "correct" ? { solved: {} } : {}),
        };
      },
      ...(closer ? { getCheckProgress: () => ({ going: true, model: 1, models: 3 }) } : {}),
      submitEssay: () => ({ end: SubmissionEnd.FEEDBACK, feedback: essay?.feedback ?? "" }),
      done: () => ({ solved: { criteria: [...(essay?.criteria ?? [])] } }),
      getRungWords: () => ({ rung: 1, words: DOTS_RUNG }),
      getCorrectAnswerWords: () => ({ words: "That's it — well done. What helped you most here?" }),
      explainDifferently: () => ({ words: DOTS_ALT }),
      getHint: () => ({
        hint: { case: "techniques", value: { techniqueIds: [] } },
        leadingQuestion: DOTS_HINT.question ?? "",
      }),
    });
    router.service(ModuleService, {
      listConnectedModules: () => ({
        modules: [{ moduleId: OLYMPIAD, packageDigest: MODULE_DIGEST, taskSkill }],
      }),
    });
    router.service(ProgressService, {
      getSkillMap: () => ({ packageDigest: MODULE_DIGEST, skills: stated }),
    });
    router.service(PackageService, {
      getManifest: () => ({
        manifest: {
          json: encode({
            module_format_version: "0.4",
            id: OLYMPIAD,
            version: "1.0.0",
            title: "Olympiad maths 1–6",
            subject: "mathematics",
            audience: { age_categories: ["under_13"], grades: [1, 2, 3, 4, 5, 6] },
            languages: { explanation: "en" },
            authors: [{ name: "The NovaTrail authors" }],
            license: "Apache-2.0",
          }),
          moduleFormatVersion: "0.4",
        },
      }),
      getSolvingSteps: () => ({}),
      getTechniques: () => ({}),
      getSkillGraph: () => ({
        skillGraph: { json: encode({ skills }), moduleFormatVersion: "0.4" },
        skillTiers: tiers,
      }),
    });
  });
}

/** The task of a module on the sheet of a task from paper, for Sam, an adult, with api as drawn. */
function aModule(drawn: ModuleDrawn = {}) {
  return () => {
    const api = moduleApi(drawn);
    const { device } = memoryDevice();
    const packages = {
      views: new OpenViews({ api, device, stale: () => {} }),
      checks: { check: async () => {} },
      files: new DeviceFiles({
        api: "https://api.example.org",
        withdrawn: () => {},
        fetch: async () => new Response(null, { status: 404 }),
      }),
    } as unknown as Packages;
    return inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>
          <LearnerProvider value={SAM}>
            <Task profileId="p1" attemptId="a1" device={device} adult onAttempt={() => {}} />
          </LearnerProvider>
        </PackagesProvider>
      </ApiProvider>,
    );
  };
}

/** The sheet drawn, with its bar, and the pill named. */
async function moduleDrawn() {
  await barDrawn();
  await waitFor(() => expect(document.querySelector(".nt-skill-name")).toBeTruthy(), {
    timeout: 10_000,
  });
}

/** A stroke on the sheet, given to it and told as the element tells one. */
function strokeOn() {
  const element = document.querySelector<CanvasElement>("novatrail-canvas");
  if (element === null) throw new Error("no sheet");
  const write: HistoryEvent = {
    kind: "write",
    t: 30,
    stroke: {
      id: 1,
      kind: "pen",
      points: [
        { x: 300, y: 300, t: 10, p: 0.5 },
        { x: 340, y: 360, t: 30, p: 0.5 },
      ],
    },
  };
  element.history = [write];
  element.dispatchEvent(
    new CustomEvent("historychange", { detail: { from: 0, events: [write] }, bubbles: true }),
  );
}

/** An option of the tracing paper tapped, as the element tells a tap. */
function optionTapped(option: number) {
  document
    .querySelector("novatrail-canvas")
    ?.dispatchEvent(
      new CustomEvent("optiontap", { detail: { option }, bubbles: true, composed: true }),
    );
}

/** The work written, then Check pressed: the card that comes. */
async function checked(choose?: number) {
  await moduleDrawn();
  if (choose === undefined) strokeOn();
  else optionTapped(choose);
  await waitFor(() =>
    expect(document.querySelector("button.nt-check-button")).toHaveAttribute(
      "aria-disabled",
      "false",
    ),
  );
  await userEvent.click(screen.getByRole("button", { name: "Check" }));
  await waitFor(() => expect(document.querySelector(".nt-card-verdict")).toBeTruthy());
}

/** A region of the tutor's panel, not of the debug window, which the mockup draws beside it. */
function inTutor(region: Region): Region {
  return "css" in region.mockup
    ? { ...region, mockup: { css: `.ph-tutor ${region.mockup.css}` } }
    : region;
}

/** The panel's regions on a module's task on the sheet, as `panelOf` gives them. */
function sheetPanelOf(device: Device, ...regions: readonly Region[]): readonly Region[] {
  return panelOf(device, ...regions).map((region) =>
    region === PANEL_HEAD || region === GRABBER ? inTutor(region) : region,
  );
}

/** Why the row's buttons stand apart from the mockup's. */
const ROW_APART =
  "the row of a task from paper: a line after the debug button, Check's padding, and Ask's word wherever the row fits it, where the mockup's phone gives its sign alone";

/** The row of a task from paper and of a module's: Ask, Hint and Check. */
const SHEET_ROW: readonly Region[] = [
  {
    name: "the row",
    mockup: { css: ".ph-row" },
    app: { css: ".nt-task-row" },
    followsText: "centre",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Ask",
    mockup: { css: ".ph-row button.ph-ask" },
    app: { css: ".nt-task-row button.nt-ask" },
    followsText: "start",
    contrast: ACCENT_TEXT,
    differs: { what: ["x"], by: ROW_APART },
  },
  {
    name: "Hint",
    mockup: { css: '.ph-row button:text-is("Hint")' },
    app: { css: '.nt-task-row button:text-is("Hint")' },
    followsText: "start",
    differs: { what: ["x"], by: ROW_APART },
  },
  {
    name: "Check",
    mockup: { css: '.ph-row button:text-is("Check")' },
    app: { css: ".nt-task-row button:text-is('Check')" },
    followsText: "end",
    differs: { what: ["x"], by: ROW_APART },
  },
];

/** The pill of the task skill at the top right, in place of a page's counter. */
const SKILL_PILL: Region = {
  name: "the pill of the task skill",
  mockup: { css: 'button[aria-label$="choose which tasks to solve"]' },
  app: { css: "button.nt-skill-pill" },
  followsText: "end",
};

/** Next task in the row, once the task is solved. */
const ROW_NEXT: Region = {
  name: "Next task",
  mockup: { css: '.ph-row button:text-is("Next task")' },
  app: { css: ".nt-task-row button.nt-row-next" },
  followsText: "end",
  differs: { what: ["x"], by: ROW_APART },
};

/** Why the card of a Check gone on to a later model is lower than the mockup's. */
const TRACK_DOTS =
  "the track's dots: the models' names stand on it only where the debug mode names the Check's models, which the state's does not, where the mockup draws them as pills";

/** Why the card of a Check the quota left unread stands apart from the mockup's. */
const QUOTA_CARD =
  "the card of a task from paper: its line says when the tutor's time comes back, and Hint stands in it";

/** The states of the mockup's task of a module, on the sheet of a task from paper. */
const MODULE_TASKS: readonly Compared[] = [
  {
    state: "module-task",
    draw: aModule(),
    settle: moduleDrawn,
    regions: [...SHEET_BAR, ...SHEET_ROW, SKILL_PILL],
  },
  {
    state: "module-task-skill",
    draw: aModule(),
    settle: async () => {
      await moduleDrawn();
      await userEvent.click(document.querySelector("button.nt-skill-pill") as HTMLElement);
    },
    regions: [
      SKILL_PILL,
      ...PICK.map((region) =>
        region.name === "a skill suggested"
          ? differing(
              region,
              ["x", "y"],
              "the choice of Home's tile, whose lines above the skills stand farther apart than the mockup draws them at the pill",
            )
          : region,
      ),
    ],
  },
  {
    state: "module-task-own",
    draw: aModule({ own: "Number patterns" }),
    settle: async () => {
      await moduleDrawn();
      await waitFor(() =>
        expect(document.querySelector(".nt-skill-name")).toHaveTextContent("Number patterns"),
      );
    },
    regions: [SKILL_PILL],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "module-task-hint",
      devices: [device],
      draw: aModule(),
      settle: async () => {
        await moduleDrawn();
        await userEvent.click(
          within(document.querySelector(".nt-task-row") as HTMLElement).getByRole("button", {
            name: "Hint",
          }),
        );
        await screen.findByText(DOTS_HINT.question ?? "");
      },
      regions: sheetPanelOf(device, PANEL_HEAD, HINT_ACT),
    }),
  ),
  {
    state: "module-task-not-yet",
    draw: aModule({ answer: "not-yet" }),
    settle: () => checked(),
    regions: [...SHEET_ROW, card(), CARD_TITLE, TRY_AGAIN],
  },
  {
    state: "module-task-correct",
    draw: aModule({ answer: "correct" }),
    settle: () => checked(),
    regions: [card(), CARD_TITLE, ROW_NEXT],
  },
  {
    state: "module-task-reading",
    draw: aModule(),
    settle: () => checked(),
    regions: [card(), CARD_TITLE],
  },
  {
    state: "module-task-reading-closer",
    draw: aModule({ closer: true }),
    settle: async () => {
      await checked();
      await waitFor(
        () =>
          expect(document.querySelector(".nt-card-title")).toHaveTextContent(
            "Looking more closely…",
          ),
        { timeout: 10_000 },
      );
    },
    regions: [card(TRACK_DOTS), differing(CARD_TITLE, ["y"], TRACK_DOTS)],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "module-task-rung",
      devices: [device],
      draw: aModule({ answer: "not-yet" }),
      settle: async () => {
        await checked();
        await userEvent.click(screen.getByRole("button", { name: "Ask" }));
        await screen.findByText(DOTS_RUNG);
      },
      regions: sheetPanelOf(device, PANEL_HEAD, HINT_ACT, EXPLAIN_ACT, REPORT_OPEN),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "module-task-alt",
      devices: [device],
      draw: aModule({ answer: "not-yet" }),
      settle: async () => {
        await checked();
        await userEvent.click(screen.getByRole("button", { name: "Ask" }));
        await screen.findByText(DOTS_RUNG);
        await userEvent.click(screen.getByRole("button", { name: "Explain differently" }));
        await screen.findByText(DOTS_ALT);
      },
      regions: sheetPanelOf(
        device,
        PANEL_HEAD,
        HINT_ACT,
        differing(EXPLAIN_ACT, ["missing"], EXPLAINED),
        REPORT_OPEN,
      ),
    }),
  ),
  {
    state: "module-task-report",
    draw: aModule({ answer: "not-yet" }),
    settle: async () => {
      await checked();
      await userEvent.click(screen.getByRole("button", { name: "Ask" }));
      await screen.findByText(DOTS_RUNG);
      await userEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    },
    regions: [
      {
        name: "the form of the report",
        mockup: { css: ".ph-report" },
        app: { css: ".nt-pop-report" },
        differs: {
          what: ["y", "height", "font-size"],
          by: `its options are app's radio buttons of 44, where the mockup's are rows of 44 with a circle of 20: the form is taller, and on a phone its sheet rises higher; ${NO_TEXT}`,
        },
      },
    ],
  },
  {
    state: "module-task-full",
    devices: ["phone"],
    draw: aModule({ answer: "not-yet" }),
    settle: async () => {
      await checked();
      await userEvent.click(screen.getByRole("button", { name: "Ask" }));
      await screen.findByText(DOTS_RUNG);
      await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    },
    regions: sheetPanelOf("phone", PANEL_HEAD, HINT_ACT, EXPLAIN_ACT, REPORT_OPEN),
  },
  {
    state: "module-task-quota",
    draw: aModule({ answer: "unchecked" }),
    settle: () => checked(),
    regions: [card(QUOTA_CARD), differing(CARD_TITLE, ["y"], QUOTA_CARD)],
  },
  {
    state: "module-choice",
    draw: aModule({ task: MONTHS }),
    settle: moduleDrawn,
    regions: [...SHEET_BAR, ...SHEET_ROW, SKILL_PILL],
  },
  {
    state: "module-choice-empty",
    draw: aModule({ task: MONTHS }),
    settle: async () => {
      await moduleDrawn();
      await userEvent.click(screen.getByRole("button", { name: "Check" }));
      await waitFor(() => expect(document.querySelector(".nt-card-verdict")).toBeTruthy());
    },
    regions: [...SHEET_ROW, card(), CARD_TITLE],
  },
  {
    state: "module-choice-wrong",
    draw: aModule({ task: MONTHS, answer: "not-yet" }),
    settle: () => checked(0),
    regions: [card(), CARD_TITLE, TRY_AGAIN],
  },
  {
    state: "module-choice-correct",
    draw: aModule({ task: MONTHS, answer: "correct" }),
    settle: () => checked(1),
    regions: [card(), CARD_TITLE, ROW_NEXT],
  },
  {
    state: "module-long",
    draw: aModule(),
    settle: moduleDrawn,
    regions: [...SHEET_BAR, ...SHEET_ROW, SKILL_PILL],
  },
];

/** The mockup's short essays, on the lined sheet: the talking umbrella, and the day remembered. */
const UMBRELLA: open.Task = {
  id: "umbrella",
  statement: [
    {
      text: "A shop sells an umbrella that can talk, but only when it rains. Write three different first sentences for an essay about it. Then put a ring round the one you would keep.",
    },
  ],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};
const A_DAY: open.Task = {
  id: "a-day",
  statement: [{ text: "Write a short essay about a day of your life that you remember well." }],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

/** The mockup's feedback on the umbrella, and the criteria of its rubric. */
const UMBRELLA_ESSAY = {
  feedback:
    "“The umbrella cleared its throat” makes a reader want to know why. The other two tell what happens before it happens. Which one did you ring?",
  criteria: [
    "Three different first sentences",
    "Each makes a reader want to go on",
    "One sentence is ringed",
  ],
};

/** Done in the row of an essay, between Hint and Check: grey till the essay is sent. */
const ROW_DONE: Region = {
  name: "Done",
  mockup: { css: '.ph-row button:text-is("Done")' },
  app: { css: ".nt-task-row button.nt-done" },
  followsText: "start",
  differs: { what: ["x"], by: ROW_APART },
};

/** Done in the row once the essay was sent: in the accent. */
const ROW_DONE_OPEN: Region = { ...ROW_DONE, contrast: ACCENT_TEXT };

/** Done on the card of an essay's feedback. */
const CARD_DONE: Region = {
  name: "Done on the card",
  mockup: { css: '.ph-verdict button:text-is("Done")' },
  app: { css: '.nt-card-verdict button:text-is("Done")' },
  followsText: "end",
  contrast: ACCENT_TEXT,
};

/** Next task at the panel's foot, once Done ended the essay. */
const NEXT_ACT: Region = {
  name: "Next task, at the panel's foot",
  mockup: { css: '.ph-tutor button:text-is("Next task")' },
  app: { css: '.nt-tutor-acts button:text-is("Next task")' },
  followsText: "start",
  contrast: ACCENT_TEXT,
};

/** The criteria of the rubric in the panel, once Done ended the essay. */
const CRITERIA: Region = {
  name: "the criteria of the rubric",
  mockup: { css: '.ph-tutor div.nt-in:has-text("Marks by the author")' },
  app: { css: ".nt-tutor-panel .nt-criteria" },
  differs: {
    what: ["y", "height", "font-size"],
    by: `the contract gives the criteria without their marks: app lists them under a heading of its own, with no mark and no line under them, and its line of the end stands above them; ${NO_TEXT}`,
  },
};

/** An essay's Check, its feedback come. */
async function essayChecked() {
  await checked();
  await waitFor(() =>
    expect(document.querySelector(".nt-card-verdict")).toHaveAttribute("data-kind", "feedback"),
  );
}

/** The states of the mockup's short essay, on the sheet of a task from paper. */
const ESSAY_TASKS: readonly Compared[] = [
  {
    state: "essay-sheet",
    draw: aModule({ task: UMBRELLA }),
    settle: moduleDrawn,
    regions: [...SHEET_BAR, ...SHEET_ROW, ROW_DONE, SKILL_PILL],
  },
  {
    state: "essay-sheet-feedback",
    draw: aModule({ task: UMBRELLA, essay: UMBRELLA_ESSAY }),
    settle: essayChecked,
    regions: [...SHEET_ROW, ROW_DONE_OPEN, card(), CARD_TITLE, CARD_DONE],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "essay-sheet-panel",
      devices: [device],
      draw: aModule({ task: UMBRELLA, essay: UMBRELLA_ESSAY }),
      settle: async () => {
        await essayChecked();
        await userEvent.click(screen.getByRole("button", { name: "Ask" }));
        await screen.findByText(UMBRELLA_ESSAY.feedback);
      },
      regions: sheetPanelOf(device, PANEL_HEAD, HINT_ACT, REPORT_OPEN),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "essay-sheet-done",
      devices: [device],
      draw: aModule({ task: UMBRELLA, essay: UMBRELLA_ESSAY }),
      settle: async () => {
        await essayChecked();
        const card = document.querySelector(".nt-card-verdict") as HTMLElement;
        await userEvent.click(within(card).getByRole("button", { name: "Done" }));
        await waitFor(() => expect(document.querySelector(".nt-criteria")).toBeTruthy());
      },
      regions: [
        ...sheetPanelOf(device, PANEL_HEAD, CRITERIA, NEXT_ACT),
        ...(device === "phone"
          ? []
          : [
              differing(
                ROW_NEXT,
                ["x"],
                "beside the open panel the row stands in the middle of the room the panel leaves, as on every task on the sheet, where the mockup centres it in the window",
              ),
            ]),
      ],
    }),
  ),
  {
    state: "essay-sheet-next",
    draw: aModule({ task: A_DAY }),
    settle: moduleDrawn,
    regions: [...SHEET_ROW, ROW_DONE],
  },
];

const SCREENS: readonly Compared[] = [
  ...WAY_IN,
  ...LEGAL_TEXTS,
  ...SETTINGS,
  ...OWN_KEY,
  ...DEVICES.map(
    (device): Compared => ({
      state: "home",
      devices: [device],
      draw: home,
      regions: [...frameOf(device), ...HOME, ...(device === "ipad" ? [LEGEND] : [])],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "home-tasks",
      devices: [device],
      draw: home,
      settle: () =>
        userEvent.click(
          screen.getAllByRole("button", {
            description: "Choose which tasks to solve",
          })[0] as HTMLElement,
        ),
      regions:
        device === "ipad" ? PICK.map((region) => differing(region, ["x", "y"], PICK_PLACED)) : PICK,
    }),
  ),
  {
    state: "home-tasks-own",
    draw: home,
    settle: async () => {
      await userEvent.click(
        screen.getAllByRole("button", {
          description: "Choose which tasks to solve",
        })[0] as HTMLElement,
      );
      const pick = screen.getByRole("dialog", { name: "Which tasks to solve?" });
      // The first is the chip of the skills suggested, as the mockup presses it.
      await userEvent.click(
        within(pick).getAllByRole("button", { name: "Number patterns" })[0] as HTMLElement,
      );
      // The focus back on the row scrolls the page on a phone; the mockup's stays at its top.
      window.scrollTo(0, 0);
    },
    regions: TILES,
  },
  {
    state: "lessons",
    draw: lessonsPage,
    settle: () => screen.findByRole("button", { name: /Pigeonhole principle/ }),
    regions: LESSONS,
  },
  { state: "home-legend", devices: ["ipad"], draw: home, regions: [LEGEND] },
  {
    state: "home-legend",
    devices: ["phone"],
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "What the marks mean" })),
    regions: [popOver("the sheet of the legend", "What the marks mean")],
  },
  {
    state: "home-switch",
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" })),
    regions: MENU,
  },
  {
    state: "home-help",
    draw: home,
    settle: async () => {
      await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
      await userEvent.click(screen.getByRole("button", { name: "Help" }));
    },
    regions: HELP,
  },
  {
    state: "home-bell",
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Notifications" })),
    regions: BELL,
  },
  {
    state: "home-quota",
    draw: home,
    settle: async () =>
      userEvent.click(await screen.findByRole("button", { name: "Tutor time: 20% used today" })),
    regions: QUOTA,
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "subjects",
      devices: [device],
      draw: subjects,
      regions: [
        ...frameOf(device).filter((region) => region.name !== "Home, the place shown"),
        ...SUBJECTS_REGIONS,
      ],
    }),
  ),
  { state: "map", draw: skillMap("Olympiad maths 1–6"), regions: MAP },
  { state: "map-essays", draw: skillMap("Short essays"), regions: MAP },
  // A skill chosen: its card is skill-map's, at the foot of the window; the head and the frame stay.
  { state: "map-skill", draw: skillMap("Olympiad maths 1–6"), regions: MAP },
  { state: "map-skill-locked", draw: skillMap("Olympiad maths 1–6"), regions: MAP },
  ...MODULE_TASKS,
  ...ESSAY_TASKS,
  {
    state: "lesson",
    until: TUTOR_IN_ROW,
    draw: explanation,
    settle: readAloudOn,
    regions: [...LESSON_BAR, ...EXPLANATION, ...LESSON_ROW],
  },
  {
    state: "lesson-segments",
    draw: explanation,
    settle: async () => {
      await readAloudOn();
      await userEvent.click(
        screen.getByRole("button", { name: "Explanation · 1 of 4: segments of the lesson" }),
      );
    },
    regions: [...LESSON_BAR, ...SEGMENTS],
  },
  ...DEVICES.map((device) => ({
    state: "example",
    until: TUTOR_IN_ROW,
    devices: [device],
    draw: workedExample(),
    settle: canvasDrawn,
    regions: [...LESSON_BAR, ...exampleRow(device)],
  })),
  ...DEVICES.map((device) => ({
    state: "example-demo",
    until: TUTOR_IN_ROW,
    devices: [device],
    draw: workedExample(4),
    settle: canvasDrawn,
    regions: [...LESSON_BAR, ...exampleRow(device, true)],
  })),
  { state: "lesson-end", draw: lessonEnd, regions: LESSON_END },
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
