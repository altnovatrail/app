// The frame of Home: the places alone in its row, Settings in the profile's menu leading to the
// section for adults, the tutor's panel to the attempt open and to a task from paper, the bell says that nothing is new, and a place that shows its icon
// alone, from 600 CSS px to 72em, is named by a tooltip of its words.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { formatHash } from "./hash.ts";
import { ADULTS, PAPER, TASK } from "./router.ts";
import { ShellBar } from "./Shell.tsx";
import { TIP_DELAY_MS } from "./Tooltip.tsx";

function learnerWith(attemptId?: string): Learner {
  return {
    learner: create(ProfileSchema, {
      profileId: "p1",
      pseudonym: "Sam",
      ageCategory: "adult",
      openAttempt: attemptId === undefined ? undefined : { attemptId },
    }),
    switchLearner: () => {},
    signOut: () => {},
    openLegal: () => {},
    onSaved: () => {},
    onFailed: () => {},
  };
}

function renderBar(learner: Learner = learnerWith()) {
  return render(
    inLanguage(
      <ApiProvider value={{} as Api}>
        <LearnerProvider value={learner}>
          <AttemptProvider learner={learner.learner}>
            <div className="nt-shell">
              <ShellBar place="home" />
            </div>
          </AttemptProvider>
        </LearnerProvider>
      </ApiProvider>,
    ),
  );
}

afterEach(async () => {
  cleanup();
  window.location.hash = "";
  await page.viewport(1024, 768);
});

describe("the frame of Home", () => {
  it("holds the places alone, Settings in the profile's menu leading to the section, the menu closed", async () => {
    renderBar();
    const nav = within(screen.getByRole("navigation", { name: "Main" }));
    expect(
      [...nav.queryAllByRole("link"), ...nav.queryAllByRole("button")].map(
        (place) => place.getAttribute("aria-label") ?? place.textContent,
      ),
    ).toEqual(["Home", "Subjects", "Cognitive map Soon"]);
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    const menu = within(screen.getByRole("dialog", { name: "Profile menu" }));
    await userEvent.click(menu.getByRole("button", { name: "Settings" }));
    expect(window.location.hash).toBe(formatHash(ADULTS));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leads from the tutor's panel to the attempt open, and to a task from paper", async () => {
    renderBar(learnerWith("a1"));
    const tutor = screen.getByRole("button", { name: "Tutor" });
    await userEvent.click(tutor);
    const panel = within(screen.getByRole("dialog", { name: "Tutor" }));
    // It says that the tutor is an AI, and what the AI checks.
    expect(panel.getByText(/The AI checks a task from paper, a program the rest/)).toBeVisible();
    await userEvent.click(panel.getByRole("button", { name: "Continue the task" }));
    expect(window.location.hash).toBe(formatHash(TASK));
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(tutor);
    await userEvent.click(screen.getByRole("button", { name: "Tasks from my paper" }));
    expect(window.location.hash).toBe(formatHash(PAPER));
  });

  it("has no Continue in the tutor's panel with no attempt open", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
    const panel = within(screen.getByRole("dialog", { name: "Tutor" }));
    expect(panel.queryByRole("button", { name: "Continue the task" })).toBeNull();
    expect(panel.getByRole("button", { name: "Tasks from my paper" })).toBeVisible();
  });

  it("says in the bell that nothing is new", async () => {
    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    const bell = within(screen.getByRole("dialog", { name: "Notifications" }));
    expect(bell.getByText("Nothing new yet")).toBeVisible();
  });

  it("names a place by a tooltip while it shows its icon alone, and not once its words show", async () => {
    await page.viewport(800, 640);
    renderBar();
    const subjects = screen.getByRole("link", { name: "Subjects" });
    await userEvent.hover(subjects);
    await new Promise((done) => setTimeout(done, TIP_DELAY_MS + 100));
    const tip = document.querySelector(".nt-tooltip");
    expect(tip?.textContent).toBe("Subjects");
    await userEvent.unhover(subjects);
    await expect.poll(() => document.querySelector(".nt-tooltip")).toBeNull();

    // The cognitive map, shut, at every width; Escape dismisses its tooltip, the pointer on it.
    await page.viewport(1300, 768);
    const shut = screen.getByRole("button", { name: "Cognitive map Soon" });
    await userEvent.hover(shut);
    await new Promise((done) => setTimeout(done, TIP_DELAY_MS + 100));
    expect(document.querySelector(".nt-tooltip")?.textContent).toBe("Cognitive map — comes later");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector(".nt-tooltip")).toBeNull();
    await userEvent.unhover(shut);
    await userEvent.hover(screen.getByRole("link", { name: "Subjects" }));
    await new Promise((done) => setTimeout(done, TIP_DELAY_MS + 100));
    expect(document.querySelector(".nt-tooltip")).toBeNull();
  });
});
