// The profile's menu (R63): the pill shows the avatar and the pseudonym and is named by what it
// opens; the menu names who is learning now and holds the buttons of the profile's header, each
// closing it first; none with no learner. And the bar that holds it on each learner's screen.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { LearnerBar } from "./App.tsx";
import { LearnerMenu } from "./LearnerMenu.tsx";

function chosen(): Learner {
  return {
    learner: create(ProfileSchema, {
      profileId: "p1",
      pseudonym: "Sam",
      avatar: "wave",
      ageCategory: "adult",
    }),
    switchLearner: vi.fn(),
    signOut: vi.fn(),
    openLegal: vi.fn(),
    onSaved: () => {},
    onFailed: () => {},
  };
}

afterEach(async () => {
  cleanup();
  if (window.location.hash !== "") {
    const changed = new Promise((done) =>
      window.addEventListener("hashchange", done, { once: true }),
    );
    window.location.hash = "";
    await act(() => changed);
  }
});

describe("the profile's menu", () => {
  it("names the learner chosen, and switches, opens the section or signs out", async () => {
    const learner = chosen();
    render(
      inLanguage(
        <LearnerProvider value={learner}>
          <LearnerMenu />
        </LearnerProvider>,
      ),
    );
    const pill = screen.getByRole("button", { name: "Sam, profile menu" });
    expect(pill).toHaveTextContent("Sam");
    expect(pill.querySelector('[data-avatar="wave"]')).not.toBeNull();
    await userEvent.click(pill);
    const menu = within(screen.getByRole("dialog", { name: "Profile menu" }));
    expect(menu.getByText("Learning now")).toBeVisible();
    expect(menu.getByText("Sam")).toBeVisible();

    await userEvent.click(menu.getByRole("button", { name: "Switch learner" }));
    expect(learner.switchLearner).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(learner.signOut).toHaveBeenCalledOnce();

    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "For grown-ups" }));
    expect(window.location.hash).toBe("#/adults");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is in Russian on a Russian screen, and not there with no learner", async () => {
    render(
      inLanguage(
        <LearnerProvider value={chosen()}>
          <LearnerMenu />
        </LearnerProvider>,
        "ru",
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sam, меню профиля" }));
    const menu = within(screen.getByRole("dialog", { name: "Меню профиля" }));
    expect(menu.getByText("Сейчас учится")).toBeVisible();
    expect(menu.getByRole("button", { name: "Сменить ученика" })).toBeVisible();
    cleanup();
    render(inLanguage(<LearnerMenu />));
    expect(screen.queryByRole("button", { name: /profile menu/ })).toBeNull();
  });
});

describe("the learner's bar", () => {
  function renderBar(screenName: string) {
    window.location.hash = `#/${screenName}`;
    return render(
      inLanguage(
        <LearnerProvider value={chosen()}>
          <LearnerBar />
        </LearnerProvider>,
      ),
    );
  }

  it("is the pill and Help on My subjects, none on the skill map, the lesson, the task and a task from paper, the buttons on the others", () => {
    renderBar("home");
    expect(screen.getByRole("button", { name: "Sam, profile menu" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Help" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Switch learner" })).toBeNull();
    cleanup();
    // The skill map, the lesson and the task have the pill in their own top bar (R63, R64, R65),
    // and a task from paper has a top bar of its own (R71).
    for (const own of ["skill-map", "lesson", "task", "paper"]) {
      renderBar(own);
      expect(screen.queryByRole("banner")).toBeNull();
      cleanup();
    }
    for (const shown of ["essays"]) {
      renderBar(shown);
      expect(screen.getByRole("button", { name: "Switch learner" })).toBeVisible();
      expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
      cleanup();
    }
  });
});
