// Histories of writing for the tests, synthetic, that a sheet could have written: a stroke with no
// style, as a history kept before strokes had one, and strokes with a style that the eraser taking
// a part cut into pieces.
import type { HistoryEvent, StrokeStyle } from "@altnovatrail/spec/canvas";

/** A pen in a colour of no palette, a little transparent. */
export const PEN: StrokeStyle = { pen: "pen", color: "#c2185b", width: 4, opacity: 90 };
/** A liner, one width all along. */
export const LINER: StrokeStyle = { pen: "liner", color: "#1565c0", width: 2.5, opacity: 100 };

/**
 * A stroke of four points apart, in time, a third of a unit off the grid; without a style unless
 * one is given.
 */
export function stroke(id: number, x: number, t: number, style?: StrokeStyle): HistoryEvent {
  const points = [0, 1, 2, 3].map((i) => ({
    x: x + i * 7.3333,
    y: 100 + i * 3.1111,
    t: t + i * 16,
    p: 0.5,
  }));
  const written = { id, kind: "mouse", ...(style === undefined ? {} : { style }), points };
  return { kind: "write", t: t + 48, stroke: written };
}

/**
 * Two strokes with a style, and the eraser that takes a part through the middle of the first: it
 * takes stroke 1 off and leaves its two halves, strokes 3 and 4, each a run of its points with its
 * pointer and style.
 */
export function styledHistory(): HistoryEvent[] {
  const first = stroke(1, 100, 0, PEN);
  const second = stroke(2, 160, 5000, LINER);
  if (first.kind !== "write") throw new Error("not a writing");
  const cut = first.stroke;
  const piece = (id: number, from: number, to: number) => ({
    of: 1,
    stroke: { ...cut, id, points: cut.points.slice(from, to) },
  });
  return [
    first,
    second,
    { kind: "cut", t: 9000, ids: [1], pieces: [piece(3, 0, 2), piece(4, 2, 4)] },
  ];
}
