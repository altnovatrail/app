// "My essays" in the browser (R53): the essays this device keeps, the newest first, each opened in
// place with its task and its submissions — the crop sent, what was read and the feedback, or why
// there was none —, and back to the list with the focus on the button it was opened by.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import type { PackageChecks } from "../packages/checks.ts";
import { DeviceFiles } from "../packages/files.ts";
import { PackagesProvider } from "../packages/PackagesContext.tsx";
import type { OpenViews } from "../packages/views.ts";
import type { MemoryBackend } from "../storage/memory.ts";
import { addProfile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { EssaysScreen } from "./EssaysScreen.tsx";

const TASK: open.Task = {
  id: "umbrella",
  statement: [
    { text: "An umbrella talks when it rains." },
    { picture: "umbrella.png", alt: "An umbrella", width: 40, height: 40 },
  ],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

async function renderScreen(
  essays: boolean,
  setup: { readonly before?: (backend: MemoryBackend) => void; readonly profile?: boolean } = {},
) {
  const { device, state, backend } = memoryDevice();
  await setAccount(device, "account-1");
  const profile = setup.profile === false ? undefined : await addProfile(device, "p1");
  if (essays) {
    const first = { attemptId: "e1", digest: `sha256:${"1".repeat(64)}`, task: TASK };
    await profile?.beginAttempt(first);
    await profile?.beginEssay(first, "en");
    await profile?.addEssaySubmission("e1", new Blob(["png"], { type: "image/png" }), {
      end: "feedback",
      text: "The umbrella spoke.",
      feedback: "A good start.",
    });
    await profile?.addEssaySubmission("e1", new Blob(["png"], { type: "image/png" }), {
      end: "unreadable",
      reason: "blank",
    });
    await profile?.attemptEnded("e1");
    state.time += 60_000;
    await profile?.beginAttempt({ attemptId: "e2", digest: "d2" });
    await profile?.beginEssay({ attemptId: "e2", digest: "d2" }, undefined);
  }
  const packages = {
    views: {} as OpenViews,
    checks: {} as PackageChecks,
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn: () => {},
      fetch: async () => new Response(new Blob(["picture"], { type: "image/png" })),
    }),
  };
  // StrictMode, as main.tsx has it: an effect runs twice, and the crops' addresses outlive it.
  setup.before?.(backend);
  render(
    <StrictMode>
      {inLanguage(
        <PackagesProvider value={packages}>
          <EssaysScreen profileId="p1" device={device} />
        </PackagesProvider>,
      )}
    </StrictMode>,
  );
  return { backend, profile };
}

describe("My essays", () => {
  it("says there are none on this device yet", async () => {
    await renderScreen(false);
    expect(await screen.findByText("No essays are kept on this device yet")).toBeVisible();
  });

  it("lists the essays newest first, and opens one with its task, its crops and its feedback", async () => {
    await renderScreen(true);
    const buttons = await screen.findAllByRole("button", { name: /^Open the essay of / });
    expect(buttons).toHaveLength(2);
    expect(screen.getAllByText("Not finished yet")).toHaveLength(1);
    expect(screen.getByText("An umbrella talks when it rains.")).toHaveAttribute("lang", "en");
    const older = buttons[1];
    if (older === undefined) throw new Error("no second essay");
    await userEvent.click(older);
    const heading = await screen.findByRole("heading", { level: 2, name: /^Essay of / });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Finished")).toBeVisible();
    expect(screen.getByText("An umbrella talks when it rains.").closest("div")).toHaveAttribute(
      "lang",
      "en",
    );
    expect(await screen.findByRole("img", { name: "An umbrella" })).toBeVisible();
    const sheets = screen.getAllByRole("img", { name: "The sheet as it was sent" });
    expect(sheets).toHaveLength(2);
    // The address of a crop shown still leads to its bytes.
    for (const sheet of sheets) {
      await vi.waitFor(async () =>
        expect(await (await fetch((sheet as HTMLImageElement).src)).text()).toBe("png"),
      );
    }
    expect(screen.getAllByRole("heading", { level: 3, name: /^Sent / })).toHaveLength(2);
    expect(screen.getByText("The umbrella spoke.")).toHaveAttribute("lang", "en");
    expect(screen.getByText("A good start.")).toHaveAttribute("lang", "en");
    expect(
      screen.getByText("The essay can't be read: Nothing is written. Write it again and send it"),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "All essays" }));
    expect(
      (await screen.findAllByRole("button", { name: /^Open the essay of / }))[1],
    ).toHaveFocus();
  });

  it("opens an essay not sent yet, whose module version was withdrawn", async () => {
    await renderScreen(true);
    const buttons = await screen.findAllByRole("button", { name: /^Open the essay of / });
    const newer = buttons[0];
    if (newer === undefined) throw new Error("no essay");
    await userEvent.click(newer);
    expect(
      await screen.findByText("The version of its module was withdrawn, so its task isn't kept"),
    ).toBeVisible();
    expect(screen.getByText("It hasn't been sent yet")).toBeVisible();
  });

  it("says there are none for a profile with no database on this device", async () => {
    await renderScreen(false, { profile: false });
    expect(await screen.findByText("No essays are kept on this device yet")).toBeVisible();
  });

  it("says the essays on this device can't be read", async () => {
    await renderScreen(true, { before: (backend) => backend.unreadable.add("essays") });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The data on this device can't be read",
    );
  });

  it("opens an essay as it was listed, without its crops, once it is gone or can't be read", async () => {
    const { backend, profile } = await renderScreen(true);
    const nth = async (n: number) => {
      const buttons = await screen.findAllByRole("button", { name: /^Open the essay of / });
      const button = buttons[n];
      if (button === undefined) throw new Error("no essay");
      return button;
    };
    const button = await nth(1);
    // Erased in another tab after the list was read.
    await profile?.eraseEssay("e1");
    await userEvent.click(button);
    expect(await screen.findByText("A good start.")).toBeVisible();
    expect(screen.queryByRole("img", { name: "The sheet as it was sent" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "All essays" }));
    // A read that fails opens it as listed too.
    backend.unreadable.add("essays");
    await userEvent.click(await nth(0));
    expect(await screen.findByText("It hasn't been sent yet")).toBeVisible();
  });
});
