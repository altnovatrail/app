// Every screen of app so far, in English, in Russian and in the pseudo-language, at a plain width
// and at 320 CSS px (section 3.9 of docs/architecture.md): no violation of WCAG 2.2 A and AA that
// axe-core finds, every target at least 44 × 44 CSS px, no sideways scroll and no text cut. Each
// screen is found by its role and name.
import "@altnovatrail/canvas";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { ItemVerdictSchema } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  ChoiceKind,
  EngineChoiceSchema,
  RunEndReason,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { userEvent } from "vitest/browser";
import {
  ChooseScreen,
  InviteScreen,
  LearnerProvider,
  OwnerProfileScreen,
  SignOutScreen,
} from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { App, LearnerBar } from "../app/App.tsx";
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
import { Example } from "../lesson/Example.tsx";
import { Explanation } from "../lesson/Explanation.tsx";
import { LessonEnd } from "../lesson/Lesson.tsx";
import { LessonScreen, type LessonScreenProps } from "../lesson/LessonScreen.tsx";
import { NextStep } from "../next/NextStep.tsx";
import { SignInScreen } from "../signin/SignInScreen.tsx";
import { SubjectsScreen } from "../subjects/MySubjects.tsx";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { NO_VERDICTS, verdictsOf } from "../task/attempt.ts";
import { initialState } from "../task/steps.ts";
import { TaskScreen, type TaskScreenProps } from "../task/TaskScreen.tsx";
import { axeViolations, overflows, smallTargets } from "../test/a11y.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { PSEUDO } from "../test/pseudo.ts";

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

/** Presses a form's button, so that every field shows its error. */
async function submit(): Promise<void> {
  const button = document.querySelector<HTMLButtonElement>("button[type=submit]");
  if (button !== null) await userEvent.click(button);
}

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
  ["sign-in", () => <SignInScreen onSignIn={async () => ({ kind: "closed" })} />],
  [
    "sign-in that the project refused, after a sign-out that left some",
    () => (
      <SignInScreen
        onSignIn={async () => ({ kind: "closed" })}
        result={{ kind: "unconfigured", code: "unauthorized-domain" }}
        left
      />
    ),
  ],
  ["invite code", () => <InviteScreen onCreate={async () => "done"} />],
  ["invite code with its errors", () => <InviteScreen onCreate={async () => "done"} />, submit],
  ["owner's profile", () => <OwnerProfileScreen onCreate={async () => "done"} />],
  [
    "owner's profile with its errors",
    () => <OwnerProfileScreen onCreate={async () => "done"} />,
    submit,
  ],
  [
    "choice of the learner on the first sign-in",
    () => <ChooseScreen profiles={[OWNER]} first onChoose={() => {}} onSignOut={() => {}} />,
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
      <LearnerProvider value={{ learner: OWNER, switchLearner: () => {}, signOut: () => {} }}>
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
