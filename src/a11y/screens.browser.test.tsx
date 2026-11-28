// Every screen of app, in English, in Russian and in the pseudo-language, at a plain width and at
// 320 CSS px: no violation of WCAG 2.2 A and AA that axe-core finds, every target at least
// 44 × 44 CSS px, no sideways scroll and no text cut. Each screen is found by its role and name.
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
  type QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { TutorReply } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  ChoiceKind,
  EngineChoiceSchema,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  LessonState,
  ListLessonsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { LegalTextSchema } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import {
  AnchorSkillHolding,
  GetSkillMapResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { userEvent } from "vitest/browser";
import { LearnerProvider } from "../account/AccountGate.tsx";
import { ChooseScreen } from "../account/ChooseScreen.tsx";
import { InviteScreen, type TextsRead } from "../account/InviteScreen.tsx";
import { OwnerProfileScreen } from "../account/OwnerProfileScreen.tsx";
import { AdultSection } from "../adults/AdultSection.tsx";
import { DevicePage } from "../adults/DevicePage.tsx";
import { ProfilePage } from "../adults/ProfilePage.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { App } from "../app/App.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { HOME, LEGAL, TUTOR } from "../app/router.ts";
import { ShellBar } from "../app/Shell.tsx";
import {
  Framed,
  Held,
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
import { ContinueButton, LessonScreen, type LessonScreenProps } from "../lesson/LessonScreen.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { KeyHolder } from "../ownkey/holder.ts";
import { KeyHolderProvider } from "../ownkey/OwnKeyContext.tsx";
import { LicensePages, licenseRoute } from "../packages/LicensePage.tsx";
import { type Packages, PackagesProvider } from "../packages/PackagesContext.tsx";
import { Camera } from "../paper/Camera.tsx";
import { Pick } from "../paper/Pick.tsx";
import { type ModuleSide, Solve } from "../paper/Solve.tsx";
import type { BegunTask } from "../paper/solve.ts";
import { SignInScreen } from "../signin/SignInScreen.tsx";
import { moduleMapRoute, SkillMapRoute } from "../skills/SkillMapScreen.tsx";
import { addProfile } from "../storage/profile.ts";
import { addDatabase, setAccount } from "../storage/registry.ts";
import { PROFILE_SCHEMA, profileDatabase } from "../storage/schema.ts";
import { LessonsRoute, lessonsRoute } from "../subjects/LessonsScreen.tsx";
import { HomeScreen } from "../subjects/MySubjects.tsx";
import type { ModuleAbout, SkillList } from "../subjects/modules.ts";
import { CatalogScreen } from "../subjects/SubjectsPage.tsx";
import type { SkillCounts } from "../subjects/states.ts";
import {
  axeViolations,
  captionlessOffList,
  overflows,
  settledViolations,
  smallTargets,
} from "../test/a11y.ts";
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

/** The owner chosen, as the gate gives the learner's screens. */
const CHOSEN = {
  learner: OWNER,
  switchLearner: () => {},
  signOut: () => {},
  openLegal: () => {},
  onSaved: () => {},
  onFailed: () => {},
};

/** Home with nothing connected, in the frame of its bar, and presses on buttons of the bar and its menu, in order. */
function homeWith(...buttons: string[]): [() => ReactNode, () => Promise<void>] {
  return [
    () => (
      <ApiProvider value={{} as Api}>
        <LearnerProvider value={CHOSEN}>
          <div className="nt-shell">
            <ShellBar place="home" />
            <HomeScreen connected={[]} />
          </div>
        </LearnerProvider>
      </ApiProvider>
    ),
    async () => {
      for (const button of buttons)
        await userEvent.click(document.querySelector(button) as HTMLElement);
      await expect.element(page.getByRole("dialog")).toBeVisible();
    },
  ];
}

/** Home in the frame of its bar with the ring of tutor time at this share, its pop-over opened. */
function ringOpen(
  name: string,
  share: MessageInitShape<typeof QuotaShareSchema>,
): [string, () => ReactNode, () => Promise<void>] {
  const api = {
    account: { getQuota: async () => create(GetQuotaResponseSchema, { share }) },
  } as unknown as Api;
  return [
    name,
    () => (
      <ApiProvider value={api}>
        <LearnerProvider value={CHOSEN}>
          <div className="nt-shell">
            <ShellBar place="home" />
            <HomeScreen connected={[]} />
          </div>
        </LearnerProvider>
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelector(".nt-ring-btn")).not.toBeNull());
      await userEvent.click(document.querySelector(".nt-ring-btn") as HTMLElement);
      await expect.element(page.getByRole("dialog")).toBeVisible();
    },
  ];
}

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

/** A task of a module with options, as the sheet lays them on its tracing paper. */
const CHOICE_TASK: open.Task = {
  id: "fruit",
  statement: [{ text: "Two apples and three pears are in a bowl. How many fruits?" }],
  canvas: { kind: "handwriting_sheet" },
  givens: ["Two apples", "Three pears"],
  unknown: "How many fruits",
  items: [{ answer_slots: [{ binding: "choice", options: ["4", "5"] }] }],
};

/** A short essay, with a rubric, on the lined sheet. */
const ESSAY_TASK: open.Task = {
  id: "essay",
  statement: [{ text: "Write about your favourite season." }],
  canvas: { kind: "handwriting_sheet" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

/** The sheet of a task of a module, its one task begun as given, with an api it never reaches. */
function moduleSheet(
  begun: Partial<BegunTask> = {},
  side: Partial<ModuleSide> = {},
  task: open.Task = CHOICE_TASK,
) {
  const frame = { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 };
  return (
    <ApiProvider value={{} as Api}>
      <Solve
        profileId="p1"
        adult={false}
        tasks={[{ id: "module", frame, drawn: false, picked: true }]}
        begun={[
          {
            attemptId: "a1",
            taskId: "module",
            frame,
            drawn: false,
            crop: new Blob([], { type: "image/png" }),
            history: [],
            ...begun,
          },
        ]}
        onKeep={() => {}}
        onRenew={() => new Promise(() => {})}
        onHome={() => {}}
        module={{
          task,
          ...(task === CHOICE_TASK
            ? { choice: { item: 1, slot: 1, options: ["4", "5"] }, writes: false }
            : { writes: true }),
          language: "en",
          catalog: undefined,
          pill: null,
          onSolved: () => {},
          onNext: () => {},
          nexting: false,
          ...side,
        }}
      />
    </ApiProvider>
  );
}

/** The lesson player on a segment of a lesson of four, with the segment given. */
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

/**
 * A whole invite code of api's form, synthetic, typed, and its step left for the statement and the
 * texts.
 */
async function agreeStep(): Promise<void> {
  await userEvent.type(document.querySelector("input") as HTMLElement, "N7VA-K2QM-9XB4-ZD3H");
  await submit();
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
    { version: PROFILE_SCHEMA.version + 1, stores: {} },
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

/** An api that opens Anthropic alone to an own key. */
const KEY_API = {
  account: {
    listOwnKeyProviders: async () => ({
      providers: [{ provider: "anthropic", name: "Anthropic" }],
    }),
  },
} as unknown as Api;

/** The own key's page in the section, beside its list, with the owner open: a key connected, or none. */
function ownKeyPage(connected: boolean) {
  // A synthetic key: no provider issued it.
  let kept = connected
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
  void holder.open(OWNER.profileId);
  return (
    <ApiProvider value={KEY_API}>
      <KeyHolderProvider holder={holder}>
        <AdultSection
          route={{ screen: "adults", parts: ["own-key"] }}
          device={memoryDevice().device}
          profiles={[OWNER]}
          onSaved={() => {}}
          onFailed={() => {}}
          onEraseAll={async () => "erased"}
          onLegal={() => {}}
        />
      </KeyHolderProvider>
    </ApiProvider>
  );
}

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
  const keep =
    [...document.querySelectorAll<HTMLInputElement>("input[role=switch]")].at(-1) ?? null;
  if (keep === null) throw new Error("no Keep works on the server");
  // By the keyboard: after a pointer's click on a switch of Settings, axe's target-size check
  // crashes Firefox's page.
  keep.focus();
  await userEvent.keyboard(" ");
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

/** A catalog card's facts and skills: a module for grades 1 to 6, its skills in two tiers. */
const CATALOG_ABOUT: ModuleAbout = {
  subject: "mathematics",
  ageCategories: ["under_13"],
  grades: [1, 2, 3, 4, 5, 6],
  version: "0.1.0",
  authors: ["The NovaTrail authors"],
  license: "Apache-2.0",
};
const CATALOG_SKILLS: SkillList = {
  tiers: [
    { tier: 1, name: "Basics", skills: ["Counting on", "Even and odd", "Perimeter"] },
    { tier: 2, skills: ["Number patterns", "Logic puzzles"] },
  ],
  count: 5,
  rubric: false,
};
/** No skill in any state or mark. */
const NO_SKILLS: SkillCounts = {
  mastered: 0,
  "time-to-review": 0,
  "in-progress": 0,
  "ready-to-start": 0,
  locked: 0,
  "feedback-by-criteria": 0,
  "not-assessed": 0,
};

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

/** The open views of a module with a skill graph of two skills, and of a module that teaches. */
/** The skills a module's card offers for its task skill. */
const PICKS = {
  suggested: [
    {
      skill: "novatrail/olympiad-math/skill/gaps",
      title: "Gaps",
      status: "time-to-review" as const,
    },
  ],
  tiers: [
    {
      name: "Warm-up",
      skills: [
        {
          skill: "novatrail/olympiad-math/skill/gaps",
          title: "Gaps",
          status: "time-to-review" as const,
        },
        {
          skill: "novatrail/olympiad-math/skill/towers",
          title: "Towers",
          status: "locked" as const,
        },
      ],
    },
  ],
};

/** api with a module's lessons: one passed, one begun, two in any order. */
const LESSONS_API = {
  learning: {
    listLessons: async () =>
      create(ListLessonsResponseSchema, {
        lessons: [
          {
            lesson: "example/fair-shares/lesson/counting",
            title: "Counting",
            segments: 4,
            group: 0,
            state: LessonState.PASSED,
          },
          {
            lesson: "example/fair-shares/lesson/halves",
            title: "Halves",
            segments: 6,
            group: 1,
            state: LessonState.OPEN,
            endedSegments: [2],
          },
          {
            lesson: "example/fair-shares/lesson/thirds",
            title: "Thirds",
            segments: 5,
            group: 1,
            state: LessonState.NEW,
          },
        ],
        tileLesson: "example/fair-shares/lesson/halves",
      }),
  },
  module: {
    listConnectedModules: async () => ({
      modules: [{ moduleId: "example/fair-shares", packageDigest: D1 }],
    }),
  },
} as unknown as Api;

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
              // The bands of the level, which the adult's map corrects.
              ...(digest === D1
                ? {
                    bands: [
                      { id: "easy", title: "Easy" },
                      { id: "middle", title: "Middle" },
                      { id: "hard", title: "Hard" },
                    ],
                  }
                : {}),
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
        levelBand: "middle",
        levelSetAt: { seconds: 1_794_830_400n, nanos: 0 },
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

/** The photo of a page on the pick screen: a white picture, synthetic. */
const PAGE_PHOTO = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#fff"/></svg>')}`;

const SCREENS: readonly [string, () => ReactNode, (() => Promise<void>)?][] = [
  ["framed", () => <Framed />],
  ["offline", () => <Offline onRetry={() => {}} />],
  ["held", () => <Held onRetry={() => {}} />],
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
  [
    "invite code",
    () => (
      <InviteScreen
        texts={TEXTS}
        onCreate={async () => "done"}
        onLegal={() => {}}
        onSignOut={() => {}}
      />
    ),
  ],
  [
    "invite code's statement",
    () => (
      <InviteScreen
        texts={TEXTS}
        onCreate={async () => "done"}
        onLegal={() => {}}
        onSignOut={() => {}}
      />
    ),
    agreeStep,
  ],
  [
    "invite code that api did not take",
    () => (
      <InviteScreen
        texts={TEXTS}
        onCreate={async () => "code-not-accepted"}
        onLegal={() => {}}
        onSignOut={() => {}}
      />
    ),
    async () => {
      await agreeStep();
      for (const tick of document.querySelectorAll("input[type=checkbox]")) {
        await userEvent.click(tick);
      }
      await submit();
    },
  ],
  [
    "invite code's statement whose texts could not be read",
    () => (
      <InviteScreen
        texts={{ status: "failed", failure: { kind: "offline" }, retry: () => {} }}
        onCreate={async () => "done"}
        onLegal={() => {}}
        onSignOut={() => {}}
      />
    ),
    agreeStep,
  ],
  ["owner's profile", () => <OwnerProfileScreen onCreate={async () => "done"} />],
  [
    "owner's profile with the avatars open",
    () => <OwnerProfileScreen onCreate={async () => "done"} />,
    async () => {
      await userEvent.click(document.querySelector<HTMLButtonElement>(".nt-link") as HTMLElement);
    },
  ],
  [
    "owner's profile whose country api did not take",
    () => <OwnerProfileScreen onCreate={async () => "country-not-accepted"} />,
    async () => {
      await userEvent.type(document.querySelector("input") as HTMLElement, "Sam");
      await userEvent.click(
        document.querySelector<HTMLButtonElement>("button.nt-row") as HTMLElement,
      );
      await userEvent.click(document.querySelector(".nt-choice-list button") as HTMLElement);
      await submit();
    },
  ],
  [
    "choice of the learner",
    () => (
      <ChooseScreen profiles={[OWNER]} first={false} onChoose={() => {}} onSignOut={() => {}} />
    ),
  ],
  [
    "Home, in the frame of its bar, with a card of each kind",
    () => (
      <ApiProvider value={{} as Api}>
        <LearnerProvider value={CHOSEN}>
          <div className="nt-shell">
            <ShellBar place="home" />
            <HomeScreen
              connected={[
                {
                  moduleId: "novatrail/olympiad-math",
                  digest: "sha256:1",
                  title: "Olympiad maths",
                  language: "en",
                  skills: {
                    mastered: 14,
                    "time-to-review": 3,
                    "in-progress": 6,
                    "ready-to-start": 9,
                    locked: 13,
                    "feedback-by-criteria": 2,
                    "not-assessed": 1,
                  },
                  picks: PICKS,
                  lesson: {
                    lesson: "novatrail/olympiad-math/lesson/gaps",
                    title: "Gaps and posts",
                    step: 2,
                    segments: 6,
                    open: true,
                  },
                },
                {
                  moduleId: "novatrail/fractions",
                  digest: "sha256:4",
                  title: "Fractions step by step",
                  language: "en",
                  sequential: true,
                  skills: {
                    mastered: 3,
                    "time-to-review": 1,
                    "in-progress": 1,
                    "ready-to-start": 1,
                    locked: 4,
                    "feedback-by-criteria": 0,
                    "not-assessed": 0,
                  },
                  picks: PICKS,
                  taskSkill: "novatrail/olympiad-math/skill/gaps",
                  lesson: null,
                },
                {
                  moduleId: "novatrail/short-essays",
                  digest: "sha256:3",
                  title: "Short essays",
                  language: "en",
                  skills: {
                    mastered: 0,
                    "time-to-review": 0,
                    "in-progress": 0,
                    "ready-to-start": 0,
                    locked: 0,
                    "feedback-by-criteria": 18,
                    "not-assessed": 0,
                  },
                  lesson: null,
                },
                { moduleId: "novatrail/gone", title: "novatrail/gone" },
              ]}
              failure={{ kind: "offline" }}
            />
          </div>
        </LearnerProvider>
      </ApiProvider>
    ),
  ],
  [
    "Home with the adult's Help open",
    // Help is the second row that leads further, after Settings.
    ...homeWith(
      "button.nt-learner-pill",
      ".nt-menu-row:has(.nt-menu-more) ~ .nt-menu-row:has(.nt-menu-more)",
    ),
  ],
  ["Home with the profile's menu open", ...homeWith("button.nt-learner-pill")],
  [
    "Home with the choice of a module's task skill open",
    () => (
      <HomeScreen
        connected={[
          {
            moduleId: "novatrail/olympiad-math",
            digest: "sha256:1",
            title: "Olympiad maths",
            language: "en",
            picks: PICKS,
            lesson: null,
          },
        ]}
      />
    ),
    async () => {
      await userEvent.click(document.querySelector("button.nt-way-row") as HTMLElement);
      await expect.element(page.getByRole("dialog")).toBeVisible();
    },
  ],
  ["the camera of a task from paper", () => <Camera onPhoto={() => {}} onClose={() => {}} />],
  [
    "the pick of a task from paper, a frame found and one drawn, the tutor's button in its bar",
    () => (
      <Pick
        photo={{ bytes: new Uint8Array(), width: 600, height: 800, url: PAGE_PHOTO }}
        tasks={[
          {
            id: "found-1",
            frame: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 },
            drawn: false,
            picked: true,
          },
          {
            id: "drawn-1",
            frame: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 },
            drawn: true,
            picked: false,
          },
        ]}
        onTasks={() => {}}
        finding={false}
        closed={false}
        starting={false}
        onStart={() => {}}
        onRetake={() => {}}
        onHome={() => {}}
        calls={
          <IconButton
            value="tutor"
            className="nt-call-tutor"
            aria-expanded={false}
            onClick={() => {}}
          />
        }
      />
    ),
  ],
  [
    "the solving of a task from paper, its sheet under the crop",
    () => (
      <ApiProvider value={{} as Api}>
        <Solve
          profileId="p1"
          adult={false}
          tasks={[
            {
              id: "found-1",
              frame: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 },
              drawn: false,
              picked: true,
            },
            {
              id: "drawn-1",
              frame: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 },
              drawn: true,
              picked: true,
            },
          ]}
          begun={[
            {
              attemptId: "a1",
              taskId: "found-1",
              frame: { ymin: 75, xmin: 50, ymax: 225, xmax: 950 },
              drawn: false,
              crop: new Blob([], { type: "image/png" }),
              history: [],
            },
            {
              attemptId: "a2",
              taskId: "drawn-1",
              frame: { ymin: 500, xmin: 50, ymax: 650, xmax: 950 },
              drawn: true,
              crop: new Blob([], { type: "image/png" }),
              history: [],
            },
          ]}
          onKeep={() => {}}
          onRenew={() => new Promise(() => {})}
          onAdd={() => {}}
          onHome={() => {}}
        />
      </ApiProvider>
    ),
  ],
  ["the sheet of a task of a module, its options on the tracing paper", () => moduleSheet()],
  [
    "the sheet of a task of a module with the voicing on, on a device with no voice for its language",
    () => (
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
          {moduleSheet()}
        </VoicingProvider>
      </SpeechProvider>
    ),
  ],
  [
    "the sheet of a task of a module after Not yet, an option chosen",
    () =>
      moduleSheet({
        chosen: 0,
        wrongAnswers: 1,
        verdict: { kind: "not-yet", read: "4", parts: [{ verdict: "not-yet" }], chose: true },
      }),
  ],
  [
    "the sheet of a task of a module solved, with Next task",
    () =>
      moduleSheet(
        {
          chosen: 1,
          over: true,
          solved: true,
          verdict: { kind: "correct", read: "5", parts: [{ verdict: "correct" }], chose: true },
        },
        { nextNote: "The tutor has no task for this skill yet" },
      ),
  ],
  [
    "the sheet of a task of a module whose work could not be read",
    () => moduleSheet({ verdict: { kind: "unreadable", reason: "several_final_answers" } }),
  ],
  [
    "the form of a report of the tutor's words, sent without a kind",
    () => (
      <main>
        <h1>Tutor</h1>
        {report()}
      </main>
    ),
    async () => {
      await press("report.button");
      await press("report.send");
    },
  ],
  [
    "the sheet of a short essay, lined, with Done",
    () => moduleSheet({}, { essay: { submissions: 1 } }, ESSAY_TASK),
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
    "lesson with its segments open, two passed and a task over",
    () =>
      lessonScreen(<p>A fence has posts and gaps between them.</p>, {
        course: { kinds: ["explanation", "example", "task", "explanation"], ended: new Set([3]) },
        place: 4,
        shown: 1,
        module: "Olympiad maths 1–6",
      }),
    async () => {
      await userEvent.click(
        document.querySelector<HTMLButtonElement>(".nt-segments-open") as HTMLElement,
      );
    },
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
          actions={<ContinueButton slot="actions" pending={false} onContinue={() => {}} />}
        />,
        { place: 3, shown: 2, unsaved: true, note: "Not open yet", onContinue: undefined },
      ),
  ],
  [
    "lesson on a task that ended, with Continue",
    () =>
      lessonScreen(<p>This task is over</p>, {
        course: { kinds: ["explanation", "example", "task", "explanation"], ended: new Set([3]) },
        place: 4,
        shown: 3,
      }),
  ],
  [
    "lesson on a task being remade, after a request that failed",
    () =>
      lessonScreen(<p>This task is being remade with the lessons</p>, {
        place: 3,
        shown: 3,
        failure: { kind: "offline" },
        onContinue: undefined,
      }),
  ],
  [
    "lesson complete, with the next lesson",
    () => (
      <LessonEnd
        reason={RunEndReason.PASSED}
        title="Gaps and posts"
        language="en"
        module={{ id: "olympiad-math", title: "Olympiad maths 1–6" }}
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
    "Settings beside the owner's page",
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
      await page.viewport(1024, 640);
      await vi.waitFor(() =>
        expect(document.querySelector(".nt-set-side .nt-set-row")).not.toBeNull(),
      );
    },
  ],
  [
    "Own AI key, its form beside the section's list",
    () => ownKeyPage(false),
    async () => {
      await page.viewport(1024, 640);
      await vi.waitFor(() => expect(document.querySelector(".nt-set-field input")).not.toBeNull());
    },
  ],
  [
    "Own AI key connected, on its own as the phone shows it",
    () => ownKeyPage(true),
    async () => {
      await page.viewport(390, 844);
      await vi.waitFor(() =>
        expect(document.querySelector("[role=status] .nt-set-tile")).not.toBeNull(),
      );
    },
  ],
  [
    "This device in the section, beside its list",
    () => (
      <ApiProvider value={POLICY_API}>
        <AdultSection
          route={{ screen: "adults", parts: ["device"] }}
          device={SEEDED}
          profiles={[OWNER, create(ProfileSchema, { profileId: "p2", pseudonym: "Аня" })]}
          onSaved={() => {}}
          onFailed={() => {}}
          onEraseAll={async () => "failed"}
          onLegal={() => {}}
        />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelectorAll("h3 ~ p").length).toBeGreaterThan(4));
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
    "a profile's page with its error",
    () => (
      <ApiProvider value={{} as Api}>
        <ProfilePage
          device={memoryDevice().device}
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
        <ProfilePage
          device={memoryDevice().device}
          profile={OWNER}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>
    ),
    consenting,
  ],
  [
    "a profile's page with its works kept on the server",
    () => (
      <ApiProvider value={{} as Api}>
        <ProfilePage
          device={memoryDevice().device}
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
        <ProfilePage
          device={memoryDevice().device}
          profile={OWNER}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>
    ),
    async () => {
      await vi.waitFor(() => expect(document.querySelector(".nt-set-meter")).not.toBeNull());
    },
  ],
  ringOpen("Home with the ring of tutor time used today, its pop-over open", {
    profilePercent: 40,
  }),
  ringOpen("Home with the ring of tutor time none used, its pop-over open", { profilePercent: 0 }),
  ringOpen("Home with the ring of tutor time used up, its pop-over open", {
    profilePercent: 100,
    capReached: true,
    nextFamilyDay: { seconds: 1_794_009_600n },
  }),
  [
    "the lessons of a module, passed, begun, new and in any order",
    () => (
      <ApiProvider value={LESSONS_API}>
        <PackagesProvider value={MAPPED}>
          <LessonsRoute route={lessonsRoute("example/fair-shares")} profileId="p1" />
        </PackagesProvider>
      </ApiProvider>
    ),
    async () => {
      await expect.element(page.getByRole("button", { name: /Halves/ })).toBeVisible();
    },
  ],
  [
    "Subjects with cards that say what their modules are",
    () => (
      <CatalogScreen
        connected={[
          {
            moduleId: "novatrail/olympiad-math",
            digest: D1,
            title: "Olympiad maths",
            language: "en",
            sequential: true,
            about: CATALOG_ABOUT,
            skillList: CATALOG_SKILLS,
            skills: { ...NO_SKILLS, mastered: 2, "in-progress": 1, locked: 2 },
          },
        ]}
        catalog={[
          {
            moduleId: "novatrail/physics",
            digest: D2,
            title: "Физика",
            language: "ru",
            about: { ...CATALOG_ABOUT, subject: "physics", grades: [] },
            skillList: CATALOG_SKILLS,
          },
        ]}
        onConnect={() => {}}
        onDisconnect={() => {}}
      />
    ),
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
    "Subjects with none connected and an empty catalog",
    () => (
      <CatalogScreen connected={[]} catalog={[]} onConnect={() => {}} onDisconnect={() => {}} />
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

/** A pattern of the words of a text, any space or none between its letters. */
function spaced(text: string): string {
  return [...text.replace(/\s+/g, "")]
    .map((letter) => letter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s*");
}

describe.each(LANGUAGES)("the screens in %s", (_, language, words) => {
  // A screen whose words are not ready yet shows nothing for a moment: none of these is so.
  it.each(SCREENS)(
    "%s has no violation, small target or overflow, at 1024 and 320 px",
    async (_, screen, after) => {
      render(inLanguage(screen(), language, words));
      await after?.();
      for (const width of [1024, 320]) {
        await page.viewport(width, 640);
        // Two frames for what measures itself on a resize: the canvas's row of a worked example
        // takes its width from the element by a ResizeObserver.
        for (let frame = 0; frame < 2; frame++) await new Promise(requestAnimationFrame);
        expect(await settledViolations(), `axe at ${width} px`).toEqual([]);
        expect(smallTargets(), `targets at ${width} px`).toEqual([]);
        expect(overflows(), `layout at ${width} px`).toEqual([]);
      }
      await expect.element(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(captionlessOffList(words), "buttons without a caption").toEqual([]);
      for (const button of page.getByRole("button").elements()) {
        // A button of the closed list is named by its caption, which it does not show; one
        // named beside its words, as the profile's pill, has its words in its name (2.5.3).
        const label = button.getAttribute("aria-label");
        const text = button.textContent ?? "";
        // A name from the words runs them on with a space between the button's blocks, where
        // its text has none: the words, whatever space there is between them.
        await expect
          .element(button)
          .toHaveAccessibleName(label ?? new RegExp(`^\\s*${spaced(text)}\\s*$`));
        if (label !== null) expect(label).toContain(text);
      }
    },
  );
});

describe("the checks", () => {
  it("take app's own button in the canvas's slot, and leave the canvas's own tree to canvas", async () => {
    render(
      <novatrail-canvas
        lang="en"
        workedExample={{
          statement: [{ text: "A path is 20 m long, with a tree every 5 m." }],
          canvas: { kind: "handwriting_sheet", grid: "squares" },
          demo: [{ text: "20 ÷ 5 = 4 gaps." }],
        }}
      >
        <button
          type="button"
          slot="actions"
          style={{ minInlineSize: 0, minBlockSize: 0, inlineSize: "1rem", blockSize: "1rem" }}
        />
      </novatrail-canvas>,
    );
    // The slot stands in the element's row once the element has drawn it.
    await vi.waitFor(() => expect(document.querySelector("[slot]")?.assignedSlot).toBeTruthy());
    expect((await axeViolations()).map((line) => line.split(":")[0])).toContain("button-name");
    expect(smallTargets()).toHaveLength(1);
    // The canvas's own buttons, in its shadow tree, are canvas's to check.
    expect(
      document.querySelector("novatrail-canvas")?.shadowRoot?.querySelector("button"),
    ).toBeTruthy();
    expect(captionlessOffList(WORDS.en)).toEqual([""]);
  });
});
