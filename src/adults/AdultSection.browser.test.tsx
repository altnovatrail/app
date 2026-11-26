// Settings, the section for adults, in the browser: its list with the profiles, the owner's first,
// each by its avatar, and the rows of the device, the language and the legal pages, the list beside
// a page from 600 CSS px and a first page of its own below, the bar of each page, a profile's page
// and its form — the avatar changed by its pop-over, the mode and the language chosen in a pop-over,
// only what changed goes to UpdateProfile, nothing when nothing did, the pseudonym checked first, a
// failure said, the language the build does not have named —, what another tab saved meanwhile,
// and the next versions of the legal texts under the list, with api on connect-es's router.
import {
  AccountService,
  HintMode,
  Mode,
  type Profile,
  ProfileSchema,
  type UpdateProfileRequest,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  LegalService,
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import type { Route } from "../app/hash.ts";
import { NextVersions } from "../legal/NextVersions.tsx";
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
          device={memoryDevice().device}
          profile={of}
          onSaved={(changed) => saved.push(changed)}
          onFailed={(failure) => failed.push(failure)}
        />
      </ApiProvider>,
    );
  const rendered = render(page(shown));
  return { asked, saved, failed, rerender: (of: Profile) => rendered.rerender(page(of)) };
}

/** Chooses one of a row's choices in its pop-over, which the choice closes. */
async function choose(row: string, option: string) {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${row}`) }));
  await userEvent.click(
    within(screen.getByRole("dialog", { name: row })).getByRole("radio", { name: option }),
  );
  expect(screen.queryByRole("dialog")).toBeNull();
}

/** The status of the profile's form, not of the storage of works below it. */
const saving = () => within(document.querySelector("form") as HTMLElement).getByRole("status");

// The tablet's width, where the list stands beside the page; the runner's own after.
beforeEach(() => page.viewport(1194, 834));
afterEach(async () => {
  window.location.hash = "";
  await page.viewport(414, 896);
});

describe("the section's first page", () => {
  it("leads to the page Own AI key at an owner profile of an adult, and has none without one", async () => {
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    const section = (shown: Route, profiles: readonly Profile[], onOpenOwner?: () => void) =>
      inLanguage(
        <ApiProvider value={api}>
          <AdultSection
            route={shown}
            device={memoryDevice().device}
            profiles={profiles}
            onSaved={() => {}}
            onFailed={() => {}}
            onEraseAll={async () => "erased"}
            onLegal={() => {}}
            {...(onOpenOwner === undefined ? {} : { onOpenOwner })}
          />
        </ApiProvider>,
      );
    const { rerender } = render(section({ screen: "adults", parts: [] }, [profile()]));
    await userEvent.click(screen.getByRole("button", { name: "Own AI key" }));
    expect(window.location.hash).toBe("#/adults/own-key");
    // No learner is chosen outside the gate: the page opens the owner profile.
    const onOpenOwner = vi.fn();
    rerender(section({ screen: "adults", parts: ["own-key"] }, [profile()], onOpenOwner));
    expect(screen.getByRole("heading", { level: 1, name: "Own AI key" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Open my profile" }));
    expect(onOpenOwner).toHaveBeenCalledOnce();
    rerender(section({ screen: "adults", parts: [] }, [profile({ ageCategory: "under_13" })]));
    expect(screen.queryByRole("button", { name: "Own AI key" })).toBeNull();
  });

  it("names each profile, the owner's first, and opens its page beside the list; the list closes", async () => {
    window.location.hash = "#/adults";
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    const route: Route = { screen: "adults", parts: [] };
    const profiles = [
      profile({ profileId: "p2", owner: false, pseudonym: "Аня", avatar: "moon" }),
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
            onLegal={() => {}}
          />
        </ApiProvider>,
      );
    const { rerender } = render(section(route));
    // From 600 CSS px the list stands beside the owner's page, and no bar leads back.
    const list = screen.getByRole("navigation", { name: "Settings" });
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();
    expect(document.querySelector(".nt-set-back")).toBeNull();
    // Each a row of its avatar, its pseudonym and whose it is, named by what it shows.
    const rows = within(list).getAllByRole("button", { name: / (Your profile|Learner)$/ });
    expect(rows.map((row) => row.textContent)).toEqual([
      "Ёжик Your profile",
      "Аня Learner",
      "Белка Learner",
    ]);
    expect(rows[0]).toHaveAttribute("aria-current", "page");
    expect(
      rows.map((row) => row.querySelector("[data-avatar]")?.getAttribute("data-avatar")),
    ).toEqual(["peak", "moon", "peak"]);
    expect(within(list).getByRole("button", { name: "Language English" })).toBeTruthy();
    await userEvent.click(rows[1] as HTMLElement);
    expect(window.location.hash).toBe("#/adults/profile");
    rerender(section({ screen: "adults", parts: ["profile"] }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Аня" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Аня / })).toHaveAttribute("aria-current", "page");
    expect(document.querySelector(".nt-avatar-profile")?.getAttribute("data-avatar")).toBe("moon");
    await userEvent.click(screen.getByRole("button", { name: "Close the settings" }));
    expect(window.location.hash).toBe("#/home");
  });

  it("below 600 CSS px is a first page of its own, and each other page leads back to it", async () => {
    await page.viewport(390, 844);
    window.location.hash = "#/adults";
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    const section = (shown: Route) =>
      inLanguage(
        <ApiProvider value={api}>
          <AdultSection
            route={shown}
            device={memoryDevice().device}
            profiles={[profile()]}
            onSaved={() => {}}
            onFailed={() => {}}
            onEraseAll={async () => "erased"}
            onLegal={() => {}}
          />
        </ApiProvider>,
      );
    const { rerender } = render(section({ screen: "adults", parts: [] }));
    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Settings" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /^Ёжик / }));
    rerender(section({ screen: "adults", parts: ["profile"] }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёжик" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Language English" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Back to Settings" }));
    expect(window.location.hash).toBe("#/adults");
  });

  it("opens This device from the first page", async () => {
    window.location.hash = "#/adults";
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    const section = (shown: Route) =>
      inLanguage(
        <ApiProvider value={api}>
          <AdultSection
            route={shown}
            device={memoryDevice().device}
            profiles={[profile()]}
            onSaved={() => {}}
            onFailed={() => {}}
            onEraseAll={async () => "erased"}
            onLegal={() => {}}
          />
        </ApiProvider>,
      );
    const { rerender } = render(section({ screen: "adults", parts: [] }));
    await userEvent.click(screen.getByRole("button", { name: "This device" }));
    expect(window.location.hash).toBe("#/adults/device");
    rerender(section({ screen: "adults", parts: ["device"] }));
    expect(screen.getByRole("heading", { level: 1, name: "This device" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "This device" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await screen.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
  });

  it("has no notice of the next versions of the texts in its list", async () => {
    const { api } = apiOf((request) => profile({ profileId: request.profileId }));
    render(
      inLanguage(
        <ApiProvider value={api}>
          <AdultSection
            route={{ screen: "adults", parts: [] }}
            device={memoryDevice().device}
            profiles={[profile()]}
            onSaved={() => {}}
            onFailed={() => {}}
            onEraseAll={async () => "erased"}
            onLegal={() => {}}
          />
        </ApiProvider>,
      ),
    );
    expect(await screen.findByRole("button", { name: "Privacy" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New versions of the texts" })).toBeNull();
  });

  it("the notice of next versions tells of them, and that a profile's storage can be switched off first", async () => {
    const next = create(LegalTextSchema, {
      id: "privacy-policy",
      version: 3,
      inForceSince: "2026-11-27",
      body: "# Privacy policy\n\nText.\n",
      summary: "In short.",
      summaryLanguage: "en",
    });
    const opened: (Route | undefined)[] = [];
    let reads = 0;
    const first = (profiles: Profile[], nextTexts: LegalText[] | Error) => {
      const api = createApi({
        baseUrl: "https://api.example.org",
        tokens: { token: async () => "t", signOut: async () => {} },
        on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
        sleep: async () => {},
        transport: (interceptors) =>
          createRouterTransport(
            (router: ConnectRouter) =>
              router.service(LegalService, {
                getLegalTexts() {
                  reads += 1;
                  if (nextTexts instanceof Error) throw nextTexts;
                  return { texts: [], nextTexts };
                },
              }),
            { transport: { interceptors } },
          ),
      });
      return render(
        inLanguage(
          <ApiProvider value={api}>
            <NextVersions
              storing={profiles.some((each) => each.workStorage)}
              onRead={(page) => opened.push(page)}
            />
          </ApiProvider>,
        ),
      );
    };
    first([profile(), profile({ profileId: "p2", owner: false, workStorage: true })], [next]);
    expect(
      await screen.findByRole("heading", { level: 2, name: "New versions of the texts" }),
    ).toBeTruthy();
    const read = screen.getByRole("button", { name: "Read Privacy Policy, version 3" });
    expect(read).toHaveAccessibleDescription(
      "Privacy Policy: version 3 applies from November 27, 2026",
    );
    expect(screen.getByText(/Keeping works on the server is on for a profile/)).toBeTruthy();
    await userEvent.click(read);
    expect(opened).toEqual([{ screen: "legal", parts: ["privacy-policy", "next"] }]);
    document.body.innerHTML = "";
    // No profile keeps its works on the server: nothing to switch off. Two texts whose next
    // versions have one number, each in the order of the pages, each button named by its text.
    first([profile()], [{ ...next, id: "terms-of-use" }, next]);
    expect(
      await screen.findByRole("button", { name: "Read Privacy Policy, version 3" }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: /, version 3$/ }).map((each) => each.textContent),
    ).toEqual(["Read Privacy Policy, version 3", "Read Terms of Use, version 3"]);
    expect(screen.queryByText(/Keeping works on the server is on/)).toBeNull();
    document.body.innerHTML = "";
    // No next version, or a read that failed: no part at all, and no Try again.
    for (const none of [[], new ConnectError("broken", Code.Internal)]) {
      const before = reads;
      first([profile({ workStorage: true })], none);
      await vi.waitFor(() => expect(reads).toBeGreaterThan(before));
      // The answer, or the failure, has come to the page.
      await new Promise((settled) => setTimeout(settled, 50));
      expect(screen.queryByRole("heading", { name: "New versions of the texts" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
      document.body.innerHTML = "";
    }
  });
});

describe("a profile's page", () => {
  it("asks nothing when nothing changed, and says so", async () => {
    const { asked } = renderPage(profile(), () => profile());
    // Save waits for a change, shown so, and pressed still it says why it sends nothing.
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(save, { force: true });
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
    await userEvent.click(screen.getByRole("switch", { name: "Read the tutor's words aloud" }));
    await userEvent.click(screen.getByRole("radio", { name: "Slow" }));
    // A choice taken back is no change.
    await choose("Default mode", "On my own");
    await choose("Default mode", "Step by step");
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
    expect(asked[0]?.settings?.avatar).toBeUndefined();
    expect(saved.map((each) => each.pseudonym)).toEqual(["Ёж"]);
  });

  it("sends the hint mode chosen, Show where at first, a choice taken back no change", async () => {
    const { asked } = renderPage(profile(), (request) =>
      profile({ hintMode: request.settings?.hintMode ?? HintMode.UNSPECIFIED }),
    );
    const hints = within(screen.getByRole("group", { name: "Hints" }));
    expect(hints.getByRole("radio", { name: "Show where" })).toBeChecked();
    await userEvent.click(hints.getByRole("radio", { name: "Questions only" }));
    await userEvent.click(hints.getByRole("radio", { name: "Show where" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }), { force: true });
    expect(saving().textContent).toBe("Nothing has changed");
    await userEvent.click(hints.getByRole("radio", { name: "Questions only" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saving().textContent).toBe("Saved"));
    expect(asked.map((each) => each.settings?.hintMode)).toEqual([HintMode.QUESTIONS_ONLY]);
    expect(asked[0]?.settings?.pseudonym).toBeUndefined();
  });

  it("changes the avatar by its pop-over, and sends it alone on Save", async () => {
    const { asked } = renderPage(profile(), (request) =>
      profile({ avatar: request.settings?.avatar ?? "" }),
    );
    const avatar = () => document.querySelector(".nt-avatar-profile")?.getAttribute("data-avatar");
    // None chosen: the set's own, and the button that chooses one.
    expect(avatar()).toBe("peak");
    await userEvent.click(screen.getByRole("button", { name: "Choose an avatar" }));
    await userEvent.click(screen.getByRole("button", { name: "Leaf" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(avatar()).toBe("leaf");
    expect(asked).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Change the avatar" }));
    expect(screen.getByRole("button", { name: "Leaf", pressed: true })).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(saving().textContent).toBe("Saved"));
    expect(asked.map((request) => request.settings?.avatar)).toEqual(["leaf"]);
    expect(asked[0]?.settings?.pseudonym).toBeUndefined();
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
    await choose("Default mode", "On my own");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This isn't there any more");
    expect(screen.getByRole("button", { name: "Default mode On my own" })).toBeTruthy();
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
    await choose("Default mode", "On my own");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await vi.waitFor(() => expect(answered).toBeDefined());
    await userEvent.click(screen.getByRole("radio", { name: "Slow" }));
    answered?.();
    await vi.waitFor(() => expect(saving().textContent).toBe("Saved"));
    // The page shows the profile it is given: the mode sent is its own now, the speed still an edit.
    rerender(profile({ defaultMode: Mode.BY_STEPS }));
    expect(screen.getByRole("button", { name: "Default mode Step by step" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Slow" })).toBeChecked();
  });

  it("shows what another tab saved in the fields not edited here, and keeps those edited", async () => {
    const { rerender } = renderPage(profile(), () => profile());
    await choose("Default mode", "On my own");
    rerender(profile({ pseudonym: "Ёж", interfaceLanguage: "ru", defaultMode: Mode.BY_STEPS }));
    expect(screen.getByRole("heading", { level: 1, name: "Profile: Ёж" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Pseudonym" })).toHaveValue("Ёж");
    expect(screen.getByRole("button", { name: "Default mode On my own" })).toBeTruthy();
  });

  it("says that the voice is the device's, and to turn the voicing off beside a screen reader", () => {
    renderPage(profile(), () => profile());
    expect(
      screen.getByRole("switch", { name: "Read the tutor's words aloud" }),
    ).toHaveAccessibleDescription(
      "The tutor's words are read by a voice of the device. Each device's voice is chosen on its page This device If you listen to a screen reader, turn voicing off: the two would speak at once",
    );
    expect(
      screen.getByRole("button", { name: "Default mode Step by step" }),
    ).toHaveAccessibleDescription(
      "Each task begins in it. The learner can switch it on the task screen",
    );
  });
});
