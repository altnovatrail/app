// The app's own log, which the debug window's Log shows beside the calls of AI: what the app, api,
// the canvas and the camera said — the errors, the warnings, what happened and the developer's
// lines. It is in the main chunk and begins with the tab, since an error before `GetDebug` answers
// is one the developer needs too; it lives in the tab's memory alone, the last ENTRIES of it, and
// goes nowhere. A line names what happened — a method, a code, a size, a time —, never the
// learner's work or words. A screen that shows the log must not make it grow: what the console says
// while the screen draws would draw it again. So the readers see the lines as they were at the last
// news, which comes a moment after a new line and at most so often, and a line said again soon after
// is counted on its entry with no news of it.

export type Level = "error" | "warn" | "info" | "debug";
export type Source = "app" | "api" | "canvas" | "camera";

export interface Entry {
  /** Rising across the tab's life: the order of the entries, and a key. */
  readonly id: number;
  readonly at: Date;
  readonly level: Level;
  readonly source: Source;
  /** One line. */
  readonly text: string;
  /** What opens under it: a stack, the fields of a call. */
  readonly detail: string;
  /** How many times more the same line was said soon after. */
  readonly repeats: number;
}

/** The entries kept: older ones go first. */
export const ENTRIES = 500;
/** A line and its detail are cut to these lengths, so that a long message cannot fill the tab. */
const TEXT = 300;
const DETAIL = 4000;
/** A line said again within this long of the last time is a repeat, ms. */
export const REPEAT_MS = 10_000;
/** How far back a repeat is looked for, in entries. */
const REPEAT_LOOK = 20;
/** The readers hear of new lines at most this often, ms. */
export const NEWS_MS = 100;

let entries: readonly Entry[] = [];
/** The entries as the readers see them: as they were at the last news. */
let published: readonly Entry[] = [];
let next = 1;
/** When each recent entry was said last, by its id. */
const lastSaid = new Map<number, number>();
const listeners = new Set<() => void>();
let news: ReturnType<typeof setTimeout> | undefined;

function tell(): void {
  if (news !== undefined) return;
  news = setTimeout(flush, NEWS_MS);
}

/** The news now: the readers see the entries as they are. */
export function flush(): void {
  clearTimeout(news);
  news = undefined;
  if (published === entries) return;
  published = entries;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshot(): readonly Entry[] {
  return published;
}

function cut(text: string, most: number): string {
  return text.length > most ? `${text.slice(0, most - 1)}…` : text;
}

export function note(
  level: Level,
  source: Source,
  text: string,
  detail = "",
  at = new Date(),
): void {
  const line = cut(text.replace(/\s+/g, " ").trim(), TEXT);
  const now = at.getTime();
  for (let i = entries.length - 1; i >= Math.max(0, entries.length - REPEAT_LOOK); i--) {
    const e = entries[i];
    if (e === undefined || e.level !== level || e.source !== source || e.text !== line) continue;
    if (now - (lastSaid.get(e.id) ?? 0) > REPEAT_MS) break;
    lastSaid.set(e.id, now);
    const again = { ...e, repeats: e.repeats + 1 };
    entries = entries.map((x, j) => (j === i ? again : x));
    return;
  }
  const entry = {
    id: next++,
    at,
    level,
    source,
    text: line,
    detail: cut(detail, DETAIL),
    repeats: 0,
  };
  lastSaid.set(entry.id, now);
  if (entries.length >= ENTRIES) {
    for (const gone of entries.slice(0, entries.length - ENTRIES + 1)) lastSaid.delete(gone.id);
    entries = [...entries.slice(1 - ENTRIES), entry];
  } else entries = [...entries, entry];
  tell();
}

export function clear(): void {
  entries = [];
  lastSaid.clear();
  flush();
}

/** What an error says, as one line and its stack. */
export function described(reason: unknown): { readonly text: string; readonly detail: string } {
  if (reason instanceof Error) {
    const text = `${reason.name}: ${reason.message}`;
    const stack = reason.stack ?? "";
    // Safari's stack has no first line of the message; V8's begins with it.
    return { text, detail: stack.startsWith(text) ? stack.slice(text.length).trim() : stack };
  }
  return { text: typeof reason === "string" ? reason : safeJson(reason), detail: "" };
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** A console's arguments as one line, an error's stack as the detail. */
function spoken(args: readonly unknown[]): { readonly text: string; readonly detail: string } {
  const error = args.find((a) => a instanceof Error);
  const text = args
    .map((a) =>
      typeof a === "string" ? a : a instanceof Error ? `${a.name}: ${a.message}` : safeJson(a),
    )
    .join(" ");
  return { text, detail: error instanceof Error ? described(error).detail : "" };
}

let installed = false;

/** What Chromium and WebKit say of a ResizeObserver whose notifications went on to the next frame. */
const RESIZE_LOOP =
  /^ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;

/** What the window says of an error nobody caught: an ErrorEvent, as far as the log reads it. */
interface Uncaught extends Event {
  readonly error?: unknown;
  readonly message?: string;
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
}

/** What the window says of a promise nobody caught. */
interface Unhandled extends Event {
  readonly reason?: unknown;
}

/**
 * The window's errors, the promises nobody caught, and what the console says as an error or a
 * warning, noted from now on: once a tab, the console still saying it too.
 */
export function install(target: EventTarget, console: Console = globalThis.console): void {
  if (installed) return;
  installed = true;
  target.addEventListener("error", (e) => {
    const event = e as Uncaught;
    const { text, detail } =
      event.error instanceof Error
        ? described(event.error)
        : { text: event.message ?? "an error", detail: "" };
    const where = event.filename ? `at ${event.filename}:${event.lineno}:${event.colno}` : "";
    // The browser's word that a layout changed the sizes it was observing again in one frame: the
    // rest comes in the next, and nothing failed.
    const level = RESIZE_LOOP.test(text) ? "debug" : "error";
    note(level, "app", text, ["uncaught", detail || where].filter(Boolean).join("\n"));
  });
  target.addEventListener("unhandledrejection", (e) => {
    const { text, detail } = described((e as Unhandled).reason);
    note("error", "app", text, ["uncaught, in a promise", detail].filter(Boolean).join("\n"));
  });
  // The system may cut the requests of a tab it put away or of a network gone: the log says when.
  target.addEventListener("visibilitychange", () => {
    const page = (globalThis as { document?: { readonly visibilityState?: string } }).document;
    const state = page?.visibilityState;
    if (state !== undefined) note("info", "app", state === "hidden" ? "page hidden" : "page shown");
  });
  target.addEventListener("offline", () => note("info", "app", "network offline"));
  target.addEventListener("online", () => note("info", "app", "network online"));
  for (const level of ["error", "warn"] as const) {
    const said = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      said(...args);
      const { text, detail } = spoken(args);
      note(level, "app", text, detail);
    };
  }
}

/** The log and its capture forgotten, for the tests. */
export function reset(): void {
  entries = [];
  published = [];
  next = 1;
  lastSaid.clear();
  clearTimeout(news);
  news = undefined;
  installed = false;
  listeners.clear();
}
