// What the monitor of Performance makes of the frames, the canvas, memory and the device, and how
// it runs: only while someone wants it and it is not paused, a long frame noted at most once in two
// seconds, the flash given to each canvas.
import type { PaintStats } from "@altnovatrail/spec/canvas";
import { afterEach, describe, expect, it } from "vitest";
import { flush, reset as resetJournal, snapshot } from "./journal.ts";
import {
  BUCKET_MS,
  BUCKETS,
  type Bucket,
  canvasOf,
  deviceOf,
  framesOf,
  type Host,
  jsonOf,
  Monitor,
  memoryOf,
} from "./perf.ts";

afterEach(resetJournal);

/** The app's log as its readers see it once the news has come. */
function journal() {
  flush();
  return snapshot();
}

const bucket = (frames: number[], heldMs = 0, waits: number[] = []): Bucket => ({
  frames,
  heldMs,
  waits,
});

function stats(over: Partial<PaintStats> = {}): PaintStats {
  return {
    strokes: 10,
    points: 400,
    frames: 30,
    fullRepaints: 3,
    fills: 50,
    last: { fills: 1, area: 0.03, ms: 1.2 },
    paintMs: [1, 2, 3, 4],
    buffers: [{ width: 2388, height: 1668 }],
    ...over,
  };
}

describe("the numbers", () => {
  it("takes the frames of the window: the worst of each bucket, quantiles, long ones, busy time", () => {
    const frames = framesOf([bucket([16, 17, 60], 100, [1, 2]), bucket([16, 16, 30], 150, [40])]);
    expect(frames.worst).toEqual([60, 30]);
    expect(frames.fps).toBe(6);
    expect(frames.median).toBe(17);
    expect(frames.p95).toBe(60);
    expect(frames.long).toBe(1);
    expect(frames.longest).toBe(60);
    expect(frames.busy).toBe(25);
    expect(frames.wait95).toBe(40);
    expect(framesOf([])).toMatchObject({ fps: 0, median: 0, busy: 0, worst: [] });
  });

  it("sums the canvases, the busiest one's last frame", () => {
    expect(canvasOf([])).toBeUndefined();
    const quiet = stats({ frames: 2, last: { fills: 0, area: 1, ms: 9 }, paintMs: [9] });
    const reading = canvasOf([quiet, stats()]);
    expect(reading).toMatchObject({
      strokes: 20,
      points: 800,
      frames: 32,
      fullRepaints: 6,
      fills: 100,
    });
    expect(reading?.last).toEqual({ fills: 1, area: 0.03, ms: 1.2 });
    expect(reading?.paint95).toBe(9);
    expect(reading?.buffers).toHaveLength(2);
  });

  it("estimates memory from the buffers, the pictures, the strokes and the heap", () => {
    const memory = memoryOf(canvasOf([stats()]), [{ width: 100, height: 50 }], 1000);
    expect(memory).toEqual({
      buffers: 2388 * 1668 * 4,
      pictures: 20_000,
      pictureCount: 1,
      strokes: 400 * 32,
      heap: 1000,
      total: 2388 * 1668 * 4 + 20_000 + 12_800 + 1000,
    });
    expect(memoryOf(undefined, [], undefined).total).toBe(0);
  });

  it("names the browser and its system, an iPad that says it is a Mac by its touch", () => {
    const safariMac =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15";
    expect(deviceOf(safariMac, 5, 1194, 834, 2, 8)).toEqual({
      browser: "Safari 19.0 · iPadOS",
      view: "1194 × 834 @2x",
      cores: 8,
    });
    expect(deviceOf(safariMac, 0, 1, 1, 1, undefined).browser).toBe("Safari 19.0 · macOS");
    const cases: [string, string][] = [
      [
        "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) Version/19.0 Mobile Safari/604.1",
        "Safari 19.0 · iOS",
      ],
      [
        "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) CriOS/140.0 Mobile Safari/604.1",
        "Chrome 140 · iPadOS",
      ],
      ["Mozilla/5.0 (Linux; Android 15) Chrome/141.0 Mobile Safari/537.36", "Chrome 141 · Android"],
      [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0 Safari/537.36 Edg/141.0",
        "Edge 141 · Windows",
      ],
      [
        "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0",
        "Firefox 140 · Linux",
      ],
      ["curl/8", "a browser"],
    ];
    for (const [ua, browser] of cases) expect(deviceOf(ua, 0, 1, 1, 1.5, 4).browser).toBe(browser);
  });
});

/** A host whose frames and timers the test runs by hand. */
function fakeHost(canvases: { paintStats?: PaintStats; paintFlash?: boolean }[] = []) {
  let now = 0;
  let frame: ((t: number) => void) | undefined;
  let timer: (() => void) | undefined;
  let long: ((ms: number) => void) | undefined;
  const host: Host = {
    now: () => now,
    frame: (fn) => {
      frame = fn;
      return 1;
    },
    cancelFrame: () => {
      frame = undefined;
    },
    later: (fn) => {
      timer = fn;
      return 2 as never;
    },
    cancel: () => {
      timer = undefined;
    },
    canvases: () => canvases,
    pictures: () => [],
    heap: () => undefined,
    device: () => ({ browser: "test", view: "1 × 1 @1x", cores: undefined }),
    longTasks: () => undefined,
  };
  return {
    host,
    /** Frames of these lengths, one after another. */
    frames(...lengths: number[]) {
      for (const ms of lengths) {
        now += ms;
        frame?.(now);
      }
    },
    /** The timer, come `late` ms after it was due. */
    timer(late: number) {
      now += late;
      timer?.();
    },
    get running() {
      return frame !== undefined;
    },
    withLongTasks(): Host {
      return {
        ...host,
        longTasks: (fn) => {
          long = fn;
          return () => {
            long = undefined;
          };
        },
      };
    },
    longTask(ms: number) {
      long?.(ms);
    },
  };
}

describe("the monitor", () => {
  it("measures only while wanted and not paused", () => {
    const fake = fakeHost();
    const monitor = new Monitor(fake.host);
    expect(monitor.snapshot().live).toBe(false);
    monitor.want("tab", true);
    expect(fake.running).toBe(true);
    expect(monitor.snapshot().live).toBe(true);
    monitor.pause(true);
    expect(fake.running).toBe(false);
    expect(monitor.snapshot()).toMatchObject({ live: false, paused: true });
    monitor.pause(false);
    expect(fake.running).toBe(true);
    monitor.want("tab", false);
    expect(fake.running).toBe(false);
    expect(monitor.snapshot().paused).toBe(false);
  });

  it("closes a bucket each half-second, keeps 30 s, and notes a long frame once in two seconds", () => {
    const canvas = { paintStats: stats(), paintFlash: false };
    const fake = fakeHost([canvas]);
    const monitor = new Monitor(fake.host);
    const heard: number[] = [];
    monitor.subscribe(() => heard.push(1));
    monitor.want("tab", true);
    fake.frames(13);
    // The bucket closes with the frame that ends its half-second.
    fake.frames(80, 70, ...Array(21).fill(16.7));
    let reading = monitor.snapshot();
    expect(reading.frames.worst).toEqual([80]);
    expect(reading.frames.long).toBe(2);
    expect(reading.canvas?.strokes).toBe(10);
    // Late frames' excess is the busy time where the browser tells no long tasks.
    expect(reading.frames.busy).toBeGreaterThan(10);
    expect(journal().map((e) => [e.level, e.source, e.text])).toEqual([
      ["warn", "canvas", "Long frame · 80 ms · 2 over 50 ms in half a second"],
    ]);
    expect(journal()[0]?.detail).toContain("last frame: 1 filled, 3% of the view, 1.2 ms");
    // Within two seconds, another long frame is not noted.
    fake.frames(...Array(30).fill(16.7), 60);
    expect(journal()).toHaveLength(1);
    for (let i = 0; i < BUCKETS + 5; i++) fake.frames(...Array(29).fill(17.3));
    reading = monitor.snapshot();
    expect(reading.frames.worst).toHaveLength(BUCKETS);
    expect(heard.length).toBeGreaterThan(BUCKETS);
    fake.frames(55, ...Array(30).fill(16.7));
    expect(journal()).toHaveLength(2);
    expect(journal().at(-1)?.text).toBe("Long frame · 55 ms");
  });

  it("takes the wait of a touch from how late the timer came", () => {
    const fake = fakeHost();
    const monitor = new Monitor(fake.host);
    monitor.want("tab", true);
    // Due a quarter of a second after the start, it came 3 ms late.
    fake.timer(BUCKET_MS / 2 + 3);
    fake.frames(...Array(16).fill(16.7));
    expect(monitor.snapshot().frames.wait95).toBe(3);
  });

  it("takes the busy time from long tasks where the browser tells them", () => {
    const fake = fakeHost();
    const monitor = new Monitor(fake.withLongTasks());
    monitor.want("tab", true);
    fake.longTask(250);
    fake.frames(...Array(31).fill(100));
    // Six half-seconds, the long task in the first.
    expect(monitor.snapshot().frames.busy).toBe(Math.round((250 / (6 * BUCKET_MS)) * 100));
    expect(journal()[0]?.source).toBe("app");
    monitor.want("tab", false);
    fake.longTask(100);
  });

  it("gives the flash to each canvas, and keeps the strip's switch", () => {
    const canvas = { paintStats: stats(), paintFlash: false };
    const old = {};
    const fake = fakeHost([canvas, old]);
    const monitor = new Monitor(fake.host);
    monitor.flash(true);
    expect(canvas.paintFlash).toBe(true);
    expect("paintFlash" in old).toBe(false);
    monitor.strip(true);
    expect(monitor.snapshot()).toMatchObject({ strip: true, flash: true });
    monitor.flash(false);
    expect(canvas.paintFlash).toBe(false);
  });

  it("writes the numbers as JSON", () => {
    const fake = fakeHost([{ paintStats: stats() }]);
    const monitor = new Monitor(fake.host);
    monitor.want("tab", true);
    fake.frames(...Array(31).fill(16.66));
    const json = JSON.parse(jsonOf(monitor.snapshot(), new Date("2026-11-24T20:00:00Z")));
    expect(json.at).toBe("2026-11-24T20:00:00.000Z");
    expect(json.frames.medianMs).toBe(16.7);
    expect(json.memoryMb).toMatchObject({ heap: null, canvasBuffers: 15.2 });
    expect(json.canvas.strokes).toBe(10);
    const none = new Monitor(fakeHost().host);
    expect(JSON.parse(jsonOf(none.snapshot())).canvas).toBeNull();
  });
});
