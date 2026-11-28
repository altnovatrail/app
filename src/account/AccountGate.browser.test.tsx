// The way in, through Boot, in the browser: the sign-in, the invite code, the
// owner's profile, the choice of the learner, which asks the browser to keep the site's data on the
// first sign-in, the top bar of the learner's screens and the sign-out, each screen by its role and name, with api
// answering by the test's fetch and the sign-in service the test's own.
import {
  CheckOwnKeyRequestSchema,
  CheckOwnKeyResponseSchema,
  CreateAccountRequestSchema,
  CreateAccountResponseSchema,
  CreateOwnerProfileRequestSchema,
  CreateOwnerProfileResponseSchema,
  GetAccountResponseSchema,
  HintMode,
  ListOwnKeyProvidersResponseSchema,
  OwnKeyCheck,
  ProfileSchema,
  SetWorkStorageRequestSchema,
  SetWorkStorageResponseSchema,
  UpdateProfileRequestSchema,
  UpdateProfileResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  Cause,
  ChoiceKind,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  BeginAttemptResponseSchema,
  ChooseNextRequestSchema,
  ChooseNextResponseSchema,
  GetOpenAttemptResponseSchema,
  LessonState,
  ListLessonsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import {
  GetLegalTextsRequestSchema,
  GetLegalTextsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { ListConnectedModulesResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import {
  CheckPackagesResponseSchema,
  GetManifestResponseSchema,
  GetSolvingStepsResponseSchema,
  GetTechniquesResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  create,
  type DescMessage,
  fromBinary,
  type MessageInitShape,
  toBinary,
} from "@bufbuild/protobuf";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { App } from "../app/App.tsx";
import { Boot } from "../boot/Boot.tsx";
import { en } from "../i18n/en.ts";
import { ru } from "../i18n/ru.ts";
import { OWN_KEY_CHANNEL } from "../ownkey/OwnKeyContext.tsx";
import { addProfile, openProfile } from "../storage/profile.ts";
import { readRegistry, setAccount } from "../storage/registry.ts";
import { profileDatabase, SETTINGS } from "../storage/schema.ts";
import { writeLanguage } from "../storage/settings.ts";
import { memoryDevice } from "../test/device.ts";
import { type FakeSignIn, fakeSignIn } from "../test/signin.ts";
import { AccountGate } from "./AccountGate.tsx";
import { PROFILES_CHANNEL, profileMessage, profileOf } from "./settings.ts";

const FILE = {
  format: 1,
  api: "https://api.example.org",
  signIn: {
    service: "firebase",
    apiKey: "synthetic-web-api-key",
    authDomain: "example-project.firebaseapp.com",
    projectId: "example-project",
    appId: "synthetic-web-app-id",
  },
};

const OWNER = { profileId: "p1", owner: true, pseudonym: "Ёжик", ageCategory: "adult" };

/**
 * A button of the profile's header, in the menu of the learner's pill: the pill is pressed,
 * and the button found in the menu it opens.
 */
async function inMenu(name: string): Promise<HTMLElement> {
  await userEvent.click(
    await screen.findByRole("button", { name: /, (profile menu|меню профиля)$/ }),
  );
  return within(await screen.findByRole("dialog")).findByRole("button", { name });
}

/** The section's list, beside its page from 600 CSS px. */
const settingsList = () => screen.findByRole("navigation", { name: "Settings" });

/** The words of the way to the section: the profile's pill, and Settings in its menu. */
const GROWN_UPS = {
  en: { pill: /, profile menu$/, section: "Settings" },
  ru: { pill: /, меню профиля$/, section: "Настройки" },
} as const;

/**
 * The section for adults from the top bar of Home, Subjects and the skill map: the profile's pill
 * is pressed, and Settings in the menu it opens, in the profile's language.
 */
async function grownUps(language: keyof typeof GROWN_UPS = "en"): Promise<void> {
  // At the tablet's width, where the section's list stands beside its page.
  await page.viewport(1194, 834);
  const { pill, section } = GROWN_UPS[language];
  await userEvent.click(await screen.findByRole("button", { name: pill }));
  const pop = within(await screen.findByRole("dialog"));
  await userEvent.click(await pop.findByRole("button", { name: section }));
}

/**
 * Opens the section for adults as the adult does since the choice of the learner has no way to it:
 * the first profile chosen, then the section from Settings in the profile's menu, in the profile's language.
 */
async function toAdults(language: keyof typeof GROWN_UPS = "en"): Promise<void> {
  await vi.waitFor(() => expect(document.querySelector(".nt-learners button")).not.toBeNull());
  await userEvent.click(document.querySelector(".nt-learners button") as HTMLElement);
  await grownUps(language);
}

/** The texts of the account, synthetic: the policy with a translation into Russian. */
function texts(language: string, policy = 2) {
  const ru = language === "ru";
  return message(GetLegalTextsResponseSchema, {
    texts: [
      {
        id: "privacy-policy",
        version: policy,
        body: "# Privacy Policy\n\nWe keep **little**. See <b>this</b> and [a link](https://example.org).\n",
        summary: ru ? "Мы храним мало." : "We keep little.",
        summaryLanguage: ru ? "ru" : "en",
        ...(ru
          ? { translation: "# Политика\n\nМы храним мало данных.\n", translationLanguage: "ru" }
          : {}),
      },
      {
        id: "terms-of-use",
        version: 1,
        body: "# Terms of Use\n\n| Who | What |\n|---|---|\n| You | Learn |\n",
        summary: ru ? "Условия." : "The terms.",
        summaryLanguage: ru ? "ru" : "en",
      },
    ],
  });
}

/** The policy in force with its section Who we are, and its next version, synthetic. */
function withNext() {
  const policy = (version: number, inForceSince: string) => ({
    id: "privacy-policy",
    version,
    inForceSince,
    body: `# Privacy Policy\n\n## Who we are\n\nThe operator of version ${version}.\n`,
    summary: `Version ${version} in short.`,
    summaryLanguage: "en",
  });
  return message(GetLegalTextsResponseSchema, {
    texts: [policy(2, "2026-11-11")],
    nextTexts: [policy(3, "2026-11-27")],
  });
}

function message<S extends DescMessage>(schema: S, init: MessageInitShape<S>): Response {
  return new Response(toBinary(schema, create(schema, init)), {
    headers: { "content-type": "application/proto" },
  });
}

const STATUS: Readonly<Record<string, number>> = {
  permission_denied: 403,
  invalid_argument: 400,
  failed_precondition: 400,
  already_exists: 409,
  unauthenticated: 401,
  unavailable: 503,
};

/** A refusal of api over Connect: its code, and a cause with no data. */
function refusal(code: string, cause: Cause): Response {
  const detail = toBinary(RefusalSchema, create(RefusalSchema, { cause }));
  return new Response(
    JSON.stringify({
      code,
      message: "refused",
      details: [
        {
          type: "novatrail.api.v1.Refusal",
          value: btoa(String.fromCharCode(...detail)).replace(/=+$/, ""),
        },
      ],
    }),
    { status: STATUS[code] ?? 500, headers: { "content-type": "application/json" } },
  );
}

type Route = (body: Uint8Array) => Response | Promise<Response>;

/** Boot with the gate and the app below it, api answering by method: `getAccount` and the others. */
function renderApp(
  routes: Record<string, Route>,
  service: FakeSignIn,
  device = memoryDevice().device,
  languages: readonly string[] = ["en"],
) {
  const asked: string[] = [];
  const apiFetch = vi.fn<typeof fetch>(async (input, init) => {
    // A request by Connect GET holds its message in the address, after the method.
    const [path = "", query = ""] = String(input).split("?");
    // A file of a device part goes by GET at its path, `device <path>` among the routes, else 404.
    const [, file] = path.split("/device/");
    if (file !== undefined) {
      asked.push(`device ${file}`);
      return routes[`device ${file}`]?.(new Uint8Array()) ?? new Response(null, { status: 404 });
    }
    const method = path.split("/").at(-1) ?? "";
    if (query !== "") {
      const message = new URLSearchParams(query).get("message") ?? "";
      const binary = atob(message.replaceAll("-", "+").replaceAll("_", "/"));
      init = { ...init, body: Uint8Array.from(binary, (c) => c.charCodeAt(0)) };
    }
    asked.push(method);
    // The routes go by the method's name as the client of connect-es calls it.
    const route = routes[method.charAt(0).toLowerCase() + method.slice(1)];
    const body = new Uint8Array(await new Response(init?.body).arrayBuffer());
    if (route === undefined) return message(CheckPackagesResponseSchema, {});
    return route(body);
  });
  render(
    <Boot
      framed={false}
      origin="https://app.example.org"
      languages={languages}
      device={device}
      fetcher={async () =>
        new Response(JSON.stringify(FILE), { headers: { "content-type": "application/json" } })
      }
      apiFetch={apiFetch}
      signIn={() => service}
    >
      <AccountGate>
        <App />
      </AccountGate>
    </Boot>,
  );
  return { asked, device };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await page.viewport(414, 896);
});

/** Invite codes of api's form, synthetic: one api takes, and one it refuses. */
const CODE = "N7VA-K2QM-9XB4-ZD3H";
const WRONG = "W0RN-G7CD-5EFX-Q2TT";

describe("the way in", () => {
  it("goes from the sign-in by the invite code and the owner's profile to the learner's screens", async () => {
    const persist = vi.fn(async () => true);
    vi.spyOn(navigator.storage, "persist").mockImplementation(persist);
    const service = fakeSignIn(null);
    let profiles: MessageInitShape<typeof GetAccountResponseSchema>["account"] | undefined;
    const codes: string[] = [];
    const accepted: string[][] = [];
    const created: {
      country: string;
      pseudonym: string | undefined;
      avatar: string | undefined;
    }[] = [];
    const { asked } = renderApp(
      {
        getLegalTexts: (body) =>
          texts(fromBinary(GetLegalTextsRequestSchema, body).interfaceLanguage),
        getAccount: () =>
          profiles === undefined
            ? refusal("permission_denied", Cause.NO_ACCESS)
            : message(GetAccountResponseSchema, { account: profiles }),
        createAccount: (body) => {
          const request = fromBinary(CreateAccountRequestSchema, body);
          codes.push(request.inviteCode);
          accepted.push(request.acceptedTexts.map(({ id, version }) => `${id} ${version}`));
          expect(request.adultStated).toBe(true);
          if (request.inviteCode !== CODE) {
            return refusal("invalid_argument", Cause.CODE_NOT_ACCEPTED);
          }
          profiles = { accountId: "account-1", profiles: [] };
          return message(CreateAccountResponseSchema, { account: profiles });
        },
        createOwnerProfile: (body) => {
          const request = fromBinary(CreateOwnerProfileRequestSchema, body);
          created.push({
            country: request.country,
            pseudonym: request.settings?.pseudonym,
            avatar: request.settings?.avatar,
          });
          if (request.country === "DE") {
            return refusal("failed_precondition", Cause.COUNTRY_NOT_ACCEPTED);
          }
          profiles = { accountId: "account-1", profiles: [OWNER] };
          return message(CreateOwnerProfileResponseSchema, { profile: OWNER });
        },
      },
      service,
    );

    // The sign-in, with the pill of the device's language.
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Language: English" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    // The invite code, then the statement and the texts: nothing goes before each is given.
    expect(await screen.findByRole("heading", { level: 1, name: "You're invited" })).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), WRONG);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Create your account" }),
    ).toBeTruthy();
    const create = screen.getByRole("button", { name: "Create account" });
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    expect(create).toHaveAttribute("aria-disabled", "true");
    // The owner's acceptance of both texts in force, each name a link to its legal page, and no
    // text shown in place.
    const accept = screen.getByRole("checkbox", {
      name: "I agree to the Terms of Use and the Privacy Policy",
    });
    expect(screen.getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "#/legal/terms-of-use",
    );
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "href",
      "#/legal/privacy-policy",
    );
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(screen.queryByText("We keep little.")).toBeNull();
    expect(codes).toEqual([]);
    await userEvent.click(accept);
    await userEvent.click(create);
    // A code api does not take: back to its step, with the line why.
    const code = await screen.findByRole("textbox", { name: "Invite code" });
    await vi.waitFor(() =>
      expect(code).toHaveAccessibleDescription(
        "Tap the boxes to paste the code from your invitation This code isn't valid or has been used",
      ),
    );
    // The right code pasted over the one refused, and sent trimmed.
    await userEvent.fill(code, ` ${CODE} `);
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    // The statement and the acceptance stay given for the versions shown.
    expect(screen.getByRole("checkbox", { name: "I am 18 or older" })).toBeChecked();
    await userEvent.click(await screen.findByRole("button", { name: "Create account" }));
    expect(codes).toEqual([WRONG, CODE]);
    expect(accepted[1]).toEqual(["privacy-policy 2", "terms-of-use 1"]);

    // The owner's profile: a pseudonym of 1 to 30 characters, an avatar of the set, and a country
    // api takes.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your learner profile" }),
    ).toBeTruthy();
    const pseudonym = screen.getByRole("textbox", { name: "Pseudonym" });
    const next = screen.getByRole("button", { name: "Continue" });
    expect(pseudonym).toHaveAccessibleDescription(
      "A made-up name, up to 30 characters. A grown-up's profile needs no age: you stated that you are 18 or older",
    );
    await userEvent.type(pseudonym, "   ");
    expect(next).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(pseudonym, "x".repeat(31));
    await userEvent.click(screen.getByRole("button", { name: "Country Choose a country" }));
    await userEvent.click(screen.getByRole("button", { name: "Germany" }));
    await userEvent.click(next);
    expect(pseudonym).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(pseudonym);
    await userEvent.clear(pseudonym);
    await userEvent.type(pseudonym, " Ёжик ");
    await userEvent.click(screen.getByRole("button", { name: "Choose an avatar" }));
    await userEvent.click(screen.getByRole("button", { name: "Moon" }));
    expect(screen.getByRole("button", { name: "Change the avatar" })).toBeTruthy();
    await userEvent.click(next);
    const country = screen.getByRole("button", { name: "Country Germany" });
    await vi.waitFor(() =>
      expect(country).toHaveAccessibleDescription(
        "NovaTrail doesn't take learners from this country yet",
      ),
    );
    expect(document.activeElement).toBe(country);
    await userEvent.click(country);
    await userEvent.click(screen.getByRole("button", { name: "United States" }));
    await userEvent.click(next);
    expect(created).toEqual([
      { country: "DE", pseudonym: "Ёжик", avatar: "moon" },
      { country: "US", pseudonym: "Ёжик", avatar: "moon" },
    ]);

    // The choice of the learner: the first sign-in asks the browser to keep the site's data, with
    // no line or button of its own.
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    expect(persist).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Ёжик" }));

    // The learner's screens, below the bar.
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(screen.getByRole("banner").textContent).toContain("Ёжик");
    await userEvent.click(await inMenu("Switch learner"));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    // Shown again, it asks the browser no more.
    expect(persist).toHaveBeenCalledOnce();
    // Each request of the way in, then the learner's home — the bell's texts, the share of the
    // quota for the ring of the frame's bar, then the modules connected —, and no other: the catalog
    // is Subjects', the choice of the learner reads no text, and CheckPackages has no package to ask
    // about.
    expect(asked).toEqual([
      "GetAccount",
      "GetLegalTexts",
      "CreateAccount",
      "CreateAccount",
      "CreateOwnerProfile",
      "CreateOwnerProfile",
      "GetAccount",
      "GetLegalTexts",
      "GetQuota",
      "ListConnectedModules",
    ]);
    // Some twenty steps of the way in: under the load of the whole suite they outlast 15 s.
  }, 30_000);

  it("leads from a Russian screen through the texts' sheets to their pages with their translation, and reads them anew when api has newer ones", async () => {
    const service = fakeSignIn("uid-1");
    let policy = 2;
    let down = true;
    const accepted: string[][] = [];
    renderApp(
      {
        getLegalTexts: (body) => {
          if (down) {
            return new Response(JSON.stringify({ code: "internal", message: "down" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
          }
          return texts(fromBinary(GetLegalTextsRequestSchema, body).interfaceLanguage, policy);
        },
        getAccount: () => refusal("permission_denied", Cause.NO_ACCESS),
        createAccount: (body) => {
          const request = fromBinary(CreateAccountRequestSchema, body);
          accepted.push(request.acceptedTexts.map(({ id, version }) => `${id} ${version}`));
          if (request.acceptedTexts[0]?.version !== policy) {
            return refusal("failed_precondition", Cause.TEXT_NOT_CURRENT);
          }
          return refusal("invalid_argument", Cause.CODE_NOT_ACCEPTED);
        },
      },
      service,
      memoryDevice().device,
      ["ru"],
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Вас пригласили" })).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Инвайт-код" }), CODE);
    await userEvent.click(screen.getByRole("button", { name: "Продолжить" }));
    // Texts that could not be read: nothing is sent, and a retry asks again.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Эта версия приложения этого ещё не знает",
    );
    expect(screen.getByRole("button", { name: "Завести аккаунт" })).toBeDisabled();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    // The texts read, their checkbox comes, and the note on their language below it.
    await screen.findByRole("checkbox", {
      name: "Принимаю условия использования и политику конфиденциальности",
    });
    expect(
      screen.getByText("Каждый текст — на английском, в силе именно он, а суть — на вашем языке"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("checkbox", { name: "Мне 18 лет или больше" }));
    // A text's name opens its sheet over the step: the gist in Russian and the line that the English
    // text is in force; its foot, the text's page: the translation and the text.
    await userEvent.click(screen.getByRole("link", { name: "политику конфиденциальности" }));
    const sheet = within(
      await screen.findByRole("dialog", { name: "Политика конфиденциальности" }),
    );
    expect(sheet.getByText("Мы храним мало.")).toHaveAttribute("lang", "ru");
    expect(sheet.getByText("Текст — на английском, и в силе английский текст")).toBeVisible();
    expect(window.location.hash).not.toBe("#/legal/privacy-policy");
    await userEvent.click(sheet.getByRole("button", { name: "Читать полностью" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Политика конфиденциальности" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/legal/privacy-policy");
    expect(await screen.findByText("Мы храним мало.")).toHaveAttribute("lang", "ru");
    expect(screen.getByText("Текст — на английском, и в силе английский текст")).toBeVisible();
    expect(screen.getByRole("region", { name: "Перевод, только для чтения" })).toHaveAttribute(
      "lang",
      "ru",
    );
    expect(screen.getByRole("heading", { name: "Политика" })).toBeTruthy();
    const original = screen.getByRole("region", { name: "Текст в силе, на английском" });
    expect(original).toHaveAttribute("lang", "en");
    // What the part refuses is text: no link, and no HTML of the body.
    expect(original.textContent).toContain("We keep little. See <b>this</b> and a link.");
    expect(original.querySelector("a, b")).toBeNull();
    // Closed, the step comes back as it was left.
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Создайте аккаунт" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Мне 18 лет или больше" })).toBeChecked();
    // The terms' page, with its table and its header, once the step has read the texts again.
    await userEvent.click(await screen.findByRole("link", { name: "условия использования" }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "Условия использования" })).getByRole(
        "button",
        { name: "Читать полностью" },
      ),
    );
    expect(window.location.hash).toBe("#/legal/terms-of-use");
    expect(await screen.findByRole("columnheader", { name: "Who" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Learn" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    const accept = await screen.findByRole("checkbox", {
      name: "Принимаю условия использования и политику конфиденциальности",
    });

    // api has a newer policy: the screen reads it, unticks, and says so.
    await userEvent.click(accept);
    policy = 3;
    await userEvent.click(screen.getByRole("button", { name: "Завести аккаунт" }));
    // The texts are read anew: their checkbox stays, unticked, with focus and the reason.
    await vi.waitFor(() =>
      expect(accept).toHaveAccessibleDescription(
        "Тексты обновились. Нужно прочитать их снова и принять",
      ),
    );
    expect(accept).not.toBeChecked();
    expect(document.activeElement).toBe(accept);
    // Ticked again once the new versions are shown, it holds for them.
    await vi.waitFor(async () => {
      if (!(accept as HTMLInputElement).checked) await userEvent.click(accept);
      expect(screen.getByRole("button", { name: "Завести аккаунт" })).toBeEnabled();
    });
    await userEvent.click(screen.getByRole("button", { name: "Завести аккаунт" }));
    await vi.waitFor(() => expect(accepted).toHaveLength(2));
    expect(accepted).toEqual([
      ["privacy-policy 2", "terms-of-use 1"],
      ["privacy-policy 3", "terms-of-use 1"],
    ]);
  });

  it("says what came of a window that did not open, and for whoever deployed the copy", async () => {
    const service = fakeSignIn(null);
    renderApp({}, service);
    const button = await screen.findByRole("button", { name: "Sign in with Google" });
    service.answer = { kind: "blocked" };
    await userEvent.click(button);
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The browser didn't open the sign-in window. Allow pop-ups for this site and try again",
    );
    service.answer = { kind: "unconfigured", code: "unauthorized-domain" };
    await userEvent.click(button);
    await vi.waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "the sign-in service refused this copy: auth/unauthorized-domain",
      ),
    );
    expect(screen.getByRole("alert").querySelector("[lang=en]")).not.toBeNull();
    for (const [kind, line] of [
      ["offline", "No connection"],
      ["unknown", "The sign-in didn't go through. Try again"],
    ] as const) {
      service.answer = { kind, code: "x" } as never;
      await userEvent.click(button);
      await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toBe(line));
    }
  });

  it("goes on with the open attempt GetAccount names, and home once it is over", async () => {
    window.location.hash = "#/task";
    const service = fakeSignIn("uid-1");
    const owner = { ...OWNER, openAttempt: { attemptId: "a1" } };
    const account = { accountId: "account-1", profiles: [owner] };
    const { asked } = renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        getOpenAttempt: () => refusal("failed_precondition", Cause.ATTEMPT_CLOSED),
      },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "This task is already over" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/task");
    expect(asked).toContain("GetOpenAttempt");
    await userEvent.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    // The attempt is over: the task screen has nothing to go on with, after switching the learner
    // and back too, and goes home in place of itself.
    await userEvent.click(await inMenu("Switch learner"));
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    window.location.hash = "#/task";
    await vi.waitFor(() => expect(window.location.hash).toBe("#/home"));
    window.location.hash = "";
  });

  it("goes home from the task screen when the learner has no attempt open", async () => {
    window.location.hash = "#/task";
    const entries = window.history.length;
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
    expect(window.history.length).toBe(entries);
    window.location.hash = "";
  });

  it("keeps the tile of a module's lesson shut, and opens no lesson, not the run GetAccount names", async () => {
    const service = fakeSignIn("uid-1");
    const run = { lessonRunId: "r1", lesson: GAPS_ID, packageDigest: D1 };
    const owner = { ...OWNER, openLessonRuns: [run] };
    const account = { accountId: "account-1", profiles: [owner] };
    const { asked } = renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        ...moduleRoutes(LessonState.OPEN),
      },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    // While the lessons are remade the tile leads nowhere, and the player's address goes home.
    expect(await screen.findByRole("button", CONTINUE_GAPS)).toBeDisabled();
    window.location.hash = "#/lesson";
    await vi.waitFor(() => expect(window.location.hash).toBe("#/home"));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(asked).not.toContain("GetLessonRun");
    expect(asked).not.toContain("OpenLesson");
    window.location.hash = "";
  });

  it("begins a task of a module by Solve on its tile, past the lesson's shut", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    const chosen: ReturnType<typeof fromBinary<typeof ChooseNextRequestSchema>>[] = [];
    const { asked } = renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        ...moduleRoutes(LessonState.NEW),
        chooseNext: (body) => {
          chosen.push(fromBinary(ChooseNextRequestSchema, body));
          return message(ChooseNextResponseSchema, {
            choice: { choiceId: "c2", kind: ChoiceKind.TASK },
          });
        },
        beginAttempt: () =>
          message(BeginAttemptResponseSchema, { attempt: { attemptId: "a5", packageDigest: "d" } }),
        getOpenAttempt: () => refusal("failed_precondition", Cause.ATTEMPT_CLOSED),
      },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("button", CONTINUE_GAPS)).toBeDisabled();
    // Solve asks for a task of the module, which begins on the sheet.
    await userEvent.click(await screen.findByRole("button", { name: "Solve" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "This task is already over" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/task");
    expect(chosen[0]?.moduleId).toBe(LESSONS_MODULE);
    expect(asked).toContain("BeginAttempt");
    expect(asked).not.toContain("OpenLesson");
    window.location.hash = "";
  });

  it("goes home from the lesson player when the learner chose no lesson", async () => {
    window.location.hash = "#/lesson";
    const entries = window.history.length;
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
    expect(window.history.length).toBe(entries);
    window.location.hash = "";
  });

  it("signs out at once from the menu, and keeps the account's work on the device", async () => {
    const { device } = memoryDevice();
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }) },
      service,
      device,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: `sha256:${"1".repeat(64)}` });

    await userEvent.click(await inMenu("Sign out"));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(service.calls.signOut).toBe(1);
    const registry = await readRegistry(device);
    expect(registry?.account).toBe("account-1");
    expect(registry?.databases.has(profileDatabase("p1"))).toBe(true);
    expect(await (await openProfile(device, "p1"))?.unfinished()).toBe(1);
  });

  it("stays where it was when the sign-out did not go through", async () => {
    const service = fakeSignIn("uid-1");
    service.signOut = async () => {
      throw new Error("no network");
    };
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await screen.findByRole("heading", { level: 1, name: "Who is learning?" });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(screen.getByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
  });

  it("signs out from the choice too", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await screen.findByRole("heading", { level: 1, name: "Who is learning?" });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
  });

  it("offers to try again when api does not answer, and shows a failure no screen is for", async () => {
    const service = fakeSignIn("uid-1");
    let answer = () =>
      new Response(JSON.stringify({ code: "unavailable", message: "down" }), {
        status: 503,
        headers: { "content-type": "application/json" },
      });
    renderApp({ getAccount: () => answer() }, service);
    // The repeats of the client take their pauses, 7.5 s: the offline screen comes after them.
    expect(
      await screen.findByRole("heading", { level: 1, name: "No connection" }, { timeout: 15_000 }),
    ).toBeTruthy();
    answer = () => refusal("failed_precondition", Cause.NO_CONSENT);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "A grown-up's consent is needed first",
      }),
    ).toBeTruthy();
    answer = () =>
      message(GetAccountResponseSchema, { account: { accountId: "account-1", profiles: [OWNER] } });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
  }, 30_000);
});

const D1 = `sha256:${"1".repeat(64)}`;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));

const LESSONS_MODULE = "example/with-lessons";
const GAPS_ID = `${LESSONS_MODULE}/lesson/gaps-and-posts`;
/** Continue on the tile of the lesson, and Solve on the module's card, as their roles find them. */
const CONTINUE_GAPS = { name: "Continue", description: "Gaps and posts" };
const SOLVE_LESSONS = { name: "Solve", description: "With lessons" };

/**
 * A module connected, its manifest, and its lessons: the one lesson in the state given, which its
 * tile on Home names; none when no state is given.
 */
function moduleRoutes(state?: LessonState): Record<string, Route> {
  return {
    listConnectedModules: () =>
      message(ListConnectedModulesResponseSchema, {
        modules: [{ moduleId: LESSONS_MODULE, packageDigest: D1 }],
      }),
    getManifest: () =>
      message(GetManifestResponseSchema, {
        manifest: {
          json: encode({
            module_format_version: "0.4",
            id: LESSONS_MODULE,
            version: "1.0.0",
            title: "With lessons",
            languages: { explanation: "en" },
          }),
          moduleFormatVersion: "0.4",
        },
      }),
    listLessons: () =>
      message(
        ListLessonsResponseSchema,
        state === undefined
          ? {}
          : {
              lessons: [{ lesson: GAPS_ID, title: "Gaps and posts", segments: 3, state }],
              tileLesson: GAPS_ID,
            },
      ),
  };
}

/** An open attempt of an essay of a module, and its views: `#/task` opens it on the sheet. */
const ATTEMPT_ROUTES: Record<string, Route> = {
  getOpenAttempt: () =>
    message(GetOpenAttemptResponseSchema, {
      attempt: {
        start: {
          attemptId: "a1",
          task: {
            json: encode({
              id: "essay",
              statement: [{ text: "Write about your day." }],
              canvas: { kind: "handwriting_sheet" },
              items: [{ answer_slots: [{ binding: "sheet" }] }],
            }),
            moduleFormatVersion: "0.4",
          },
          packageDigest: D1,
        },
      },
    }),
  getManifest: () =>
    message(GetManifestResponseSchema, {
      manifest: {
        json: encode({
          module_format_version: "0.4",
          id: "example/choices",
          version: "1.0.0",
          title: "Choices",
          languages: { explanation: "en" },
        }),
        moduleFormatVersion: "0.4",
      },
    }),
  getSolvingSteps: () =>
    message(GetSolvingStepsResponseSchema, {
      solvingSteps: {
        json: encode({ steps: [{ title: "Solve it", exit_condition: "answer_slots_filled" }] }),
        moduleFormatVersion: "0.4",
      },
    }),
  getTechniques: () =>
    message(GetTechniquesResponseSchema, {
      techniques: { json: encode({ techniques: {} }), moduleFormatVersion: "0.4" },
    }),
};

describe("the section for adults", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("opens from Settings in the profile's menu, saves what changed, and the learner's screens take it", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    const updates: ReturnType<typeof fromBinary<typeof UpdateProfileRequestSchema>>[] = [];
    const heard: unknown[] = [];
    const other = new BroadcastChannel(PROFILES_CHANNEL);
    other.onmessage = (event) => heard.push(event.data);
    renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        updateProfile: (body) => {
          updates.push(fromBinary(UpdateProfileRequestSchema, body));
          return message(UpdateProfileResponseSchema, {
            profile: { ...OWNER, hintMode: HintMode.QUESTIONS_ONLY, interfaceLanguage: "ru" },
          });
        },
      },
      service,
    );

    // From Settings, the section in the device's language, the learner's page beside its list.
    await toAdults();
    expect(await settingsList()).toBeTruthy();
    expect(window.location.hash).toBe("#/adults");
    expect(screen.getByRole("button", { name: "Language English" })).toBeTruthy();
    expect(await screen.findByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Show where" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "Questions only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("button", { name: "Saved" })).toBeTruthy();
    // Only what changed goes.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      profileId: "p1",
      settings: { hintMode: HintMode.QUESTIONS_ONLY },
    });
    expect(updates[0]?.settings?.pseudonym).toBeUndefined();
    expect(updates[0]?.settings?.voicing).toBeUndefined();
    // The other tabs hear of it.
    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(profileOf(heard[0])).toMatchObject({
      profileId: "p1",
      hintMode: HintMode.QUESTIONS_ONLY,
    });
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();

    // The learner's screens are in the device's language too.
    await userEvent.click(screen.getByRole("button", { name: "Close the settings" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    other.close();
  });

  it("takes what another tab saved, and keeps the attempt the sheet opens", async () => {
    const service = fakeSignIn("uid-1");
    const owner = { ...OWNER, openAttempt: { attemptId: "a1" } };
    const account = { accountId: "account-1", profiles: [owner] };
    const other = new BroadcastChannel(PROFILES_CHANNEL);
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }), ...ATTEMPT_ROUTES },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    // A third tab hears both messages when the app does: the task opens only after they came.
    const probe = new BroadcastChannel(PROFILES_CHANNEL);
    const came = new Promise<void>((resolve) => {
      let count = 0;
      probe.onmessage = () => {
        count += 1;
        if (count === 2) resolve();
      };
    });
    // Something that is no profile changes nothing.
    other.postMessage("ru");
    other.postMessage(
      profileMessage(
        create(ProfileSchema, {
          ...OWNER,
          hintMode: HintMode.QUESTIONS_ONLY,
          interfaceLanguage: "ru",
        }),
      ),
    );
    // Its language is no language of this device's screens.
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    await came;
    probe.close();
    // The open attempt GetAccount named stays: other settings make no other profile of it.
    window.location.hash = "#/task";
    expect(
      await screen.findByRole("heading", { level: 1, name: en["paper.module-task"] }),
    ).toBeTruthy();
    other.close();
  });

  it("asks for the account again when api has the profile no longer, and the page goes with it", async () => {
    const service = fakeSignIn("uid-1");
    let asked = 0;
    const owner = { ...OWNER, profileId: "p0", pseudonym: "Белка" };
    renderApp(
      {
        getAccount: () => {
          asked += 1;
          const profiles = asked === 1 ? [OWNER, { ...owner, owner: false }] : [OWNER];
          return message(GetAccountResponseSchema, {
            account: { accountId: "account-1", profiles },
          });
        },
        updateProfile: () => refusal("failed_precondition", Cause.NO_PROFILE),
      },
      service,
    );
    await toAdults();
    await userEvent.click(await screen.findByRole("button", { name: /^Белка / }));
    expect(await screen.findByRole("heading", { level: 1, name: "Profile: Белка" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Questions only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(window.location.hash).toBe("#/adults"));
    expect(await screen.findByRole("button", { name: /^Ёжик / })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Белка / })).toBeNull();
    expect(asked).toBe(2);
  });

  it("goes to its first page from a profile's page with none chosen, and from a page it does not know", async () => {
    await page.viewport(1194, 834);
    window.location.hash = "#/adults/profile";
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    expect(await settingsList()).toBeTruthy();
    expect(window.location.hash).toBe("#/adults");
    window.location.hash = "#/adults/nowhere";
    await vi.waitFor(() => expect(window.location.hash).toBe("#/adults"));
    expect(await settingsList()).toBeTruthy();
  });
});

describe("the legal pages", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("open from the policy's sheet on the sign-in screen before signing in, read the policy with no token, and close home", async () => {
    const service = fakeSignIn(null);
    const read: string[] = [];
    const { asked } = renderApp(
      {
        getLegalTexts: (body) => {
          read.push(fromBinary(GetLegalTextsRequestSchema, body).interfaceLanguage);
          return texts("en");
        },
      },
      service,
    );
    // The card's foot opens the policy's sheet over the screen, as the mockup's.
    await userEvent.click(
      await screen.findByRole("button", { name: "Privacy and legal information" }),
    );
    const sheet = within(await screen.findByRole("dialog", { name: "Privacy Policy" }));
    expect(await sheet.findByText("We keep little.")).toBeVisible();
    expect(window.location.hash).not.toBe("#/legal");
    await userEvent.click(sheet.getByRole("button", { name: "Read the full text" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Privacy Policy" })).toBeTruthy();
    expect(await screen.findByText("We keep little.")).toBeTruthy();
    expect(window.location.hash).toBe("#/legal/privacy-policy");
    expect(read).toEqual(["en", "en"]);
    expect(asked).toEqual(["GetLegalTexts", "GetLegalTexts"]);
    await userEvent.click(screen.getByRole("button", { name: "Back to the list" }));
    expect(window.location.hash).toBe("#/legal");
    await userEvent.click(await screen.findByRole("button", { name: "Close" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
  });

  it("are no rows of Settings, but its quiet link Privacy leads to them and back", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await toAdults();
    expect(await settingsList()).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Privacy and legal information" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Accessibility" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Privacy" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy and legal information" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/legal");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await settingsList()).toBeTruthy();
    expect(window.location.hash).toBe("#/adults");
  });

  it("open from the adult's Help on Home, and close back home", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    await userEvent.click(await screen.findByRole("button", { name: /, profile menu$/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Help" }));
    await userEvent.click(await screen.findByRole("button", { name: "Accessibility" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Accessibility" })).toBeTruthy();
    expect(window.location.hash).toBe("#/legal/accessibility");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
  });

  it("tell of a next version neither on the choice of the learner nor in the section", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [{ ...OWNER, workStorage: true }] };
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }), getLegalTexts: withNext },
      service,
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    await toAdults();
    expect(await settingsList()).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New versions of the texts" })).toBeNull();
    window.location.hash = "#/legal/privacy-policy/next";
    expect(
      await screen.findByRole("heading", { level: 1, name: "Privacy Policy: the next version" }),
    ).toBeTruthy();
    expect(await screen.findByText("Version 3 in short.")).toBeTruthy();
  });
});

describe("the own key", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("goes with the owner profile's requests once connected, and leaves memory on Switch learner", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    const checked: ReturnType<typeof fromBinary<typeof CheckOwnKeyRequestSchema>>[] = [];
    const chosen: ReturnType<typeof fromBinary<typeof ChooseNextRequestSchema>>[] = [];
    const heard: unknown[] = [];
    const other = new BroadcastChannel(OWN_KEY_CHANNEL);
    other.onmessage = (event) => heard.push(event.data);
    renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        listOwnKeyProviders: () =>
          message(ListOwnKeyProvidersResponseSchema, {
            providers: [{ provider: "anthropic", name: "Anthropic" }],
          }),
        checkOwnKey: (body) => {
          checked.push(fromBinary(CheckOwnKeyRequestSchema, body));
          return message(CheckOwnKeyResponseSchema, { check: OwnKeyCheck.ACCEPTED });
        },
        chooseNext: (body) => {
          chosen.push(fromBinary(ChooseNextRequestSchema, body));
          return message(ChooseNextResponseSchema, { choice: { kind: ChoiceKind.NOTHING } });
        },
        ...moduleRoutes(),
      },
      service,
    );
    // From Settings, the owner profile chosen, which holds the key.
    await toAdults();
    await userEvent.click(await screen.findByRole("button", { name: "Own AI key" }));
    // A synthetic key: no provider issued it.
    await userEvent.fill(await screen.findByLabelText("Key"), "sk-ant-synthetic-0000-a1b2");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
    expect(await screen.findByText("Key ending in a1b2")).toBeTruthy();
    expect(checked[0]).toMatchObject({ profileId: "p1", ownKey: { provider: "anthropic" } });
    await vi.waitFor(() => expect(heard).toEqual([{ profileId: "p1" }]));
    await userEvent.click(screen.getByRole("button", { name: "Close the settings" }));
    await userEvent.click(await screen.findByRole("button", SOLVE_LESSONS));
    await vi.waitFor(() => expect(chosen).toHaveLength(1));
    expect(chosen[0]?.ownKeyProvider).toBe("anthropic");
    // Switch learner closes the owner profile: the key, not kept here, is gone.
    await userEvent.click(await inMenu("Switch learner"));
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    await userEvent.click(await screen.findByRole("button", SOLVE_LESSONS));
    await vi.waitFor(() => expect(chosen).toHaveLength(2));
    expect(chosen[1]?.ownKeyProvider).toBe("");
    other.close();
  });
});

describe("the page This device in the section", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("lifts its warning of loss once the storage on the server is on and nothing here is unsent", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    const switched: ReturnType<typeof fromBinary<typeof SetWorkStorageRequestSchema>>[] = [];
    const heard: unknown[] = [];
    const other = new BroadcastChannel(PROFILES_CHANNEL);
    other.onmessage = (event) => heard.push(event.data);
    renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        getLegalTexts: () =>
          message(GetLegalTextsResponseSchema, {
            texts: [
              {
                id: "storage-consent",
                version: 1,
                body: "# Keeping works on our server\n\nText.\n",
                summary: "Works kept.",
                summaryLanguage: "en",
              },
            ],
          }),
        setWorkStorage: (body) => {
          switched.push(fromBinary(SetWorkStorageRequestSchema, body));
          return message(SetWorkStorageResponseSchema, {
            profile: { ...OWNER, workStorage: true },
          });
        },
      },
      service,
    );
    await toAdults();
    await userEvent.click(await screen.findByRole("button", { name: /^Ёжик / }));
    await userEvent.click(await screen.findByRole("switch", { name: "Keep works on the server" }));
    await userEvent.click(
      await screen.findByRole("checkbox", { name: /^I give my explicit consent/ }),
    );
    const on = screen.getByRole("button", { name: "Switch it on" });
    await vi.waitFor(() => expect(on).toBeEnabled());
    await userEvent.click(on);
    expect(
      await screen.findByRole("switch", { name: "Keep works on the server", checked: true }),
    ).toBeTruthy();
    expect(switched).toHaveLength(1);
    expect(switched[0]).toMatchObject({
      profileId: "p1",
      enabled: true,
      text: { id: "storage-consent", version: 1 },
    });
    // The other tabs hear of it, as of any profile api changed.
    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(profileOf(heard[0])).toMatchObject({ profileId: "p1", workStorage: true });
    await userEvent.click(await screen.findByRole("button", { name: "This device" }));
    expect(await screen.findByRole("heading", { level: 1, name: "This device" })).toBeTruthy();
    // The device keeps no work of the profile that the server lacks: once read, no warning.
    expect(await screen.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
    expect(
      screen.queryByText(
        "Its work is on this device alone: if the site's data is erased, the work is lost",
      ),
    ).toBeNull();
    other.close();
  });

  it("erases everything on this device: the account's data, the device's language, the session", async () => {
    const { device, backend } = memoryDevice();
    await writeLanguage(device, "en");
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }) },
      service,
      device,
    );
    await toAdults();
    await userEvent.click(await screen.findByRole("button", { name: "This device" }));
    expect(await screen.findByRole("heading", { level: 1, name: "This device" })).toBeTruthy();
    expect(window.location.hash).toBe("#/adults/device");
    await userEvent.click(screen.getByRole("button", { name: "Erase everything on this device" }));
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(service.calls.signOut).toBe(1);
    expect(await readRegistry(device)).toBeUndefined();
    expect(backend.databases.has(SETTINGS)).toBe(false);
    expect(window.location.hash).toBe("#/home");
  });

  it("holds the account on a failure screen while another tab holds what another account left", async () => {
    const { device, backend } = memoryDevice();
    await setAccount(device, "account-0");
    await addProfile(device, "old");
    backend.blocked.add(profileDatabase("old"));
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }) },
      fakeSignIn("uid-1"),
      device,
    );
    const held = await screen.findByRole("heading", {
      level: 1,
      name: "Another account's data on this device can't be erased yet. Close the app's other tabs and try again",
    });
    // A failure screen's card, its Try again the primary button.
    expect(held.closest("main")).toHaveClass("nt-failure");
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toHaveClass("nt-main");
    backend.blocked.clear();
    await userEvent.click(retry);
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
  });
});

describe("the license of a module", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  const LICENSE = "Apache License\nVersion 2.0, January 2004\n";
  const routes = (profile: object) => ({
    getAccount: () =>
      message(GetAccountResponseSchema, {
        account: { accountId: "account-1", profiles: [profile] },
      }),
    listConnectedModules: () =>
      message(ListConnectedModulesResponseSchema, {
        modules: [{ moduleId: "example/choices", packageDigest: D1 }],
      }),
    getManifest: ATTEMPT_ROUTES.getManifest as Route,
    "device LICENSE": () => new Response(LICENSE),
  });

  it("opens by its address in the device's language while a learner is chosen, and closes home", async () => {
    const service = fakeSignIn("uid-1");
    const { asked } = renderApp(routes(OWNER), service, memoryDevice().device, ["ru"]);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    // A card of Subjects names the license among its facts, with no button of the page.
    await userEvent.click(await screen.findByRole("link", { name: "Предметы" }));
    const card = within(await screen.findByRole("article", { name: "Choices" }));
    expect(card.queryByRole("button", { name: "Лицензия" })).toBeNull();
    window.location.hash = `#/license/${encodeURIComponent(D1)}`;
    expect(
      await screen.findByRole("heading", { level: 1, name: "Лицензия и уведомления модуля" }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe("ru");
    await vi.waitFor(() => expect(document.querySelector("pre")?.textContent).toBe(LICENSE));
    expect(await screen.findByText("Файла NOTICE у модуля нет")).toBeTruthy();
    expect(asked).toContain("device LICENSE");
    expect(asked).toContain("device NOTICE");
    await userEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Главная" })).toBeTruthy();
  });
});

describe("the page on the AI tutor", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  const routes = (profile: object) => ({
    getAccount: () =>
      message(GetAccountResponseSchema, {
        account: { accountId: "account-1", profiles: [profile] },
      }),
    listConnectedModules: () => message(ListConnectedModulesResponseSchema, { modules: [] }),
  });

  it("opens by its address in the device's language, closes home, and shows before signing in", async () => {
    const service = fakeSignIn("uid-1");
    renderApp(routes(OWNER), service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    await screen.findByRole("heading", { level: 1, name: "Home" });
    window.location.hash = "#/tutor";
    expect(
      await screen.findByRole("heading", { level: 1, name: "How to use the AI tutor safely" }),
    ).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(6);
    expect(document.querySelector("a")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Home" })).toBeTruthy();
    // Signed out, the page shows by its address in the device's language; a part it does not know
    // goes to the page itself.
    service.set(null);
    window.location.hash = "#/home";
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    window.location.hash = "#/tutor/more";
    expect(
      await screen.findByRole("heading", { level: 1, name: "How to use the AI tutor safely" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/tutor");
    expect(screen.getByText(/call your country's emergency number/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
  });
});

describe("the page on the AI tutor and who runs this copy", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("leads to who runs this copy where it names the operator, and back to itself", async () => {
    const service = fakeSignIn("uid-1");
    renderApp(
      {
        getAccount: () =>
          message(GetAccountResponseSchema, {
            account: {
              accountId: "account-1",
              profiles: [OWNER],
            },
          }),
        listConnectedModules: () => message(ListConnectedModulesResponseSchema, { modules: [] }),
        getLegalTexts: withNext,
      },
      service,
      memoryDevice().device,
      ["ru"],
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    await screen.findByRole("heading", { level: 1, name: "Главная" });
    window.location.hash = "#/tutor";
    await userEvent.click(await screen.findByRole("button", { name: "Кто ведёт приложение" }));
    expect(window.location.hash).toBe("#/legal/operator");
    expect(
      await screen.findByRole("heading", { level: 1, name: ru["legal.operator"] }),
    ).toBeTruthy();
    expect(await screen.findByText("The operator of version 2.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: ru["common.close"] }));
    expect(window.location.hash).toBe("#/tutor");
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Как безопасно пользоваться ИИ-наставником",
      }),
    ).toBeTruthy();
  });

  it("closes who runs this copy back to the page on the AI tutor before signing in too", async () => {
    renderApp({ getLegalTexts: withNext }, fakeSignIn());
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    window.location.hash = "#/tutor";
    await userEvent.click(await screen.findByRole("button", { name: "Who runs the app" }));
    expect(await screen.findByText("The operator of version 2.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(window.location.hash).toBe("#/tutor");
    expect(
      await screen.findByRole("heading", { level: 1, name: "How to use the AI tutor safely" }),
    ).toBeTruthy();
  });
});
