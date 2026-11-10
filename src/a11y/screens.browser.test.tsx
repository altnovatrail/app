// Every screen of app so far, in English, in Russian and in the pseudo-language, at a plain width
// and at 320 CSS px (section 3.9 of docs/architecture.md): no violation of WCAG 2.2 A and AA that
// axe-core finds, every target at least 44 × 44 CSS px, no sideways scroll and no text cut. Each
// screen is found by its role and name.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { userEvent } from "vitest/browser";
import {
  ChooseScreen,
  InviteScreen,
  LearnerProvider,
  OwnerProfileScreen,
  SignOutScreen,
} from "../account/AccountGate.tsx";
import { App } from "../app/App.tsx";
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
import { SignInScreen } from "../signin/SignInScreen.tsx";
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
    "home of the learner, below the bar",
    () => (
      <LearnerProvider value={{ learner: OWNER, switchLearner: () => {}, signOut: () => {} }}>
        <App />
      </LearnerProvider>
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
