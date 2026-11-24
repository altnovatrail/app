// The photo of a page on the device: a frame of the camera's video, or a picture the learner
// picked, drawn upright on a canvas and encoded anew as a JPEG of at most 4 MiB — the metadata of
// its file, its place and its time among them, stay behind —, and the crops of the
// tasks picked cut from that same photo as PNGs. The photo and its crops stay in the tab's memory.
// A photo whose tasks were found on it turned upright is turned so too, and encoded by the same
// rules.
// A kept page's thumbnail, for "Your pages", is made from its photo in memory too, and never kept:
// the device's records go into the profile's export as they are.
import { cropRect, type Frame } from "./frame.ts";
import { cropFitted, MAX_PHOTO, QUALITY, tries, turnedSize } from "./photo.ts";

/** The photo of a page as app sent it: its bytes, its size, and a URL of them for the screen. */
export interface Photo {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** An object URL of the bytes, which `release` revokes. */
  readonly url: string;
}

/** The photo is too large even at the smallest try, or the picture could not be read. */
export class PhotoError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "PhotoError";
  }
}

function blobOf(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob === null ? reject(new PhotoError("the canvas gave no picture")) : resolve(blob),
      type,
      quality,
    );
  });
}

/** How a picture is drawn onto a context at a size, in px. */
type Draw = (context: CanvasRenderingContext2D, width: number, height: number) => void;

/** The source drawn whole over the context. */
const whole =
  (source: CanvasImageSource): Draw =>
  (context, width, height) =>
    context.drawImage(source, 0, 0, width, height);

/** A picture of `width` × `height` px drawn at each try's size until its JPEG fits. */
async function encoded(draw: Draw, width: number, height: number): Promise<Photo> {
  if (width === 0 || height === 0) throw new PhotoError("the picture has no size");
  const canvas = document.createElement("canvas");
  for (const size of tries(width, height)) {
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null) throw new PhotoError("no canvas to draw on");
    draw(context, size.width, size.height);
    const blob = await blobOf(canvas, "image/jpeg", QUALITY);
    if (blob.size <= MAX_PHOTO) {
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        width: size.width,
        height: size.height,
        url: URL.createObjectURL(blob),
      };
    }
  }
  throw new PhotoError("the photo is too large");
}

/** The frame the camera's video shows now. */
export function photoOfVideo(video: HTMLVideoElement): Promise<Photo> {
  return encoded(whole(video), video.videoWidth, video.videoHeight);
}

/**
 * A picture the learner picked: upright by its own orientation, as the camera held it. One the
 * browser cannot read is a PhotoError.
 */
export async function photoOfFile(file: Blob): Promise<Photo> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (reason) {
    throw new PhotoError("the picture could not be read", { cause: reason });
  }
  try {
    return await encoded(whole(bitmap), bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * The photo turned by `degrees` clockwise about its centre: onto the smallest upright
 * rectangle that holds it, its corners white, as the server turned it to find the tasks, then fitted
 * and encoded as any photo of a page. It is decoded before it comes back, so that the page takes it
 * in the place of the photo before with no moment of neither. One the browser cannot read, or too
 * large, is a PhotoError.
 */
export async function turnedPhoto(photo: Photo, degrees: number): Promise<Photo> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([photo.bytes as BlobPart], { type: "image/jpeg" }));
  } catch (reason) {
    throw new PhotoError("the photo could not be read", { cause: reason });
  }
  try {
    const { width, height } = bitmap;
    const upright = turnedSize(width, height, degrees);
    const turned = await encoded(
      (context, w, h) => {
        // A JPEG has no transparency: the corners the turn leaves would come out black.
        context.fillStyle = "#fff";
        context.fillRect(0, 0, w, h);
        context.scale(w / upright.width, h / upright.height);
        context.translate(upright.width / 2, upright.height / 2);
        context.rotate((degrees * Math.PI) / 180);
        context.drawImage(bitmap, -width / 2, -height / 2);
      },
      upright.width,
      upright.height,
    );
    const image = new Image();
    image.src = turned.url;
    // Only a head start: the page shows the photo by its URL either way.
    await image.decode().catch(() => {});
    return turned;
  } finally {
    bitmap.close();
  }
}

/**
 * The crop of each frame on the photo, as a PNG, in the order of the frames: drawn within the
 * bounds of a crop (cropFitted), so that a large frame costs a Check no more tokens than the work,
 * then smaller, try after try, until it fits the bytes api takes of a picture — a PNG of a
 * camera's frame is several times the JPEG it was cut from.
 */
export async function cropsOf(photo: Photo, frames: readonly Frame[]): Promise<readonly Blob[]> {
  const bitmap = await createImageBitmap(
    new Blob([photo.bytes as BlobPart], { type: "image/jpeg" }),
  );
  try {
    const canvas = document.createElement("canvas");
    const crops: Blob[] = [];
    for (const frame of frames) {
      const { sx, sy, sw, sh } = cropRect(frame, bitmap.width, bitmap.height);
      crops.push(await croppedPng(canvas, bitmap, sx, sy, sw, sh));
    }
    return crops;
  } finally {
    bitmap.close();
  }
}

/** The region of the bitmap as a PNG within the bounds of a crop, then at each try's size until it fits MAX_PHOTO. */
async function croppedPng(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
): Promise<Blob> {
  const first = cropFitted(sw, sh);
  for (const size of tries(first.width, first.height)) {
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (context === null) throw new PhotoError("no canvas to draw on");
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, size.width, size.height);
    const blob = await blobOf(canvas, "image/png");
    if (blob.size <= MAX_PHOTO) return blob;
  }
  throw new PhotoError("the crop is too large");
}

/**
 * The box of a page's thumbnail in its list, in px: the mockup's 44 × 56 CSS px at three device px
 * each, so that it is sharp on any screen.
 */
const THUMBNAIL = { width: 132, height: 168 } as const;

/**
 * The thumbnail of a page's photo, a small JPEG that covers the box at least, never larger than the
 * photo: the list draws many, and a whole photo each would hold megabytes for a picture of 44 px.
 * One the browser cannot read is a PhotoError.
 */
export async function thumbnailOf(bytes: Uint8Array): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: "image/jpeg" }));
  } catch (reason) {
    throw new PhotoError("the photo could not be read", { cause: reason });
  }
  try {
    const k = Math.min(
      1,
      Math.max(THUMBNAIL.width / bitmap.width, THUMBNAIL.height / bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * k));
    canvas.height = Math.max(1, Math.round(bitmap.height * k));
    const context = canvas.getContext("2d");
    if (context === null) throw new PhotoError("no canvas to draw on");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return await blobOf(canvas, "image/jpeg", QUALITY);
  } finally {
    bitmap.close();
  }
}

/** The photo's URL revoked: the screen no longer shows it. */
export function release(photo: Photo | undefined): void {
  if (photo !== undefined) URL.revokeObjectURL(photo.url);
}
