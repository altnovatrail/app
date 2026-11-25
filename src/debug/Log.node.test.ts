// The Log's runs of info: the lines of a card with each run of two info lines or more folded, a
// line of another level ending it, and a run in words — its names counted, newest first, how many,
// from where and from when to when.
import { expect, it } from "vitest";
import type { Entry } from "./journal.ts";
import { folded, runSummary } from "./Log.tsx";

let id = 0;
function entry(
  level: Entry["level"],
  source: Entry["source"],
  text: string,
  at: string,
  repeats = 0,
): Entry {
  id++;
  return { id, at: new Date(`2026-11-25T${at}Z`), level, source, text, detail: "", repeats };
}

it("folds two info lines or more in a row, and leaves one alone and every other level", () => {
  const lines = [
    entry("info", "api", "DebugService/GetDebug · ok · 0.3 s", "14:58:07"),
    entry("info", "api", "PaperService/BeginPaperAttempts · ok · 1.8 s", "14:58:06"),
    entry("warn", "canvas", "Long frame · 61 ms", "14:58:00"),
    entry("info", "camera", "Photo 4032 × 3024", "14:57:59"),
    entry("debug", "app", "Profile opened", "14:57:58"),
    entry("info", "api", "AccountService/GetQuota · ok · 0.9 s", "14:57:52"),
    entry("info", "api", "ModuleService/ListConnectedModules · ok · 0.5 s", "14:57:51", 1),
    entry("info", "app", "Started", "14:57:50"),
  ];
  const out = folded(lines);
  expect(out.map((each) => ("entries" in each ? each.entries.length : each.level))).toEqual([
    2,
    "warn",
    "info",
    "debug",
    3,
  ]);
  expect(folded([])).toEqual([]);
});

it("says a run's names with their counts, how many, from where and when", () => {
  const run = {
    entries: [
      entry("info", "api", "AccountService/GetQuota · ok · 0.9 s", "14:57:53"),
      entry("info", "api", "ModuleService/ListConnectedModules · ok · 0.5 s", "14:57:52", 1),
      entry("info", "camera", "Photo 4032 × 3024", "14:57:52"),
      entry("info", "api", "AccountService/GetQuota · ok · 0.8 s", "14:57:51"),
    ],
  };
  const { names, sub } = runSummary(run);
  expect(names).toBe("GetQuota ×2 · ListConnectedModules ×2 · Photo 4032 × 3024");
  expect(sub).toMatch(/^4 info · Server · api, Camera · \d\d:\d\d:\d\d – \d\d:\d\d:\d\d$/);
  const same = runSummary({ entries: run.entries.slice(1, 3) }).sub;
  expect(same).toMatch(/^2 info · Server · api, Camera · \d\d:\d\d:\d\d$/);
});
