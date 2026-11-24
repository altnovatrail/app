// The debug window's Performance: what loads the device, as far as a page can see it. No browser
// gives a page the CPU's load, its heat or the battery, and Safari gives no memory either, so the
// frames stand in for the load: how long each took, how much of the time they waited on the page,
// and how late a timer came — the wait a touch would have had. The canvas tells what it holds and
// paints (`paintStats`), and memory is estimated from what the page holds: the canvases' pixels,
// the decoded pictures, the strokes. It measures only while Performance is open, its strip is on
// the screen or the flash of what is repainted is on, since a measuring loop wakes the device
// every frame; the numbers stay in the tab.

import type { PaintStats } from "@altnovatrail/spec/canvas";
import { note } from "./journal.ts";

/** A bucket of frames, half a second. */
export const BUCKET_MS = 500;
/** The buckets kept: 30 s. */
export const BUCKETS = 60;
/** A frame on time at 60 Hz. */
export const FRAME_MS = 1000 / 60;
/** A frame over this the pen lags. */
export const LONG_MS = 50;
/** A long frame is noted in the log at most once in this long. */
const WARN_EVERY_MS = 2000;
/** The bytes a point of a stroke takes in memory, about: its numbers and their object. */
const POINT_BYTES = 32;

/** What half a second of frames came to. */
export interface Bucket {
  /** Each frame's time, ms. */
  readonly frames: readonly number[];
  /** How long the page held its frames: long tasks where the browser tells them, else late frames' excess. */
  readonly heldMs: number;
  /** How late the timer came in it, ms, each time. */
  readonly waits: readonly number[];
}

export interface Frames {
  /** The worst frame of each bucket, oldest first. */
  readonly worst: readonly number[];
  /** Frames in the last second. */
  readonly fps: number;
  readonly median: number;
  readonly p95: number;
  /** Frames over LONG_MS in the window. */
  readonly long: number;
  readonly longest: number;
  /** The share of the window the page held its frames, 0–100. */
  readonly busy: number;
  /** How late a timer came, p95, ms: the wait of a touch. */
  readonly wait95: number;
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

/** The frames of the window, from its buckets, oldest first. */
export function framesOf(buckets: readonly Bucket[]): Frames {
  const all = buckets.flatMap((b) => b.frames);
  const sorted = [...all].sort((a, b) => a - b);
  const waits = buckets.flatMap((b) => b.waits).sort((a, b) => a - b);
  const span = buckets.length * BUCKET_MS;
  const held = buckets.reduce((n, b) => n + b.heldMs, 0);
  const last = buckets.slice(-2).flatMap((b) => b.frames);
  return {
    worst: buckets.map((b) => b.frames.reduce((m, f) => Math.max(m, f), 0)),
    fps: last.length,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    long: all.filter((f) => f > LONG_MS).length,
    longest: sorted.at(-1) ?? 0,
    busy: span === 0 ? 0 : Math.min(100, Math.round((held / span) * 100)),
    wait95: quantile(waits, 0.95),
  };
}

/** What the canvases on the screen hold and paint, summed. */
export interface CanvasReading {
  readonly strokes: number;
  readonly points: number;
  readonly frames: number;
  readonly fullRepaints: number;
  readonly fills: number;
  readonly last: PaintStats["last"];
  readonly paint95: number;
  readonly buffers: PaintStats["buffers"];
}

export function canvasOf(stats: readonly PaintStats[]): CanvasReading | undefined {
  if (stats.length === 0) return undefined;
  const sum = (k: "strokes" | "points" | "frames" | "fullRepaints" | "fills") =>
    stats.reduce((n, s) => n + s[k], 0);
  // The canvas that painted most is the one the learner works on.
  const busiest = stats.reduce((a, b) => (b.frames > a.frames ? b : a));
  return {
    strokes: sum("strokes"),
    points: sum("points"),
    frames: sum("frames"),
    fullRepaints: sum("fullRepaints"),
    fills: sum("fills"),
    last: busiest.last,
    paint95: quantile(
      stats.flatMap((s) => s.paintMs).sort((a, b) => a - b),
      0.95,
    ),
    buffers: stats.flatMap((s) => s.buffers),
  };
}

/** Memory the page holds, estimated, bytes; the heap where the browser gives it. */
export interface Memory {
  readonly buffers: number;
  readonly pictures: number;
  readonly pictureCount: number;
  readonly strokes: number;
  readonly heap: number | undefined;
  readonly total: number;
}

export function memoryOf(
  canvas: CanvasReading | undefined,
  pictures: readonly { readonly width: number; readonly height: number }[],
  heap: number | undefined,
): Memory {
  const buffers = (canvas?.buffers ?? []).reduce((n, b) => n + b.width * b.height * 4, 0);
  const decoded = pictures.reduce((n, p) => n + p.width * p.height * 4, 0);
  const strokes = (canvas?.points ?? 0) * POINT_BYTES;
  return {
    buffers,
    pictures: decoded,
    pictureCount: pictures.length,
    strokes,
    heap,
    total: buffers + decoded + strokes + (heap ?? 0),
  };
}

export interface Device {
  readonly browser: string;
  readonly view: string;
  readonly cores: number | undefined;
}

/** The browser and its system, by the user agent: an iPad that says it is a Mac is told by its touch. */
export function deviceOf(
  ua: string,
  touch: number,
  width: number,
  height: number,
  dpr: number,
  cores: number | undefined,
): Device {
  const v = (re: RegExp) => ua.match(re)?.[1];
  const name =
    v(/Edg\/(\d+)/) !== undefined
      ? `Edge ${v(/Edg\/(\d+)/)}`
      : v(/Firefox\/(\d+)/) !== undefined
        ? `Firefox ${v(/Firefox\/(\d+)/)}`
        : v(/(?:Chrome|CriOS)\/(\d+)/) !== undefined
          ? `Chrome ${v(/(?:Chrome|CriOS)\/(\d+)/)}`
          : v(/Version\/([\d.]+).*Safari/) !== undefined
            ? `Safari ${v(/Version\/([\d.]+).*Safari/)}`
            : "a browser";
  const system = /iPad/.test(ua)
    ? "iPadOS"
    : /iPhone/.test(ua)
      ? "iOS"
      : /Android/.test(ua)
        ? "Android"
        : /Macintosh/.test(ua)
          ? touch > 1
            ? "iPadOS"
            : "macOS"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return {
    browser: system === "" ? name : `${name} · ${system}`,
    view: `${width} × ${height} @${Math.round(dpr * 100) / 100}x`,
    cores,
  };
}

export interface Reading {
  /** Measuring now. */
  readonly live: boolean;
  /** Measuring is wanted but paused by the developer. */
  readonly paused: boolean;
  readonly frames: Frames;
  readonly canvas: CanvasReading | undefined;
  readonly memory: Memory;
  readonly device: Device;
  /** The strip on the canvas, and the flash of what a frame paints. */
  readonly strip: boolean;
  readonly flash: boolean;
}

/** What the browser gives the monitor: the tests give their own. */
export interface Host {
  readonly now: () => number;
  readonly frame: (fn: (t: number) => void) => number;
  readonly cancelFrame: (id: number) => void;
  readonly later: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  readonly cancel: (id: ReturnType<typeof setTimeout>) => void;
  /** The canvases on the screen. */
  readonly canvases: () => readonly { paintStats?: PaintStats; paintFlash?: boolean }[];
  readonly pictures: () => readonly { readonly width: number; readonly height: number }[];
  readonly heap: () => number | undefined;
  readonly device: () => Device;
  /** Long tasks as the browser tells them, where it does: a stop, or nothing. */
  readonly longTasks: (fn: (ms: number) => void) => (() => void) | undefined;
}

/** The monitor, started by those who want it and stopped when none does. */
export class Monitor {
  #host: Host;
  #wanted = new Set<string>();
  #paused = false;
  #strip = false;
  #flash = false;
  #buckets: Bucket[] = [];
  #frames: number[] = [];
  #held = 0;
  #waits: number[] = [];
  #bucketAt = 0;
  #lastFrame: number | undefined;
  #frame: number | undefined;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #timerDue = 0;
  #stopLong: (() => void) | undefined;
  #longTasks = false;
  #lastWarn = Number.NEGATIVE_INFINITY;
  #reading: Reading;
  #listeners = new Set<() => void>();

  constructor(host: Host) {
    this.#host = host;
    this.#reading = this.#read(false);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  snapshot = (): Reading => this.#reading;

  /** One who wants the numbers, by a name: Performance open, the strip, the flash. */
  want(who: string, on: boolean): void {
    if (on) this.#wanted.add(who);
    else this.#wanted.delete(who);
    this.#run();
  }

  pause(paused: boolean): void {
    this.#paused = paused;
    this.#run();
    this.#publish();
  }

  /** The strip on the screen: whoever draws it wants the numbers while it is on. */
  strip(on: boolean): void {
    this.#strip = on;
    this.#publish();
  }

  /** The flash of what a frame paints, on every canvas on the screen and every one that comes. */
  flash(on: boolean): void {
    this.#flash = on;
    this.#applyFlash();
    this.#publish();
  }

  get #live(): boolean {
    return this.#frame !== undefined;
  }

  #run(): void {
    const should = this.#wanted.size > 0 && !this.#paused;
    if (should && !this.#live) this.#start();
    else if (!should && this.#live) this.#stop();
  }

  #start(): void {
    const now = this.#host.now();
    this.#bucketAt = now;
    this.#lastFrame = undefined;
    this.#frames = [];
    this.#held = 0;
    this.#waits = [];
    const tick = (t: number) => {
      if (this.#lastFrame !== undefined) {
        const took = t - this.#lastFrame;
        this.#frames.push(took);
        if (!this.#longTasks) this.#held += Math.max(0, took - FRAME_MS);
      }
      this.#lastFrame = t;
      if (t - this.#bucketAt >= BUCKET_MS) this.#close(t);
      this.#frame = this.#host.frame(tick);
    };
    this.#frame = this.#host.frame(tick);
    const probe = () => {
      this.#waits.push(Math.max(0, this.#host.now() - this.#timerDue));
      this.#timerDue = this.#host.now() + BUCKET_MS / 2;
      this.#timer = this.#host.later(probe, BUCKET_MS / 2);
    };
    this.#timerDue = now + BUCKET_MS / 2;
    this.#timer = this.#host.later(probe, BUCKET_MS / 2);
    this.#stopLong = this.#host.longTasks((ms) => {
      this.#held += ms;
    });
    this.#longTasks = this.#stopLong !== undefined;
    this.#publish();
  }

  #stop(): void {
    if (this.#frame !== undefined) this.#host.cancelFrame(this.#frame);
    if (this.#timer !== undefined) this.#host.cancel(this.#timer);
    this.#stopLong?.();
    this.#frame = undefined;
    this.#timer = undefined;
    this.#stopLong = undefined;
    this.#publish();
  }

  #close(t: number): void {
    const bucket = { frames: this.#frames, heldMs: this.#held, waits: this.#waits };
    this.#buckets = [...this.#buckets.slice(1 - BUCKETS), bucket];
    this.#frames = [];
    this.#held = 0;
    this.#waits = [];
    this.#bucketAt = t;
    const long = bucket.frames.filter((f) => f > LONG_MS);
    if (long.length > 0 && t - this.#lastWarn >= WARN_EVERY_MS) {
      this.#lastWarn = t;
      const worst = Math.round(Math.max(...long));
      const canvas = canvasOf(this.#stats());
      note(
        "warn",
        canvas === undefined ? "app" : "canvas",
        `Long frame · ${worst} ms${long.length > 1 ? ` · ${long.length} over ${LONG_MS} ms in half a second` : ""}`,
        canvas === undefined
          ? ""
          : [
              `strokes: ${canvas.strokes}`,
              `points: ${canvas.points}`,
              canvas.last === undefined
                ? ""
                : `last frame: ${canvas.last.fills} filled, ${Math.round(canvas.last.area * 100)}% of the view, ${canvas.last.ms.toFixed(1)} ms`,
            ]
              .filter(Boolean)
              .join("\n"),
      );
    }
    this.#applyFlash();
    this.#publish();
  }

  #stats(): PaintStats[] {
    return this.#host.canvases().flatMap((c) => (c.paintStats === undefined ? [] : [c.paintStats]));
  }

  /** A canvas that comes later takes the flash at the next half-second. */
  #applyFlash(): void {
    for (const c of this.#host.canvases()) if ("paintFlash" in c) c.paintFlash = this.#flash;
  }

  #read(live: boolean): Reading {
    const canvas = canvasOf(this.#stats());
    return {
      live,
      paused: this.#paused && this.#wanted.size > 0,
      frames: framesOf(this.#buckets),
      canvas,
      memory: memoryOf(canvas, this.#host.pictures(), this.#host.heap()),
      device: this.#host.device(),
      strip: this.#strip,
      flash: this.#flash,
    };
  }

  #publish(): void {
    this.#reading = this.#read(this.#live);
    for (const listener of this.#listeners) listener();
  }
}

/** The numbers as JSON, for the developer to send. */
export function jsonOf(reading: Reading, at = new Date()): string {
  const { frames, canvas, memory, device } = reading;
  const mb = (b: number) => Math.round((b / 1048576) * 10) / 10;
  return JSON.stringify(
    {
      at: at.toISOString(),
      device,
      frames: {
        fps: frames.fps,
        medianMs: round(frames.median),
        p95Ms: round(frames.p95),
        longFrames: frames.long,
        longestMs: round(frames.longest),
        worstEachHalfSecondMs: frames.worst.map(round),
      },
      mainThread: { busyPct: frames.busy, timerWaitP95Ms: round(frames.wait95) },
      canvas: canvas === undefined ? null : { ...canvas, paint95: round(canvas.paint95) },
      memoryMb: {
        canvasBuffers: mb(memory.buffers),
        pictures: mb(memory.pictures),
        strokes: mb(memory.strokes),
        heap: memory.heap === undefined ? null : mb(memory.heap),
        estimated: mb(memory.total),
      },
    },
    null,
    2,
  );
}

function round(ms: number): number {
  return Math.round(ms * 10) / 10;
}
