// The profile's menu (R63): the pill shows the avatar and the pseudonym and is named by what it
// opens; the menu names who is learning now, the hint mode — set by an adult learner by
// SetHintMode, read only for a child (R76) —, and holds the buttons of the profile's header, each
// closing it first; none with no learner. And the bar that holds it on each learner's screen.

import {
  AccountService,
  HintMode,
  type Profile,
  ProfileSchema,
  type SetHintModeRequest,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { routedApi } from "../test/api.ts";
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
    }),
    switchLearner: vi.fn(),
    signOut: vi.fn(),
    openLegal: vi.fn(),
    onSaved: vi.fn(),
    onFailed: vi.fn(),
  };
}

/** The menu of the learner given, under the client given: by default one that is never called. */
function menuOf(learner: Learner, language?: "ru", api: Api = {} as Api): ReactNode {
  return inLanguage(
    <ApiProvider value={api}>
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
  it("names the learner chosen, and switches, opens the section or signs out", async () => {
    const learner = chosen();
    render(menuOf(learner));
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

  it("beside the row of places holds the switch and Sign out, the section being Grown-ups'", async () => {
    const learner = chosen();
    render(
      inLanguage(
        <ApiProvider value={{} as Api}>
          <LearnerProvider value={learner}>
            <LearnerMenu short />
          </LearnerProvider>
        </ApiProvider>,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    const menu = within(screen.getByRole("dialog", { name: "Profile menu" }));
    expect(menu.getByRole("button", { name: "Switch learner" })).toBeVisible();
    expect(menu.queryByRole("button", { name: "For grown-ups" })).toBeNull();
    await userEvent.click(menu.getByRole("button", { name: "Sign out" }));
    expect(learner.signOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is in Russian on a Russian screen, and not there with no learner", async () => {
    render(menuOf(chosen(), "ru"));
    await userEvent.click(screen.getByRole("button", { name: "Sam, меню профиля" }));
    const menu = within(screen.getByRole("dialog", { name: "Меню профиля" }));
    expect(menu.getByText("Сейчас учится")).toBeVisible();
    expect(menu.getByRole("button", { name: "Сменить ученика" })).toBeVisible();
    cleanup();
    render(inLanguage(<LearnerMenu />));
    expect(screen.queryByRole("button", { name: /profile menu/ })).toBeNull();
  });
});

describe("the hint mode in the profile's menu", () => {
  /** The menu open under SetHintMode's route: what it was asked, and what it answers or throws. */
  async function opened(
    learner: Learner,
    answer: (request: SetHintModeRequest) => Profile = (request) =>
      create(ProfileSchema, { ...learner.learner, hintMode: request.hintMode }),
  ) {
    const asked: SetHintModeRequest[] = [];
    const api = routedApi((router) => {
      router.service(AccountService, {
        setHintMode(request) {
          asked.push(request);
          return { profile: answer(request) };
        },
      });
    });
    render(menuOf(learner, undefined, api));
    await userEvent.click(screen.getByRole("button", { name: "Sam, profile menu" }));
    return { asked, menu: within(screen.getByRole("dialog", { name: "Profile menu" })) };
  }

  it("is Show where for a new profile, and an adult learner sets Questions only by SetHintMode", async () => {
    const learner = chosen();
    const { asked, menu } = await opened(learner);
    expect(menu.getByRole("group", { name: "Hints" })).toBeVisible();
    expect(menu.getByRole("radio", { name: /Show where/ })).toBeChecked();
    await userEvent.click(menu.getByRole("radio", { name: /Show where/ }));
    expect(asked).toHaveLength(0);
    await userEvent.click(menu.getByRole("radio", { name: /Questions only/ }));
    await waitFor(() => expect(learner.onSaved).toHaveBeenCalledOnce());
    expect(asked.map(({ profileId, hintMode }) => [profileId, hintMode])).toEqual([
      ["p1", HintMode.QUESTIONS_ONLY],
    ]);
    expect(vi.mocked(learner.onSaved).mock.calls[0]?.[0].hintMode).toBe(HintMode.QUESTIONS_ONLY);
    expect(menu.queryByRole("alert")).toBeNull();
  });

  it("says what a refused change came to, and a profile missing from the answer", async () => {
    const learner = chosen();
    const { menu } = await opened(learner, () => {
      throw new ConnectError("down", Code.Unavailable);
    });
    await userEvent.click(menu.getByRole("radio", { name: /Questions only/ }));
    expect(await menu.findByRole("alert")).toBeVisible();
    expect(learner.onFailed).toHaveBeenCalledOnce();
    expect(learner.onSaved).not.toHaveBeenCalled();
    cleanup();
    const empty = chosen();
    const second = await opened(empty, () => undefined as unknown as Profile);
    await userEvent.click(second.menu.getByRole("radio", { name: /Questions only/ }));
    expect(await second.menu.findByRole("alert")).toBeVisible();
    expect(empty.onSaved).not.toHaveBeenCalled();
  });

  it("is read only for a child, set by a grown-up", async () => {
    const learner = chosen("under_13");
    const { asked, menu } = await opened(learner);
    expect(menu.getByText("set by a grown-up")).toBeVisible();
    expect(menu.getByRole("radio", { name: /Questions only/ })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    // Marked disabled, not disabled, so that it keeps the focus: Playwright would wait for it.
    await userEvent.click(menu.getByRole("radio", { name: /Questions only/ }), { force: true });
    expect(asked).toHaveLength(0);
    expect(learner.onSaved).not.toHaveBeenCalled();
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
    // Home, Subjects and the skill map have the profile's menu in the frame's top bar (R79), the
    // lesson and the task the pill in their own top bar (R63, R64, R65), and a task from paper a
    // top bar of its own (R71).
    for (const own of ["home", "subjects", "skill-map", "lesson", "task", "paper"]) {
      renderBar(own);
      expect(screen.queryByRole("banner")).toBeNull();
      cleanup();
    }
    // Any other screen, as one yet to come, keeps a way to switch (R63).
    renderBar("adults");
    expect(screen.getByRole("button", { name: "Switch learner" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Help" })).toBeNull();
    cleanup();
  });
});
