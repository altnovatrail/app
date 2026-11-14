// The storage of works on the server on a profile's page, in the browser (R30 in docs/decisions.md;
// R113, R127 and R131 in spec), with api on connect-es's router: off by default, the words that the
// server keeps no work yet, the consent with the text storage-consent and what R127 in spec has it
// say, the version shown named by SetWorkStorage, a version no longer current read and agreed to
// again, no text in force, switching off at once with no question, and the failures said.
import {
  AccountService,
  type Profile,
  ProfileSchema,
  type SetWorkStorageRequest,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  LegalService,
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { act, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Failure } from "../api/failure.ts";
import { inLanguage } from "../test/language.tsx";
import { WorkStorage } from "./WorkStorage.tsx";

const OWNER = create(ProfileSchema, { profileId: "p1", owner: true, pseudonym: "Ёжик" });

function consent(version: number): LegalText {
  return create(LegalTextSchema, {
    id: "storage-consent",
    version,
    body: `# Keeping works on our server\n\nVersion ${version}.\n`,
    summary: `Works kept, version ${version}.`,
    summaryLanguage: "en",
  });
}

function refused(cause: Cause, code = Code.FailedPrecondition): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

interface Routes {
  /** The texts in force at each reading; no LegalService at all when left out. */
  readonly texts?: (reading: number) => LegalText[];
  /** The answer to SetWorkStorage: by default, the profile with the storage as asked. */
  readonly set?: (request: SetWorkStorageRequest, asked: number) => Profile | Promise<Profile>;
}

/** The section, the profile it shows as api's answers make it, as the session would. */
function Harness({
  shown,
  saved,
  failed,
  elsewhere,
}: {
  readonly shown: Profile;
  readonly saved: Profile[];
  readonly failed: Failure[];
  /** Where a test puts the profile another tab saved. */
  readonly elsewhere: { change?: (profile: Profile) => void };
}) {
  const [profile, setProfile] = useState(shown);
  elsewhere.change = setProfile;
  return (
    <WorkStorage
      profile={profile}
      onSaved={(changed) => {
        saved.push(changed);
        setProfile(changed);
      }}
      onFailed={(failure) => failed.push(failure)}
    />
  );
}

/** The section on its own, with api on the router. */
function renderSection(shown: Profile, routes: Routes = {}) {
  const asked: SetWorkStorageRequest[] = [];
  const read: string[] = [];
  const saved: Profile[] = [];
  const failed: Failure[] = [];
  const elsewhere: { change?: (profile: Profile) => void } = {};
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          router.service(AccountService, {
            async setWorkStorage(request) {
              asked.push(request);
              const profile =
                (await routes.set?.(request, asked.length)) ??
                create(ProfileSchema, { ...shown, workStorage: request.enabled });
              return { profile };
            },
          });
          const { texts } = routes;
          if (texts !== undefined) {
            router.service(LegalService, {
              getLegalTexts(request) {
                read.push(request.interfaceLanguage);
                return { texts: texts(read.length) };
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
        <Harness shown={shown} saved={saved} failed={failed} elsewhere={elsewhere} />
      </ApiProvider>,
    ),
  );
  return { asked, read, saved, failed, elsewhere };
}

const OFF = "Keeping this profile's works on the server is off";
const ON = "Keeping this profile's works on the server is on";
const NOT_YET =
  "The server doesn't keep works yet: switching this on records the consent, and the works stay on this device alone";
const AGREE =
  "I give my explicit consent to keeping this profile's works on the server, with what they tell about health";
const WHAT = "A work may tell something personal, about health and family too. Nobody reads it";

describe("the storage of works on the server", () => {
  it("is off, says the server keeps no work yet, and switches on by the consent to the version shown", async () => {
    const { asked, read, saved } = renderSection(OWNER, {
      texts: () => [consent(1)],
    });
    expect(
      screen.getByRole("heading", { level: 2, name: "Keeping works on the server" }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(OFF);
    expect(screen.getByText(NOT_YET)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    // The consent takes the place of the button, and the focus.
    const heading = screen.getByRole("heading", {
      level: 3,
      name: "Consent to keeping works on the server",
    });
    expect(document.activeElement).toBe(heading);
    expect(screen.queryByRole("button", { name: "Keep works on the server" })).toBeNull();
    // The text in force, in place, read in the language of the section.
    expect(await screen.findByText("Works kept, version 1.")).toBeTruthy();
    expect(document.querySelector("details summary")?.textContent).toBe(
      "Keeping works on our server",
    );
    expect(read).toEqual(["en"]);
    const agree = screen.getByRole("checkbox", { name: AGREE });
    expect(agree).toHaveAccessibleDescription(WHAT);
    // Not ticked: nothing goes, and the focus comes to the checkbox.
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    expect(asked).toEqual([]);
    expect(agree).toHaveAttribute("aria-invalid", "true");
    expect(agree).toHaveAccessibleDescription(`${WHAT} To switch it on, tick the consent`);
    expect(document.activeElement).toBe(agree);
    await userEvent.click(agree);
    // Ticked, it lacks nothing any more.
    expect(agree).toHaveAttribute("aria-invalid", "false");
    expect(agree).toHaveAccessibleDescription(WHAT);
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(ON));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({
      profileId: "p1",
      action: Action.ADULT,
      enabled: true,
      text: { id: "storage-consent", version: 1 },
    });
    expect(saved.map((each) => each.workStorage)).toEqual([true]);
    // Switched on, it still promises no copy, and the focus is on the button now in place.
    expect(screen.getByText(NOT_YET)).toBeTruthy();
    const off = screen.getByRole("button", { name: "Stop keeping works on the server" });
    await vi.waitFor(() => expect(document.activeElement).toBe(off));
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("reads the text again when api has a newer version, and asks the consent to it again", async () => {
    const { asked, read } = renderSection(OWNER, {
      texts: (reading) => [consent(reading === 1 ? 1 : 2)],
      set: (request, n) => {
        if (n === 1) throw refused(Cause.TEXT_NOT_CURRENT, Code.InvalidArgument);
        return create(ProfileSchema, { ...OWNER, workStorage: request.enabled });
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    const agree = await screen.findByRole("checkbox", { name: AGREE });
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch it on" })).toBeEnabled(),
    );
    await userEvent.click(agree);
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    expect(await screen.findByText("Works kept, version 2.")).toBeTruthy();
    expect(read).toHaveLength(2);
    // The new version shown is not agreed to yet.
    expect(agree).not.toBeChecked();
    expect(agree).toHaveAccessibleDescription(
      `${WHAT} The text of the consent has changed. Read it again and tick the consent`,
    );
    expect(document.activeElement).toBe(agree);
    expect(screen.getByRole("status").textContent).toBe(OFF);
    await userEvent.click(agree);
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(ON));
    expect(asked.map((request) => request.text?.version)).toEqual([1, 2]);
  });

  it("keeps the focus on Switch it on while the request is away, and asks once", async () => {
    let answer: (() => void) | undefined;
    const { asked } = renderSection(OWNER, {
      texts: () => [consent(1)],
      set: async (request) => {
        await new Promise<void>((resolve) => {
          answer = resolve;
        });
        return create(ProfileSchema, { ...OWNER, workStorage: request.enabled });
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: AGREE }));
    const on = screen.getByRole("button", { name: "Switch it on" });
    await vi.waitFor(() => expect(on).toBeEnabled());
    await userEvent.click(on);
    await vi.waitFor(() => expect(answer).toBeDefined());
    expect(on).toHaveAttribute("aria-disabled", "true");
    expect(document.activeElement).toBe(on);
    // Pressed again on the keyboard, it asks nothing more.
    await userEvent.keyboard("{Enter}");
    expect(asked).toHaveLength(1);
    answer?.();
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(ON));
  });

  it("closes the consent open here when another tab switched the storage on, for good", async () => {
    const { elsewhere, read } = renderSection(OWNER, { texts: () => [consent(1)] });
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    expect(await screen.findByRole("checkbox", { name: AGREE })).toBeTruthy();
    act(() => elsewhere.change?.(create(ProfileSchema, { ...OWNER, workStorage: true })));
    expect(screen.getByRole("status").textContent).toBe(ON);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const off = screen.getByRole("button", { name: "Stop keeping works on the server" });
    await vi.waitFor(() => expect(document.activeElement).toBe(off));
    // Off again, the consent does not come back by itself.
    act(() => elsewhere.change?.(OWNER));
    expect(screen.getByRole("status").textContent).toBe(OFF);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Keep works on the server" })).toBeTruthy();
    expect(read).toHaveLength(1);
  });

  it("asks the consent with no text when none is in force, and names none", async () => {
    // An api with no LegalService has no text in force.
    const { asked } = renderSection(OWNER);
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch it on" })).toBeEnabled(),
    );
    expect(screen.queryByRole("group")).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: AGREE }));
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(ON));
    expect(asked).toHaveLength(1);
    expect(asked[0]?.text).toBeUndefined();
    expect(asked[0]?.enabled).toBe(true);
  });

  it("switches off at once, with no question and no text, and says the copies on the server go", async () => {
    const { asked, saved } = renderSection(create(ProfileSchema, { ...OWNER, workStorage: true }));
    expect(screen.getByRole("status").textContent).toBe(ON);
    const off = screen.getByRole("button", { name: "Stop keeping works on the server" });
    expect(off).toHaveAccessibleDescription(
      "It stops at once, and any copies of this profile's works on the server are erased. The works on this device stay",
    );
    await userEvent.click(off);
    await vi.waitFor(() => expect(screen.getByRole("status").textContent).toBe(OFF));
    expect(asked).toHaveLength(1);
    expect(asked[0]).toMatchObject({ profileId: "p1", action: Action.ADULT, enabled: false });
    expect(asked[0]?.text).toBeUndefined();
    expect(saved.map((each) => each.workStorage)).toEqual([false]);
    expect(screen.queryByRole("checkbox")).toBeNull();
    const on = screen.getByRole("button", { name: "Keep works on the server" });
    await vi.waitFor(() => expect(document.activeElement).toBe(on));
  });

  it("says what came of a switch that did not go through, and tells the session", async () => {
    const { failed } = renderSection(create(ProfileSchema, { ...OWNER, workStorage: true }), {
      set: () => {
        throw refused(Cause.NO_PROFILE);
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Stop keeping works on the server" }));
    expect((await screen.findByRole("alert")).textContent).toBe("This isn't there any more");
    expect(screen.getByRole("status").textContent).toBe(ON);
    expect(failed).toMatchObject([{ kind: "refused", cause: Cause.NO_PROFILE }]);
  });

  it("says a refusal of the consent and keeps it open; Cancel gives the focus back to the button", async () => {
    const { failed } = renderSection(OWNER, {
      texts: () => [consent(1)],
      set: () => {
        throw refused(Cause.LEARNER_DECIDES, Code.PermissionDenied);
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: AGREE }));
    await vi.waitFor(() =>
      expect(screen.getByRole("button", { name: "Switch it on" })).toBeEnabled(),
    );
    await userEvent.click(screen.getByRole("button", { name: "Switch it on" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The learner decides this themselves",
    );
    expect(failed).toMatchObject([{ kind: "refused", cause: Cause.LEARNER_DECIDES }]);
    expect(screen.getByRole("checkbox", { name: AGREE })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const keep = screen.getByRole("button", { name: "Keep works on the server" });
    await vi.waitFor(() => expect(document.activeElement).toBe(keep));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says that the text could not be read, holds the switch, and reads it again", async () => {
    let down = true;
    const { asked } = renderSection(OWNER, {
      texts: () => {
        if (down) throw new ConnectError("down", Code.Unavailable);
        return [consent(1)];
      },
    });
    await userEvent.click(screen.getByRole("button", { name: "Keep works on the server" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No connection");
    expect(screen.getByRole("button", { name: "Switch it on" })).toBeDisabled();
    down = false;
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Works kept, version 1.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(asked).toEqual([]);
  });
});
