// The Log's runs of info: two info lines or more in a row on a card, folded into one row, and a
// run in words. The camera's lines are named apart from the app's, as the Log names them.
import type { Entry, Source } from "./journal.ts";

export const SOURCE_NAMES: Record<Source, string> = {
  app: "App",
  api: "Server · api",
  canvas: "Canvas",
  camera: "Camera",
};

/** Info in a row on a card, two lines or more, newest first: one row, closed till pressed. */
export interface Run {
  readonly entries: readonly [Entry, Entry, ...Entry[]];
}

/** A run's oldest line, which knows it: a line coming is newer. */
export function oldestOf(run: Run): Entry {
  return run.entries[run.entries.length - 1] as Entry;
}

/** A card's lines, each run of info in them folded; a line of another level ends a run. */
export function folded(lines: readonly Entry[]): readonly (Entry | Run)[] {
  const out: (Entry | Run)[] = [];
  let info: Entry[] = [];
  const close = () => {
    const [first, second, ...rest] = info;
    if (first !== undefined && second !== undefined)
      out.push({ entries: [first, second, ...rest] });
    else out.push(...info);
    info = [];
  };
  for (const line of lines) {
    if (line.level === "info") info.push(line);
    else {
      close();
      out.push(line);
    }
  }
  close();
  return out;
}

/** A line's name in a run: a call to api by its method, any other by its words before " · ". */
function nameOf(entry: Entry): string {
  const [head] = entry.text.split(" · ");
  return entry.source === "api" ? (head as string).replace(/^.*\//, "") : (head as string);
}

/**
 * A run in words: the names of its lines, each with how many times it was said, newest first; how
 * many lines, from where, and from when to when.
 */
export function runSummary(run: Run): { readonly names: string; readonly sub: string } {
  const counts = new Map<string, number>();
  for (const entry of run.entries)
    counts.set(nameOf(entry), (counts.get(nameOf(entry)) ?? 0) + entry.repeats + 1);
  const time = (entry: Entry) => entry.at.toLocaleTimeString("en-GB");
  const newest = time(run.entries[0]);
  const oldest = time(oldestOf(run));
  const from = [...new Set(run.entries.map((e) => SOURCE_NAMES[e.source]))].join(", ");
  return {
    names: [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(" · "),
    sub: `${run.entries.length} info · ${from} · ${oldest === newest ? newest : `${oldest} – ${newest}`}`,
  };
}
