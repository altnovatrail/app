// The debug window's Log, as the mockup's states `solve-debug-log`, `solve-debug-errors`,
// `solve-debug-filter`, `solve-debug-runs` and `solve-debug-run-open`: the app's log — what the
// app, api, the canvas and the camera said — with the actions of AI among its lines, newest first,
// info in a row folded into one row, a filter by level and source behind a small button, the
// errors alone by one press, and Copy of what is shown.
import type { DebugAction } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { type ReactNode, useState } from "react";
import type { Entry, Level } from "./journal.ts";
import { folded, oldestOf, type Run, runSummary, SOURCE_NAMES } from "./runs.ts";

export const LEVELS: readonly {
  readonly level: Level;
  readonly name: string;
  readonly mark: string;
}[] = [
  { level: "error", name: "Errors", mark: "!" },
  { level: "warn", name: "Warnings", mark: "!" },
  { level: "info", name: "Info", mark: "i" },
  { level: "debug", name: "Debug", mark: "·" },
];

/** The sources of the filter: the camera's lines are the app's. */
export type Kind = "ai" | "api" | "canvas" | "app";
export const KINDS: readonly { readonly kind: Kind; readonly name: string }[] = [
  { kind: "ai", name: "AI calls" },
  { kind: "api", name: "Server · api" },
  { kind: "canvas", name: "Canvas" },
  { kind: "app", name: "App" },
];

export function kindOf(source: Entry["source"]): Kind {
  return source === "camera" ? "app" : source;
}

export interface Filter {
  readonly levels: ReadonlySet<Level>;
  readonly kinds: ReadonlySet<Kind>;
}

export const EVERYTHING: Filter = {
  levels: new Set(LEVELS.map((l) => l.level)),
  kinds: new Set(KINDS.map((k) => k.kind)),
};
export const ERRORS: Filter = { levels: new Set(["error"]), kinds: EVERYTHING.kinds };

/** An item of the log: a line of the app's, or an action of AI, which is info. */
export type Item =
  | { readonly line: Entry; readonly at: number }
  | { readonly action: DebugAction; readonly key: string; readonly at: number };

/** The lines and the actions, newest first; an action before a line of the same time. */
export function itemsOf(
  lines: readonly Entry[],
  actions: readonly { readonly action: DebugAction; readonly key: string }[],
): readonly Item[] {
  const items: Item[] = [
    ...lines.map((line) => ({ line, at: line.at.getTime() })),
    ...actions.map(({ action, key }) => ({
      action,
      key,
      at: action.at === undefined ? 0 : timestampDate(action.at).getTime(),
    })),
  ];
  return items.sort((a, b) => b.at - a.at || ("action" in b ? 1 : 0) - ("action" in a ? 1 : 0));
}

export function shown(item: Item, filter: Filter): boolean {
  return "line" in item
    ? filter.levels.has(item.line.level) && filter.kinds.has(kindOf(item.line.source))
    : filter.levels.has("info") && filter.kinds.has("ai");
}

/** What the filter shows, in its button's word. */
export function filterName(filter: Filter): string {
  const all = filter.kinds.size === KINDS.length;
  if (filter.levels.size === LEVELS.length && all) return "All";
  if (filter.levels.size === 1 && filter.levels.has("error") && all) return "Errors";
  return "Filtered";
}

/** The items as text, one a line, for Copy. */
export function textOf(items: readonly Item[], title: (action: DebugAction) => string): string {
  const time = (at: number) => new Date(at).toLocaleTimeString("en-GB");
  return items
    .map((item) =>
      "line" in item
        ? [
            `${time(item.at)} ${item.line.level} ${item.line.source} ${item.line.text}`,
            ...(item.line.detail === "" ? [] : item.line.detail.split("\n").map((l) => `    ${l}`)),
          ].join("\n")
        : `${time(item.at)} info ai ${title(item.action)}`,
    )
    .join("\n");
}

/** A run's row, and its lines under it while open, indented on a tint. */
function RunRows({ run }: { readonly run: Run }) {
  const [open, setOpen] = useState(false);
  const { names, sub } = runSummary(run);
  return (
    <>
      <button
        type="button"
        className="nt-debug-run"
        aria-expanded={open}
        aria-label={`${run.entries.length} info entries: ${names}`}
        onClick={() => setOpen(!open)}
      >
        <span className="nt-debug-stack" aria-hidden="true">
          <span className="nt-debug-mark">i</span>
        </span>
        <span className="nt-debug-two">
          <span className="nt-debug-line-text">{names}</span>
          <span className="nt-debug-sub">{sub}</span>
        </span>
        <span className="nt-debug-count" aria-hidden="true">
          {run.entries.length}
        </span>
        <svg className="nt-debug-chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>
      {open ? run.entries.map((entry) => <Line key={entry.id} entry={entry} nested />) : null}
    </>
  );
}

function Line({ entry, nested = false }: { readonly entry: Entry; readonly nested?: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const level = LEVELS.find((l) => l.level === entry.level) ?? LEVELS[2];
  return (
    <>
      <button
        type="button"
        className={nested ? "nt-debug-line nt-debug-nested" : "nt-debug-line"}
        aria-expanded={entry.detail === "" ? undefined : open}
        data-level={entry.level}
        onClick={() => setOpen(!open)}
      >
        <span className="nt-debug-mark" aria-hidden="true">
          {level?.mark}
        </span>
        <span className="nt-hidden-label">{level?.name.replace(/s$/, "")}: </span>
        <span className="nt-debug-two">
          <span className="nt-debug-line-text">{entry.text}</span>
          <span className="nt-debug-sub">
            {SOURCE_NAMES[entry.source]} · {entry.at.toLocaleTimeString("en-GB")}
            {entry.repeats > 0 ? ` · ×${entry.repeats + 1}` : ""}
          </span>
        </span>
      </button>
      {open ? (
        <div className={nested ? "nt-debug-open nt-debug-nested" : "nt-debug-open"}>
          <div className="nt-debug-json-head">
            <span className="nt-debug-grow">Details</span>
            <button
              type="button"
              onClick={() => {
                const text = `${entry.at.toISOString()} ${entry.level} ${entry.source} ${entry.text}${entry.detail === "" ? "" : `\n${entry.detail}`}`;
                // A browser that does not let the page write the clipboard leaves Copy as it is.
                void navigator.clipboard?.writeText(text).then(
                  () => setCopied(true),
                  () => {},
                );
              }}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {entry.detail === "" ? null : <pre className="nt-debug-json">{entry.detail}</pre>}
        </div>
      ) : null}
    </>
  );
}

/** The filter's pop-over: the levels and the sources, each with its count, and everything again. */
function FilterMenu({
  filter,
  counts,
  onChange,
}: {
  readonly filter: Filter;
  readonly counts: { readonly level: (l: Level) => number; readonly kind: (k: Kind) => number };
  readonly onChange: (filter: Filter) => void;
}) {
  const flip = <T,>(set: ReadonlySet<T>, value: T): ReadonlySet<T> => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  return (
    <div className="nt-debug-menu nt-debug-filter-menu" role="menu" aria-label="Show in the log">
      <span className="nt-debug-menu-head">Level</span>
      {LEVELS.map((l) => (
        <button
          key={l.level}
          type="button"
          role="menuitemcheckbox"
          aria-checked={filter.levels.has(l.level)}
          onClick={() => onChange({ ...filter, levels: flip(filter.levels, l.level) })}
        >
          <span className="nt-debug-level-dot" data-level={l.level} />
          <span className="nt-debug-grow">{l.name}</span>
          <span className="nt-debug-sub">{counts.level(l.level)}</span>
        </button>
      ))}
      <span className="nt-debug-menu-head">Source</span>
      {KINDS.map((k) => (
        <button
          key={k.kind}
          type="button"
          role="menuitemcheckbox"
          aria-checked={filter.kinds.has(k.kind)}
          onClick={() => onChange({ ...filter, kinds: flip(filter.kinds, k.kind) })}
        >
          <span className="nt-debug-grow">{k.name}</span>
          <span className="nt-debug-sub">{counts.kind(k.kind)}</span>
        </button>
      ))}
      <button
        type="button"
        role="menuitem"
        className="nt-debug-all"
        onClick={() => onChange(EVERYTHING)}
      >
        Show everything
      </button>
    </div>
  );
}

/**
 * The Log's body: the filter's bar, then the items newest first — the lines that follow one
 * another on one card, info in a row folded, each action of AI as `action` draws it.
 */
export function Log({
  items,
  filter,
  onFilter,
  action,
}: {
  readonly items: readonly Item[];
  readonly filter: Filter;
  readonly onFilter: (filter: Filter) => void;
  readonly action: (action: DebugAction, key: string) => ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const visible = items.filter((item) => shown(item, filter));
  const lines = items.flatMap((item) => ("line" in item ? [item.line] : []));
  const actions = items.length - lines.length;
  const errors = lines.filter((l) => l.level === "error").length;
  const onlyErrors = filterName(filter) === "Errors";
  // The lines that follow one another share a card.
  const blocks: (
    | { readonly lines: Entry[] }
    | { readonly action: DebugAction; readonly key: string }
  )[] = [];
  for (const item of visible) {
    const last = blocks.at(-1);
    if ("action" in item) blocks.push({ action: item.action, key: item.key });
    else if (last !== undefined && "lines" in last) last.lines.push(item.line);
    else blocks.push({ lines: [item.line] });
  }
  return (
    <>
      <div className="nt-debug-filter">
        <button
          type="button"
          className="nt-debug-chip"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {filterName(filter)}
        </button>
        <span className="nt-debug-sub nt-debug-grow">
          {visible.length === items.length
            ? `${items.length} ${items.length === 1 ? "entry" : "entries"}`
            : `${visible.length} of ${items.length} entries`}
        </span>
        {errors > 0 && !onlyErrors ? (
          <button
            type="button"
            className="nt-debug-chip"
            data-level="error"
            onClick={() => {
              setMenu(false);
              onFilter(ERRORS);
            }}
          >
            {errors} {errors === 1 ? "error" : "errors"}
          </button>
        ) : null}
        {menu ? (
          <FilterMenu
            filter={filter}
            counts={{
              level: (l) =>
                lines.filter((x) => x.level === l).length + (l === "info" ? actions : 0),
              kind: (k) =>
                k === "ai" ? actions : lines.filter((x) => kindOf(x.source) === k).length,
            }}
            onChange={(next) => {
              setMenu(false);
              onFilter(next);
            }}
          />
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="nt-debug-empty">
          Nothing yet. What the app does, and the AI’s calls, come here.
        </p>
      ) : visible.length === 0 ? (
        <p className="nt-debug-empty">Nothing of what the filter shows.</p>
      ) : (
        blocks.map((block) =>
          "lines" in block ? (
            <div key={`l${block.lines.at(-1)?.id}`} className="nt-debug-card nt-debug-lines">
              {/* A card and a run are known by their oldest line, so that a line coming keeps them
                  as they are, a run open. */}
              {folded(block.lines).map((each) =>
                "entries" in each ? (
                  <RunRows key={`run${oldestOf(each).id}`} run={each} />
                ) : (
                  <Line key={each.id} entry={each} />
                ),
              )}
            </div>
          ) : (
            action(block.action, block.key)
          ),
        )
      )}
    </>
  );
}
