// The size of the photo of a page that app sends to find its tasks: a JPEG of at most 4 MiB,
// as the contract takes it, its long side no more than LONG_SIDE, and each try that comes out too
// large again smaller by STEP; and the size of the photo turned upright by the turn FindTasks gave.
// No DOM: capture.ts draws and encodes.

/** The most bytes `FindTasks` takes of a photo (the contract). */
export const MAX_PHOTO = 4 << 20;

/**
 * The long side of the photo, in px: past what any provider's model takes unshrunk (tutor fits it
 * to its model), and enough for the crop of a task cut from it on the device.
 */
export const LONG_SIDE = 3200;

/** How much smaller each try of the encoding is than the one before, which came out too large. */
export const STEP = 0.8;

/** The quality of the JPEG, from 0 to 1. */
export const QUALITY = 0.9;

/** How many tries of the encoding there are before the photo is given up as too large. */
export const TRIES = 6;

/** A size in px. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** The size of a photo of `width` × `height` px drawn with its long side at most `longSide`. */
export function fitted(width: number, height: number, longSide: number = LONG_SIDE): Size {
  const long = Math.max(width, height);
  if (long <= longSide || long === 0) return { width, height };
  const k = longSide / long;
  return { width: Math.max(1, Math.round(width * k)), height: Math.max(1, Math.round(height * k)) };
}

/** The sizes to encode a photo at, one try after another: fitted first, then smaller by STEP. */
export function tries(width: number, height: number): readonly Size[] {
  const first = fitted(width, height);
  return Array.from({ length: TRIES }, (_, i) => ({
    width: Math.max(1, Math.round(first.width * STEP ** i)),
    height: Math.max(1, Math.round(first.height * STEP ** i)),
  }));
}

/**
 * The size of a photo of `width` × `height` px turned by `degrees` clockwise about its centre: the
 * smallest upright rectangle that holds it, in whole px, as the server turns it (the contract), so
 * that the frames it gave are on the same rectangle.
 */
export function turnedSize(width: number, height: number, degrees: number): Size {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    width: Math.round(width * cos + height * sin),
    height: Math.round(width * sin + height * cos),
  };
}
