// The tutor time on a profile's page in the section for adults, in the browser (section 15 of the text
// of the contracts, "The quota"), with api on connect-es's router: below the progress, the share of
// the profile and of the account by an adult's action, when the tutor time renews, the cap reached,
// no share while platform AI is closed to the account, no section from an api with no GetQuota,
// and a share that did not come, with its retry.
import {
  AccountService,
  type GetQuotaRequest,
  ProfileSchema,
  type QuotaShareSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { timestampFromDate } from "@bufbuild/protobuf/wkt";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { dateTimeFormat, percentText } from "../i18n/intl.ts";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import { ProfilePage } from "./ProfilePage.tsx";

const OWNER = create(ProfileSchema, {
  profileId: "p1",
  owner: true,
  pseudonym: "Ёжик",
  ageCategory: "adult",
});

type Share = MessageInitShape<typeof QuotaShareSchema>;

/** The profile's page, api giving each share by `answer`; with none, api has no GetQuota. */
function renderPage(answer?: (asked: number) => Share, language: Language = "en") {
  const asked: GetQuotaRequest[] = [];
  const stale = vi.fn();
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          if (answer !== undefined) {
            router.service(AccountService, {
              getQuota(request) {
                asked.push(request);
                return { share: answer(asked.length) };
              },
            });
          }
        },
        { transport: { interceptors } },
      ),
  });
  render(
    inLanguage(
      <ApiProvider value={api}>
        <ProfilePage profile={OWNER} onSaved={() => {}} onFailed={() => {}} />
      </ApiProvider>,
      language,
    ),
  );
  return { asked, stale };
}

/** The lines of a section below its heading. */
const linesOf = (region: HTMLElement) =>
  [...region.querySelectorAll("p")].map((line) => line.textContent);

// In the device's time zone: the midnight that begins tomorrow.
const now = new Date();
const MIDNIGHT = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const time = (language: Language) =>
  dateTimeFormat(language, { timeStyle: "short" }).format(MIDNIGHT);

describe("the tutor time of a profile", () => {
  it("shows, below the progress, the profile's share and the account's, and when it renews", async () => {
    const { asked } = renderPage(() => ({
      profilePercent: 40,
      accountPercent: 65,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    }));
    const region = await screen.findByRole("region", { name: "Tutor time" });
    expect(linesOf(region)).toEqual([
      "How much of today's tutor time — the platform's AI, which checks work and words the tutor's replies — this profile and the whole account have used",
      "This profile: 40% used",
      "The whole account: 65% used",
      `Tutor time renews tomorrow at ${time("en")}`,
    ]);
    const progress = screen.getByRole("region", { name: "Progress" });
    expect(
      progress.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // By an adult's action, ACTION_ADULT, of the profile of the page.
    expect(asked).toEqual([expect.objectContaining({ profileId: "p1", action: Action.ADULT })]);
  });

  it("says, once a cap is reached, that platform AI checks no work of the profile until then", async () => {
    renderPage(
      () => ({
        profilePercent: 20,
        accountPercent: 100,
        capReached: true,
        nextFamilyDay: timestampFromDate(MIDNIGHT),
      }),
      "ru",
    );
    const region = await screen.findByRole("region", { name: "Время наставника" });
    expect(linesOf(region).slice(1)).toEqual([
      `Этот профиль: потрачено ${percentText("ru", 20)}`,
      `Весь аккаунт: потрачено ${percentText("ru", 100)}`,
      "Время наставника на сегодня кончилось: пока оно не обновится, ИИ платформы не проверяет работы этого профиля",
      `Время наставника обновится завтра в ${time("ru")}`,
    ]);
  });

  it("says in one line that platform AI is closed to an account whose tariff has no caps", async () => {
    renderPage(() => ({ nextFamilyDay: timestampFromDate(MIDNIGHT) }));
    const region = await screen.findByRole("region", { name: "Tutor time" });
    expect(linesOf(region).slice(1)).toEqual([
      "The platform's AI has no tutor time on this account now: it is closed to it",
    ]);
  });

  it("has no section from an api with no GetQuota yet, and offers it no reload", async () => {
    const { stale } = renderPage();
    expect(await screen.findByRole("region", { name: "Progress" })).toBeTruthy();
    // The read came back before the page settled: nothing stands in for the section.
    await vi.waitFor(() => expect(screen.queryByRole("region", { name: "Tutor time" })).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(stale).not.toHaveBeenCalled();
  });

  it("says what a share that did not come came to, and reads it again", async () => {
    let down = true;
    const { asked } = renderPage(() => {
      if (down) throw new ConnectError("down", Code.Unavailable);
      return { profilePercent: 5, accountPercent: 10 };
    });
    const region = within(await screen.findByRole("region", { name: "Tutor time" }));
    expect((await region.findByRole("alert")).textContent).toBe("No connection");
    down = false;
    await userEvent.click(region.getByRole("button", { name: "Try again" }));
    expect(await region.findByText("This profile: 5% used")).toBeVisible();
    expect(region.getByText("The whole account: 10% used")).toBeVisible();
    expect(region.queryByRole("alert")).toBeNull();
    // The client's own repeats, then the retry's one.
    expect(asked).toHaveLength(6);
  });
});
