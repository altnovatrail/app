// The photo of a page in the browser: a picture the browser cannot read, a frame of no size, a
// canvas that gives no picture or none to draw on, and a photo too large at every try are each a
// PhotoError; a picture that fits is a JPEG, and its crops PNGs.
import { afterEach, expect, it, vi } from "vitest";
import { cropsOf, PhotoError, photoOfFile, photoOfVideo, release } from "./capture.ts";
import { MAX_PHOTO } from "./photo.ts";

/** A synthetic picture: a white PNG of 60 × 80 px. */
async function picture(): Promise<Blob> {
  const canvas = new OffscreenCanvas(60, 80);
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, 60, 80);
  return canvas.convertToBlob({ type: "image/png" });
}

/** The PhotoError a promise fails with, by its message. */
async function failure(made: Promise<unknown>): Promise<string> {
  const reason = await made.then(
    () => undefined,
    (error: unknown) => error,
  );
  if (!(reason instanceof PhotoError)) throw new Error(`no PhotoError: ${String(reason)}`);
  expect(reason.name).toBe("PhotoError");
  return reason.message;
}

afterEach(() => {
  vi.restoreAllMocks();
});

it("encodes a picture as a JPEG of its size, and cuts each frame's crop as a PNG", async () => {
  const photo = await photoOfFile(await picture());
  expect([photo.width, photo.height]).toEqual([60, 80]);
  expect([photo.bytes[0], photo.bytes[1]]).toEqual([0xff, 0xd8]);
  const [crop] = await cropsOf(photo, [{ ymin: 0, xmin: 0, ymax: 500, xmax: 500 }]);
  expect(crop?.type).toBe("image/png");
  release(photo);
  release(undefined);
});

it("says a picture the browser cannot read could not be read", async () => {
  const file = new Blob(["not a picture"], { type: "image/png" });
  expect(await failure(photoOfFile(file))).toBe("the picture could not be read");
});

it("says a frame of the video with no size has none", async () => {
  expect(await failure(photoOfVideo(document.createElement("video")))).toBe(
    "the picture has no size",
  );
});

it("says a canvas that gives no picture, or none to draw on, gave none", async () => {
  const blob = await picture();
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(null));
  expect(await failure(photoOfFile(blob))).toBe("the canvas gave no picture");
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  expect(await failure(photoOfFile(blob))).toBe("no canvas to draw on");
  const photo = { bytes: new Uint8Array(await blob.arrayBuffer()), width: 60, height: 80, url: "" };
  expect(await failure(cropsOf(photo, [{ ymin: 0, xmin: 0, ymax: 500, xmax: 500 }]))).toBe(
    "no canvas to draw on",
  );
});

it("gives the photo up when it is too large at every try", async () => {
  const blob = await picture();
  const large = new Blob([new Uint8Array(MAX_PHOTO + 1)], { type: "image/jpeg" });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(large));
  expect(await failure(photoOfFile(blob))).toBe("the photo is too large");
});
