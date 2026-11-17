// The adult's Help (R63; R148 in spec): behind its button, filled while open, the three things and
// the three pages of the app itself — no link out of it —, each opened home's way back; none for a
// learner of another category, nor with no learner.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { AdultHelp } from "./Help.tsx";

function chosen(ageCategory: string, openLegal = vi.fn()): Learner {
  return {
    learner: create(ProfileSchema, { profileId: "p1", pseudonym: "Sam", ageCategory }),
    switchLearner: () => {},
    signOut: () => {},
    openLegal,
    onSaved: () => {},
    onFailed: () => {},
  };
}

function renderHelp(learner: Learner | undefined, language: Language = "en") {
  return render(
    inLanguage(
      learner === undefined ? (
        <AdultHelp />
      ) : (
        <LearnerProvider value={learner}>
          <AdultHelp />
        </LearnerProvider>
      ),
      language,
    ),
  );
}

afterEach(cleanup);

describe("the adult's Help", () => {
  it("says the three things, and leads to the app's own pages alone", async () => {
    const openLegal = vi.fn();
    renderHelp(chosen("adult", openLegal));
    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const help = within(screen.getByRole("dialog", { name: "Help" }));
    expect(help.getByRole("heading", { level: 2, name: "Help" })).toBeVisible();
    expect(help.getByText("The tutor is an AI")).toBeVisible();
    expect(help.getByText(/a program checks every answer/)).toBeVisible();
    expect(help.getByText(/Report a problem/)).toBeVisible();
    expect(help.getByText("Your name is made up")).toBeVisible();
    // No link out of the app, and no helpline: buttons of the app's own pages alone.
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelectorAll("a")).toHaveLength(0);
    expect(dialog.textContent).not.toMatch(/https?:|www\.|\+?\d[\d -]{6,}/);
    expect(
      help
        .getAllByRole("button")
        .map((page) => page.textContent)
        .filter((text) => text !== ""),
    ).toEqual(["Privacy Policy", "Terms of Use", "Accessibility"]);

    await userEvent.click(help.getByRole("button", { name: "Terms of Use" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["terms-of-use"] });
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["privacy-policy"] });
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Accessibility" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["accessibility"] });
  });

  it("closes by Escape, the focus back on its button", async () => {
    renderHelp(chosen("adult"));
    const button = screen.getByRole("button", { name: "Help" });
    await userEvent.click(button);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
  });

  it("speaks Russian on a Russian screen", async () => {
    renderHelp(chosen("adult"), "ru");
    await userEvent.click(screen.getByRole("button", { name: "Помощь" }));
    const help = within(screen.getByRole("dialog", { name: "Помощь" }));
    expect(help.getByText("Наставник — это ИИ")).toBeVisible();
    expect(help.getByRole("button", { name: "Политика конфиденциальности" })).toBeVisible();
  });

  it("is not there for a learner of another category, nor with no learner", () => {
    renderHelp(chosen("under_13"));
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
    cleanup();
    renderHelp(undefined);
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
  });
});
