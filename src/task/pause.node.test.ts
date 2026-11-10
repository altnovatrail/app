// The pause on the task screen (section 3.3 of docs/architecture.md; the 2026-11-02 amendment to
// R05): one blink for a pause of 6 s, only while Check is open, again only after a new action, and
// none once the screen has gone.
import { describe, expect, it } from "vitest";
import { BLINK_MS, PAUSE_MS, Pause, type PauseTimer } from "./pause.ts";

/** A timer the test moves by hand. */
function clock() {
  let now = 0;
  let next = 0;
  const due = new Map<number, { at: number; run: () => void }>();
  const timer: PauseTimer = {
    set(run, ms) {
      next += 1;
      due.set(next, { at: now + ms, run });
      return next;
    },
    clear(handle) {
      due.delete(handle as number);
    },
  };
  const advance = (ms: number) => {
    const until = now + ms;
    for (;;) {
      const first = [...due.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (first === undefined || first[1].at > until) break;
      due.delete(first[0]);
      now = first[1].at;
      first[1].run();
    }
    now = until;
  };
  return { timer, advance, pending: () => due.size };
}

function pause(open = () => true) {
  const { timer, advance, pending } = clock();
  const blinks: boolean[] = [];
  const paused = new Pause((on) => blinks.push(on), open, timer);
  return { paused, advance, blinks, pending };
}

describe("the pause", () => {
  it("blinks once 6 s after an action, for 3 s, and not again on the next 6 s", () => {
    const { paused, advance, blinks } = pause();
    paused.acted();
    advance(PAUSE_MS - 1);
    expect(blinks).toEqual([]);
    advance(1);
    expect(blinks).toEqual([true]);
    advance(BLINK_MS);
    expect(blinks).toEqual([true, false]);
    advance(PAUSE_MS * 3);
    expect(blinks).toEqual([true, false]);
    expect(BLINK_MS).toBeLessThan(5000);
  });

  it("blinks again only after a new stroke or tap, which stops a blink under way", () => {
    const { paused, advance, blinks } = pause();
    paused.acted();
    advance(PAUSE_MS + 1000);
    paused.acted();
    expect(blinks).toEqual([true, false]);
    advance(PAUSE_MS);
    expect(blinks).toEqual([true, false, true]);
  });

  it("starts the pause again on each action", () => {
    const { paused, advance, blinks } = pause();
    paused.acted();
    advance(PAUSE_MS - 1000);
    paused.acted();
    advance(PAUSE_MS - 1000);
    expect(blinks).toEqual([]);
  });

  it("does not blink while Check is closed, nor before the first action", () => {
    const { paused, advance, blinks } = pause(() => false);
    advance(PAUSE_MS * 2);
    paused.acted();
    advance(PAUSE_MS * 2);
    expect(blinks).toEqual([]);
  });

  it("leaves nothing to come once stopped", () => {
    const { paused, advance, blinks, pending } = pause();
    paused.acted();
    paused.stop();
    expect(pending()).toBe(0);
    paused.acted();
    advance(PAUSE_MS);
    paused.stop();
    expect(blinks).toEqual([true, false]);
    expect(pending()).toBe(0);
    paused.stop();
  });
});
