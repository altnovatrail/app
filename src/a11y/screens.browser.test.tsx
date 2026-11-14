// Every screen of app so far, in English, in Russian and in the pseudo-language, at a plain width
// and at 320 CSS px (section 3.9 of docs/architecture.md): no violation of WCAG 2.2 A and AA that
// axe-core finds, every target at least 44 × 44 CSS px, no sideways scroll and no text cut. Each
// screen is found by its role and name.
import "@altnovatrail/canvas";
import "@altnovatrail/skill-map";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import {
  GetQuotaResponseSchema,
  ProfileSchema,
  QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  ItemVerdictSchema,
  TutorReply,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  ChoiceKind,
  CloseReason,
  EngineChoiceSchema,
  ReasonCode,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { LegalTextSchema } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import {
  AnchorSkillHolding,
  GetProgressResponseSchema,
  GetSkillMapResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { create } from "@bufbuild/protobuf";
import { userEvent } from "vitest/browser";
import {
  ChooseScreen,
  InviteScreen,
  LearnerProvider,
  OwnerProfileScreen,
  SignOutScreen,
  type TextsRead,
} from "../account/AccountGate.tsx";
import { AdultSection } from "../adults/AdultSection.tsx";
import { DevicePage } from "../adults/DevicePage.tsx";
import { ModulesPage } from "../adults/ModulesPage.tsx";
import { ProfilePage } from "../adults/ProfilePage.tsx";
import { ProgressMap, ProgressPage } from "../adults/ProgressPage.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { App, LearnerBar } from "../app/App.tsx";
import { HOME, LEGAL, SKILL_MAP, TUTOR } from "../app/router.ts";
import {
  Framed,
  Offline,
  OtherTab,
  ReloadOffer,
  StorageGone,
  Unconfigured,
} from "../boot/Screens.tsx";
import type { Language } from "../i18n/language.ts";
import { WORDS, wordsOf } from "../i18n/words.ts";
import { LegalPages } from "../legal/LegalPages.tsx";
import { Example } from "../lesson/Example.tsx";
import { Explanation } from "../lesson/Explanation.tsx";
import { LessonEnd } from "../lesson/Lesson.tsx";
import { LessonScreen, type LessonScreenProps } from "../lesson/LessonScreen.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { LicensePages, licenseRoute } from "../packages/LicensePage.tsx";
import { type Packages, PackagesProvider } from "../packages/PackagesContext.tsx";
import { SignInScreen } from "../signin/SignInScreen.tsx";
import { moduleMapRoute, SkillMapRoute } from "../skills/SkillMapScreen.tsx";
import { addProfile } from "../storage/profile.ts";
import { addDatabase, setAccount } from "../storage/registry.ts";
import { profileDatabase } from "../storage/schema.ts";
import { SubjectsScreen } from "../subjects/MySubjects.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { NO_VERDICTS, verdictsOf } from "../task/attempt.ts";
import { initialState } from "../task/steps.ts";
import { TaskScreen, type TaskScreenProps } from "../task/TaskScreen.tsx";
import { axeViolations, overflows, smallTargets } from "../test/a11y.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { PSEUDO } from "../test/pseudo.ts";
import { fakeSpeech } from "../test/speech.ts";
import { ReportProblem } from "../tutor/ReportProblem.tsx";
import { TutorPages } from "../tutor/TutorPage.tsx";
import { SpeechProvider, VoicingProvider } from "../voice/VoicingContext.tsx";

const OWNER = create(ProfileSchema, {
  profileId: "p1",
  owner: true,
  pseudonym: "Ёжик",
  ageCategory: "adult",
});

/** A task with options and chips, on the steps of the format's example of olympiad maths. */
const TASK: TaskScreenProps["task"] = {
  id: "fruit",
  statement: [{ text: "Two apples and three pears are in a bowl." }],
  canvas: { kind: "handwriting_sheet" },
  givens: ["Two apples", "Three pears"],
  unknown: "How many fruits",
  items: [
    { text: "How many fruits?", answer_slots: [{ binding: "choice", options: ["4", "5"] }] },
    {
      answer_slots: [
        { binding: "choice", options: ["Yes", "No"] },
        { binding: "choice", options: ["Apples", "Pears"] },
      ],
    },
  ],
};

/** A task answered on the sheet, and a workbook's page of two lines. */
const HANDWRITTEN: TaskScreenProps["task"] = {
  id: "rungs",
  statement: [{ text: "The rungs are 30 cm apart." }],
  canvas: { kind: "handwriting_sheet" },
  items: [{ text: "How many rungs?", answer_slots: [{ binding: "anywhere" }] }],
};
const WORKBOOK: TaskScreenProps["task"] = {
  id: "page",
  statement: [{ text: "Fill in the boxes." }],
  canvas: { kind: "workbook" },
  items: [
    { line: [{ text: "7 × " }, { binding: "box" }, { text: " = 56" }] },
    { line: [{ text: "9 + " }, { binding: "box" }, { text: " = 12" }] },
  ],
};

/** "Report a problem" beside the words of a rung, with an api it never reaches. */
function report() {
  return (
    <ApiProvider value={{} as Api}>
      <ReportProblem
        profileId="p1"
        attemptId="a1"
        said={{ text: "Count the gaps.", reply: TutorReply.RUNG, rung: 1 }}
      />
    </ApiProvider>
  );
}

/** Presses the button with the words of a key, in whichever language of the test the screen is. */
async function press(key: "report.button" | "report.send"): Promise<void> {
  // None found is a failure, not a skip.
  const names = [WORDS.en, WORDS.ru, wordsOf(PSEUDO, "en")].map((each) => each.text(key));
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((each) =>
    names.includes(each.textContent ?? ""),
  );
  if (button === undefined) throw new Error(`no button ${key}`);
  await userEvent.click(button);
}

/** The task screen, by steps on the first step unless the test says otherwise. */
function taskScreen(props: Partial<TaskScreenProps> = {}) {
  return (
    <TaskScreen
      task={TASK}
      manifest={
        {
          module_format_version: "0.4",
          id: "example/choices",
          version: "1.0.0",
          title: "Choices",
          languages: { explanation: "en" },
        } as TaskScreenProps["manifest"]
      }
      steps={[
        {
          title: "Understand the task",
          description: "Tick what is known and what you are to find.",
          gives: ["givens"],
          exit_condition: "givens_ticked",
        },
        { title: "Make a plan", gives: ["techniques"], exit_condition: "none" },
        { title: "Solve it", exit_condition: "answer_slots_filled" },
      ]}
      catalog={{ techniques: { draw: { title: "Draw the problem", description: "A picture." } } }}
      state={{ ...initialState("steps"), ticked: { givens: [0], unknown: false } }}
      mode="steps"
      verdicts={NO_VERDICTS}
      filled={null}
      history={[]}
      media={() => Promise.reject(new Error("no file in this test"))}
      notSaved={false}
      pending={false}
      blink={false}
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
      {...props}
    />
  );
}

/** The lesson player on a segment of the lesson of section 3.4, with the segment given. */
function lessonScreen(children: ReactNode, props: Partial<LessonScreenProps> = {}) {
  return (
    <LessonScreen
      title="Gaps and posts"
      language="en"
      course={{ kinds: ["explanation", "example", "task", "explanation"], ended: new Set() }}
      place={2}
      shown={2}
      unsaved={false}
      pending={false}
      onContinue={() => {}}
      onGoTo={() => {}}
      onNote={() => {}}
      onLeave={() => {}}
      {...props}
    >
      {children}
    </LessonScreen>
  );
}

const noMedia = () => Promise.reject(new Error("no file in this test"));

/** The way to what the engine chose, which no press here sends: api is never called. */
function nextStep(props: Partial<Parameters<typeof NextStep>[0]> = {}) {
  return (
    <ApiProvider value={{} as Api}>
      <NextStep profileId="p1" {...props} />
    </ApiProvider>
  );
}

const choice = (kind: ChoiceKind) => create(EngineChoiceSchema, { choiceId: "c1", kind });

const JUDGED = verdictsOf(
  [
    create(ItemVerdictSchema, {
      verdict: "not_yet",
      answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "4" }],
    }),
    create(ItemVerdictSchema, {
      verdict: "correct",
      answerSlots: [
        { answerSlot: { item: 2, slot: 1 }, verdict: "correct", value: "Yes" },
        { answerSlot: { item: 2, slot: 2 }, verdict: "correct", value: "Pears" },
      ],
    }),
  ],
  TASK,
);

/** The policy's next version, synthetic, which applies from a day still to come. */
const NEXT_POLICY = create(LegalTextSchema, {
  id: "privacy-policy",
  version: 3,
  inForceSince: "2026-11-27",
  body: "# Privacy policy\n\n## Who we are\n\nThe operator, by post and by email.\n",
  summary: "We keep little, and say more of it.",
  summaryLanguage: "en",
  translation: "# Политика конфиденциальности\n\nМы храним мало.\n",
  translationLanguage: "ru",
});

/**
 * The legal texts of the account, synthetic: the policy with a translation and a table, and its
 * next version.
 */
const TEXTS: TextsRead = {
  status: "done",
  value: {
    next: [NEXT_POLICY],
    texts: [
      create(LegalTextSchema, {
        id: "privacy-policy",
        version: 2,
        body: "# Privacy Policy\n\n## What we keep\n\nLittle, and **not** for long.\n\n- one\n- two\n",
        summary: "We keep little.",
        summaryLanguage: "en",
        translation: "# Политика конфиденциальности\n\nМы храним мало.\n",
        translationLanguage: "ru",
      }),
      create(LegalTextSchema, {
        id: "terms-of-use",
        version: 1,
        body: "# Terms of Use\n\n| Who | What |\n|---|---|\n| You | Learn |\n",
        summary: "The terms.",
        summaryLanguage: "en",
      }),
    ],
  },
  retry: () => {},
};

/** Every legal text of the screen, opened. */
async function openTexts(): Promise<void> {
  for (const summary of document.querySelectorAll("summary")) await userEvent.click(summary);
}

/** Presses a form's button, so that every field shows its error. */
/**
 * A device where the owner keeps an unfinished attempt, and the other profile's database is at a
 * version newer than the build's, so that it cannot be read.
 */
async function seeded() {
  const { device, backend } = memoryDevice();
  await setAccount(device, "account-1");
  await (await addProfile(device, "p1"))?.beginAttempt({ attemptId: "a1", digest: "d1" });
  await addDatabase(device, profileDatabase("p2"), { kind: "profile", profileId: "p2" });
  await backend.open(
    profileDatabase("p2"),
    { version: 2, stores: {} },
    {
      create: true,
      onLost: () => {},
    },
  );
  return device;
}

const SEEDED = await seeded();

function devicePage() {
  return (
    <DevicePage
      device={SEEDED}
      profiles={[OWNER, create(ProfileSchema, { profileId: "p2", pseudonym: "Аня" })]}
      onEraseAll={async () => "failed"}
      site={{
        estimate: async () => ({ usage: 1_500_000, quota: 120_000_000_000 }),
        persisted: async () => false,
        persist: async () => false,
      }}
    />
  );
}

/**
 * An api that gives the privacy policy with its translation and a table, as version 2 does, and its
 * next version.
 */
const POLICY_API = {
  legal: {
    getLegalTexts: async () => ({
      nextTexts: [NEXT_POLICY],
      texts: [
        create(LegalTextSchema, {
          id: "privacy-policy",
          version: 2,
          inForceSince: "2026-11-11",
          body: "# Privacy policy\n\n## Who we are\n\nALT EdTech LLC, a company, which you can reach:\n\n- by post;\n- by email.\n\n## How long we keep it\n\n| What we keep | How long |\n|---|---|\n| Messages to the operator's email, and our replies | 1 year after the message came or after our last reply to it, whichever is later |\n",
          summary: "Мы храним только то, без чего NovaTrail не работает.",
          summaryLanguage: "ru",
          translation: "# Политика конфиденциальности\n\nМы храним мало данных.\n",
          translationLanguage: "ru",
        }),
      ],
    }),
  },
} as unknown as Api;

/** An api that gives the text storage-consent alone, for the consent of a profile's page. */
const STORAGE_API = {
  legal: {
    getLegalTexts: async () => ({
      nextTexts: [],
      texts: [
        create(LegalTextSchema, {
          id: "storage-consent",
          version: 1,
          body: "# Keeping works on our server\n\n## What is kept\n\n- each work, as the device holds it.\n",
          summary: "Вы включаете хранение работ этого ученика на нашем сервере.",
          summaryLanguage: "ru",
        }),
      ],
    }),
  },
} as unknown as Api;

/** An api of a profile whose cap is reached, beside the account's share: its page's tutor time. */
const QUOTA_API = {
  account: {
    getQuota: async () =>
      create(GetQuotaResponseSchema, {
        share: {
          profilePercent: 100,
          accountPercent: 85,
          capReached: true,
          nextFamilyDay: { seconds: 1_794_009_600n },
        },
      }),
  },
} as unknown as Api;

/** The consent to keeping works opened on a profile's page, and switched on with no tick. */
async function consenting(): Promise<void> {
  const keep = document.querySelector<HTMLButtonElement>("section .nt-buttons button");
  if (keep === null) throw new Error("no Keep works on the server");
  await userEvent.click(keep);
  const on = document.querySelector<HTMLButtonElement>("section form button[type=submit]");
  if (on === null) throw new Error("no Switch it on");
  await vi.waitFor(() => expect(on.disabled).toBe(false));
  await userEvent.click(on);
  expect(document.querySelector("section form [aria-invalid=true]")).not.toBeNull();
}

async function submit(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button !== null) await userEvent.click(button);
}

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;

/** The packages of a module whose manifest and files come at once: LICENSE with long lines. */
const LICENSED = {
  views: {
    get: async () => ({
      view: {
        title: "Olympiad maths",
        version: "1.2.0",
        license: "Apache-2.0",
        languages: { explanation: "en" },
      },
      skillTiers: {},
    }),
    keptManifests: async () => new Map(),
  },
  files: {
    text: async (_: string, path: string) =>
      path === "LICENSE"
        ? `Apache License\n${"   You must give any other recipients of the Work or Derivative Works a copy of this License; and".repeat(2)}\n`
        : undefined,
  },
} as unknown as Packages;

/** An api that gives the profile two modules, one with no current version. */
const MODULES_API = {
  module: {
    listConnectedModules: async () => ({
      modules: [
        { moduleId: "novatrail/olympiad-math", packageDigest: D1 },
        { moduleId: "novatrail/gone", packageDigest: "" },
      ],
    }),
  },
} as unknown as Api;

/** The open views of a module with a skill graph of two skills, and of a module that teaches. */
const MAPPED = {
  views: {
    get: async (digest: string, kind: string) =>
      kind === "skill-graph"
        ? {
            view: {
              skills: {
                counting: { title: "Counting", assessability: "verdict" },
                halves: {
                  title: "Halves",
                  assessability: "verdict",
                  prerequisites: ["counting", "core.multiplication-table"],
                },
              },
            },
            skillTiers: { counting: 1, halves: 2 },
          }
        : {
            view: {
              module_format_version: "0.4",
              id: digest === D1 ? "example/fair-shares" : "novatrail/tables",
              version: "1.0.0",
              title: digest === D1 ? "Fair shares" : "Таблица умножения",
              languages: { explanation: digest === D1 ? "en" : "ru" },
            },
            skillTiers: {},
          },
    keptManifests: async () => new Map(),
  },
} as unknown as Packages;

/** An api of a profile with a module whose anchor skill is unknown, and a module that teaches it. */
const MAP_API = {
  module: {
    listConnectedModules: async () => ({
      modules: [
        { moduleId: "example/fair-shares", packageDigest: D1 },
        { moduleId: "novatrail/gone", packageDigest: "" },
      ],
    }),
    listCatalog: async () => ({ modules: [{ moduleId: "novatrail/tables", packageDigest: D2 }] }),
  },
  progress: {
    getSkillMap: async () =>
      create(GetSkillMapResponseSchema, {
        packageDigest: D1,
        skills: [{ skill: "counting", evidenceCount: 1 }],
        anchorSkills: [
          {
            anchorSkill: "core.multiplication-table",
            holding: AnchorSkillHolding.UNKNOWN,
            teachingModules: ["novatrail/tables"],
          },
        ],
      }),
  },
} as unknown as Api;

/** An api of a profile's progress: a trap that repeats, two attempts and a page more. */
const PROGRESS_API = {
  ...MAP_API,
  progress: {
    ...MAP_API.progress,
    getProgress: async () =>
      create(GetProgressResponseSchema, {
        repeatingTraps: [
          {
            trap: "example/fair-shares/trap/halves-of-unequal-parts",
            description: "Takes unequal parts for halves",
            trapAdvice: "Ask whether both parts are the same size before naming them halves",
            attemptCount: 2,
            lastClosedAt: { seconds: 1_794_000_000n },
          },
        ],
        attempts: [
          {
            task: "example/fair-shares/task/a-rather-long-task-identifier-with-no-break-in-it-at-all",
            moduleVersion: "1.0.0",
            lesson: "example/fair-shares/lesson/halves-first-steps",
            closeReason: CloseReason.CORRECT,
            wrongAnswers: 2,
            begunAt: { seconds: 1_794_000_000n },
            closedAt: { seconds: 1_794_000_600n },
            chosenAt: { seconds: 1_793_999_990n },
            reasonCode: ReasonCode.QUEUE,
          },
          {
            task: "novatrail/gone/task/levers-1",
            moduleVersion: "0.3.0",
            begunAt: { seconds: 1_794_000_000n },
          },
        ],
        nextPageToken: "page-2",
      }),
  },
} as unknown as Api;

const SCREENS: readonly [string, () => ReactNode, (() => Promise<void>)?][] = [
  ["framed", () => <Framed />],
  ["offline", () => <Offline onRetry={() => {}} />],
  [
    "unconfigured",
    () => <Unconfigured detail="/deployment.json is refused by schema: signIn.measurementId" />,
  ],
  ["erased", () => <StorageGone trouble="erased" />],
  ["unreadable", () => <StorageGone trouble="unreadable" />],
  [
    "home with the offer to reload",
    () => (
      <>
        <ReloadOffer />
        <App />
      </>
    ),
  ],
  ["another tab", () => <OtherTab />],
  [
    "sign-in",
    () => <SignInScreen onSignIn={async () => ({ kind: "closed" })} onLegal={() => {}} />,
  ],
  [
    "sign-in that the project refused, after a sign-out that left some",
    () => (
      <SignInScreen
        onSignIn={async () => ({ kind: "closed" })}
        result={{ kind: "unconfigured", code: "unauthorized-domain" }}
        left
        onLegal={() => {}}
      />
    ),
  ],
  ["invite code", () => <InviteScreen texts={TEXTS} onCreate={async () => "done"} />],
  [
    "invite code with its texts open",
    () => <InviteScreen texts={TEXTS} onCreate={async () => "done"} />,
    openTexts,
  ],
  [
    "invite code with its errors",
    () => <InviteScreen texts={TEXTS} onCreate={async () => "done"} />,
    submit,
  ],
  [
    "invite code whose texts could not be read",
    () => (
      <InviteScreen
        texts={{ status: "failed", failure: { kind: "offline" }, retry: () => {} }}
        onCreate={async () => "done"}
      />
    ),
  ],
  ["owner's profile", () => <OwnerProfileScreen onCreate={async () => "done"} />],
  [
    "owner's profile with its errors",
    () => <OwnerProfileScreen onCreate={async () => "done"} />,
    submit,
  ],
  [
    "choice of the learner on the first sign-in, with the next version of a text",
    () => (
      <ApiProvider value={POLICY_API}>
        <ChooseScreen
          profiles={[{ ...OWNER, workStorage: true }]}
          first
          onChoose={() => {}}
          onSignOut={() => {}}
          onLegal={() => {}}
        />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("h2")).toHaveLength(1));
    },
  ],
  [
    "sign-out",
    () => (
      <SignOutScreen
        device={memoryDevice().device}
        profiles={[OWNER]}
        onConfirm={async () => "erased" as const}
        onCancel={() => {}}
      />
    ),
  ],
  [
    "My subjects, below the bar, with a card of each kind",
    () => (
      <LearnerProvider
        value={{
          learner: OWNER,
          switchLearner: () => {},
          signOut: () => {},
          onSaved: () => {},
          onFailed: () => {},
        }}
      >
        <LearnerBar />
        <SubjectsScreen
          connected={[
            {
              moduleId: "novatrail/olympiad-math",
              digest: "sha256:1",
              title: "Olympiad maths",
              language: "en",
            },
            { moduleId: "novatrail/gone", title: "novatrail/gone" },
          ]}
          catalog={[
            { moduleId: "novatrail/physics", digest: "sha256:2", title: "Физика", language: "ru" },
          ]}
          failure={{ kind: "offline" }}
          onConnect={() => {}}
          onDisconnect={() => {}}
        />
      </LearnerProvider>
    ),
  ],
  [
    "My subjects with a task in progress",
    () => (
      <SubjectsScreen
        connected={[]}
        catalog={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        onContinue={() => {}}
      />
    ),
  ],
  ["task screen by steps, with its chips", () => taskScreen()],
  [
    "task screen with the voicing on, on a device with no voice for the module's language",
    () => (
      <ApiProvider value={{} as Api}>
        <SpeechProvider value={fakeSpeech([]).speech}>
          <VoicingProvider
            profile={create(ProfileSchema, {
              profileId: "p1",
              presentationStyle: { voicing: { enabled: true } },
            })}
            device={memoryDevice().device}
            place="task"
            onSaved={() => {}}
            onFailed={() => {}}
          >
            {taskScreen({ tutorWords: "How many gaps are there?", wordsCame: true })}
          </VoicingProvider>
        </SpeechProvider>
      </ApiProvider>
    ),
  ],
  [
    "task screen at the plan, with a technique, and the work not saved",
    () =>
      taskScreen({
        state: { ...initialState("steps"), place: 2, reached: 2, techniques: { 2: ["draw"] } },
        notSaved: true,
      }),
  ],
  [
    "task screen on my own, after Not yet",
    () =>
      taskScreen({
        mode: "self",
        state: { ...initialState("self"), choices: { "1.1": "4", "2.1": "Yes", "2.2": "Pears" } },
        verdicts: JUDGED,
        failure: { kind: "offline" },
      }),
  ],
  [
    "task screen solved, with its solution",
    () =>
      taskScreen({
        state: { ...initialState("steps"), choices: { "1.1": "5", "2.1": "Yes", "2.2": "Pears" } },
        solution: [
          { text: "Two and three make five." },
          { picture: "fruit.png", alt: "Five fruits" },
        ],
        againFailure: { kind: "offline" },
      }),
  ],
  [
    "task screen with handwriting after Not yet, with what was read and the tutor's words",
    () =>
      taskScreen({
        task: HANDWRITTEN,
        state: { ...initialState("self"), wrongAnswers: 1 },
        mode: "self",
        verdicts: verdictsOf(
          [
            create(ItemVerdictSchema, {
              verdict: "not_yet",
              answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "5" }],
            }),
          ],
          HANDWRITTEN,
        ),
        tutorWords: "How many gaps are there between the rungs?",
        wordsCame: true,
        outcome: "The tutor can't answer right now",
      }),
  ],
  [
    "task screen with handwriting that could not be read, by steps",
    () =>
      taskScreen({
        task: HANDWRITTEN,
        verdicts: verdictsOf(
          [
            create(ItemVerdictSchema, {
              verdict: "unreadable",
              answerSlots: [
                {
                  answerSlot: { item: 1, slot: 1 },
                  verdict: "unreadable",
                  reason: "several_final_answers",
                },
              ],
            }),
          ],
          HANDWRITTEN,
        ),
        wordsFailure: "A grown-up's consent is needed first",
      }),
  ],
  [
    "task screen of a workbook once checked, its lines with what was read",
    () =>
      taskScreen({
        task: WORKBOOK,
        mode: "self",
        verdicts: verdictsOf(
          [
            create(ItemVerdictSchema, {
              verdict: "correct",
              answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "correct", value: "8" }],
            }),
            create(ItemVerdictSchema, {
              verdict: "unreadable",
              answerSlots: [
                { answerSlot: { item: 2, slot: 1 }, verdict: "unreadable", reason: "blank" },
              ],
            }),
          ],
          WORKBOOK,
        ),
      }),
  ],
  [
    "task screen with the hint asked for, the words of a rung and Explain differently",
    () =>
      taskScreen({
        mode: "self",
        hint: { techniques: ["draw"], question: "What if there were only two pears?" },
        tutorWords: "Count the gaps.",
        onExplain: () => {},
        explainNote: "The tutor has no other words for this",
        onShow: () => {},
        showNote: "A grown-up needs to help",
      }),
  ],
  [
    "task screen with the words of a rung and Report a problem",
    () => taskScreen({ mode: "self", tutorWords: "Count the gaps.", report: report() }),
  ],
  [
    "task screen with the form of a report, sent without a kind",
    () => taskScreen({ mode: "self", tutorWords: "Count the gaps.", report: report() }),
    async () => {
      await press("report.button");
      await press("report.send");
    },
  ],
  [
    "task screen solved, with the words after it and the form of a report",
    () =>
      taskScreen({
        solution: [{ text: "Two and three make five." }],
        tutorWords: "Well done: five fruits.",
        report: report(),
      }),
    async () => {
      await press("report.button");
    },
  ],
  [
    "task screen asking whether to show the solution",
    () => taskScreen({ onShow: () => {} }),
    async () => {
      // The button by its words in each language of the test: none found is a failure, not a skip.
      const names = [WORDS.en, WORDS.ru, wordsOf(PSEUDO, "en")].map((each) =>
        each.text("task.show-solution"),
      );
      const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find((each) =>
        names.includes(each.textContent ?? ""),
      );
      if (button === undefined) throw new Error("no button to show the solution");
      await userEvent.click(button);
    },
  ],
  [
    "task screen with the solution shown",
    () =>
      taskScreen({
        shown: true,
        solution: [{ text: "Two and three make five." }],
      }),
  ],
  [
    "lesson on an explanation, with its picture and numbered list",
    () =>
      lessonScreen(
        <Explanation
          parts={[
            { text: "A fence has posts and gaps between them." },
            { picture: "fence.png", alt: "A fence of four posts", width: 400, height: 100 },
            { numbered_list: ["Count the gaps.", "Add one for the posts."] },
          ]}
          language="en"
          media={noMedia}
        />,
        { place: 1, shown: 1 },
      ),
  ],
  [
    "lesson on a worked example, back from its task, a write not saved",
    () =>
      lessonScreen(
        <Example
          example={{
            statement: [{ text: "A path is 20 m long, with a tree every 5 m." }],
            canvas: { kind: "handwriting_sheet", grid: "squares" },
            demo: [{ text: "20 ÷ 5 = 4 gaps." }, { text: "5 trees." }],
          }}
          manifest={undefined}
          media={noMedia}
          demo={{ opened: 1, hidden: false }}
          onDemo={() => {}}
        />,
        { place: 3, shown: 2, unsaved: true, note: "Not open yet" },
      ),
  ],
  [
    "lesson on its task, solved, with Continue",
    () =>
      lessonScreen(taskScreen({ inLesson: true, solution: [{ text: "Four gaps." }] }), {
        course: { kinds: ["explanation", "example", "task", "explanation"], ended: new Set([3]) },
        place: 4,
        shown: 3,
      }),
  ],
  [
    "lesson on a task that did not begin, with Begin the task again",
    () =>
      lessonScreen(null, {
        place: 3,
        shown: 3,
        failure: { kind: "offline" },
        onAgain: () => {},
      }),
  ],
  [
    "lesson complete, with the next lesson",
    () => (
      <LessonEnd
        reason={RunEndReason.PASSED}
        title="Gaps and posts"
        language="en"
        next={nextStep({ choice: choice(ChoiceKind.LESSON) })}
      />
    ),
  ],
  [
    "lesson ended, with nothing more to offer",
    () => (
      <LessonEnd
        reason={RunEndReason.NOT_SUITABLE}
        next={nextStep({ choice: choice(ChoiceKind.NOTHING) })}
      />
    ),
  ],
  [
    "task screen solved, with the next task",
    () =>
      taskScreen({
        solution: [{ text: "Two and three make five." }],
        next: nextStep({ choice: choice(ChoiceKind.TASK) }),
      }),
  ],
  [
    "My subjects with What's next",
    () => (
      <SubjectsScreen
        connected={[]}
        catalog={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        next={nextStep()}
      />
    ),
  ],
  [
    "My subjects asking whether to leave the task in progress",
    () => (
      <SubjectsScreen
        connected={[]}
        catalog={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        onContinue={() => {}}
        next={
          <AttemptProvider
            learner={create(ProfileSchema, { profileId: "p1", openAttempt: { attemptId: "a1" } })}
          >
            {nextStep()}
          </AttemptProvider>
        }
      />
    ),
    async () => {
      const button = document.querySelector<HTMLButtonElement>("button.nt-secondary");
      if (button === null) throw new Error("no Something else");
      await userEvent.click(button);
    },
  ],
  ["lesson ended by api", () => <LessonEnd reason={RunEndReason.ABANDONED} />],
  ["the legal pages, below their bar", () => <LegalPages route={LEGAL} back={HOME} />],
  [
    "the privacy policy as a page, with its translation and a table",
    () => (
      <ApiProvider value={POLICY_API}>
        <LegalPages route={{ ...LEGAL, parts: ["privacy-policy"] }} back={HOME} />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelector("table")).not.toBeNull());
    },
  ],
  [
    "the next version of the privacy policy as a page",
    () => (
      <ApiProvider value={POLICY_API}>
        <LegalPages route={{ ...LEGAL, parts: ["privacy-policy", "next"] }} back={HOME} />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("section[lang]")).toHaveLength(2));
    },
  ],
  [
    "who runs this copy, from the privacy policy",
    () => (
      <ApiProvider value={POLICY_API}>
        <LegalPages route={{ ...LEGAL, parts: ["operator"] }} back={HOME} />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelector("section[lang] ul")).not.toBeNull());
    },
  ],
  [
    "Accessibility",
    () => <LegalPages route={{ ...LEGAL, parts: ["accessibility"] }} back={HOME} />,
  ],
  [
    "the notices of third-party code",
    () => <LegalPages route={{ ...LEGAL, parts: ["notices"] }} back={HOME} />,
  ],
  [
    "the section for adults, below its bar, with the next version of a text",
    () => (
      <ApiProvider value={POLICY_API}>
        <AdultSection
          route={{ screen: "adults", parts: [] }}
          device={memoryDevice().device}
          profiles={[OWNER]}
          onSaved={() => {}}
          onFailed={() => {}}
          onEraseAll={async () => "erased"}
          onLegal={() => {}}
        />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("h2")).toHaveLength(5));
    },
  ],
  [
    "This device, with a profile that keeps work and one that cannot be read",
    () => devicePage(),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("h3 ~ p").length).toBeGreaterThan(4));
    },
  ],
  [
    "This device asking before it erases everything",
    () => devicePage(),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("h3 ~ p").length).toBeGreaterThan(4));
      const buttons = document.querySelectorAll<HTMLButtonElement>("button");
      await userEvent.click(buttons[buttons.length - 1] as HTMLButtonElement);
      expect(document.querySelector("fieldset legend")).not.toBeNull();
    },
  ],
  [
    "a profile's page, with a language the build does not have",
    () => (
      <ApiProvider value={{} as Api}>
        <ProfilePage
          profile={{ ...OWNER, interfaceLanguage: "de" }}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>
    ),
  ],
  [
    "a profile's page with its error",
    () => (
      <ApiProvider value={{} as Api}>
        <ProfilePage
          profile={{ ...OWNER, pseudonym: " " }}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>
    ),
    submit,
  ],
  [
    "a profile's page asking the consent to keep works on the server, unticked",
    () => (
      <ApiProvider value={STORAGE_API}>
        <ProfilePage profile={OWNER} onSaved={() => {}} onFailed={() => {}} />
      </ApiProvider>
    ),
    consenting,
  ],
  [
    "a profile's page with its works kept on the server",
    () => (
      <ApiProvider value={{} as Api}>
        <ProfilePage
          profile={{ ...OWNER, workStorage: true }}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>
    ),
  ],
  [
    "a profile's page with the tutor time of the profile and the account, its cap reached",
    () => (
      <ApiProvider value={QUOTA_API}>
        <ProfilePage profile={OWNER} onSaved={() => {}} onFailed={() => {}} />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("section")).toHaveLength(4));
    },
  ],
  [
    "My subjects with the tutor time used today",
    () => (
      <SubjectsScreen
        connected={[]}
        catalog={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        quota={create(QuotaShareSchema, { profilePercent: 40 })}
      />
    ),
  ],
  [
    "My subjects with lessons in progress",
    () => (
      <SubjectsScreen
        connected={[]}
        catalog={[]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        runs={[
          { lessonRunId: "r1", title: "Gaps and posts", module: "Olympiad maths", language: "en" },
          { lessonRunId: "r2", module: "Физика", language: "ru" },
        ]}
        onLesson={() => {}}
      />
    ),
  ],
  [
    "My subjects with cards that open their licenses",
    () => (
      <SubjectsScreen
        connected={[
          {
            moduleId: "novatrail/olympiad-math",
            digest: D1,
            title: "Olympiad maths",
            language: "en",
            sequential: true,
          },
        ]}
        catalog={[{ moduleId: "novatrail/physics", digest: D2, title: "Физика", language: "ru" }]}
        onConnect={() => {}}
        onDisconnect={() => {}}
        onLicense={() => {}}
      />
    ),
  ],
  [
    "the skill maps of the modules connected",
    () => (
      <ApiProvider value={MAP_API}>
        <PackagesProvider value={MAPPED}>
          <SkillMapRoute route={SKILL_MAP} profileId="p1" />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("article")).toHaveLength(2));
    },
  ],
  [
    "a module's skill map, a skill open, with a module to connect",
    () => (
      <ApiProvider value={MAP_API}>
        <PackagesProvider value={MAPPED}>
          <SkillMapRoute route={moduleMapRoute("example/fair-shares")} profileId="p1" />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("article")).toHaveLength(1));
      const root = await vi.waitFor(() => {
        const found = document.querySelector("novatrail-skill-map")?.shadowRoot;
        if (found?.querySelector("button.tile") == null) throw new Error("no map yet");
        return found;
      });
      [...root.querySelectorAll<HTMLButtonElement>("button.tile")]
        .find((tile) => tile.textContent?.startsWith("Counting"))
        ?.click();
      await vi.waitFor(() => expect(root.querySelector("button.practise")).not.toBeNull());
    },
  ],
  [
    "the page on the AI tutor, below its bar",
    () => <TutorPages route={TUTOR} onOperator={() => {}} />,
  ],
  [
    "the license of a module, below its bar",
    () => (
      <ApiProvider value={{} as Api}>
        <PackagesProvider value={LICENSED}>
          <LicensePages route={licenseRoute(D1)} />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelector("pre")).not.toBeNull());
    },
  ],
  [
    "the modules of a profile in the section",
    () => (
      <ApiProvider value={MODULES_API}>
        <PackagesProvider value={LICENSED}>
          <ModulesPage profile={OWNER} />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("article")).toHaveLength(2));
    },
  ],
  [
    "the progress of a profile in the section",
    () => (
      <ApiProvider value={PROGRESS_API}>
        <PackagesProvider value={MAPPED}>
          <ProgressPage profile={OWNER} />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("article")).toHaveLength(5));
    },
  ],
  [
    "a module's map in the progress, the adult's view, a skill open",
    () => (
      <ApiProvider value={PROGRESS_API}>
        <PackagesProvider value={MAPPED}>
          <ProgressMap profile={OWNER} moduleId="example/fair-shares" />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      const root = await vi.waitFor(() => {
        const found = document.querySelector("novatrail-skill-map")?.shadowRoot;
        if (found?.querySelector("button.tile") == null) throw new Error("no map yet");
        return found;
      });
      root.querySelector<HTMLButtonElement>("button.tile")?.click();
      await vi.waitFor(() => expect(root.querySelector("[aria-expanded='true']")).not.toBeNull());
    },
  ],
  [
    "My subjects with none connected and an empty catalog",
    () => (
      <SubjectsScreen connected={[]} catalog={[]} onConnect={() => {}} onDisconnect={() => {}} />
    ),
  ],
];

const LANGUAGES: readonly [string, Language, typeof WORDS.en][] = [
  ["en", "en", WORDS.en],
  ["ru", "ru", WORDS.ru],
  ["pseudo", "en", wordsOf(PSEUDO, "en")],
];

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe.each(LANGUAGES)("the screens in %s", (_, language, words) => {
  // A screen whose words are not ready yet shows nothing for a moment: none of these is so.
  it.each(SCREENS)(
    "%s has no violation, small target or overflow, at 1024 and 320 px",
    async (_, screen, after) => {
      render(inLanguage(screen(), language, words));
      await after?.();
      for (const width of [1024, 320]) {
        await page.viewport(width, 640);
        expect(await axeViolations(), `axe at ${width} px`).toEqual([]);
        expect(smallTargets(), `targets at ${width} px`).toEqual([]);
        expect(overflows(), `layout at ${width} px`).toEqual([]);
      }
      await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
      for (const button of page.getByRole("button").elements()) {
        await expect.element(button).toHaveAccessibleName(button.textContent ?? "");
      }
    },
  );
});
