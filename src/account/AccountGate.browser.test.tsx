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
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { CheckPackagesResponseSchema } from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import {
  create,
  type DescMessage,
  fromBinary,
  type MessageInitShape,
  toBinary,
} from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { App } from "../app/App.tsx";
import { Boot } from "../boot/Boot.tsx";
import { addProfile } from "../storage/profile.ts";
import { readRegistry } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { type FakeSignIn, fakeSignIn } from "../test/signin.ts";
import { AccountGate } from "./AccountGate.tsx";

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
) {
  const asked: string[] = [];
  const apiFetch = vi.fn<typeof fetch>(async (input, init) => {
    const method = String(input).split("/").at(-1) ?? "";
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
      languages={["en"]}
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
    const created: { country: string; pseudonym: string | undefined }[] = [];
    const { asked } = renderApp(
      {
        getAccount: () =>
          profiles === undefined
            ? refusal("permission_denied", Cause.NO_ACCESS)
            : message(GetAccountResponseSchema, { account: profiles }),
        createAccount: (body) => {
          const request = fromBinary(CreateAccountRequestSchema, body);
          codes.push(request.inviteCode);
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
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await vi.waitFor(() =>
      expect(code).toHaveAccessibleDescription("This code isn't valid or has been used"),
    );
    await userEvent.clear(code);
    await userEvent.type(code, " 0123-4567-89AB-CDEF ");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(codes).toEqual(["WRONG", "0123-4567-89AB-CDEF"]);

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
    expect(await screen.findByRole("heading", { level: 1, name: "NovaTrail" })).toBeTruthy();
    expect(screen.getByRole("banner").textContent).toContain("Ёжик");
    await userEvent.click(screen.getByRole("button", { name: "Switch learner" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Who is learning?" })).toBeTruthy();
    expect(screen.queryByText("Learners' work is kept on this device")).toBeNull();
    // Each request of the way in, and no other: CheckPackages has no package to ask about.
    expect(asked).toEqual([
      "GetAccount",
      "CreateAccount",
      "CreateAccount",
      "CreateOwnerProfile",
      "CreateOwnerProfile",
      "GetAccount",
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
    expect(await screen.findByRole("heading", { level: 1, name: "NovaTrail" })).toBeTruthy();

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
