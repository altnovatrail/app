// The tutor time on a profile's page in the section for adults, in the browser (the contract's
// quota), with api on connect-es's router: below the progress, the shapes of its lines while it is
// read, the share of the profile and of the account by an adult's action, when the tutor time
// renews, the cap reached, no share while platform AI is closed to the account, no section from an
// api with no GetQuota, and a share that did not come, with its retry.
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
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { expectLoaded, expectLoading, held } from "../test/loading.ts";
import { ProfilePage } from "./ProfilePage.tsx";

const OWNER = create(ProfileSchema, {
  profileId: "p1",
  owner: true,
  pseudonym: "Ёжик",
  ageCategory: "adult",
});

type Share = MessageInitShape<typeof QuotaShareSchema>;

/** The profile's page, api giving each share by `answer`; with none, api has no GetQuota. */
function renderPage(answer?: (asked: number) => Share | Promise<Share>, language: Language = "en") {
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
              async getQuota(request) {
                asked.push(request);
                return { share: await answer(asked.length) };
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
        <ProfilePage
          device={memoryDevice().device}
          profile={OWNER}
          onSaved={() => {}}
          onFailed={() => {}}
        />
      </ApiProvider>,
      language,
    ),
  );
  return { asked, stale };
}

/** The section once its share is read: no shape of a line left in it. */
async function settled(name: string) {
  const region = await screen.findByRole("region", { name });
  await vi.waitFor(() => expect(region.querySelector("[aria-busy]")).toBeNull());
  return region;
}

/** The lines of a section below its heading — a share's row as its words and how much —, its note last. */
const linesOf = (region: HTMLElement) =>
  [...region.querySelectorAll(".nt-set-meter-row, p")].map((line) =>
    line.matches(".nt-set-meter-row")
      ? `${line.querySelector(".nt-set-label")?.textContent}: ${line.querySelector(".nt-set-value")?.textContent}`
      : line.textContent,
  );

// In the device's time zone: the midnight that begins tomorrow.
const now = new Date();
const MIDNIGHT = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
const time = (language: Language) =>
  dateTimeFormat(language, { timeStyle: "short" }).format(MIDNIGHT);

describe("the tutor time of a profile", () => {
  it("shows, below the storage of works, the profile's share and the account's, each a meter, and when it renews", async () => {
    const { asked } = renderPage(() => ({
      profilePercent: 40,
      accountPercent: 65,
      nextFamilyDay: timestampFromDate(MIDNIGHT),
    }));
    const region = await settled("Tutor time");
    expect(linesOf(region)).toEqual([
      "This profile: 40% used",
      "The whole account: 65% used",
      `Tutor time renews tomorrow at ${time("en")}`,
      "How much of today's tutor time — the platform's AI, which checks work and words the tutor's replies — this profile and the whole account have used",
    ]);
    const meters = within(region).getAllByRole("meter");
    expect(meters.map((meter) => meter.getAttribute("aria-valuenow"))).toEqual(["40", "65"]);
    expect(meters[0]).toHaveAccessibleName("This profile");
    expect(meters[1]).toHaveAttribute("aria-valuetext", "65% used");
    expect(meters.map((meter) => meter.dataset.level)).toEqual([undefined, undefined]);
    // Each bar spans its row under the words, and fills as much as its share.
    for (const [meter, share] of [
      [meters[0], 0.4],
      [meters[1], 0.65],
    ] as const) {
      const bar = meter?.getBoundingClientRect().width ?? 0;
      const row = meter?.closest(".nt-set-row")?.getBoundingClientRect().width ?? 0;
      const fill = meter?.firstElementChild?.getBoundingClientRect().width ?? 0;
      expect(bar).toBeGreaterThan(row * 0.8);
      expect(fill / bar).toBeCloseTo(share, 1);
    }
    const storage = screen.getByRole("region", { name: "Keeping works on the server" });
    expect(storage.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // By an adult's action, ACTION_ADULT, of the profile of the page.
    expect(asked).toEqual([expect.objectContaining({ profileId: "p1", action: Action.ADULT })]);
  });

  it("stands with the shapes of its lines while the share is read, busy, and says Loading", async () => {
    const { given, give } = held();
    renderPage(async () => {
      await given;
      return { profilePercent: 40, accountPercent: 65, nextFamilyDay: timestampFromDate(MIDNIGHT) };
    });
    const region = await screen.findByRole("region", { name: "Tutor time" });
    expectLoading(region, 2);
    give();
    expect(await within(region).findByRole("meter", { name: "This profile" })).toBeTruthy();
    expectLoaded(region);
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
    const region = await settled("Время наставника");
    expect(linesOf(region).slice(0, -1)).toEqual([
      `Этот профиль: потрачено ${percentText("ru", 20)}`,
      `Весь аккаунт: потрачено ${percentText("ru", 100)}`,
      `Время наставника обновится завтра в ${time("ru")}`,
      "Время наставника на сегодня кончилось: пока оно не обновится, ИИ платформы не проверяет работы этого профиля",
    ]);
    // A cap reached turns both bars red.
    expect(
      within(region)
        .getAllByRole("meter")
        .map((meter) => meter.dataset.level),
    ).toEqual(["full", "full"]);
  });

  it("says in one line that platform AI is closed to an account whose tariff has no caps", async () => {
    renderPage(() => ({ nextFamilyDay: timestampFromDate(MIDNIGHT) }));
    const region = await settled("Tutor time");
    expect(linesOf(region).slice(0, -1)).toEqual([
      "The platform's AI has no tutor time on this account now: it is closed to it",
    ]);
  });

  it("has no section from an api with no GetQuota yet, and offers it no reload", async () => {
    const { stale } = renderPage();
    expect(await screen.findByRole("region", { name: "Keeping works on the server" })).toBeTruthy();
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
    expect(await region.findByRole("meter", { name: "This profile" })).toHaveAttribute(
      "aria-valuetext",
      "5% used",
    );
    expect(region.getByRole("meter", { name: "The whole account" })).toHaveAttribute(
      "aria-valuetext",
      "10% used",
    );
    expect(region.queryByRole("alert")).toBeNull();
    // The client's own repeats, then the retry's one.
    expect(asked).toHaveLength(6);
  });
});
