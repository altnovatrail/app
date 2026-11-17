// The picture of a work, drawn by the canvas itself from the history the device keeps (section 3.2
// of docs/architecture.md; R83 in canvas): it begins with the signature of PNG and stands the size
// of the surface, and the stored work with it has the form api checks before it keeps one —
// the history a JSON array and each context a JSON object, in UTF-8, no history length below zero,
// and the picture a PNG by its signature (`WorkMalformed` of api's internal/learning/works.go). A
// synthetic task of the module format 0.4: no task of a module is in the packages.
import "@altnovatrail/canvas";
import type { CanvasElement, HistoryEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { afterEach, describe, expect, it } from "vitest";
import { drawPicture } from "./picture.ts";
import { storedWork } from "./stored.ts";

const TASK: open.Task = {
  id: "probe",
  statement: [{ text: "Write the answer." }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

/** A stroke the sheet could have written: points apart, in time, a third of a unit off the grid. */
function stroke(id: number, x: number, t: number): HistoryEvent {
  const points = [0, 1, 2, 3].map((i) => ({
    x: x + i * 7.3333,
    y: 100 + i * 3.1111,
    t: t + i * 16,
    p: 0.5,
  }));
  return { kind: "write", t: t + 48, stroke: { id, kind: "mouse", points } };
}

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const decoder = new TextDecoder("utf-8", { fatal: true });

/** The form api checks of a stored work: the field it refuses, or none. */
function malformed(work: NonNullable<ReturnType<typeof storedWork>>): string {
  const json = (data: Uint8Array | undefined, open: string) => {
    try {
      const text = decoder.decode(data);
      JSON.parse(text);
      return text.trimStart().startsWith(open);
    } catch {
      return false;
    }
  };
  if (!json(work.history as Uint8Array, "[")) return "history";
  for (const submission of work.submissions ?? []) {
    if (!json(submission.context as Uint8Array, "{")) return "context";
    if ((submission.historyLength ?? 0) < 0) return "history_length";
  }
  const picture = [...((work.picture as Uint8Array | undefined) ?? [])];
  return SIGNATURE.every((byte, at) => picture[at] === byte) ? "" : "picture";
}

/** The width and the height a PNG's header names. */
function size(png: Uint8Array): [number, number] {
  const view = new DataView(png.buffer, png.byteOffset);
  return [view.getUint32(16), view.getUint32(20)];
}

afterEach(() => {
  for (const sheet of document.querySelectorAll("novatrail-canvas")) sheet.remove();
});

describe("the picture of a work", () => {
  it("is the canvas's PNG of the strokes, and the work with it has the form api keeps", async () => {
    const history = [stroke(1, 100, 0), stroke(2, 160, 5000)];
    const picture = new Uint8Array(await (await drawPicture(history)).arrayBuffer());
    expect([...picture.slice(0, 8)]).toEqual(SIGNATURE);
    expect(size(picture)).toEqual([1000, 1400]);
    // The context of a submission as a sheet on a page gives it.
    const sheet = document.createElement("novatrail-canvas") as CanvasElement;
    document.body.append(sheet);
    sheet.task = TASK;
    sheet.history = history;
    const exported = await sheet.exportWork();
    if (exported === null) throw new Error("no work of a sheet");
    const work = storedWork(
      {
        attemptId: "a1",
        history,
        submissions: [{ context: exported.submission, historyLength: history.length }],
      },
      picture,
    );
    if (work === undefined) throw new Error("a work of two strokes over 4 MiB");
    expect(malformed(work)).toBe("");
    // A history drawn anew is the same picture: the strokes, not the screen, make it.
    const again = new Uint8Array(await (await drawPicture(history)).arrayBuffer());
    expect(again).toEqual(picture);
  });

  it("is a white surface, a PNG still, of a work with no stroke", async () => {
    const picture = new Uint8Array(await (await drawPicture([])).arrayBuffer());
    expect([...picture.slice(0, 8)]).toEqual(SIGNATURE);
    expect(size(picture)).toEqual([1000, 1400]);
    const work = storedWork({ attemptId: "a1", history: [], submissions: [] }, picture);
    expect(work === undefined ? "too large" : malformed(work)).toBe("");
  });
});
