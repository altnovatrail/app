// The legal pages in Chromium (R31 in docs/decisions.md), with api on connect-es's router: their
// list and bar, a text as a page in the language of the screen — its version, its gist, the line
// that the English text is in force, its translation and its body —, a text with no version in
// force, a read that failed, the page Accessibility with the places R11 declares, the notices of
// the build as they are, a page this build does not know, and no link on any of them.
import {
  LegalService,
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import { ADULTS, type Route } from "../app/router.ts";
import type { Language } from "../i18n/language.ts";
import { inLanguage } from "../test/language.tsx";
import { dayText, LegalPages } from "./LegalPages.tsx";
import { LICENSE, NOTICE } from "./notices.ts";

const POLICY = create(LegalTextSchema, {
  id: "privacy-policy",
  version: 2,
  inForceSince: "2026-11-11",
  body: "# Privacy policy\n\n## Who we are\n\nThe operator. See [a page](https://example.org).\n\n| What | Why |\n|---|---|\n| Little | To teach |\n",
  summary: "Мы храним мало.",
  summaryLanguage: "ru",
  translation: "# Политика конфиденциальности\n\nМы храним мало данных.\n",
  translationLanguage: "ru",
});

/** The pages at a route, api giving the texts of each reading; no LegalService when left out. */
function renderPages(
  route: Route,
  texts?: (reading: number) => LegalText[] | Promise<LegalText[]>,
  language: Language = "en",
) {
  const read: string[] = [];
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          if (texts === undefined) return;
          router.service(LegalService, {
            async getLegalTexts(request) {
              read.push(request.interfaceLanguage);
              return { texts: await texts(read.length) };
            },
          });
        },
        { transport: { interceptors } },
      ),
  });
  const pages = (shown: Route) =>
    inLanguage(
      <ApiProvider value={api}>
        <LegalPages route={shown} back={ADULTS} />
      </ApiProvider>,
      language,
    );
  const { rerender } = render(pages(route));
  return { read, show: (shown: Route) => rerender(pages(shown)) };
}

const legal = (...parts: string[]): Route => ({ screen: "legal", parts });

afterEach(() => {
  window.location.hash = "";
});

describe("the legal pages", () => {
  it("list every page, with a bar that has no way back on the list and closes to where they came from", async () => {
    window.location.hash = "#/legal";
    renderPages(legal());
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy and legal information" }),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to the list" })).toBeNull();
    const list = screen.getByRole("list");
    expect(
      within(list)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual([
      "Privacy Policy",
      "Terms of Use",
      "Consent to keeping works on the server",
      "Accessibility",
      "Licenses and third-party notices",
    ]);
    for (const [name, hash] of [
      ["Terms of Use", "#/legal/terms-of-use"],
      ["Consent to keeping works on the server", "#/legal/storage-consent"],
      ["Accessibility", "#/legal/accessibility"],
      ["Licenses and third-party notices", "#/legal/notices"],
      ["Privacy Policy", "#/legal/privacy-policy"],
    ] as const) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(window.location.hash).toBe(hash);
    }
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(window.location.hash).toBe("#/adults");
  });

  it("show a text open, in the language of the screen, with its version, and lead nowhere out", async () => {
    const { read } = renderPages(legal("privacy-policy"), () => [POLICY], "ru");
    expect(
      screen.getByRole("heading", { level: 1, name: "Политика конфиденциальности" }),
    ).toBeTruthy();
    expect(await screen.findByText("Версия 2, в силе с 11 ноября 2026 г.")).toBeTruthy();
    expect(read).toEqual(["ru"]);
    expect(screen.getByText("Мы храним мало.")).toHaveAttribute("lang", "ru");
    expect(screen.getByText("Текст — на английском, и в силе английский текст")).toBeTruthy();
    const translation = screen.getByRole("region", { name: "Перевод, только для чтения" });
    expect(translation).toHaveAttribute("lang", "ru");
    const original = screen.getByRole("region", { name: "Текст в силе, на английском" });
    expect(original).toHaveAttribute("lang", "en");
    // The body's headings go below the page's: its title is the second level.
    expect(
      within(original).getByRole("heading", { level: 2, name: "Privacy policy" }),
    ).toBeTruthy();
    expect(within(original).getByRole("heading", { level: 3, name: "Who we are" })).toBeTruthy();
    expect(within(original).getByRole("table")).toBeTruthy();
    expect(document.querySelector("details")).toBeNull();
    expect(document.querySelectorAll("a")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Назад к списку" })).toBeTruthy();
  });

  it("say so of a text with no version in force, and of an api with no LegalService", async () => {
    const none = "This copy of the app has no version of this text in force";
    renderPages(legal("terms-of-use"), () => [POLICY]);
    expect(await screen.findByText(none)).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Terms of Use" })).toBeTruthy();
    document.body.innerHTML = "";
    renderPages(legal("storage-consent"));
    expect(await screen.findByText(none)).toBeTruthy();
  });

  it("say what came of a read that failed, and read again on Try again", async () => {
    let down = true;
    const { read } = renderPages(legal("privacy-policy"), () => {
      if (down) throw new ConnectError("down", Code.Unavailable);
      return [POLICY];
    });
    expect(await screen.findByRole("alert")).toBeTruthy();
    down = false;
    const tries = read.length;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Version 2, in force since November 11, 2026")).toBeTruthy();
    expect(read).toHaveLength(tries + 1);
    expect(screen.queryByRole("alert")).toBeNull();
    // On an English screen there is no line that the text is in English.
    expect(
      screen.queryByText("The text is in English, and the English text is the one in force"),
    ).toBeNull();
  });

  it("show Accessibility: the standard, the places R11 declares, how it is checked, and whom to write to", async () => {
    window.location.hash = "#/legal/accessibility";
    renderPages(legal("accessibility"));
    expect(screen.getByRole("heading", { level: 1, name: "Accessibility" })).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual([
      "The standard",
      "Where the app does not meet it yet",
      "How it is checked",
      "If something is hard to use",
    ]);
    const places = screen.getAllByRole("region");
    expect(places.map((place) => place.getAttribute("aria-labelledby"))).toHaveLength(3);
    expect(
      places.map((place) => within(place).getByRole("heading", { level: 3 }).textContent),
    ).toEqual([
      "Answering in handwriting",
      "Print in the lines of a workbook",
      "Sending an answer with Check",
    ]);
    const criteria = places.map((place) => place.querySelector("dd")?.textContent ?? "");
    expect(criteria[0]).toContain("2.1.1");
    expect(criteria[0]).toContain("2.5.1");
    expect(criteria[0]).toContain("2.5.7");
    expect(criteria[1]).toContain("1.4.12");
    expect(criteria[2]).toContain("3.3.4");
    // 1.4.4 went with canvas 0.3.15, and 3.1.2 app never has (the 2026-11-12 amendment to R11).
    expect(document.body.textContent).not.toContain("1.4.4");
    expect(document.body.textContent).not.toContain("3.1.2");
    for (const place of places) {
      expect(
        within(place)
          .getAllByRole("term")
          .map((term) => term.textContent),
      ).toEqual(["Criteria", "Why", "What there is instead", "When this changes"]);
    }
    expect(document.querySelectorAll("a")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Open the privacy policy" }));
    expect(window.location.hash).toBe("#/legal/privacy-policy");
  });

  it("show the notices of the build, NOTICE and LICENSE, in English as they are", () => {
    renderPages(legal("notices"));
    expect(
      screen.getByRole("heading", { level: 1, name: "Licenses and third-party notices" }),
    ).toBeTruthy();
    const files = [...document.querySelectorAll("pre")];
    expect(files.map((file) => file.textContent)).toEqual([NOTICE, LICENSE]);
    expect(files.map((file) => file.lang)).toEqual(["en", "en"]);
    expect(document.querySelectorAll("a")).toHaveLength(0);
  });

  it("go to their list from a page this build does not know, a family's text among them", async () => {
    window.location.hash = "#/legal/parent-consent";
    const { show } = renderPages(legal("parent-consent"));
    await vi.waitFor(() => expect(window.location.hash).toBe("#/legal"));
    show(legal());
    expect(
      screen.getByRole("heading", { level: 1, name: "Privacy and legal information" }),
    ).toBeTruthy();
  });
});

describe("the day a version came into force", () => {
  it("is written as the language writes a date, and as it came when it is not a day", () => {
    expect(dayText("en", "2026-11-10")).toBe("November 10, 2026");
    expect(dayText("ru", "2026-11-10")).toBe("10 ноября 2026 г.");
    expect(dayText("en", "")).toBe("");
    expect(dayText("en", "2026-13-40")).toBe("2026-13-40");
    // A day the calendar does not have, which the engine would roll over to March 2.
    expect(dayText("en", "2026-02-30")).toBe("2026-02-30");
    expect(dayText("en", "2026-11-10T00:00:00Z")).toBe("2026-11-10T00:00:00Z");
  });
});
