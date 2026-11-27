// The frame of Home: the places alone in its row, Settings in the profile's menu leading to the
// section for adults, the tutor's panel to the attempt open and to a task from paper, the bell says that nothing is new, or tells of the next version of a legal text, and a place that shows its icon
// alone, from 600 CSS px to 72em, is named by a tooltip of its words.

import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  LegalService,
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import { type Api, createApi } from "../api/client.ts";
import { AttemptProvider } from "../task/AttemptContext.tsx";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { formatHash } from "./hash.ts";
import { captionHidden } from "./NavCaption.tsx";
import { ADULTS, TASK } from "./router.ts";
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

/** api whose legal texts are these, the current at version 2 of each. */
function legalApi(next: readonly LegalText[]): Api {
  return createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) =>
          router.service(LegalService, {
            getLegalTexts: () => ({
              texts: next.map((each) => ({ ...each, version: 2 })),
              nextTexts: [...next],
            }),
          }),
        { transport: { interceptors } },
      ),
  });
}

function renderBar(learner: Learner = learnerWith(), api: Api = {} as Api) {
  return render(
    inLanguage(
      <ApiProvider value={api}>
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

/**
 * Hovers the control `find` gives until its tooltip says `words`. A loaded Firefox may draw the
 * row again under a pointer that has not moved, and then tells no element the pointer came in;
 * each try finds the control afresh and moves the pointer to it again.
 */
async function hoverForTip(find: () => HTMLElement, words: string) {
  for (let tries = 3; ; tries -= 1) {
    await userEvent.hover(find());
    try {
      await expect
        .poll(() => document.querySelector(".nt-tooltip")?.textContent, {
          timeout: TIP_DELAY_MS * 5,
        })
        .toBe(words);
      return;
    } catch (failure) {
      if (tries === 1) throw failure;
      await userEvent.unhover(find());
    }
  }
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

  it("holds the tutor shut until it comes: named, its tooltip saying so, opening nothing", async () => {
    renderBar(learnerWith("a1"));
    const tutor = screen.getByRole("button", { name: "Tutor" });
    expect(tutor).toHaveAttribute("aria-disabled", "true");
    await userEvent.hover(tutor);
    await expect
      .poll(() => document.querySelector(".nt-tooltip")?.textContent)
      .toBe("Tutor — comes later");
    await userEvent.click(tutor, { force: true });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(window.location.hash).not.toBe(formatHash(TASK));
  });

  it("tells in the bell of a text's next version, its dot gone once shown, and leads to its page", async () => {
    window.localStorage.removeItem("novatrail.bell.seen");
    const opened: unknown[] = [];
    const next = create(LegalTextSchema, {
      id: "privacy-policy",
      version: 3,
      inForceSince: "2026-11-27",
      body: "# Privacy policy\n\nText.\n",
    });
    const learner = {
      ...learnerWith(),
      storing: true,
      openLegal: (page: unknown) => opened.push(page),
    };
    renderBar(learner, legalApi([next]));
    const button = screen.getByRole("button", { name: "Notifications" });
    await vi.waitFor(() => expect(button).toHaveAccessibleDescription("1 new"));
    expect(button).toHaveClass("nt-bell-new");
    await userEvent.click(button);
    const bell = within(screen.getByRole("dialog", { name: "Notifications" }));
    expect(bell.getByText("Privacy Policy: version 3")).toBeVisible();
    expect(
      bell.getByText("Applies from November 27, 2026. Until then, version 2 is in force."),
    ).toBeVisible();
    expect(bell.getByText(/turn that off in Settings before that day/)).toBeVisible();
    await vi.waitFor(() => expect(button).not.toHaveClass("nt-bell-new"));
    expect(button).not.toHaveAccessibleDescription("1 new");
    await userEvent.click(bell.getByRole("button", { name: "Read Privacy Policy, version 3" }));
    expect(opened).toEqual([{ screen: "legal", parts: ["privacy-policy", "next"] }]);
    cleanup();
    // Shown once on this device, it has no dot again; no profile keeping works, no line of it.
    renderBar({ ...learnerWith(), storing: false }, legalApi([next]));
    const again = screen.getByRole("button", { name: "Notifications" });
    await userEvent.click(again);
    expect(await screen.findByText("Privacy Policy: version 3")).toBeVisible();
    expect(again).not.toHaveClass("nt-bell-new");
    expect(screen.queryByText(/turn that off in Settings/)).toBeNull();
    window.localStorage.removeItem("novatrail.bell.seen");
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
    await expect.poll(() => document.querySelector(".nt-tooltip")?.textContent).toBe("Subjects");
    await userEvent.unhover(subjects);
    await expect.poll(() => document.querySelector(".nt-tooltip")).toBeNull();

    // The cognitive map, shut, at every width; Escape dismisses its tooltip, the pointer on it.
    await page.viewport(1300, 768);
    // A loaded Firefox lays the page out at the new width a moment after the viewport changed: the
    // pointer goes to the map once the places show their words, or it lands where the map stood.
    await expect.poll(() => captionHidden(subjects)).toBe(false);
    const shut = () => screen.getByRole("button", { name: "Cognitive map Soon" });
    await hoverForTip(shut, "Cognitive map — comes later");
    await userEvent.keyboard("{Escape}");
    await expect.poll(() => document.querySelector(".nt-tooltip")).toBeNull();
    await userEvent.unhover(shut());
    await userEvent.hover(screen.getByRole("link", { name: "Subjects" }));
    // No tooltip is the check, so nothing to wait for: the tooltip's own timer, set first and
    // shorter than this pause, has fired and its render has run by the end of the pause.
    await new Promise((done) => setTimeout(done, TIP_DELAY_MS + 100));
    expect(document.querySelector(".nt-tooltip")).toBeNull();
  });
});
