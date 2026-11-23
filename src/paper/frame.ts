// The geometry of a task frame on the photo of a page (R71): a rectangle in whole thousandths of
// the photo's width and height, as a crop box is written. A frame the learner
// draws comes of a rectangle dragged from one corner of a task to the opposite — the rectangle the
// learner sees is the frame — or of two taps, a corner and then the one opposite. Every frame, the
// AI's too, moves when dragged by its middle and resizes by its corner. Each is at least the size
// of a target on the screen and
// never past the photo's edge. The sizes on the screen come in CSS px, by the scale the screen
// draws the photo at. A frame on a photo turned upright turns with it (R162 spec). No DOM.
import type { Size } from "./photo.ts";

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

/** The least frame, in CSS px: a stroke whose box is smaller is a tap, not a drag. */
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
 * Whether a stroke is a tap: its box smaller than the least frame, across or down. A tap is no drag,
 * and stands for a corner of two taps.
 */
export function isTap(points: readonly Point[], scale: Scale): boolean {
  if (points.length === 0) return true;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const { w, h } = least(scale);
  return Math.max(...xs) - Math.min(...xs) < w || Math.max(...ys) - Math.min(...ys) < h;
}

/** The rectangle of two opposite corners, in whichever direction, kept in the photo. */
export function spanned(from: Point, to: Point): Frame {
  return rounded(
    Math.min(from.x, to.x),
    Math.min(from.y, to.y),
    Math.max(from.x, to.x),
    Math.max(from.y, to.y),
  );
}

/**
 * The frame of a rectangle dragged from one corner to the opposite: the rectangle itself; none when
 * it is smaller than the least frame, as when the pointer came back near where it was pressed, or
 * where the photo's edge cuts it.
 */
export function dragFrame(from: Point, to: Point, scale: Scale): Frame | undefined {
  const frame = spanned(from, to);
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

/** How far a press on a frame moves, in CSS px, before it is a drag that moves the frame, not a tap. */
export const MOVE_SLOP = 6;

/** Whether a press on a frame from `from` to `to` has gone past a tap: farther than MOVE_SLOP. */
export function isMove(from: Point, to: Point, scale: Scale): boolean {
  return Math.hypot((to.x - from.x) * scale.x, (to.y - from.y) * scale.y) >= MOVE_SLOP;
}

/** The frame moved by `by`, its size as it was, kept wholly in the photo. */
export function movedFrame(frame: Frame, by: Point): Frame {
  const width = frame.xmax - frame.xmin;
  const height = frame.ymax - frame.ymin;
  const xmin = clamp(Math.round(frame.xmin + by.x), 0, 1000 - width);
  const ymin = clamp(Math.round(frame.ymin + by.y), 0, 1000 - height);
  return { xmin, ymin, xmax: xmin + width, ymax: ymin + height };
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

/**
 * The frame on a photo of `from` px turned by `degrees` clockwise about its centre onto one of `to`
 * px (R162 spec): the upright rectangle that holds its corners turned, rounded out to whole
 * thousandths and kept in the photo, which a turn by a multiple of 90° gives exactly; none when
 * nothing of it is left on the photo.
 */
export function turnedFrame(
  frame: Frame,
  degrees: number,
  from: Size,
  to: Size,
): Frame | undefined {
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  // To a millionth, so that the error of floats never rounds an exact edge out by one.
  const snapped = (value: number) => Math.round(value * 1e6) / 1e6;
  const corners = [
    { x: frame.xmin, y: frame.ymin },
    { x: frame.xmax, y: frame.ymin },
    { x: frame.xmin, y: frame.ymax },
    { x: frame.xmax, y: frame.ymax },
  ].map(({ x, y }) => {
    const u = (x * from.width) / 1000 - from.width / 2;
    const v = (y * from.height) / 1000 - from.height / 2;
    return {
      x: snapped(((u * cos - v * sin + to.width / 2) * 1000) / to.width),
      y: snapped(((u * sin + v * cos + to.height / 2) * 1000) / to.height),
    };
  });
  const turned = rounded(
    Math.min(...corners.map((p) => p.x)),
    Math.min(...corners.map((p) => p.y)),
    Math.max(...corners.map((p) => p.x)),
    Math.max(...corners.map((p) => p.y)),
  );
  return isFrame(turned) ? turned : undefined;
}
