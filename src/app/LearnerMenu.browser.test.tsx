// The profile's menu: the pill shows the avatar and the pseudonym and is named by what it
// opens; the menu names who is learning now, with no tick — there is nothing to choose there —, and
// holds the switch, Settings — the section for adults —, Help for an adult, in the menu's own place
// with a way back, and Sign out, each that leaves closing it first; none with no learner. And the
// bar that holds it on each learner's screen.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { LearnerBar } from "./App.tsx";
import { LearnerMenu } from "./LearnerMenu.tsx";

function chosen(ageCategory = "adult"): Learner {
  return {
    learner: create(ProfileSchema, {
      profileId: "p1",
      pseudonym: "Sam",
      avatar: "wave",
      ageCategory,
      owner: ageCategory === "adult",
    }),
    switchLearner: vi.fn(),
    signOut: vi.fn(),
    openLegal: vi.fn(),
    onSaved: vi.fn(),
    onFailed: vi.fn(),
  };
}

/** The menu of the learner given, under a client that is never called. */
function menuOf(learner: Learner, language?: "ru"): ReactNode {
  return inLanguage(
    <ApiProvider value={{} as Api}>
      <LearnerProvider value={learner}>
        <LearnerMenu />
      </LearnerProvider>
    </ApiProvider>,
    language,
  );
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
  it("names the learner chosen with no tick, and switches, opens Settings or signs out", async () => {
    const learner = chosen();
    render(menuOf(learner));
    const pill = screen.getByRole("button", { name: "Sam, profile menu" });
    expect(pill).toHaveTextContent("Sam");
    expect(pill.querySelector('[data-avatar="wave"]')).not.toBeNull();
    await userEvent.click(pill);
    const dialog = screen.getByRole("dialog", { name: "Profile menu" });
    const menu = within(dialog);
    expect(menu.getByText("Learning now")).toBeVisible();
    expect(menu.getByText("Sam")).toBeVisible();
    expect(menu.getByText("Your profile")).toBeVisible();
    expect(dialog.querySelector(".nt-menu-tick")).toBeNull();
    expect([...dialog.querySelectorAll(".nt-menu-row")].map((row) => row.textContent)).toEqual([
      "Switch learner",
      "Settings",
      "Help",
      "Sign out",
    ]);
    expect(menu.queryByRole("radio")).toBeNull();

    await userEvent.click(menu.getByRole("button", { name: "Switch learner" }));
    expect(learner.switchLearner).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(learner.signOut).toHaveBeenCalledOnce();

    await userEvent.click(pill);
    await userEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(window.location.hash).toBe("#/adults");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens Help in its rows' place, the focus on its heading, and comes back to its row", async () => {
    render(menuOf(chosen()));
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    const menu = within(screen.getByRole("dialog", { name: "Profile menu" }));
    await userEvent.click(menu.getByRole("button", { name: "Help" }));
    expect(menu.getByRole("heading", { level: 2, name: "Help" })).toHaveFocus();
    expect(menu.queryByRole("button", { name: "Switch learner" })).toBeNull();
    await userEvent.click(menu.getByRole("button", { name: "Profile" }));
    expect(menu.getByRole("button", { name: "Help" })).toHaveFocus();
    expect(menu.getByRole("button", { name: "Switch learner" })).toBeVisible();
    // Closed and opened again, the menu shows its rows.
    await userEvent.click(menu.getByRole("button", { name: "Help" }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    expect(screen.getByRole("button", { name: "Switch learner" })).toBeVisible();
  });

  it("has no Help for a learner of another category, as Help is the adult's", async () => {
    render(menuOf(chosen("under_13")));
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    const menu = within(screen.getByRole("dialog", { name: "Profile menu" }));
    expect(menu.getByRole("button", { name: "Settings" })).toBeVisible();
    expect(menu.queryByRole("button", { name: "Help" })).toBeNull();
  });

  it("is in Russian on a Russian screen, and not there with no learner", async () => {
    render(menuOf(chosen(), "ru"));
    await userEvent.click(screen.getByRole("button", { name: "Sam, меню профиля" }));
    const menu = within(screen.getByRole("dialog", { name: "Меню профиля" }));
    expect(menu.getByText("Сейчас учится")).toBeVisible();
    expect(menu.getByRole("button", { name: "Сменить ученика" })).toBeVisible();
    expect(menu.getByRole("button", { name: "Настройки" })).toBeVisible();
    await userEvent.click(menu.getByRole("button", { name: "Помощь" }));
    expect(menu.getByRole("button", { name: "Профиль" })).toBeVisible();
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

  it("is none on Home, Subjects, the skill map, the lesson, the task and a task from paper, the buttons on the others", () => {
    // Home, Subjects and the skill map have the profile's menu in the frame's top bar, the
    // lesson and the task the pill in their own top bar, and a task from paper a
    // top bar of its own.
    for (const own of ["home", "subjects", "skill-map", "lesson", "task", "paper"]) {
      renderBar(own);
      expect(screen.queryByRole("banner")).toBeNull();
      cleanup();
    }
    // Any other screen, as one yet to come, keeps a way to switch.
    renderBar("adults");
    expect(screen.getByRole("button", { name: "Switch learner" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
    cleanup();
  });
});
