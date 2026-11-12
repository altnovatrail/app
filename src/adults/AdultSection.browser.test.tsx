// The section for adults in Chromium (R29 in docs/decisions.md; section 3.10 of
// docs/architecture.md): its first page with the profiles and the device's language, a profile's
// page and its form — only what changed goes to UpdateProfile, nothing when nothing did, the
// pseudonym checked first, a failure said, the language the build does not have named — and what
// another tab saved meanwhile, with api on connect-es's router.
import {
  AccountService,
  Mode,
  type Profile,
  ProfileSchema,
  type UpdateProfileRequest,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import type { Route } from "../app/hash.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { AdultSection } from "./AdultSection.tsx";
import { ProfilePage } from "./ProfilePage.tsx";

type Init = MessageInitShape<typeof ProfileSchema>;

function profile(init: Init = {}): Profile {
  const defaults: Init = {
    profileId: "p1",
    owner: true,
    pseudonym: "Ёжик",
    ageCategory: "adult",
    defaultMode: Mode.BY_STEPS,
    presentationStyle: { voicing: { enabled: false, speed: VoicingSpeed.NORMAL } },
  };
  return create(ProfileSchema, { ...defaults, ...init } as Init);
}

/** api on the router: `UpdateProfile` answers by `answer`, the request recorded. */
function apiOf(answer: (request: UpdateProfileRequest) => Profile | Promise<Profile>) {
  const asked: UpdateProfileRequest[] = [];
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) =>
          router.service(AccountService, {
            async updateProfile(request) {
              asked.push(request);
              return { profile: await answer(request) };
            },
          }),
        { transport: { interceptors } },
      ),
  });
  return { api, asked };
}

function renderPage(
  shown: Profile,
  answer: (request: UpdateProfileRequest) => Profile | Promise<Profile>,
) {
  const { api, asked } = apiOf(answer);
  const saved: Profile[] = [];
  const failed: Failure[] = [];
  const page = (of: Profile) =>
    inLanguage(
      <ApiProvider value={api}>
        <ProfilePage
          profile={of}
          onSaved={(changed) => saved.push(changed)}
          onFailed={(failure) => failed.push(failure)}
        />
      </ApiProvider>,
    );
  const rendered = render(page(shown));
  return { asked, saved, failed, rerender: (of: Profile) => rendered.rerender(page(of)) };
}

/** The status of the profile's form, not of the storage of works below it. */
const saving = () => within(document.querySelector("form") as HTMLElement).getByRole("status");

afterEach(() => {
  window.location.hash = "";
});

describe("the section's first page", () => {
  it("names each profile, the owner's first, and opens its page; the bar leads back and out", async () => {
    window.location.hash = "#/adults";
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    const route: Route = { screen: "adults", parts: [] };
    const profiles = [
      profile({ profileId: "p2", owner: false, pseudonym: "Аня" }),
      profile(),
      profile({ profileId: "p3", owner: false, pseudonym: "Белка" }),
    ];
    const section = (shown: Route) =>
      inLanguage(
        <ApiProvider value={api}>
          <AdultSection
            route={shown}
            device={memoryDevice().device}
            profiles={profiles}
            onSaved={() => {}}
            onFailed={() => {}}
            onEraseAll={async () => "erased"}
          />
        </ApiProvider>,
      );
    const { rerender } = render(section(route));
    expect(screen.getByRole("heading", { level: 1, name: "For grown-ups" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back to the section" })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /^Profile: / }).map((button) => button.textContent),
    ).toEqual(["Profile: Ёжик", "Profile: Аня", "Profile: Белка"]);
    await userEvent.click(screen.getByRole("button", { name: "Profile: Аня" }));
    expect(window.location.hash).toBe("#/adults/profile");
    rerender(section({ screen: "adults", parts: ["profile"] }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Аня" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back to the section" }));
    expect(window.location.hash).toBe("#/adults");
    await userEvent.click(screen.getByRole("button", { name: "Close the section" }));
    expect(window.location.hash).toBe("#/home");
  });

  it("opens This device from the first page", async () => {
    window.location.hash = "#/adults";
    const section = (shown: Route) =>
      inLanguage(
        <AdultSection
          route={shown}
          device={memoryDevice().device}
          profiles={[profile()]}
          onSaved={() => {}}
          onFailed={() => {}}
          onEraseAll={async () => "erased"}
        />,
      );
    const { rerender } = render(section({ screen: "adults", parts: [] }));
    const open = screen.getByRole("button", { name: "See what is on this device" });
    expect(open).toHaveAccessibleDescription(
      "What the app keeps on this device, and how to erase it",
    );
    await userEvent.click(open);
    expect(window.location.hash).toBe("#/adults/device");
    rerender(section({ screen: "adults", parts: ["device"] }));
    expect(screen.getByRole("heading", { level: 1, name: "This device" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to the section" })).toBeTruthy();
    expect(await screen.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
  });
});

describe("a profile's page", () => {
  it("asks nothing when nothing changed, and says so", async () => {
    const { asked } = renderPage(profile(), () => profile());
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(saving().textContent).toBe("Nothing has changed");
    expect(asked).toEqual([]);
  });

  it("sends the pseudonym trimmed and the voicing changed, alone, and takes api's profile", async () => {
    const { asked, saved } = renderPage(profile(), () =>
      profile({
        pseudonym: "Ёж",
        presentationStyle: { voicing: { enabled: true, speed: VoicingSpeed.SLOW } },
      }),
    );
    const pseudonym = screen.getByRole("textbox", { name: "Pseudonym" });
    expect(pseudonym).toHaveAccessibleDescription("Not a real name, up to 30 characters");
    await userEvent.clear(pseudonym);
    await userEvent.type(pseudonym, "  Ёж ");
    await userEvent.click(screen.getByRole("checkbox", { name: "Read the tutor's words aloud" }));
    await userEvent.click(screen.getByRole("radio", { name: "Slow" }));
    // A choice taken back is no change.
    await userEvent.click(screen.getByRole("radio", { name: "On my own" }));
    await userEvent.click(screen.getByRole("radio", { name: "Step by step" }));
    await userEvent.click(screen.getByRole("radio", { name: "Normal" }));
    await userEvent.click(screen.getByRole("radio", { name: "Slow" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saving().textContent).toBe("Saved"));
    expect(asked).toHaveLength(1);
    expect(asked[0]?.settings).toMatchObject({
      pseudonym: "Ёж",
      voicing: { enabled: true, speed: VoicingSpeed.SLOW },
    });
    expect(asked[0]?.settings?.defaultMode).toBe(Mode.UNSPECIFIED);
    expect(asked[0]?.settings?.interfaceLanguage).toBeUndefined();
    expect(saved.map((each) => each.pseudonym)).toEqual(["Ёж"]);
  });

  it("checks the pseudonym before it asks, and puts the focus on it", async () => {
    const { asked } = renderPage(profile(), () => profile());
    const pseudonym = screen.getByRole("textbox", { name: "Pseudonym" });
    await userEvent.clear(pseudonym);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(pseudonym).toHaveAttribute("aria-invalid", "true");
    expect(pseudonym).toHaveAccessibleDescription(
      "Not a real name, up to 30 characters From 1 to 30 characters",
    );
    expect(document.activeElement).toBe(pseudonym);
    expect(asked).toEqual([]);
  });

  it("says what came of a request that did not go through, and keeps what was chosen", async () => {
    const { failed } = renderPage(profile(), () => {
      throw new ConnectError("refused", Code.FailedPrecondition, undefined, [
        { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.NO_PROFILE }) },
      ]);
    });
    await userEvent.click(screen.getByRole("radio", { name: "On my own" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This isn't there any more");
    expect(screen.getByRole("radio", { name: "On my own" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    // The session hears of it too.
    expect(failed).toMatchObject([{ kind: "refused", cause: Cause.NO_PROFILE }]);
  });

  it("keeps an edit made while the request was away, and lets go of those sent", async () => {
    let answered: (() => void) | undefined;
    const { rerender } = renderPage(profile(), async () => {
      await new Promise<void>((resolve) => {
        answered = resolve;
      });
      return profile({ defaultMode: Mode.SELF });
    });
    await userEvent.click(screen.getByRole("radio", { name: "On my own" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(answered).toBeDefined());
    await userEvent.click(screen.getByRole("radio", { name: "Slow" }));
    answered?.();
    await vi.waitFor(() => expect(saving().textContent).toBe("Saved"));
    // The page shows the profile it is given: the mode sent is its own now, the speed still an edit.
    rerender(profile({ defaultMode: Mode.BY_STEPS }));
    expect(screen.getByRole("radio", { name: "Step by step" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Slow" })).toBeChecked();
  });

  it("names the language the profile has when the build has none of it, and none when it has none", () => {
    const { rerender } = renderPage(profile({ interfaceLanguage: "de" }), () => profile());
    const group = () => screen.getByRole("group", { name: "Language of the learner's screens" });
    expect(group()).toHaveAccessibleDescription(
      "The profile's language is German, which this version of the app doesn't have. The learner's screens are in the language of the device",
    );
    expect(screen.getByRole("radio", { name: "English" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Русский" })).not.toBeChecked();
    // Each language by its own name, in its own language.
    expect(screen.getByText("Русский").closest("label")).toHaveAttribute("lang", "ru");
    rerender(profile());
    expect(group()).toHaveAccessibleDescription(
      "None is chosen: the learner's screens are in the language of the device",
    );
    // A tag Intl cannot read stands for itself.
    rerender(profile({ interfaceLanguage: "not a tag" }));
    expect(group()).toHaveAccessibleDescription(
      "The profile's language is not a tag, which this version of the app doesn't have. The learner's screens are in the language of the device",
    );
    // An empty field is none.
    rerender(profile({ interfaceLanguage: "" }));
    expect(group()).toHaveAccessibleDescription(
      "None is chosen: the learner's screens are in the language of the device",
    );
    rerender(profile({ interfaceLanguage: "ru-RU" }));
    expect(screen.getByRole("radio", { name: "Русский" })).toBeChecked();
    expect(group()).toHaveAccessibleDescription("");
  });

  it("shows what another tab saved in the fields not edited here, and keeps those edited", async () => {
    const { rerender } = renderPage(profile(), () => profile());
    await userEvent.click(screen.getByRole("radio", { name: "On my own" }));
    rerender(profile({ pseudonym: "Ёж", interfaceLanguage: "ru", defaultMode: Mode.BY_STEPS }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёж" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Pseudonym" })).toHaveValue("Ёж");
    expect(screen.getByRole("radio", { name: "Русский" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "On my own" })).toBeChecked();
  });

  it("says that the voicing is kept for later, and to turn it off beside a screen reader", () => {
    renderPage(profile(), () => profile());
    expect(screen.getByRole("group", { name: "Voicing" })).toHaveAccessibleDescription(
      "This version of the app doesn't read aloud yet. The setting is kept for when it does If you listen to a screen reader, turn voicing off: the two would speak at once",
    );
    expect(screen.getByRole("group", { name: "Default mode" })).toHaveAccessibleDescription(
      "Each task begins in it. The learner can switch it on the task screen",
    );
  });
});
