// The history of writing and a submission's context, kept in the browser's IndexedDB and read back,
// go through the element as they came out of it (section 3.2 of docs/architecture.md): the sheet
// opens as it was, and the tutor's marks with that context take hold. A synthetic task of the
// module format 0.4: no task of a module is in the packages.
import "@altnovatrail/canvas";
import type {
  CanvasElement,
  HistoryChange,
  HistoryEvent,
  SheetSubmission,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { afterEach, describe, expect, it } from "vitest";
import { browserDevice } from "./browser.ts";
import { eraseAccount } from "./erase.ts";
import { addProfile } from "./profile.ts";
import { setAccount } from "./registry.ts";

const MANIFEST: open.Manifest = {
  module_format_version: "0.4",
  id: "probe",
  version: "1.0.0",
  title: "Probe",
  subject: "mathematics",
  audience: { age_categories: ["adult"] },
  languages: { explanation: "en" },
  authors: [{ name: "NovaTrail" }],
  license: "Apache-2.0",
};

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

function element(): CanvasElement {
  const sheet = document.createElement("novatrail-canvas") as CanvasElement;
  document.body.append(sheet);
  sheet.manifest = MANIFEST;
  sheet.task = TASK;
  return sheet;
}

afterEach(async () => {
  for (const sheet of document.querySelectorAll("novatrail-canvas")) sheet.remove();
  await eraseAccount(browserDevice());
});

describe("the history and the context through IndexedDB", () => {
  it("open the sheet as it was, and take the tutor's marks back", async () => {
    const device = browserDevice();
    await setAccount(device, "account-1");
    const profile = await addProfile(device, "p1");
    await profile?.beginAttempt({ attemptId: "a1", digest: "d1", task: TASK });

    const first = element();
    const changes: HistoryChange[] = [];
    first.addEventListener("historychange", (event) => changes.push(event.detail));
    // The history the element is given sends no event: what it keeps is what it tells after.
    first.history = [stroke(1, 100, 0), stroke(2, 160, 5000)];
    // undo() is canvas's own command, not the contract's.
    (first as CanvasElement & { undo(): void }).undo();
    expect(changes.length).toBe(1);
    expect(await profile?.replaceHistory("a1", first.history.slice(0, 2))).toBe("saved");
    expect(await profile?.appendHistory("a1", changes[0] as HistoryChange)).toBe("saved");
    const work = await first.exportWork();
    if (work === null || !("png" in work)) throw new Error("no work of a sheet");
    expect(await profile?.addSubmission("a1", work, first.history.length)).toBe(0);

    const stored = await profile?.readAttempt("a1");
    expect(stored?.history).toEqual(first.history);
    const context = stored?.submissions?.[0]?.context as SheetSubmission;
    expect(context).toEqual(work.submission);

    const second = element();
    second.history = stored?.history ?? [];
    expect(second.history).toEqual(first.history);
    expect(second.filled).toEqual(first.filled);
    const name = "Tutor's mark 1 of 1";
    const label = context.groups[0]?.label ?? "A";
    second.marks = { submission: context, marks: [{ kind: "frame", at: { group: label }, name }] };
    expect(second.marks?.marks).toHaveLength(1);
    const kept = stored?.submissions?.[0]?.work;
    if (kept === undefined || !("png" in kept)) throw new Error("no crop kept");
    expect(await kept.png.arrayBuffer()).toEqual(await work.png.arrayBuffer());
  });

  it("refuse marks whose context lost a digit on the way, which is why it is kept unchanged", async () => {
    const sheet = element();
    sheet.history = [stroke(1, 100, 0)];
    const work = await sheet.exportWork();
    if (work === null || !("png" in work)) throw new Error("no work of a sheet");
    const [ymin, xmin, ymax, xmax] = work.submission.crop.sheetBox;
    const rounded: SheetSubmission = {
      ...work.submission,
      crop: {
        ...work.submission.crop,
        sheetBox: [Math.round(ymin), Math.round(xmin), Math.round(ymax), Math.round(xmax)],
      },
    };
    expect(rounded.crop.sheetBox).not.toEqual(work.submission.crop.sheetBox);
    const name = "Tutor's mark 1 of 1";
    expect(() => {
      sheet.marks = { submission: rounded, marks: [{ kind: "frame", at: { group: "A" }, name }] };
    }).toThrow(TypeError);
  });
});
