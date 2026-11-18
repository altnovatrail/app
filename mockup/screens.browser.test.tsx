// app's screens against the interface mockup (R58): each entry draws a screen as the screen tests
// do, synthetic and with no api, at each size of the mockup, and compares its regions with the
// mockup's state of the same name in the same engine. An entry with `until` is a screen not brought
// to the mockup yet: its differences are reported in mockup/out/ and not held. Without it, every
// difference but those a region's `differs` names fails the test.
import {
  ProfileSchema,
  QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  ChoiceKind,
  EngineChoiceSchema,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  LegalService,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { describe, expect, it } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import "@altnovatrail/canvas";
import "../src/theme/theme.css";
import { LearnerProvider } from "../src/account/AccountGate.tsx";
import { ChooseScreen } from "../src/account/ChooseScreen.tsx";
import { InviteScreen, type TextsRead } from "../src/account/InviteScreen.tsx";
import { OwnerProfileScreen } from "../src/account/OwnerProfileScreen.tsx";
import { ApiProvider } from "../src/api/ApiContext.tsx";
import { HomeBar } from "../src/app/App.tsx";
import { HOME as HOME_ROUTE, type Route } from "../src/app/router.ts";
import { LegalPages } from "../src/legal/LegalPages.tsx";
import { Example } from "../src/lesson/Example.tsx";
import { Explanation } from "../src/lesson/Explanation.tsx";
import { LessonEnd } from "../src/lesson/Lesson.tsx";
import { ContinueButton, LessonScreen } from "../src/lesson/LessonScreen.tsx";
import { NextStep } from "../src/next/NextStep.tsx";
import { SignInScreen } from "../src/signin/SignInScreen.tsx";
import type { ModuleMap } from "../src/skills/map.ts";
import { MapBarHeading } from "../src/skills/SkillMap.tsx";
import { MapScreen } from "../src/skills/SkillMapScreen.tsx";
import { SubjectsScreen } from "../src/subjects/MySubjects.tsx";
import type { ModuleCard } from "../src/subjects/modules.ts";
import type { SkillCounts } from "../src/subjects/states.ts";
import { NO_VERDICTS, type Verdicts, verdictsOf } from "../src/task/attempt.ts";
import { EssayScreen, type EssayScreenProps } from "../src/task/EssayScreen.tsx";
import type { HintGiven } from "../src/task/Hint.tsx";
import { initialState, slotsOf } from "../src/task/steps.ts";
import { TaskScreen } from "../src/task/TaskScreen.tsx";
import { routedApi } from "../src/test/api.ts";
import { memoryDevice } from "../src/test/device.ts";
import { inLanguage } from "../src/test/language.tsx";
import { fakeSpeech, voice } from "../src/test/speech.ts";
import { ReportProblem } from "../src/tutor/ReportProblem.tsx";
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
  /** What is to bring the screen to the mockup, while nothing has: its differences are not held. */
  readonly until?: string;
  /** What a screen that draws in an effect waits for before it is read: its last element shown. */
  readonly settle?: () => Promise<unknown>;
  /** The sizes it is compared at, when not both. */
  readonly devices?: readonly Device[];
}

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

/** The mockup's second task, a choice: which number comes next. */
const NEXT: open.Task = {
  id: "next",
  statement: [{ text: "Which number comes next: 1, 4, 9, 16, …?" }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "choice", options: ["20", "24", "25", "36"] }] }],
};

/** The solving steps of the mockup's module, which the pill of the mode stands for. */
const STEPS: readonly open.Step[] = [
  {
    title: "Understand the task",
    description: "Read the task again, and tick what is known and what you are to find.",
    gives: ["givens"],
    exit_condition: "givens_ticked",
  },
  { title: "Plan", exit_condition: "none" },
  { title: "Solve", exit_condition: "none" },
  { title: "Check the answer", exit_condition: "none" },
];

/** The mockup's workbook page of grade 3: six lines of a division with a remainder, two boxes each. */
const REMAINDERS: open.Task = {
  id: "remainders",
  statement: [{ text: "Divide, and write the quotient and the remainder." }],
  canvas: { kind: "workbook" },
  items: ["47 ÷ 6 =", "38 ÷ 5 =", "29 ÷ 4 =", "52 ÷ 7 =", "44 ÷ 9 =", "33 ÷ 8 ="].map((sum) => ({
    line: [{ text: sum }, { binding: "box" }, { text: "r" }, { binding: "box" }],
  })),
};

/** The mockup's six lines read: the second and the fifth not right yet, as its demo has them. */
const REMAINDERS_READ: Verdicts = verdictsOf(
  [
    ["7", "5", true],
    ["6", "8", false],
    ["7", "1", true],
    ["7", "3", true],
    ["4", "7", false],
    ["4", "1", true],
  ].map(([quotient, remainder, right], i) => {
    const verdict = right === true ? "correct" : "not_yet";
    return {
      verdict,
      answerSlots: [quotient, remainder].map((value, slot) => ({
        answerSlot: { item: i + 1, slot: slot + 1 },
        verdict,
        value,
      })),
    };
  }) as unknown as Parameters<typeof verdictsOf>[0],
  REMAINDERS,
);

/** The mockup's essay, on a lined sheet, to a rubric. */
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

/** The steps of the mockup's essays, which its panel opens with. */
const ESSAY_STEPS: readonly open.Step[] = [
  { title: "Plan the essay", gives: ["techniques"], exit_condition: "none" },
  { title: "Write it", exit_condition: "none" },
  { title: "Read it again", exit_condition: "none" },
];

/** A verdict of the one item of a task: "Not yet" or "Correct", with what was read, or the option. */
function judged(task: open.Task, verdict: string, value?: string): Verdicts {
  return verdictsOf(
    [
      {
        verdict,
        answerSlots: [
          { answerSlot: { item: 1, slot: 1 }, verdict, ...(value === undefined ? {} : { value }) },
        ],
      },
    ] as unknown as Parameters<typeof verdictsOf>[0],
    task,
  );
}

/** What "Report a problem" is about: the words of the mockup's first rung. */
function SAID(text: string) {
  return {
    profileId: "p1",
    attemptId: "a1",
    said: { text, reply: TutorReply.RUNG, rung: 1 },
    language: "en",
  } as const;
}

interface Drawn {
  readonly task?: open.Task;
  readonly mode?: "steps" | "self";
  readonly verdicts?: Verdicts;
  readonly choices?: Readonly<Record<string, string>>;
  readonly filled?: boolean;
  readonly solution?: readonly open.StatementPart[];
  /** Check leaves the screen waiting: the work being read. */
  readonly waits?: boolean;
  /** The tutor's panel open as the screen begins, as the mockup opens it on a task. */
  readonly open?: boolean;
  /** The tutor's words in the panel: a rung's after a wrong answer, or the same in other words. */
  readonly words?: string;
  /** A hint before a wrong answer: the givens, a technique and the leading question. */
  readonly hint?: HintGiven;
  /** The panel's line of the quota. */
  readonly quota?: string;
  /** "Explain differently" at the panel's foot. */
  readonly explain?: boolean;
}

/**
 * The task screen of an adult, who may ask for the solution: on my own by default, its panel closed,
 * or by steps, as the mockup's module has them; the sheet empty unless `filled`.
 */
function TaskDrawn({
  task = DOTS,
  mode = "self",
  verdicts = NO_VERDICTS,
  choices = {},
  filled = false,
  solution,
  waits = false,
  open = false,
  words,
  hint,
  quota,
  explain = false,
}: Drawn) {
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(mode);
  const [panel, setPanel] = useState(open);
  const wrong = [...verdicts.slots.values()].includes("not_yet");
  return (
    <TaskScreen
      task={task}
      manifest={undefined}
      steps={STEPS}
      catalog={undefined}
      state={{ ...initialState(shown), choices, wrongAnswers: wrong ? 1 : 0 }}
      mode={shown}
      verdicts={verdicts}
      filled={task.items.map((item) => slotsOf(item).map(() => filled))}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={pending}
      blink={false}
      panelOpen={panel}
      onPanel={() => setPanel(!panel)}
      {...(solution === undefined ? {} : { solution })}
      {...(words === undefined
        ? {}
        : { tutorWords: words, report: <ReportProblem {...SAID(words)} /> })}
      {...(hint === undefined ? {} : { hint })}
      {...(quota === undefined ? {} : { quota })}
      {...(explain ? { onExplain: () => {} } : {})}
      onHistoryChange={() => {}}
      onMode={setShown}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onChoose={() => {}}
      onCheck={() => {
        if (waits) setPending(true);
      }}
      onHint={() => {}}
      onShow={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
    />
  );
}

/** The task screen as `TaskDrawn` draws it: api asked nothing, "Report a problem" sends none. */
function aTask(drawn: Drawn = {}) {
  return () =>
    inLanguage(
      <ApiProvider value={QUIET}>
        <TaskDrawn {...drawn} />
      </ApiProvider>,
    );
}

/** The mockup's hint on its first task before a wrong answer: a technique and the leading question. */
const DOTS_HINT: HintGiven = {
  techniques: [],
  question: "How many steps of 3 are there from row 1 to row 10?",
};

/** The mockup's first rung on its first task, after "32", and the same in other words. */
const DOTS_RUNG = "Count the steps again: from row 1 to row 10, how many times are 3 dots added?";
const DOTS_ALT =
  "Write rows 1 to 4 and their dots in a table. By row 4, how many 3s have been added?";

/** The first task by steps after "32", its panel open with the rung. */
const RUNG: Drawn = {
  mode: "steps",
  open: true,
  filled: true,
  verdicts: judged(DOTS, "not_yet", "32"),
  words: DOTS_RUNG,
  explain: true,
};

/** The task screen on a squared sheet, on my own, with nothing written: the canvas's bar of tools. */
const sheetTask = aTask();

/** What the screen of an essay is drawn with, beside what every drawing shares. */
type EssayDrawn = Partial<
  Pick<EssayScreenProps, "mode" | "feedback" | "mayFinish" | "finished">
> & {
  readonly filled?: boolean;
};

/**
 * The screen of an essay, by steps unless told otherwise, the sheet empty unless `filled`; Check
 * leaves it reading.
 */
function EssayDrawnScreen({ mode = "steps", filled = false, ...drawn }: EssayDrawn) {
  const [pending, setPending] = useState(false);
  const [shown, setShown] = useState(mode);
  return (
    <EssayScreen
      task={UMBRELLA}
      manifest={undefined}
      steps={ESSAY_STEPS}
      catalog={undefined}
      state={initialState(shown)}
      mode={shown}
      filled={[[filled]]}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={pending}
      checking={pending}
      blink={false}
      came={false}
      mayFinish={false}
      {...drawn}
      onHint={() => {}}
      onHistoryChange={() => {}}
      onMode={setShown}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
      onCheck={() => setPending(true)}
      onFinish={() => {}}
    />
  );
}

/** The screen of an essay as `EssayDrawnScreen` draws it. */
function anEssay(drawn: EssayDrawn = {}) {
  return () => inLanguage(<EssayDrawnScreen {...drawn} />);
}

/** Feedback on the mockup's essay, synthetic. */
const FEEDBACK =
  "The second sentence makes a reader want to know why. The other two tell what happens before it happens.";

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

/** The end of the lesson, done: the module's tile, its title, and the way to the next lesson. */
function lessonEnd() {
  return inLanguage(
    <ApiProvider value={QUIET}>
      <LessonEnd
        reason={RunEndReason.PASSED}
        title="Number patterns"
        language="en"
        module={{ id: "olympiad-math", title: "Olympiad maths 1–6" }}
        next={
          <NextStep
            profileId="p1"
            choice={create(EngineChoiceSchema, { choiceId: "c1", kind: ChoiceKind.LESSON })}
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
 * and its speaker (R65; В74 in run/QUESTIONS.md); and "Draw with finger" with its line, 57 px, comes
 * only in pen mode (R29 canvas), so the bar is that much shorter.
 */
const PLACED =
  'the line of "Read aloud" above the canvas, R65; "Draw with finger" only in pen mode, R29 canvas';

/** A button the bar shows by its icon alone: the font of its caption, out of sight, is not drawn. */
const ICON_ALONE = "the caption is out of sight (R60; R84 canvas)";

/** The canvas's bar of glass, its first tool and the zoom (R84 canvas). */
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
 * the frame's height, as the mockup's, but its heading keeps app's own words — one line where the
 * mockup's has two —, the code's step has no "Back", which in the mockup signs out, and the
 * statement's texts stand in place below it (R27; R46), so the column is of another height (R61).
 */
const CENTRED =
  "app's own words of the headings, no Back from the code, the texts in place below (R27; R46; R61)";

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

/** The policy and the terms in force, synthetic, and the policy's next version, as api gives them. */
const LEGAL_API = routedApi((router) =>
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
  }),
);

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

/** A text's page once its version has come. */
const versionShown = () => screen.findByText(/^Version \d, in force since /);

/**
 * Why a legal page differs from the mockup's sheet: the way back to their list, which the mockup
 * has no list for, before the heading; the whole text open below the gist, not behind "Read the
 * full text"; and the texts api gives, where the mockup's are a sample (R31; R69).
 */
const LISTED = "the way back to the list of the legal pages before the heading (R31; R69)";
const OPEN = 'the whole text open below its gist, not behind "Read the full text" (R31; R69)';
const FROM_API = "the texts come from api, the mockup's are a sample (its «Where it differs»)";
/** Why the gist stands lower on a phone: the chip's words wrap beside the way back. */
const WRAPPED = `${LISTED}: the chip wraps on a phone`;

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

/** A text's gist below its caption, and the line that the English text is the one in force. */
const GIST: readonly Region[] = [
  {
    name: "the gist's caption",
    mockup: { css: ".ph-legal > div:nth-child(2)" },
    app: { css: ".nt-gist > .nt-sheet-caption" },
    followsText: "start",
    differs: { what: ["y"], by: WRAPPED },
  },
  {
    name: "the gist",
    mockup: { css: ".ph-gist" },
    app: { css: ".nt-gist > p:last-child" },
    differs: { what: ["y", "height"], by: `${FROM_API}; ${WRAPPED}` },
  },
  {
    name: "the English text in force",
    mockup: { text: "The English text is the one in force" },
    app: { css: ".nt-in-force" },
    differs: { what: ["missing"], by: "the line is on a screen in another language alone (R27)" },
  },
];

const LEGAL_TEXTS: readonly Compared[] = [
  {
    state: "legal-privacy",
    draw: legalShown("privacy-policy"),
    settle: versionShown,
    regions: [
      ...sheetOf("Privacy Policy"),
      ...GIST,
      {
        name: "the next version",
        mockup: { css: '.ph-legal > div[style*="F5F5F7"]' },
        app: { css: ".nt-sheet-note" },
        differs: {
          what: ["y", "height"],
          by: `${FROM_API}; the way to the next version's page in it (R46)`,
        },
      },
    ],
  },
  {
    state: "legal-terms",
    draw: legalShown("terms-of-use"),
    settle: versionShown,
    regions: [...sheetOf("Terms of Use"), ...GIST],
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
        differs: { what: ["height"], by: "the words of the standard of R11" },
      },
    ],
  },
];

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

/** The home screen with the mockup's three modules, a fifth of today's tutor time used. */
function home() {
  return inLanguage(
    <ApiProvider value={QUIET}>
      <LearnerProvider value={SAM}>
        <HomeBar />
      </LearnerProvider>
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
 * screen keeps the heading "My subjects", where the mockup greets the learner by name (R63); the
 * card of what comes next holds the engine's way, "What's next", which names no lesson before it is
 * pressed (R24), not the mockup's lesson and its picture; the modules connected are "Connected",
 * with Disconnect and License beside their map, the catalog below them in place of "Add a module".
 */
const HOME_PLACED =
  'the heading "My subjects" (R63); "What\'s next" names no lesson (R24); Disconnect and License on a card (R62)';

/** A card or a bar, whose words are its own regions': the size of its own text is not drawn. */
const NO_TEXT = "no text of its own: the body's 14 px (R11)";

/**
 * Why the row is in sight under the options on a phone: the mockup's tutor's sheet is open and hides
 * it, where app's sheet hides the row while it is open, so that its options open with the sheet
 * closed (R67).
 */
const UNDER_SHEET =
  "the mockup's tutor's sheet open over the row of the phone; app's row, and its options, with the sheet closed (R67)";

/** Why Check is grey while the work is read: it takes no press till the verdict comes (R65). */
const READING = "Check takes no press while the work is read, and looks so (R65)";

/** Why the way on after "Correct" is not in the card: a lesson's Continue is its row's (R23). */
const WAY_ON =
  'the way on after "Correct": the lesson\'s row, or the result in the panel (R23; R65)';

/** The row of glass and its buttons, on a task with no options. */
const ROW: readonly Region[] = [
  {
    name: "the row",
    mockup: { css: ".ph-row" },
    app: { css: ".nt-task-row" },
    followsText: "centre",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Hint",
    mockup: { css: '.ph-row button:text-is("Hint")' },
    app: { css: '.nt-task-row button:text-is("Hint")' },
    followsText: "start",
  },
  {
    name: "Show the solution",
    mockup: { css: '.ph-row button:text-is("Show the solution")' },
    app: { role: "button", name: "Show the solution" },
    followsText: "start",
  },
  {
    name: "Check",
    mockup: { css: '.ph-row button:text-is("Check")' },
    app: { css: "button.nt-check-button" },
    followsText: "end",
  },
];

/**
 * Why the ends of the row of a choice stand up to 5 further out than the mockup's: its four buttons
 * are each a pixel or two wider in app, which the row's width adds up; its middle is the mockup's.
 */
const CHOICE_WIDER =
  "each of the row's four buttons a pixel or two wider: the row's ends 4–5 further out";

/** The row with "Choose an answer" at its start. */
const CHOICE_ROW: readonly Region[] = [
  ...ROW.map((region) =>
    region.name === "Check" ? differing(region, ["x"], CHOICE_WIDER) : region,
  ),
  {
    name: "Choose an answer",
    mockup: { css: "button.ph-rowfull" },
    app: { css: "button.nt-choose" },
    followsText: "start",
    differs: { what: ["x"], by: CHOICE_WIDER },
  },
];

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

/** The step's card at the top of the panel. */
const STEP_CARD: Region = {
  name: "the step's card",
  mockup: { role: "region", name: "The step" },
  app: { role: "region", name: "The step" },
  differs: { what: ["font-size"], by: NO_TEXT },
};

/** The list of the steps, unfolded from the step's card. */
const STEP_LIST: Region = {
  name: "the list of the steps",
  mockup: { role: "list", name: "Steps" },
  app: { role: "list", name: "Steps" },
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
 * where the mockup greys it (R67).
 */
const EXPLAINED =
  'app hides "Explain differently" while it takes no press, where the mockup greys it (R67)';

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
    by: "app's grabber shows the icon of what it does, Full screen or Half screen, of the closed list of buttons without a caption, where the mockup draws a bar (R60; R67)",
  },
};

/** The round button that calls the tutor, at the right edge. */
const TUTOR_BUTTON: Region = {
  name: "the tutor's button",
  mockup: { css: ".ph-tutbtn" },
  app: { css: ".nt-tutor-button" },
  differs: {
    what: ["border", "colour", "font-size", "font-weight"],
    by: `the button is its sign, the tutor's gradient in an edge of glass, where the mockup's sign is a span in it (R67); ${ICON_ALONE}`,
  },
};

/** The step's pill above the row, the panel closed. */
const STEP_PILL: Region = {
  name: "the step's pill",
  mockup: { css: ".ph-verdict" },
  app: { css: ".nt-step-pill" },
  differs: { what: ["font-size"], by: NO_TEXT },
};

/** The panel's regions on a device: the grabber on a phone. */
function panelOf(device: Device, ...regions: readonly Region[]): readonly Region[] {
  return [PANEL, ...regions, ...(device === "phone" ? [GRABBER] : [])];
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

/** The pill of the mode, at the top bar's right. */
const MODE_PILL: Region = {
  name: "the pill of the mode",
  mockup: { css: ".ph-mode" },
  app: { css: ".nt-mode" },
  followsText: "end",
  differs: { what: ["font-size"], by: NO_TEXT },
};

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

/** The profile's pill, whose width follows the pseudonym; its words are its name's (R63). */
const PILL: Region = {
  name: "the profile's pill",
  mockup: { role: "button", name: "Sam, switch learner" },
  app: { role: "button", name: "Sam, profile menu" },
  followsText: "start",
};

/**
 * Why the profile's menu is taller, and on the phone its rows higher up the rising sheet: it holds
 * "For grown-ups" and "Sign out" too, the buttons of the profile's header (R63).
 */
const HEADER_ROWS = 'the rows "For grown-ups" and "Sign out" of the profile\'s header (R63)';

/** The adult's Help, open, and the bar it stands in. */
const HELP: readonly Region[] = [
  PILL,
  {
    name: "the glass of Help",
    mockup: { css: 'div.glass:has(> button[aria-label="Help"])' },
    app: { css: ".nt-help" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Help",
    mockup: { role: "button", name: "Help" },
    app: { role: "button", name: "Help" },
    differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
  },
  {
    name: "the pop-over of Help",
    mockup: { css: 'div.glass.nt-pop:has(> div:text-is("Help"))' },
    app: { role: "dialog", name: "Help" },
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "The tutor is an AI",
    mockup: { css: 'div.nt-pop span:text-is("The tutor is an AI")' },
    app: { css: ".nt-help-item:first-of-type > b" },
    followsText: "start",
  },
  {
    name: "Privacy Policy",
    mockup: { role: "button", name: "Privacy Policy" },
    app: { role: "button", name: "Privacy Policy" },
    followsText: "start",
    contrast: ACCENT_TEXT,
  },
  {
    name: "Accessibility",
    mockup: { role: "button", name: "Accessibility" },
    app: { role: "button", name: "Accessibility" },
    followsText: "end",
    contrast: ACCENT_TEXT,
  },
];

/** The profile's menu, open. */
const MENU: readonly Region[] = [
  PILL,
  {
    name: "the profile's menu",
    mockup: { css: 'div.glass.nt-pop:has(> div:text-is("Learning now"))' },
    app: { role: "dialog", name: "Profile menu" },
    differs: { what: ["y", "height", "font-size"], by: `${HEADER_ROWS}; ${NO_TEXT}` },
  },
  {
    name: "Learning now",
    mockup: { text: "Learning now" },
    app: { css: ".nt-menu-caption" },
    differs: { what: ["y"], by: HEADER_ROWS },
  },
  {
    name: "Switch learner",
    mockup: { role: "button", name: "Switch learner" },
    app: { role: "button", name: "Switch learner" },
    contrast: ACCENT_TEXT,
    differs: { what: ["y"], by: HEADER_ROWS },
  },
];

/** A module's skill map in the mockup's frame, the map itself a line: skill-map draws it. */
function skillMap(title: string) {
  const map = { manifest: { title, languages: { explanation: "en" } } } as ModuleMap;
  return () =>
    inLanguage(
      <LearnerProvider value={SAM}>
        <MapScreen title={`Skill map: ${title}`} heading={<MapBarHeading map={map} />}>
          <p>Choose a skill on the map to practise it.</p>
        </MapScreen>
      </LearnerProvider>,
    );
}

/** The top bar of the skill map and its frame. */
const MAP: readonly Region[] = [
  {
    name: "the top bar",
    mockup: { css: 'div.glass:has(> button[aria-label="Back"]):has(span:text-is("Skill map"))' },
    app: { css: ".nt-top-pill" },
    followsText: "start",
    differs: { what: ["font-size"], by: NO_TEXT },
  },
  {
    name: "Back",
    mockup: { css: 'div.glass:has(span:text-is("Skill map")) > button[aria-label="Back"]' },
    app: { role: "button", name: "Back" },
    differs: { what: ["font-size", "font-weight"], by: ICON_ALONE },
  },
  {
    name: "the title",
    mockup: { text: "Skill map" },
    app: { css: ".nt-top-title" },
    followsText: "start",
  },
  {
    name: "the frame",
    mockup: { css: ".ph-mapframe" },
    app: { css: ".nt-map-frame" },
    differs: { what: ["font-size"], by: NO_TEXT },
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

/** The format gives a segment no title of its own (format 21 in spec): the caption is its kind. */
const NO_SEGMENT_TITLE = "a segment has no title in the format (format 21 in spec)";

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
 * a button that does not act by its colour, the mockup by its opacity (R84 canvas).
 */
const ROW_LINE = "the canvas's row keeps its line on a phone (R84 canvas)";
const PALE = "canvas pales a button that does not act by its colour, not its opacity (R84 canvas)";

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

/** The canvas's row of a worked example: Next, Demo and the lesson's Continue (R84 canvas). */
const EXAMPLE_ROW: readonly Region[] = [
  {
    name: "the row of Next, Demo and Continue",
    mockup: { css: 'div.glass:has(> button:text-is("Next"))' },
    app: { css: ".tools.row" },
    followsText: "centre",
    // Its words are its buttons', compared below.
    differs: { what: ["font-size"], by: "no text of its own (R84 canvas)" },
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
    differs: { what: ["font-size", "font-weight"], by: "the letter is drawn by CSS (R62)" },
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
    name: "Back to My subjects",
    mockup: { role: "button", name: "Back to My subjects" },
    app: { role: "button", name: "Back to My subjects" },
    contrast: ACCENT_TEXT,
  },
];

/** Done in the row of an essay, open or not. */
const DONE: Region = {
  name: "Done",
  mockup: { css: '.ph-row button:text-is("Done")' },
  app: { css: '.nt-task-row button:text-is("Done")' },
  followsText: "start",
};

/** The row of an essay: Hint, Done and Check. */
const ESSAY_ROW: readonly Region[] = [
  ...ROW.filter((region) => region.name !== "Show the solution"),
  DONE,
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

/** The regions by steps: the row beside the open panel on the iPad, the sheet over it on a phone. */
function besidePanel(device: Device, regions: readonly Region[]): readonly Region[] {
  return device === "ipad" ? [PANEL, ...regions] : panelOf(device);
}

/**
 * Why the row's glass is whiter on a workbook: canvas draws the page on its own white paper over
 * the whole window (R84 canvas), where the mockup lays a white page on the page's `#F2F2F7`,
 * which its glass lets through.
 */
const WORKBOOK_PAPER = "canvas draws the workbook on its white paper (R84 canvas)";

/** The row on a workbook, its glass over canvas's paper. */
const WORKBOOK_ROW: readonly Region[] = ROW.map((region) =>
  differing(region, ["background", "border"], WORKBOOK_PAPER),
);

/** The criteria of the mockup's rubric, which the result names once the essay is finished. */
const CRITERIA = [
  "Three different first sentences",
  "Each makes a reader want to go on",
  "One sentence is ringed",
];

/**
 * Why no row stands under a finished essay: the way on is the lesson's row, or the result in the
 * panel (R23; R53), which names the criteria without the marks — those are the adult's, in the
 * progress (R87 spec) —, where the mockup's panel shows them.
 */
const DONE_ON =
  "the way on after Done: the lesson's row, or the result in the panel (R23; R53; R87 spec)";

/** "Try again" in the card of "Not yet". */
const TRY_AGAIN: Region = {
  name: "Try again",
  mockup: { css: '.ph-verdict button:text-is("Try again")' },
  app: { role: "button", name: "Try again" },
  followsText: "end",
  contrast: ACCENT_TEXT,
};

const WORKBOOK_AND_ESSAY: readonly Compared[] = [
  ...DEVICES.map(
    (device): Compared => ({
      state: "workbook",
      devices: [device],
      draw: aTask({ task: REMAINDERS, mode: "steps", open: true }),
      settle: barDrawn,
      regions: besidePanel(device, WORKBOOK_ROW),
    }),
  ),
  // The mockup closes its panel before this check, and app's row stands in the window's middle with
  // the panel open or not: the row is compared as it is.
  ...DEVICES.map(
    (device): Compared => ({
      state: "workbook-not-yet",
      devices: [device],
      draw: aTask({ task: REMAINDERS, mode: "steps", filled: true, verdicts: REMAINDERS_READ }),
      settle: barDrawn,
      regions: [...WORKBOOK_ROW, card(), CARD_TITLE, TRY_AGAIN],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "workbook-shown",
      devices: [device],
      draw: aTask({
        task: REMAINDERS,
        mode: "steps",
        filled: true,
        verdicts: REMAINDERS_READ,
        solution: [{ text: "47 ÷ 6 = 7 r 5." }],
      }),
      settle: barDrawn,
      regions: [card(WAY_ON), { ...CARD_TITLE, differs: { what: ["x", "y"], by: WAY_ON } }],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "essay",
      devices: [device],
      draw: anEssay(),
      settle: barDrawn,
      regions: besidePanel(device, ESSAY_ROW),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "essay-feedback",
      devices: [device],
      draw: anEssay({ mode: "self", filled: true, feedback: FEEDBACK, mayFinish: true }),
      settle: barDrawn,
      regions: [
        ...ESSAY_ROW.map((region) =>
          region === DONE ? { ...region, contrast: ACCENT_TEXT } : region,
        ),
        card(),
        CARD_TITLE,
        {
          name: "Done, in the card",
          mockup: { css: '.ph-verdict button:text-is("Done")' },
          app: { css: '.nt-card-verdict button:text-is("Done")' },
          followsText: "end",
          contrast: ACCENT_TEXT,
        },
      ],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "essay-done",
      devices: [device],
      draw: anEssay({
        mode: "self",
        filled: true,
        feedback: FEEDBACK,
        mayFinish: true,
        finished: { criteria: CRITERIA, solution: [] },
      }),
      settle: barDrawn,
      regions: [
        {
          name: "the row of Continue",
          mockup: { css: ".ph-row" },
          app: { css: ".nt-task-row" },
          followsText: "centre",
          differs: { what: ["missing"], by: DONE_ON },
        },
      ],
    }),
  ),
];

const SCREENS: readonly Compared[] = [
  ...WAY_IN,
  ...LEGAL_TEXTS,
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
  {
    state: "home-help",
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Help" })),
    regions: HELP,
  },
  {
    state: "home-switch",
    draw: home,
    settle: () => userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" })),
    regions: MENU,
  },
  { state: "map", draw: skillMap("Olympiad maths 1–6"), regions: MAP },
  { state: "map-essays", draw: skillMap("Short essays"), regions: MAP },
  {
    state: "task-pill",
    draw: aTask({ mode: "steps" }),
    settle: barDrawn,
    regions: [...BAR, ...ROW, STEP_PILL, TUTOR_BUTTON],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "task",
      devices: [device],
      draw: aTask({ mode: "steps", open: true }),
      settle: barDrawn,
      // On a phone the sheet hides the row and the tool bar, on both sides.
      regions: [
        ...panelOf(device, PANEL_HEAD, STEP_CARD, HINT_ACT),
        ...(device === "ipad" ? [...BAR, ...ROW] : []),
      ],
    }),
  ),
  {
    state: "task-steps",
    draw: aTask({ mode: "steps", open: true }),
    settle: async () => {
      await barDrawn();
      await userEvent.click(screen.getByRole("button", { name: "Step 1 of 4" }));
    },
    regions: [STEP_CARD, STEP_LIST],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-hint",
      devices: [device],
      draw: aTask({ mode: "steps", open: true, hint: DOTS_HINT }),
      settle: barDrawn,
      regions: panelOf(device, PANEL_HEAD, HINT_ACT),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-rung",
      devices: [device],
      draw: aTask(RUNG),
      settle: barDrawn,
      regions: panelOf(device, PANEL_HEAD, HINT_ACT, EXPLAIN_ACT, REPORT_OPEN),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-alt",
      devices: [device],
      draw: aTask({ ...RUNG, words: DOTS_ALT, explain: false }),
      settle: barDrawn,
      regions: panelOf(
        device,
        PANEL_HEAD,
        HINT_ACT,
        differing(EXPLAIN_ACT, ["missing"], EXPLAINED),
        REPORT_OPEN,
      ),
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-report",
      devices: [device],
      draw: aTask(RUNG),
      settle: async () => {
        await barDrawn();
        await userEvent.click(screen.getByRole("button", { name: "Report a problem" }));
      },
      regions: [
        {
          name: "the form of the report",
          mockup: { css: ".ph-report" },
          app: { css: ".nt-pop-report" },
          differs: {
            what: ["y", "height", "font-size"],
            by: `its options are app's radio buttons of 44 (R11), where the mockup's are rows of 44 with a circle of 20: the form is taller, and on a phone its sheet rises higher; ${NO_TEXT}`,
          },
        },
      ],
    }),
  ),
  {
    state: "task-full",
    devices: ["phone"],
    draw: aTask(RUNG),
    settle: async () => {
      await barDrawn();
      await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    },
    regions: panelOf("phone", PANEL_HEAD, HINT_ACT, EXPLAIN_ACT, REPORT_OPEN),
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "quota",
      devices: [device],
      draw: aTask({
        task: NEXT,
        mode: "steps",
        open: true,
        choices: { "1.1": "20" },
        verdicts: judged(NEXT, "not_yet"),
        quota: "Tutor time today: 100% used",
      }),
      settle: barDrawn,
      regions: panelOf(device, PANEL_HEAD, HINT_ACT),
    }),
  ),
  {
    state: "task-mode",
    draw: aTask({ mode: "steps" }),
    settle: () => userEvent.click(screen.getByRole("button", { name: "Mode: Step by step" })),
    regions: [
      MODE_PILL,
      {
        name: "the pop-over of the mode",
        mockup: { css: 'div.nt-pop:has(> button[aria-pressed="true"])' },
        app: { role: "dialog", name: "Mode" },
        differs: { what: ["font-size"], by: NO_TEXT },
      },
      {
        name: "Step by step, chosen",
        mockup: { css: 'div.nt-pop > button[aria-pressed="true"]' },
        app: { css: 'button.nt-mode-choice[aria-pressed="true"]' },
        differs: { what: ["font-size"], by: NO_TEXT },
      },
    ],
  },
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-empty",
      devices: [device],
      draw: sheetTask,
      settle: async () => {
        await barDrawn();
        // Forced: Playwright takes no click on a button that says it is disabled.
        await userEvent.click(screen.getByRole("button", { name: "Check" }), { force: true });
      },
      regions: [...ROW, card(), CARD_TITLE],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-reading",
      devices: [device],
      draw: aTask({ filled: true, waits: true }),
      settle: async () => {
        await barDrawn();
        await userEvent.click(screen.getByRole("button", { name: "Check" }));
      },
      regions: [
        ...ROW.map((region) =>
          region.name === "Check"
            ? {
                ...region,
                differs: { what: ["background" as const, "colour" as const], by: READING },
              }
            : region,
        ),
        card(),
        CARD_TITLE,
      ],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-not-yet",
      devices: [device],
      draw: aTask({ filled: true, verdicts: judged(DOTS, "not_yet", "32") }),
      settle: barDrawn,
      regions: [...ROW, card(), CARD_TITLE, TRY_AGAIN],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "task-correct",
      devices: [device],
      draw: aTask({
        filled: true,
        verdicts: judged(DOTS, "correct", "29"),
        solution: [{ text: "Row 10 has 29 dots." }],
      }),
      settle: barDrawn,
      regions: [card(WAY_ON), { ...CARD_TITLE, differs: { what: ["x", "y"], by: WAY_ON } }],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "choice",
      devices: [device],
      draw: aTask({ task: NEXT, mode: "steps", open: device === "ipad" }),
      settle: async () => {
        await barDrawn();
        await userEvent.click(screen.getByRole("button", { name: "Choose an answer" }));
      },
      regions: [
        ...CHOICE_ROW.map((region) =>
          device === "phone"
            ? { ...region, differs: { what: ["missing" as const], by: UNDER_SHEET } }
            : region,
        ),
        {
          name: "the options",
          mockup: { role: "radiogroup", name: "Choose an answer" },
          app: { role: "dialog", name: "Choose an answer" },
          differs: { what: ["font-size"], by: NO_TEXT },
        },
      ],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "choice-wrong",
      devices: [device],
      draw: aTask({
        task: NEXT,
        mode: "steps",
        open: true,
        choices: { "1.1": "20" },
        verdicts: judged(NEXT, "not_yet"),
      }),
      settle: barDrawn,
      // The verdict is a line in the open panel, on both sides; a phone's sheet hides the row.
      regions: [...panelOf(device, HINT_ACT), ...(device === "ipad" ? CHOICE_ROW : [])],
    }),
  ),
  ...DEVICES.map(
    (device): Compared => ({
      state: "solution-ask",
      devices: [device],
      draw: aTask({
        task: NEXT,
        mode: "steps",
        open: device === "ipad",
        choices: { "1.1": "20" },
        verdicts: judged(NEXT, "not_yet"),
      }),
      settle: async () => {
        await barDrawn();
        await userEvent.click(screen.getByRole("button", { name: "Show the solution" }));
      },
      regions: [
        {
          name: "the question",
          mockup: { role: "dialog", name: "Show the solution" },
          app: { role: "dialog", name: "Show the solution" },
          differs: { what: ["font-size"], by: NO_TEXT },
        },
        {
          name: "Show it",
          mockup: { role: "button", name: "Show it" },
          app: { role: "button", name: "Show it" },
          followsText: "end",
        },
      ],
    }),
  ),
  ...WORKBOOK_AND_ESSAY,
  {
    state: "lesson",
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
    devices: [device],
    draw: workedExample(),
    settle: canvasDrawn,
    regions: [...LESSON_BAR, ...exampleRow(device)],
  })),
  ...DEVICES.map((device) => ({
    state: "example-demo",
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
