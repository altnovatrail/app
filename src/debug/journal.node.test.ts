// The app's log: its last entries kept and the oldest gone, a long line cut, and what the window
// and the console say of an error noted once installed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clear,
  described,
  ENTRIES,
  flush,
  install,
  NEWS_MS,
  note,
  REPEAT_MS,
  reset,
  snapshot,
  subscribe,
} from "./journal.ts";

/** The entries as the readers see them once the news has come. */
function seen() {
  flush();
  return snapshot();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  reset();
  vi.useRealTimers();
});

describe("the app's log", () => {
  it("keeps the last entries, in their order, each on one line", () => {
    const heard = vi.fn();
    subscribe(heard);
    for (let i = 0; i < ENTRIES + 3; i++) note("info", "app", `line\n${i}`);
    // The readers see it, and hear of it, a moment later, once.
    expect(snapshot()).toEqual([]);
    expect(heard).not.toHaveBeenCalled();
    vi.advanceTimersByTime(NEWS_MS);
    expect(heard).toHaveBeenCalledTimes(1);
    const entries = snapshot();
    expect(entries).toHaveLength(ENTRIES);
    expect(entries[0]?.text).toBe("line 3");
    expect(entries.at(-1)?.text).toBe(`line ${ENTRIES + 2}`);
    expect(entries.at(-1)?.id).toBe(ENTRIES + 3);
    // News with nothing new tells nobody.
    flush();
    expect(heard).toHaveBeenCalledTimes(1);
    clear();
    expect(snapshot()).toEqual([]);
  });

  it("counts a line said again soon after on its entry, with no news", () => {
    const heard = vi.fn();
    subscribe(heard);
    const at = new Date("2026-11-24T20:00:00Z");
    note("warn", "app", "the same", "", at);
    note("info", "api", "between", "", at);
    vi.advanceTimersByTime(NEWS_MS);
    note("warn", "app", "the same", "", new Date(at.getTime() + 1000));
    note("warn", "app", "the same", "", new Date(at.getTime() + 2000));
    vi.advanceTimersByTime(NEWS_MS);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(seen().map((e) => [e.text, e.repeats])).toEqual([
      ["the same", 2],
      ["between", 0],
    ]);
    // Long after the last time, it is a line of its own.
    note("warn", "app", "the same", "", new Date(at.getTime() + 2000 + REPEAT_MS + 1));
    expect(seen()).toHaveLength(3);
    // Far back in the log, it is too.
    for (let i = 0; i < 25; i++) note("debug", "app", `line ${i}`, "", at);
    note("debug", "app", "line 0", "", at);
    expect(seen().filter((e) => e.text === "line 0")).toHaveLength(2);
  });

  it("cuts a line and a detail too long", () => {
    note("warn", "canvas", "x".repeat(400), "y".repeat(5000));
    const [entry] = seen();
    expect(entry?.text).toHaveLength(300);
    expect(entry?.text.endsWith("…")).toBe(true);
    expect(entry?.detail).toHaveLength(4000);
  });

  it("says an error as its line and its stack, and anything else as text", () => {
    const error = new TypeError("no box");
    error.stack = "TypeError: no box\n    at cropFitted (photo.ts:88:14)";
    expect(described(error)).toEqual({
      text: "TypeError: no box",
      detail: "at cropFitted (photo.ts:88:14)",
    });
    const safari = new Error("gone");
    safari.stack = "check@Solve.tsx:612:22";
    expect(described(safari).detail).toBe("check@Solve.tsx:612:22");
    expect(described("plain")).toEqual({ text: "plain", detail: "" });
    expect(described({ code: 3 })).toEqual({ text: '{"code":3}', detail: "" });
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(described(loop).text).toBe("[object Object]");
  });

  it("notes the window's errors and the console's errors and warnings once installed", () => {
    const target = new EventTarget();
    const said: unknown[][] = [];
    const console = {
      error: (...args: unknown[]) => said.push(["error", ...args]),
      warn: (...args: unknown[]) => said.push(["warn", ...args]),
    } as unknown as Console;
    install(target, console);
    install(target, console);

    const uncaught = Object.assign(new Event("error"), { error: new RangeError("too far") });
    target.dispatchEvent(uncaught);
    target.dispatchEvent(
      Object.assign(new Event("error"), {
        message: "Script error.",
        filename: "app.js",
        lineno: 3,
        colno: 9,
      }),
    );
    target.dispatchEvent(Object.assign(new Event("error"), {}));
    target.dispatchEvent(
      Object.assign(new Event("unhandledrejection"), { reason: new Error("lost") }),
    );
    console.error("failed", new Error("boom"));
    console.warn("careful", { n: 1 });

    const entries = seen();
    expect(entries.map((e) => [e.level, e.source, e.text])).toEqual([
      ["error", "app", "RangeError: too far"],
      ["error", "app", "Script error."],
      ["error", "app", "an error"],
      ["error", "app", "Error: lost"],
      ["error", "app", "failed Error: boom"],
      ["warn", "app", 'careful {"n":1}'],
    ]);
    expect(entries[0]?.detail.startsWith("uncaught")).toBe(true);
    expect(entries[1]?.detail).toBe("uncaught\nat app.js:3:9");
    expect(entries[3]?.detail.startsWith("uncaught, in a promise")).toBe(true);
    // The console still says it.
    expect(said).toHaveLength(2);
  });
});
