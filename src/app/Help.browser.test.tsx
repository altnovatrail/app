// The adult's Help, in the profile's menu: in the rows' place, the three things and the three
// texts of the app itself — no link out of it —: the policy and the terms each a sheet over the
// screen whose foot opens its page home's way back, and the page Accessibility.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  LegalService,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { LearnerMenu } from "./LearnerMenu.tsx";

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

/** api by connect-es's router: each text in force, version 1, its gist its name. */
const API = createApi({
  baseUrl: "https://api.example.org",
  tokens: { token: async () => "t", signOut: async () => {} },
  on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
  sleep: async () => {},
  transport: (interceptors) =>
    createRouterTransport(
      (router: ConnectRouter) => {
        router.service(LegalService, {
          getLegalTexts: () => ({
            texts: ["privacy-policy", "terms-of-use"].map((id) =>
              create(LegalTextSchema, {
                id,
                version: 1,
                inForceSince: "2026-11-11",
                body: "# A text\n",
                summary: `The gist of ${id}.`,
                summaryLanguage: "en",
              }),
            ),
          }),
        });
      },
      { transport: { interceptors } },
    ),
});

/** The profile's menu of the learner given, opened on Help: the pill, and Help's dialog. */
async function openHelp(learner: Learner, language: Language = "en") {
  render(
    inLanguage(
      <ApiProvider value={API}>
        <LearnerProvider value={learner}>
          <LearnerMenu />
        </LearnerProvider>
      </ApiProvider>,
      language,
    ),
  );
  const pill = screen.getByRole("button", { name: /profile menu|меню профиля/ });
  await userEvent.click(pill);
  await userEvent.click(
    screen.getByRole("button", { name: language === "ru" ? "Помощь" : "Help" }),
  );
  return { pill, dialog: screen.getByRole("dialog") };
}

afterEach(() => {
  cleanup();
});

describe("the adult's Help", () => {
  it("says the three things, and leads to the app's own texts alone", async () => {
    const openLegal = vi.fn();
    const { pill, dialog } = await openHelp(chosen("adult", openLegal));
    const help = within(dialog);
    expect(help.getByRole("heading", { level: 2, name: "Help" })).toBeVisible();
    expect(help.getByText("The tutor is an AI")).toBeVisible();
    expect(help.getByText(/The AI checks a task from paper, a program the rest/)).toBeVisible();
    expect(help.getByText(/Report a problem/)).toBeVisible();
    expect(help.getByText("Your name is made up")).toBeVisible();
    // No link out of the app, and no helpline: buttons of the app's own pages alone, after the way
    // back to the menu.
    expect(dialog.querySelectorAll("a")).toHaveLength(0);
    expect(dialog.textContent).not.toMatch(/https?:|www\.|\+?\d[\d -]{6,}/);
    expect(
      help
        .getAllByRole("button")
        .map((page) => page.textContent)
        .filter((text) => text !== ""),
    ).toEqual(["Profile", "Privacy Policy", "Terms of Use", "Accessibility"]);

    // A text: its sheet over the screen, once read, the menu gone; its foot, the text's page.
    await userEvent.click(help.getByRole("button", { name: "Terms of Use" }));
    const terms = within(await screen.findByRole("dialog", { name: "Terms of Use" }));
    expect(terms.getByText("The gist of terms-of-use.")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Profile menu" })).toBeNull();
    expect(openLegal).not.toHaveBeenCalled();
    await userEvent.click(terms.getByRole("button", { name: "Read the full text" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["terms-of-use"] });
    await userEvent.click(terms.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pill).toHaveFocus();
    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    await userEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    const policy = within(await screen.findByRole("dialog", { name: "Privacy Policy" }));
    await userEvent.click(policy.getByRole("button", { name: "Read the full text" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["privacy-policy"] });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "Help" }));
    await userEvent.click(screen.getByRole("button", { name: "Accessibility" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["accessibility"] });
  });

  it("closes by Escape, the focus back on the profile's pill", async () => {
    const { pill } = await openHelp(chosen("adult"));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(pill).toHaveFocus();
  });

  it("speaks Russian on a Russian screen", async () => {
    const { dialog } = await openHelp(chosen("adult"), "ru");
    const help = within(dialog);
    expect(help.getByText("Наставник — это ИИ")).toBeVisible();
    expect(help.getByRole("button", { name: "Политика конфиденциальности" })).toBeVisible();
  });
});
