// The adult's Help (R63; R148 spec): behind its button, filled while open, the three things and
// the three texts of the app itself — no link out of it —: the policy and the terms each a sheet
// over the screen whose foot opens its page home's way back (R69), and the page Accessibility; none
// for a learner of another category, nor with no learner.

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
import { AdultHelp } from "./Help.tsx";
import { TIP_DELAY_MS } from "./IconButton.tsx";

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

function renderHelp(learner: Learner | undefined, language: Language = "en") {
  return render(
    inLanguage(
      <ApiProvider value={API}>
        {learner === undefined ? (
          <AdultHelp />
        ) : (
          <LearnerProvider value={learner}>
            <AdultHelp />
          </LearnerProvider>
        )}
      </ApiProvider>,
      language,
    ),
  );
}

afterEach(cleanup);

describe("the adult's Help", () => {
  it("says the three things, and leads to the app's own texts alone", async () => {
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

    // A text: its sheet over the screen, once read, the pop-over gone; its foot, the text's page.
    await userEvent.click(help.getByRole("button", { name: "Terms of Use" }));
    const terms = within(await screen.findByRole("dialog", { name: "Terms of Use" }));
    expect(terms.getByText("The gist of terms-of-use.")).toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Help" })).toBeNull();
    expect(openLegal).not.toHaveBeenCalled();
    await userEvent.click(terms.getByRole("button", { name: "Read the full text" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["terms-of-use"] });
    await userEvent.click(terms.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
    await userEvent.click(button);
    await userEvent.click(screen.getByRole("button", { name: "Privacy Policy" }));
    const policy = within(await screen.findByRole("dialog", { name: "Privacy Policy" }));
    await userEvent.click(policy.getByRole("button", { name: "Read the full text" }));
    expect(openLegal).toHaveBeenLastCalledWith({ screen: "legal", parts: ["privacy-policy"] });
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("shows no tooltip over its open pop-over, the pointer still on its button", async () => {
    renderHelp(chosen("adult"));
    const button = screen.getByRole("button", { name: "Help" });
    await userEvent.hover(button);
    await userEvent.click(button);
    await new Promise((later) => setTimeout(later, TIP_DELAY_MS + 200));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(document.querySelector(".nt-tooltip")).toBeNull();
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
