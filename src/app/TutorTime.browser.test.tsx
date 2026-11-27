// The ring of tutor time at the frame's top right: the profile's share by the learner's action, its
// colour by how much is used, its sign while none is and once it is all used, its pop-over — what
// the share means, its number in the ring alone, when it renews, the way to Settings —, a shape while it is read, and
// no ring with no share, no GetQuota or a share that did not come.
import {
  AccountService,
  ProfileSchema,
  type QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat, percentText } from "../i18n/intl.ts";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { formatHash } from "./hash.ts";
import { ADULTS } from "./router.ts";
import { TutorTime } from "./TutorTime.tsx";

const SAM: Learner = {
  learner: create(ProfileSchema, { profileId: "p1", pseudonym: "Sam", ageCategory: "adult" }),
  switchLearner: () => {},
  signOut: () => {},
  openLegal: () => {},
  onSaved: () => {},
  onFailed: () => {},
};

type Share = MessageInitShape<typeof QuotaShareSchema>;

/** The ring in the pills of the frame, its api giving this share; none: an api with no GetQuota. */
function renderRing(share?: () => Share | Promise<Share>, language: Language = "en") {
  const asked: string[] = [];
  const stale = vi.fn();
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          if (share === undefined) return;
          router.service(AccountService, {
            getQuota: async (request) => {
              asked.push(`quota ${request.profileId} ${request.action}`);
              return { share: await share() };
            },
          });
        },
        { transport: { interceptors } },
      ),
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        <LearnerProvider value={SAM}>
          <div className="nt-shell">
            <div className="nt-top-pills">
              <TutorTime />
            </div>
          </div>
        </LearnerProvider>
      </ApiProvider>,
      language,
    ),
  );
  return { asked, stale };
}

/** The ring's button, once its share has come. */
const ringButton = () => screen.findByRole("button", { name: /^Tutor time|^Время наставника/ });

/** The colour the ring's arc is drawn in. */
const arc = (button: HTMLElement) =>
  getComputedStyle(button.querySelector(".nt-ring-arc") as Element).stroke;

afterEach(() => {
  cleanup();
  window.location.hash = "";
});

describe("the ring of tutor time", () => {
  it("shows the profile's share in its ring, asked by the learner's action, and never the account's", async () => {
    const { asked } = renderRing(() => ({ profilePercent: 40, accountPercent: 90 }));
    const button = await ringButton();
    expect(button).toHaveAccessibleName("Tutor time: 40% used today");
    expect(button.textContent).toBe("40");
    expect(arc(button)).toBe("rgb(52, 199, 89)");
    expect(asked).toEqual(["quota p1 1"]);
    expect(document.body.textContent).not.toMatch(/90/);
  });

  it("is yellow from 50% and red from 80%", async () => {
    renderRing(() => ({ profilePercent: 50 }));
    expect(arc(await ringButton())).toBe("rgb(247, 181, 0)");
    cleanup();
    renderRing(() => ({ profilePercent: 80 }));
    expect(arc(await ringButton())).toBe("rgb(255, 59, 48)");
  });

  it("shows a sign in place of the number while none is used, and once a cap is reached", async () => {
    renderRing(() => ({ profilePercent: 0 }));
    const fresh = await ringButton();
    expect(fresh).toHaveAccessibleName("Tutor time: none used today");
    expect(fresh.textContent).toBe("");
    expect(fresh.querySelector(".nt-ring-sign svg")).not.toBeNull();
    cleanup();
    // The account's cap reached with the profile's own share below it: the ring is full.
    renderRing(() => ({ profilePercent: 20, capReached: true }));
    const out = await ringButton();
    expect(out).toHaveAccessibleName("Tutor time: used up today");
    expect(out.textContent).toBe("");
    expect(arc(out)).toBe("rgb(255, 59, 48)");
  });

  it("opens what the share means, its number in the ring alone, when it renews, and the way to Settings", async () => {
    const now = new Date();
    const renews = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8);
    renderRing(() => ({ profilePercent: 85, nextFamilyDay: timestampFromDate(renews) }), "ru");
    await userEvent.click(await ringButton());
    const pop = within(await screen.findByRole("dialog", { name: "Время наставника" }));
    const time = dateTimeFormat("ru", { timeStyle: "short" }).format(renews);
    expect(pop.getByText("Почти кончилось")).toBeVisible();
    expect(pop.getByText(`Обновится завтра в ${time}`)).toBeVisible();
    // The share is told once, in the big ring.
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent?.match(/85/g)).toHaveLength(1);
    expect(dialog.querySelector(".nt-ring-big")?.textContent).toBe(percentText("ru", 85));
    await userEvent.click(pop.getByRole("button", { name: "Весь аккаунт — в настройках" }));
    expect(window.location.hash).toBe(formatHash(ADULTS));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says, once used up, that the tutor waits, and when it renews", async () => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    renderRing(() => ({
      profilePercent: 100,
      capReached: true,
      nextFamilyDay: timestampFromDate(midnight),
    }));
    await userEvent.click(await ringButton());
    const pop = within(await screen.findByRole("dialog", { name: "Tutor time" }));
    const time = dateTimeFormat("en", { timeStyle: "short" }).format(midnight);
    expect(pop.getByText("Used up for today")).toBeVisible();
    expect(
      pop.getByText("Until it renews, the tutor and the AI's check of works wait."),
    ).toBeVisible();
    expect(pop.getByText(`Renews tomorrow at ${time}`)).toBeVisible();
  });

  it("is a shape while the share is read", async () => {
    let give: (share: Share) => void = () => {};
    const { asked } = renderRing(() => new Promise<Share>((resolve) => (give = resolve)));
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    const shape = document.querySelector('.nt-ring-wait[aria-busy="true"] .nt-sk');
    expect(shape).not.toBeNull();
    give({ profilePercent: 10 });
    await ringButton();
    expect(document.querySelector(".nt-ring-wait")).toBeNull();
  });

  it("is none while the tariff has no caps, from an api with no GetQuota, or when the share did not come", async () => {
    const { asked } = renderRing(() => ({}));
    await vi.waitFor(() => expect(asked).toHaveLength(1));
    await vi.waitFor(() => expect(document.querySelector(".nt-ring-wait")).toBeNull());
    expect(screen.queryByRole("button")).toBeNull();
    cleanup();
    const { stale } = renderRing();
    await vi.waitFor(() => expect(document.querySelector(".nt-ring-wait")).toBeNull());
    expect(screen.queryByRole("button")).toBeNull();
    expect(stale).not.toHaveBeenCalled();
    cleanup();
    renderRing(() => {
      throw new ConnectError("broken", Code.Internal);
    });
    await vi.waitFor(() => expect(document.querySelector(".nt-ring-wait")).toBeNull());
    expect(screen.queryByRole("button")).toBeNull();
  });
});
