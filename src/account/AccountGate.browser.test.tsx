// The way in, through Boot, in Chromium (sections 3.2, 3.6 and 3.10 of docs/architecture.md): the
// sign-in, the invite code, the owner's profile, the choice of the learner, the bar above the
// learner's screens and the sign-out, each screen by its role and name, with api answering by the
// test's fetch and the sign-in service the test's own.
import {
  CreateAccountRequestSchema,
  CreateAccountResponseSchema,
  CreateOwnerProfileRequestSchema,
  CreateOwnerProfileResponseSchema,
  GetAccountResponseSchema,
  Mode,
  ProfileSchema,
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
  ChooseNextResponseSchema,
  GetOpenAttemptResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import {
  GetLegalTextsRequestSchema,
  GetLegalTextsResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
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
import { userEvent } from "vitest/browser";
import { App } from "../app/App.tsx";
import { Boot } from "../boot/Boot.tsx";
import { addProfile } from "../storage/profile.ts";
import { readRegistry } from "../storage/registry.ts";
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the way in", () => {
  it("goes from the sign-in by the invite code and the owner's profile to the learner's screens", async () => {
    const service = fakeSignIn(null);
    let profiles: MessageInitShape<typeof GetAccountResponseSchema>["account"] | undefined;
    const codes: string[] = [];
    const accepted: string[][] = [];
    const created: { country: string; pseudonym: string | undefined }[] = [];
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
          if (request.inviteCode !== "0123-4567-89AB-CDEF") {
            return refusal("invalid_argument", Cause.CODE_NOT_ACCEPTED);
          }
          profiles = { accountId: "account-1", profiles: [] };
          return message(CreateAccountResponseSchema, { account: profiles });
        },
        createOwnerProfile: (body) => {
          const request = fromBinary(CreateOwnerProfileRequestSchema, body);
          created.push({ country: request.country, pseudonym: request.settings?.pseudonym });
          if (request.country === "DE") {
            return refusal("failed_precondition", Cause.COUNTRY_NOT_ACCEPTED);
          }
          profiles = { accountId: "account-1", profiles: [OWNER] };
          return message(CreateOwnerProfileResponseSchema, { profile: OWNER });
        },
      },
      service,
    );

    // The sign-in, with the buttons of the device's language.
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Sign in with Google" }));

    // The invite code: each field says what it lacks, and focus goes to the first.
    expect(await screen.findByRole("heading", { level: 1, name: "Invite code" })).toBeTruthy();
    const code = screen.getByRole("textbox", { name: "Invite code" });
    const adult = screen.getByRole("checkbox", { name: "I am 18 or older" });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(code).toHaveAccessibleDescription("Enter the invite code");
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(code);
    await userEvent.type(code, "WRONG");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(adult).toHaveAccessibleDescription("Only someone 18 or older can create an account");
    expect(document.activeElement).toBe(adult);
    expect(codes).toEqual([]);
    await userEvent.click(adult);
    // The texts in force, each open in place, and the owner's acceptance of both.
    expect(
      screen.getByRole("heading", { level: 2, name: "Privacy Policy and Terms of Use" }),
    ).toBeTruthy();
    const accept = screen.getByRole("checkbox", {
      name: "I accept the Privacy Policy and the Terms of Use",
    });
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(accept).toHaveAccessibleDescription(
      "To create an account, accept the Privacy Policy and the Terms of Use",
    );
    expect(document.activeElement).toBe(accept);
    expect(codes).toEqual([]);
    await userEvent.click(screen.getByText("Privacy Policy", { selector: "summary span" }));
    expect(screen.getByText("We keep little.")).toBeVisible();
    expect(screen.getByRole("heading", { level: 3, name: "Privacy Policy" })).toBeTruthy();
    // What the part refuses is text: no link, and no HTML of the body.
    const body = screen.getByText(
      (_, element) =>
        element?.tagName === "P" &&
        element.textContent === "We keep little. See <b>this</b> and a link.",
    );
    expect(body.closest("section")).toHaveAttribute("lang", "en");
    expect(document.querySelector("main a, main b")).toBeNull();
    expect(
      screen.queryByText("The text is in English, and the English text is the one in force"),
    ).toBeNull();
    await userEvent.click(accept);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await vi.waitFor(() =>
      expect(code).toHaveAccessibleDescription("This code isn't valid or has been used"),
    );
    await userEvent.clear(code);
    await userEvent.type(code, " 0123-4567-89AB-CDEF ");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(codes).toEqual(["WRONG", "0123-4567-89AB-CDEF"]);
    expect(accepted[1]).toEqual(["privacy-policy 2", "terms-of-use 1"]);

    // The owner's profile: a pseudonym of 1 to 30 characters, and a country api takes.
    expect(
      await screen.findByRole("heading", { level: 1, name: "Your learner profile" }),
    ).toBeTruthy();
    const pseudonym = screen.getByRole("textbox", { name: "Pseudonym" });
    const country = screen.getByRole("combobox", { name: "Country" });
    expect(pseudonym).toHaveAccessibleDescription("Not a real name, up to 30 characters");
    await userEvent.type(pseudonym, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(pseudonym).toHaveAccessibleDescription(
      "Not a real name, up to 30 characters From 1 to 30 characters",
    );
    await userEvent.type(pseudonym, " Ёжик ");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(country).toHaveAccessibleDescription("Choose a country");
    expect(document.activeElement).toBe(country);
    await userEvent.selectOptions(country, "DE");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await vi.waitFor(() =>
      expect(country).toHaveAccessibleDescription(
        "NovaTrail doesn't take learners from this country yet",
      ),
    );
    await userEvent.selectOptions(country, "US");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(created).toEqual([
      { country: "DE", pseudonym: "Ёжик" },
      { country: "US", pseudonym: "Ёжик" },
    ]);

    // The choice of the learner, with the line of the first sign-in.
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    const persist = vi.fn(async () => true);
    vi.spyOn(navigator.storage, "persist").mockImplementation(persist);
    expect(screen.getByText("Learners' work is kept on this device")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ask the browser to keep it" }));
    expect(await screen.findByText("The browser will keep it")).toBeTruthy();
    expect(persist).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Ёжик" }));

    // The learner's screens, below the bar.
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(screen.getByRole("banner").textContent).toContain("Ёжик");
    await userEvent.click(screen.getByRole("button", { name: "Switch learner" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    expect(screen.queryByText("Learners' work is kept on this device")).toBeNull();
    // Each request of the way in, then the learner's home, and no other: CheckPackages has no
    // package to ask about.
    expect(asked).toEqual([
      "GetAccount",
      "GetLegalTexts",
      "CreateAccount",
      "CreateAccount",
      "CreateOwnerProfile",
      "CreateOwnerProfile",
      "GetAccount",
      "ListConnectedModules",
      "ListCatalog",
    ]);
  });

  it("shows the texts on a Russian screen with their translation, and anew when api has newer ones", async () => {
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
    expect(await screen.findByRole("heading", { level: 1, name: "Инвайт-код" })).toBeTruthy();
    // Texts that could not be read: nothing is sent, and a retry asks again.
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Эта версия приложения этого ещё не знает",
    );
    expect(screen.getByRole("button", { name: "Завести аккаунт" })).toBeDisabled();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Повторить" }));
    const accept = await screen.findByRole("checkbox", {
      name: "Принимаю политику конфиденциальности и условия использования",
    });
    // The gist in Russian, the line that the English text is in force, the translation and the text.
    await userEvent.click(screen.getByText("Privacy Policy", { selector: "summary span" }));
    expect(screen.getByText("Privacy Policy", { selector: "summary span" })).toHaveAttribute(
      "lang",
      "en",
    );
    expect(screen.getByText("Мы храним мало.", { selector: "section > p" })).toHaveAttribute(
      "lang",
      "ru",
    );
    expect(
      screen.getAllByText("Текст — на английском, и в силе английский текст")[0],
    ).toBeVisible();
    expect(screen.getByRole("region", { name: "Перевод, только для чтения" })).toHaveAttribute(
      "lang",
      "ru",
    );
    expect(screen.getByRole("heading", { level: 3, name: "Политика" })).toBeTruthy();
    expect(
      screen.getAllByRole("region", { name: "Текст в силе, на английском" })[0],
    ).toHaveAttribute("lang", "en");
    // The terms' table, with its header.
    await userEvent.click(screen.getByText("Terms of Use", { selector: "summary span" }));
    expect(screen.getByRole("columnheader", { name: "Who" })).toBeTruthy();
    expect(screen.getByRole("cell", { name: "Learn" })).toBeTruthy();

    // api has a newer policy: the screen reads it, unticks, and says so.
    await userEvent.type(screen.getByRole("textbox", { name: "Инвайт-код" }), "CODE");
    await userEvent.click(screen.getByRole("checkbox", { name: "Мне 18 лет или больше" }));
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
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Завести аккаунт" })).toBeEnabled(),
    );
    await userEvent.click(accept);
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
    await userEvent.click(await screen.findByRole("button", { name: "Continue the task" }));
    expect(window.location.hash).toBe("#/task");
    expect(
      await screen.findByRole("heading", { level: 1, name: "This task is already over" }),
    ).toBeTruthy();
    expect(asked).toContain("GetOpenAttempt");
    await userEvent.click(screen.getByRole("button", { name: "Back to My subjects" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    // The attempt is over: nothing to go on with any more, after switching the learner and back too.
    expect(screen.queryByRole("button", { name: "Continue the task" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Switch learner" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue the task" })).toBeNull();
    window.location.hash = "";
  });

  it("goes home from the task screen when the learner has no attempt open", async () => {
    window.location.hash = "#/task";
    const entries = window.history.length;
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
    expect(window.history.length).toBe(entries);
    window.location.hash = "";
  });

  it("goes on with a lesson GetAccount names open, and home once api says it ended", async () => {
    const service = fakeSignIn("uid-1");
    const run = {
      lessonRunId: "r1",
      lesson: "example/with-lessons/lesson/gaps-and-posts",
      packageDigest: `sha256:${"1".repeat(64)}`,
    };
    const owner = { ...OWNER, openLessonRuns: [run] };
    const account = { accountId: "account-1", profiles: [owner] };
    const { asked } = renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        getLessonRun: () => refusal("failed_precondition", Cause.RUN_ENDED),
      },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(
      await screen.findByRole("heading", { level: 2, name: "A lesson in progress" }),
    ).toBeTruthy();
    // No state of the run on this device, and no manifest: the lesson by its module's ID.
    expect(
      await screen.findByRole("heading", { level: 3, name: "A lesson: example/with-lessons" }),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Continue the lesson" }));
    expect(window.location.hash).toBe("#/lesson");
    expect(
      await screen.findByRole("heading", { level: 1, name: "This lesson is over" }),
    ).toBeTruthy();
    expect(asked).toContain("GetLessonRun");
    await userEvent.click(screen.getByRole("button", { name: "Back to My subjects" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    // The run is over: nothing to go on with, after switching the learner and back too.
    expect(screen.queryByRole("button", { name: "Continue the lesson" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Switch learner" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue the lesson" })).toBeNull();
    window.location.hash = "";
  });

  it("goes to the lesson the engine chose from My subjects, and on to its next task", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    let next = ChoiceKind.LESSON;
    const { asked } = renderApp(
      {
        getAccount: () => message(GetAccountResponseSchema, { account }),
        chooseNext: () =>
          message(ChooseNextResponseSchema, {
            choice: { choiceId: next === ChoiceKind.LESSON ? "c1" : "c2", kind: next },
          }),
        openLesson: () => refusal("failed_precondition", Cause.RUN_ENDED),
        beginAttempt: () =>
          message(BeginAttemptResponseSchema, { attempt: { attemptId: "a5", packageDigest: "d" } }),
        getOpenAttempt: () => refusal("failed_precondition", Cause.ATTEMPT_CLOSED),
      },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    await userEvent.click(await screen.findByRole("button", { name: "What's next" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "This lesson is over" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/lesson");
    expect(asked).toContain("OpenLesson");
    // The end gave no choice: the press asks for one, and a task begins on the task screen.
    next = ChoiceKind.TASK;
    await userEvent.click(screen.getByRole("button", { name: "What's next" }));
    expect(
      await screen.findByRole("heading", { level: 1, name: "This task is already over" }),
    ).toBeTruthy();
    expect(window.location.hash).toBe("#/task");
    expect(asked).toContain("BeginAttempt");
    window.location.hash = "";
  });

  it("goes home from the lesson player when the learner chose no lesson", async () => {
    window.location.hash = "#/lesson";
    const entries = window.history.length;
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    expect(window.location.hash).toBe("#/home");
    expect(window.history.length).toBe(entries);
    window.location.hash = "";
  });

  it("names what the sign-out takes, comes back on Cancel, and erases on Sign out and erase", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign out?" })).toBeTruthy();
    expect(await screen.findByText("Ёжик: 1 unfinished task")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign out and erase" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeTruthy();
    expect(service.calls.signOut).toBe(1);
    expect(await readRegistry(device)).toBeUndefined();
  });

  it("does not open the next account on the sign-out screen when the account went some other way", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Sign out?" })).toBeTruthy();
    // Another tab signed out.
    service.set(null);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in with Google" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
  });

  it("erases nothing when the sign-out did not go through, and says so", async () => {
    const { device } = memoryDevice();
    const service = fakeSignIn("uid-1");
    service.signOut = async () => {
      throw new Error("no network");
    };
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }) },
      service,
      device,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Sign out" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign out and erase" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The sign-out didn't go through. Nothing was erased. Try again",
    );
    expect(screen.getByRole("button", { name: "Sign out and erase" })).toBeEnabled();
    expect((await readRegistry(device))?.account).toBe("account-1");
  });

  it("signs out from the choice too, saying there is nothing unfinished", async () => {
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    await screen.findByRole("heading", { level: 1, name: "Who is learning?" });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByText("No unfinished work is on this device")).toBeTruthy();
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

/** An open attempt of a module with steps, and its views: the task screen shows the mode. */
const ATTEMPT_ROUTES: Record<string, Route> = {
  getOpenAttempt: () =>
    message(GetOpenAttemptResponseSchema, {
      attempt: {
        start: {
          attemptId: "a1",
          task: {
            json: encode({
              id: "pick",
              statement: [{ text: "Pick one." }],
              canvas: { kind: "handwriting_sheet" },
              items: [{ answer_slots: [{ binding: "choice", options: ["4", "5"] }] }],
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

  it("opens from the choice and the bar, saves what changed, and the learner's screens take it", async () => {
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
            profile: { ...OWNER, defaultMode: Mode.SELF, interfaceLanguage: "ru" },
          });
        },
      },
      service,
    );

    // From the choice of the learner, in the device's language.
    await userEvent.click(await screen.findByRole("button", { name: "For grown-ups" }));
    expect(await screen.findByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
    expect(window.location.hash).toBe("#/adults");
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Profile: Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();
    expect(window.location.hash).toBe("#/adults/profile");
    expect(screen.getByRole("radio", { name: "Step by step" })).toBeChecked();
    await userEvent.click(screen.getByRole("radio", { name: "On my own" }));
    await userEvent.click(screen.getByRole("radio", { name: "Русский" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Saved")).toBeTruthy();
    // Only what changed goes.
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      profileId: "p1",
      settings: { defaultMode: Mode.SELF, interfaceLanguage: "ru" },
    });
    expect(updates[0]?.settings?.pseudonym).toBeUndefined();
    expect(updates[0]?.settings?.voicing).toBeUndefined();
    // The other tabs hear of it.
    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(profileOf(heard[0])).toMatchObject({ profileId: "p1", defaultMode: Mode.SELF });
    // The section stays in the device's language.
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");

    await userEvent.click(screen.getByRole("button", { name: "Back to the section" }));
    expect(await screen.findByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close the section" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Ёжик" }));
    // The learner's screens in the profile's language, the page's language with them.
    expect(await screen.findByRole("heading", { level: 1, name: "Мои предметы" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ru");
    // From the bar, back to the device's language.
    await userEvent.click(screen.getByRole("button", { name: "Для взрослых" }));
    expect(await screen.findByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
    await userEvent.click(screen.getByRole("button", { name: "Close the section" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Мои предметы" })).toBeTruthy();
    other.close();
  });

  it("takes what another tab saved, and the default mode comes to the attempt the task screen opens", async () => {
    const service = fakeSignIn("uid-1");
    const owner = { ...OWNER, openAttempt: { attemptId: "a1" } };
    const account = { accountId: "account-1", profiles: [owner] };
    const other = new BroadcastChannel(PROFILES_CHANNEL);
    renderApp(
      { getAccount: () => message(GetAccountResponseSchema, { account }), ...ATTEMPT_ROUTES },
      service,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ёжик" }));
    expect(await screen.findByRole("heading", { level: 1, name: "My subjects" })).toBeTruthy();
    // Something that is no profile changes nothing.
    other.postMessage("ru");
    other.postMessage(
      profileMessage(
        create(ProfileSchema, { ...OWNER, defaultMode: Mode.SELF, interfaceLanguage: "ru" }),
      ),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Мои предметы" })).toBeTruthy();
    // The open attempt GetAccount named stays: other settings make no other profile of it.
    await userEvent.click(screen.getByRole("button", { name: "Продолжить задачу" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Задача" })).toBeTruthy();
    const mode = screen.getByRole("group", { name: "Режим" });
    expect(within(mode).getByRole("button", { name: "Самостоятельно" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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
    await userEvent.click(await screen.findByRole("button", { name: "For grown-ups" }));
    await userEvent.click(await screen.findByRole("button", { name: "Profile: Белка" }));
    await userEvent.click(await screen.findByRole("radio", { name: "On my own" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(window.location.hash).toBe("#/adults"));
    expect(await screen.findByRole("button", { name: "Profile: Ёжик" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Profile: Белка" })).toBeNull();
    expect(asked).toBe(2);
  });

  it("goes to its first page from a profile's page with none chosen, and from a page it does not know", async () => {
    window.location.hash = "#/adults/profile";
    const service = fakeSignIn("uid-1");
    const account = { accountId: "account-1", profiles: [OWNER] };
    renderApp({ getAccount: () => message(GetAccountResponseSchema, { account }) }, service);
    expect(await screen.findByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
    expect(window.location.hash).toBe("#/adults");
    window.location.hash = "#/adults/nowhere";
    await vi.waitFor(() => expect(window.location.hash).toBe("#/adults"));
    expect(screen.getByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
  });
});
