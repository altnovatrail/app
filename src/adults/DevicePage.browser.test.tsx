// The page This device in the browser (R04 with its 2026-11-12 amendment; section 3.2 of
// docs/architecture.md): what each profile keeps here and about how much, the profile with nothing
// here and the one that cannot be read, the warning of loss on every profile while api keeps no
// copy (R113 in spec), with the storage on the server switched on too (R30), the browser's
// estimate, persistent storage asked for and refused, Safari's seven days, and both erasures, each
// asked first, with the focus where it belongs.
import {
  type Profile,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { SiteStorage } from "../storage/browser.ts";
import { addProfile } from "../storage/profile.ts";
import { readRegistry, setAccount } from "../storage/registry.ts";
import { profileDatabase } from "../storage/schema.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { DevicePage } from "./DevicePage.tsx";

const OWNER = create(ProfileSchema, { profileId: "p1", owner: true, pseudonym: "Ёжик" });
const OTHER = create(ProfileSchema, { profileId: "p2", owner: false, pseudonym: "Аня" });

function site(init: Partial<SiteStorage> = {}): SiteStorage {
  return {
    estimate: async () => ({ usage: 1_500_000, quota: 120_000_000_000 }),
    persisted: async () => false,
    persist: async () => false,
    ...init,
  };
}

/** A device where the owner has an unfinished attempt with a submission, and the other nothing. */
async function deviceWithWork() {
  const setup = memoryDevice();
  await setAccount(setup.device, "account-1");
  const profile = await addProfile(setup.device, "p1");
  await profile?.beginAttempt({ attemptId: "a1", digest: "d1" });
  await profile?.addSubmission(
    "a1",
    {
      cells: [{ item: 1, slot: 1, png: new Blob([new Uint8Array(20_000)], { type: "image/png" }) }],
      submission: { boxes: [{ item: 1, slot: 1, ids: [1] }], digest: "0123456789abcdef" },
    },
    0,
  );
  return setup;
}

function renderPage(
  device: ReturnType<typeof memoryDevice>["device"],
  {
    profiles = [OTHER, OWNER],
    storage = site(),
    onEraseAll = async () => "erased" as const,
  }: {
    profiles?: readonly Profile[];
    storage?: SiteStorage;
    onEraseAll?: () => Promise<"erased" | "left" | "failed">;
  } = {},
) {
  return render(
    inLanguage(
      <DevicePage device={device} profiles={profiles} onEraseAll={onEraseAll} site={storage} />,
    ),
  );
}

const section = (name: string) => screen.getByRole("region", { name });

describe("the page This device", () => {
  it("names what each profile keeps here, the owner's first, and warns of its loss on each", async () => {
    const { device } = await deviceWithWork();
    // The storage on the server switched on is no copy there: api keeps none yet (R30).
    renderPage(device, { profiles: [OTHER, { ...OWNER, workStorage: true }] });
    expect(screen.getByRole("heading", { level: 1, name: "This device" })).toBeTruthy();
    expect(await screen.findByText("1 unfinished task")).toBeTruthy();
    expect(
      screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent),
    ).toEqual(["Profile: Ёжик", "Profile: Аня"]);
    const owner = within(section("Profile: Ёжик"));
    expect(owner.getByText(/^Its data here takes about 2\d(\.\d)? kB$/)).toBeTruthy();
    const other = within(section("Profile: Аня"));
    expect(other.getByText("Nothing of this profile is kept on this device")).toBeTruthy();
    expect(other.queryByRole("button")).toBeNull();
    for (const name of ["Profile: Ёжик", "Profile: Аня"]) {
      expect(
        within(section(name)).getByText(
          "Its work is on this device alone: if the site's data is erased, the work is lost",
        ),
      ).toBeTruthy();
    }
    expect(
      screen.getByText(
        "The app takes about 1.5 MB here, of the 120 GB the browser gives it. This is the browser's estimate for the whole site",
      ),
    ).toBeTruthy();
    expect(screen.getByText(/Safari erases it after seven days of use/)).toBeTruthy();
    expect(screen.getByText(/added to the Home Screen/)).toBeTruthy();
  });

  it("counts the work of a profile whose records cannot be read, and says the rest is unread", async () => {
    const { device, backend } = await deviceWithWork();
    backend.unreadable.add("submissions");
    renderPage(device, { profiles: [OWNER] });
    const owner = within(section("Profile: Ёжик"));
    expect(await owner.findByText("1 unfinished task")).toBeTruthy();
    expect(owner.getByText("The data of this profile on this device can't be read")).toBeTruthy();
    expect(owner.queryByText(/takes about/)).toBeNull();
  });

  it("says that a profile's data cannot be read, and still erases it", async () => {
    const { device, backend } = await deviceWithWork();
    backend.unreadable.add("attempts");
    renderPage(device, { profiles: [OWNER] });
    expect(
      await screen.findByText("The data of this profile on this device can't be read"),
    ).toBeTruthy();
    backend.unreadable.clear();
    await userEvent.click(
      screen.getByRole("button", { name: "Erase the profile's data on this device" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect(await screen.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
  });

  it("says nothing of keeping the data when the browser has nothing to tell", async () => {
    const { device } = memoryDevice();
    renderPage(device, { profiles: [OWNER], storage: site({ persisted: async () => undefined }) });
    expect(await screen.findByRole("heading", { name: "Space" })).toBeTruthy();
    expect(screen.queryByText(/agreed to keep/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask the browser to keep it" })).toBeNull();
  });

  it("leaves out the estimate the browser does not give, and the button once it keeps the data", async () => {
    const { device } = memoryDevice();
    renderPage(device, {
      profiles: [OWNER],
      storage: site({ estimate: async () => undefined, persisted: async () => true }),
    });
    expect(await screen.findByText("The browser has agreed to keep the site's data")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Space" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ask the browser to keep it" })).toBeNull();
  });

  it.each([
    [true, "The browser has agreed to keep the site's data"],
    [false, "The browser didn't agree. The data is kept, but the browser may erase it"],
  ])(
    "asks the browser to keep the data on a press, and says what it said (%s)",
    async (yes, said) => {
      const { device } = memoryDevice();
      const persist = vi.fn(async () => yes);
      renderPage(device, { profiles: [OWNER], storage: site({ persist }) });
      expect(
        await screen.findByText("The browser hasn't agreed to keep the site's data"),
      ).toBeTruthy();
      expect(persist).not.toHaveBeenCalled();
      await userEvent.click(screen.getByRole("button", { name: "Ask the browser to keep it" }));
      await vi.waitFor(() =>
        expect(screen.getAllByRole("status").map((status) => status.textContent)).toContain(said),
      );
      expect(persist).toHaveBeenCalledOnce();
      // The line before the answer goes: it would contradict it.
      expect(screen.queryByText("The browser hasn't agreed to keep the site's data")).toBeNull();
      expect(screen.getAllByText(said)).toHaveLength(1);
    },
  );
});

describe("the erasures of the page", () => {
  it("asks before it erases a profile's data, gives the focus back on Cancel, and erases on Erase", async () => {
    const { device, backend } = await deviceWithWork();
    await addProfile(device, "p2");
    renderPage(device);
    await screen.findByText("1 unfinished task");
    const owner = within(section("Profile: Ёжик"));
    const button = owner.getByRole("button", { name: "Erase the profile's data on this device" });
    await userEvent.click(button);
    const question = owner.getByRole("group", {
      name: "Profile: Ёжик. Its unfinished work on this device is lost, and nothing changes on the server",
    });
    expect(document.activeElement).toBe(within(question).getByRole("button", { name: "Erase" }));
    await userEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(
      owner.getByRole("button", { name: "Erase the profile's data on this device" }),
    );
    expect(backend.databases.has(profileDatabase("p1"))).toBe(true);

    await userEvent.click(
      owner.getByRole("button", { name: "Erase the profile's data on this device" }),
    );
    await userEvent.click(owner.getByRole("button", { name: "Erase" }));
    expect(await owner.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
    expect(owner.getByRole("status").textContent).toBe("Erased");
    expect(document.activeElement).toBe(owner.getByRole("heading", { level: 3 }));
    expect(backend.databases.has(profileDatabase("p1"))).toBe(false);
    expect(backend.databases.has(profileDatabase("p2"))).toBe(true);
  });

  it("says when not all of it was erased, and when nothing was", async () => {
    const { device, backend } = await deviceWithWork();
    backend.blocked.add(profileDatabase("p1"));
    renderPage(device, { profiles: [OWNER] });
    await screen.findByText("1 unfinished task");
    await userEvent.click(
      screen.getByRole("button", { name: "Erase the profile's data on this device" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    const owner = within(section("Profile: Ёжик"));
    await vi.waitFor(() =>
      expect(owner.getByRole("status").textContent).toBe(
        "Not all of it was erased. The app finishes at the next start",
      ),
    );
    expect((await readRegistry(device))?.databases.get(profileDatabase("p1"))?.erase).toBe(true);
    // The page says it of the profile too, and keeps the button to erase again.
    expect(
      await owner.findByText("Not all of it was erased. The app finishes at the next start", {
        selector: "p:not([role])",
      }),
    ).toBeTruthy();
    expect(owner.queryByText("Nothing of this profile is kept on this device")).toBeNull();
    backend.blocked.clear();
    await userEvent.click(
      owner.getByRole("button", { name: "Erase the profile's data on this device" }),
    );
    await userEvent.click(owner.getByRole("button", { name: "Erase" }));
    expect(await owner.findByText("Nothing of this profile is kept on this device")).toBeTruthy();
    expect(owner.getByRole("status").textContent).toBe("Erased");
    cleanup();

    const other = await deviceWithWork();
    other.backend.refuseWrites = true;
    renderPage(other.device, { profiles: [OWNER] });
    await userEvent.click(
      await screen.findByRole("button", { name: "Erase the profile's data on this device" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Nothing was erased. Try again");
    expect(other.backend.databases.has(profileDatabase("p1"))).toBe(true);
  });

  it("asks before it erases everything, and says when the sign-out did not go through", async () => {
    const { device } = memoryDevice();
    const onEraseAll = vi.fn(async () => "failed" as const);
    renderPage(device, { profiles: [OWNER], onEraseAll });
    await userEvent.click(screen.getByRole("button", { name: "Erase everything on this device" }));
    expect(
      screen.getByRole("group", {
        name: "Everything the app keeps on this device is lost: the work of every profile and the language of the device. The app signs out, and nothing changes on the server",
      }),
    ).toBeTruthy();
    expect(onEraseAll).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Erase" }));
    expect((await screen.findByRole("alert")).textContent).toBe(
      "The sign-out didn't go through, so nothing was erased. Try again",
    );
    expect(onEraseAll).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Erase everything on this device" }),
    );
  });
});
