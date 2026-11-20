// The geometry of a task frame on the photo of a page (R71): a rectangle in whole thousandths of
// the photo's width and height, as a crop box is written. A frame the learner
// draws comes of a loop round a task — its box, with a margin — or of two taps, a corner and then
// the one opposite; its corner resizes it. Each is at least the size of a target on the screen and
// never past the photo's edge. The sizes on the screen come in CSS px, by the scale the screen
// draws the photo at. No DOM.

/** A frame, in whole thousandths of the photo: `ymin` and `xmin` its top-left, the rest bottom-right. */
export interface Frame {
  readonly ymin: number;
  readonly xmin: number;
  readonly ymax: number;
  readonly xmax: number;
}

/** A point on the photo, in thousandths of its width (`x`) and height (`y`), not rounded. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** How many CSS px of the screen one thousandth of the photo takes, across and down. */
export interface Scale {
  readonly x: number;
  readonly y: number;
}

/** The margin round a loop's box, in CSS px: the loop drawn tight round a task still holds it. */
export const MARGIN = 6;
/** The least frame, in CSS px: a stroke whose box is smaller is a tap, not a loop. */
export const MIN_WIDTH = 40;
export const MIN_HEIGHT = 30;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** The least frame in thousandths at this scale, never more than the whole photo. */
function least(scale: Scale): { readonly w: number; readonly h: number } {
  return { w: Math.min(1000, MIN_WIDTH / scale.x), h: Math.min(1000, MIN_HEIGHT / scale.y) };
}

/** A frame of these edges, kept in the photo, its corners rounded out to whole thousandths. */
function rounded(x0: number, y0: number, x1: number, y1: number): Frame {
  return {
    xmin: clamp(Math.floor(x0), 0, 1000),
    ymin: clamp(Math.floor(y0), 0, 1000),
    xmax: clamp(Math.ceil(x1), 0, 1000),
    ymax: clamp(Math.ceil(y1), 0, 1000),
  };
}

/**
 * Whether a stroke is a tap: its box smaller than the least frame, across or down. A tap is no loop,
 * and stands for a corner of two taps.
 */
export function isTap(points: readonly Point[], scale: Scale): boolean {
  if (points.length === 0) return true;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const { w, h } = least(scale);
  return Math.max(...xs) - Math.min(...xs) < w || Math.max(...ys) - Math.min(...ys) < h;
}

/**
 * The frame of a loop drawn round a task: its box, with the margin, in the photo; none when the
 * stroke is a tap, or its box with the margin is smaller than the least frame where the photo's
 * edge cuts it.
 */
export function loopFrame(points: readonly Point[], scale: Scale): Frame | undefined {
  if (isTap(points, scale)) return undefined;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const mx = MARGIN / scale.x;
  const my = MARGIN / scale.y;
  const frame = rounded(
    Math.min(...xs) - mx,
    Math.min(...ys) - my,
    Math.max(...xs) + mx,
    Math.max(...ys) + my,
  );
  const { w, h } = least(scale);
  return frame.xmax - frame.xmin < w || frame.ymax - frame.ymin < h ? undefined : frame;
}

/**
 * The frame of two taps, a corner and then the one opposite, in whichever direction. Two taps closer
 * than the least frame give the least frame, grown from the first one towards the second and kept in
 * the photo.
 */
export function tapsFrame(first: Point, second: Point, scale: Scale): Frame {
  const { w, h } = least(scale);
  const span = (a: number, b: number, size: number): [number, number] => {
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    if (high - low >= size) return [low, high];
    // Grown from the first tap towards the second, and back inside the photo where it went past.
    const start = b >= a ? a : a - size;
    const kept = clamp(start, 0, 1000 - size);
    return [kept, kept + size];
  };
  const [x0, x1] = span(first.x, second.x, w);
  const [y0, y1] = span(first.y, second.y, h);
  return rounded(x0, y0, x1, y1);
}

/**
 * The frame with its bottom-right corner moved to a point: at least the least frame, never past the
 * photo's edge, its top-left where it was.
 */
export function resizedFrame(frame: Frame, to: Point, scale: Scale): Frame {
  const { w, h } = least(scale);
  return {
    ...frame,
    xmax: clamp(Math.round(to.x), Math.min(1000, Math.ceil(frame.xmin + w)), 1000),
    ymax: clamp(Math.round(to.y), Math.min(1000, Math.ceil(frame.ymin + h)), 1000),
  };
}

/** Whether a value is a frame: four numbers, its edges in order and within the photo. */
export function isFrame(value: unknown): value is Frame {
  const frame = value as Partial<Frame> | null | undefined;
  const { ymin, xmin, ymax, xmax } = frame ?? {};
  return (
    typeof ymin === "number" &&
    typeof xmin === "number" &&
    typeof ymax === "number" &&
    typeof xmax === "number" &&
    xmin >= 0 &&
    ymin >= 0 &&
    xmax <= 1000 &&
    ymax <= 1000 &&
    xmin < xmax &&
    ymin < ymax
  );
}

/** Whether two frames are one: the same edges, and none is no frame. */
export function sameFrame(a: Frame | undefined, b: Frame): boolean {
  return (
    a !== undefined &&
    a.ymin === b.ymin &&
    a.xmin === b.xmin &&
    a.ymax === b.ymax &&
    a.xmax === b.xmax
  );
}

/** The order of the page: top to bottom, and of two at one height the left first, as tutor's. */
export function pageOrder(a: Frame, b: Frame): number {
  return a.ymin - b.ymin || a.xmin - b.xmin;
}

/** The rectangle of a frame on a photo of `width` × `height` px, in whole pixels, at least one. */
export function cropRect(
  frame: Frame,
  width: number,
  height: number,
): { readonly sx: number; readonly sy: number; readonly sw: number; readonly sh: number } {
  const sx = clamp(Math.floor((frame.xmin * width) / 1000), 0, Math.max(0, width - 1));
  const sy = clamp(Math.floor((frame.ymin * height) / 1000), 0, Math.max(0, height - 1));
  const ex = clamp(Math.ceil((frame.xmax * width) / 1000), sx + 1, Math.max(sx + 1, width));
  const ey = clamp(Math.ceil((frame.ymax * height) / 1000), sy + 1, Math.max(sy + 1, height));
  return { sx, sy, sw: ex - sx, sh: ey - sy };
}
