// Every screen of app so far, in English, in Russian and in the pseudo-language, at a plain width
// and at 320 CSS px (section 3.9 of docs/architecture.md): no violation of WCAG 2.2 A and AA that
// axe-core finds, every target at least 44 × 44 CSS px, no sideways scroll and no text cut. Each
// screen is found by its role and name.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { App } from "../app/App.tsx";
import { Framed, Offline, ReloadOffer, StorageGone, Unconfigured } from "../boot/Screens.tsx";
import type { Language } from "../i18n/language.ts";
import { WORDS, wordsOf } from "../i18n/words.ts";
import { axeViolations, overflows, smallTargets } from "../test/a11y.ts";
import { inLanguage } from "../test/language.tsx";
import { PSEUDO } from "../test/pseudo.ts";

const SCREENS: readonly [string, () => ReactNode][] = [
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
  it.each(SCREENS)(
    "%s has no violation, small target or overflow, at 1024 and 320 px",
    async (_, screen) => {
      render(inLanguage(screen(), language, words));
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
