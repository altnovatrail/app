// The file of a page from paper in the export, by paper.schema.json of the part export/ spec,
// version 4: its fields, the frames in the order of the page, each task's frame by its place, and
// the images in base64. The schema itself is not read here: it comes into the tests with the part's
// release file, as deployment/'s does, once the whole export is written.
import type { HistoryEvent, PaperSubmission } from "@altnovatrail/spec/canvas";
import { describe, expect, it } from "vitest";
import type { KeptPaperTask } from "../storage/profile.ts";
import { base64, PAPER_FORMAT, paperFile } from "./export.ts";

/** The patterns of common.schema.json: an image's base64, and a time in UTC. */
const BASE64 = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const TIME =
  /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]{1,9})?Z$/;

const frame = (ymin: number) => ({ ymin, xmin: 50, ymax: ymin + 100, xmax: 950 });
const write: HistoryEvent = {
  kind: "write",
  t: 300,
  on: "tracing",
  stroke: { id: 1, kind: "pen", points: [{ x: 40, y: 20, t: 0, p: 0.5 }] },
};
const context = {
  crop: { drawn: 24, width: 320, height: 410 },
  groups: [],
  tracing: { at: [200, 90], hidden: false },
  digest: "00112233445566ff",
} as unknown as PaperSubmission;

const task = (n: number, taskId: string, change: Partial<KeptPaperTask> = {}): KeptPaperTask => ({
  pageId: "page-1",
  attemptId: `attempt-${n}`,
  taskId,
  frame: frame(100 * n),
  drawn: false,
  crop: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, n])], { type: "image/png" }),
  n,
  history: [],
  sent: [],
  over: false,
  ...change,
});

describe("the file of a page from paper", () => {
  it("holds the page as the device keeps it, by the schema's fields", async () => {
    const file = await paperFile("p-1", {
      page: {
        pageId: "page-1",
        takenAt: Date.UTC(2026, 10, 18, 16, 5),
        // Kept as the screen had them; the file has them in the order of the page.
        frames: [
          { id: "drawn-1", frame: frame(300), drawn: true },
          { id: "found-1", frame: frame(100), drawn: false },
          { id: "found-2", frame: frame(200), drawn: false },
        ],
      },
      photo: { bytes: new Uint8Array([0xff, 0xd8, 0xff]), width: 300, height: 400 },
      tasks: [
        task(1, "found-1", {
          history: [write],
          tracing: { at: [200, 90], hidden: false },
          sent: [{ context, historyLength: 1 }],
        }),
        task(3, "drawn-1", { drawn: true }),
        // Begun before its frame was resized: its own frame comes after the page's.
        task(4, "found-2"),
      ],
    });
    expect(Object.keys(file).sort()).toEqual(
      ["format", "frames", "page_id", "photo", "profile_id", "taken_at", "tasks"].sort(),
    );
    expect(file.format).toBe(PAPER_FORMAT);
    expect(file.profile_id).toBe("p-1");
    expect(file.page_id).toBe("page-1");
    expect(file.taken_at).toMatch(TIME);
    expect(file.taken_at).toBe("2026-11-18T16:05:00.000Z");
    expect(file.photo).toEqual({ media_type: "image/jpeg", data: "/9j/" });
    expect(file.frames).toEqual([
      { box: [100, 50, 200, 950], by: "ai" },
      { box: [200, 50, 300, 950], by: "ai" },
      { box: [300, 50, 400, 950], by: "learner" },
      { box: [400, 50, 500, 950], by: "ai" },
    ]);
    expect(file.tasks.map((each) => [each.attempt_id, each.frame])).toEqual([
      ["attempt-1", 1],
      ["attempt-3", 3],
      ["attempt-4", 4],
    ]);
    const [first, second] = file.tasks;
    expect(Object.keys(first ?? {}).sort()).toEqual(
      ["attempt_id", "frame", "history", "statement", "submissions", "tracing"].sort(),
    );
    expect(first?.statement.media_type).toBe("image/png");
    expect(first?.statement.data).toMatch(BASE64);
    expect(first?.history).toEqual([write]);
    expect(first?.submissions).toEqual([{ context, history_length: 1 }]);
    // Never moved: where canvas starts it.
    expect(second?.tracing).toEqual({ at: [180, 60], hidden: false });
    for (const box of file.frames.map((each) => each.box)) {
      expect(box.every((n) => Number.isInteger(n) && n >= 0 && n <= 1000)).toBe(true);
    }
  });

  it("writes bytes in base64 by RFC 4648, however many", () => {
    expect(base64(new Uint8Array([]))).toBe("");
    expect(base64(new Uint8Array([0xff, 0xd8, 0xff]))).toBe("/9j/");
    expect(base64(new Uint8Array([1, 2]))).toBe("AQI=");
    const large = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(Buffer.from(base64(large), "base64")).toEqual(Buffer.from(large));
    expect(base64(large)).toMatch(BASE64);
  });
});
