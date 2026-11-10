// The pause on the task screen (section 3.3 of docs/architecture.md; the 2026-11-02 amendment to
// R05 in docs/decisions.md; R69 in spec): 6 s with no stroke and no option tapped, and Check, if it
// is open, blinks once — shorter than 5 s and no more than three times a second (WCAG 2.2.2,
// 2.3.1). It blinks again only after a new stroke or a new tap, not after every next 6 s. Nothing is
// read and no AI is called. No DOM: the screen gives the timer.

/** How long the learner rests before Check blinks, ms. */
export const PAUSE_MS = 6000;

/** How long the blink lasts, ms: three flashes of a second, the class's animation in theme.css. */
export const BLINK_MS = 3000;

/** The timer the pause waits on; the tests give their own. */
export interface PauseTimer {
  set(run: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const TIMER: PauseTimer = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * The pause of one task screen: `acted()` on each stroke and tap, `blinking(true)` once 6 s have
 * gone with Check open, `blinking(false)` once the blink is over or the learner acts. A pause blinks
 * once; one with Check closed blinks not at all, and none comes before the first action.
 */
export class Pause {
  private readonly blinking: (on: boolean) => void;
  private readonly open: () => boolean;
  private readonly timer: PauseTimer;
  private waiting: unknown;
  private showing: unknown;

  constructor(blinking: (on: boolean) => void, open: () => boolean, timer: PauseTimer = TIMER) {
    this.blinking = blinking;
    this.open = open;
    this.timer = timer;
  }

  /** A stroke or a tap: the blink under way stops, and a new pause begins. */
  acted(): void {
    this.stopBlink();
    if (this.waiting !== undefined) this.timer.clear(this.waiting);
    this.waiting = this.timer.set(() => {
      this.waiting = undefined;
      if (!this.open()) return;
      this.blinking(true);
      this.showing = this.timer.set(() => {
        this.showing = undefined;
        this.blinking(false);
      }, BLINK_MS);
    }, PAUSE_MS);
  }

  /** The screen goes, or the attempt ends: no blink comes after. */
  stop(): void {
    if (this.waiting !== undefined) this.timer.clear(this.waiting);
    this.waiting = undefined;
    this.stopBlink();
  }

  private stopBlink(): void {
    if (this.showing === undefined) return;
    this.timer.clear(this.showing);
    this.showing = undefined;
    this.blinking(false);
  }
}
