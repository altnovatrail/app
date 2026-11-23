// "Your pages" in the browser: each row a thumbnail of its page's photo beside when it was
// taken and how many tasks it began, named by both; a skeleton of the thumbnail's size while the
// photo is read and made small, a blank sheet where it cannot be shown, and the
// thumbnails' URLs revoked when the list goes.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { addProfile, type KeptPhoto, Profile } from "../storage/profile.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { PaperProvider } from "./PaperContext.tsx";
import { YourPages } from "./YourPages.tsx";
import "../theme/theme.css";

/** The wait for a thumbnail: its photo decoded and drawn small, a second on a busy runner. */
const SLOW = { timeout: 10_000 };

/** A synthetic photo of a page: a white JPEG of 600 × 800 px with a grey stripe. */
async function pagePhoto(): Promise<KeptPhoto> {
  const canvas = new OffscreenCanvas(600, 800);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 600, 800);
  context.fillStyle = "#888888";
  context.fillRect(40, 60, 520, 120);
  const blob = await canvas.convertToBlob({ type: "image/jpeg" });
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: 600, height: 800 };
}

const frame = { ymin: 100, xmin: 0, ymax: 200, xmax: 900 };

/** A device that keeps two pages of the profile, the first with one task, the second with two. */
async function keptPages() {
  const { device } = memoryDevice();
  const profile = await addProfile(device, "p1");
  if (profile === undefined) throw new Error("no profile");
  const photo = await pagePhoto();
  for (const [pageId, takenAt, tasks] of [
    ["g1", Date.UTC(2026, 10, 21, 20, 45), 1],
    ["g2", Date.UTC(2026, 10, 21, 20, 50), 2],
  ] as const) {
    const begun = Array.from({ length: tasks }, (_, n) => ({
      attemptId: `${pageId}-a${n}`,
      taskId: `found-${n}`,
      frame,
      drawn: false,
      crop: new Blob(["crop"], { type: "image/png" }),
      history: [],
      sent: [],
      over: false,
    }));
    const frames = begun.map(({ taskId }) => ({ id: taskId, frame, drawn: false }));
    await profile.keepPage({ pageId, takenAt, frames }, photo, begun);
  }
  return device;
}

async function openPages() {
  const device = await keptPages();
  render(
    inLanguage(
      <PaperProvider profileId="p1" device={device}>
        <YourPages profileId="p1" device={device} />
      </PaperProvider>,
    ),
  );
  await userEvent.click(await screen.findByRole("button", { name: "Your pages" }));
  return {
    one: await screen.findByRole("button", { name: /· 1 task$/ }),
    two: screen.getByRole("button", { name: /· 2 tasks$/ }),
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows each page's thumbnail beside when it was taken and how many tasks it began", async () => {
  const revoked = vi.spyOn(URL, "revokeObjectURL");
  const { one, two } = await openPages();
  expect(screen.getByRole("heading", { name: "Your pages" })).toBeVisible();
  expect(screen.getByText("on this device")).toBeVisible();
  // The newest first.
  expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
    expect.stringMatching(/2 tasks$/),
    expect.stringMatching(/1 task$/),
  ]);
  expect(within(two).getByText("2 tasks")).toBeVisible();
  const thumbnails = await waitFor(() => {
    const shown = [one, two].map((row) => row.querySelector("img"));
    for (const img of shown) {
      expect(img?.src).toMatch(/^blob:/);
      expect(img?.complete && img.naturalWidth).toBeGreaterThan(0);
    }
    return shown as HTMLImageElement[];
  }, SLOW);
  for (const img of thumbnails) {
    expect(img.alt).toBe("");
    // Made small: the box of 44 × 56 at three device px each, not the photo's 600 × 800.
    expect([img.naturalWidth, img.naturalHeight]).toEqual([132, 176]);
  }
  expect(one.querySelector(".nt-sk")).toBeNull();
  expect(
    screen.getByText(/The latest 5 pages are kept on this device until the profile is deleted/),
  ).toBeVisible();
  // Closed and opened again: made once, then revoked with the list.
  await userEvent.keyboard("{Escape}");
  await userEvent.click(screen.getByRole("button", { name: "Your pages" }));
  const again = await screen.findByRole("button", { name: /· 1 task$/ });
  expect(again.querySelector("img")?.src).toBe(thumbnails[0]?.src);
  cleanup();
  expect(revoked.mock.calls.map(([url]) => url).sort()).toEqual(
    thumbnails.map((img) => img.src).sort(),
  );
});

it("shows a skeleton of the thumbnail's size while the photo is read, then the photo", async () => {
  let give: (photo: KeptPhoto | undefined) => void = () => {};
  const read = Profile.prototype.photo;
  const photos = vi.spyOn(Profile.prototype, "photo").mockImplementation(function (
    this: Profile,
    pageId,
  ) {
    return pageId === "g1"
      ? new Promise((resolve) => {
          give = resolve;
        })
      : read.call(this, pageId);
  });
  const { one } = await openPages();
  // One after another: the older page's photo is read once the newer's thumbnail is made.
  await waitFor(() => expect(photos).toHaveBeenCalledWith("g1"), SLOW);
  const shape = one.querySelector<HTMLElement>(".nt-pages-thumb > .nt-sk");
  expect(shape).not.toBeNull();
  expect(shape?.getAttribute("aria-hidden")).toBe("true");
  expect([shape?.offsetWidth, shape?.offsetHeight]).toEqual([44, 56]);
  expect(one.querySelector("img")).toBeNull();
  // The row's name is still when and how many, with no "Loading" in it.
  expect(one).toHaveAccessibleName(/^\S.* · 1 task$/);
  give(await pagePhoto());
  await waitFor(() => expect(one.querySelector("img")?.src).toMatch(/^blob:/), SLOW);
  expect(one.querySelector(".nt-sk")).toBeNull();
});

it("shows a blank sheet, not a broken picture, where the photo cannot be shown", async () => {
  vi.spyOn(Profile.prototype, "photo").mockImplementation(async (pageId) =>
    pageId === "g1" ? undefined : { bytes: new Uint8Array([1, 2, 3]), width: 3, height: 4 },
  );
  const { one, two } = await openPages();
  await waitFor(() => {
    for (const row of [one, two]) {
      expect(row.querySelector(".nt-pages-blank")).not.toBeNull();
      expect(row.querySelector("img")).toBeNull();
      expect(row.querySelector(".nt-sk")).toBeNull();
    }
  }, SLOW);
});
