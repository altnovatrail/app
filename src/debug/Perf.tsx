// The debug window's Performance, as the mockup's states `solve-debug-perf` and `solve-debug-hud`:
// the frames — a second's count, the p95, those over 50 ms and the worst of each half-second over
// 30 s —, the main thread, the canvas, memory estimated and the device, with Pause and Copy, and
// two switches: the strip of the numbers on the screen, and the flash of what a frame paints.
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  BUCKETS,
  deviceOf,
  FRAME_MS,
  type Host,
  jsonOf,
  LONG_MS,
  Monitor,
  type Reading,
} from "./perf.ts";

/** What the browser gives the monitor: the frames, a timer, the canvases, the pictures and the device. */
function browserHost(): Host {
  return {
    now: () => performance.now(),
    frame: (fn) => requestAnimationFrame(fn),
    cancelFrame: (id) => cancelAnimationFrame(id),
    later: (fn, ms) => setTimeout(fn, ms),
    cancel: (id) => clearTimeout(id),
    canvases: () => [...document.querySelectorAll("novatrail-canvas")] as never,
    pictures: () => {
      const seen: { width: number; height: number }[] = [];
      for (const img of document.images)
        if (img.complete && img.naturalWidth > 0)
          seen.push({ width: img.naturalWidth, height: img.naturalHeight });
      for (const video of document.querySelectorAll("video"))
        if (video.videoWidth > 0) seen.push({ width: video.videoWidth, height: video.videoHeight });
      return seen;
    },
    heap: () =>
      (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
    device: () =>
      deviceOf(
        navigator.userAgent,
        navigator.maxTouchPoints,
        window.innerWidth,
        window.innerHeight,
        window.devicePixelRatio,
        navigator.hardwareConcurrency || undefined,
      ),
    longTasks: (fn) => {
      if (!PerformanceObserver.supportedEntryTypes?.includes("longtask")) return undefined;
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) fn(entry.duration);
      });
      observer.observe({ type: "longtask" });
      return () => observer.disconnect();
    },
  };
}

let monitor: Monitor | undefined;

/** The tab's monitor, made at its first use: one a tab. */
export function theMonitor(): Monitor {
  monitor ??= new Monitor(browserHost());
  return monitor;
}

const CHART_TOP_MS = 66;
const CHART_HEIGHT = 72;
const BAR = 6;

function mb(bytes: number): string {
  const m = bytes / 1048576;
  return m < 0.1 ? "< 0.1 MB" : `${m.toFixed(1)} MB`;
}

export function tone(ms: number): "good" | "late" | "long" {
  return ms <= FRAME_MS ? "good" : ms <= LONG_MS ? "late" : "long";
}

/** The bars of the worst frames as three paths, one a colour, in the chart's units. */
export function barsOf(worst: readonly number[]): Record<"good" | "late" | "long", string> {
  const bars = { good: "", late: "", long: "" };
  const start = BUCKETS - worst.length;
  worst.forEach((ms, i) => {
    const h = Math.max(2, Math.min(CHART_HEIGHT, (ms / CHART_TOP_MS) * CHART_HEIGHT));
    bars[tone(ms)] +=
      `M${(start + i) * BAR} ${CHART_HEIGHT}v${(-h).toFixed(1)}h${BAR - 1}v${h.toFixed(1)}z`;
  });
  return bars;
}

const lineAt = (ms: number) => (CHART_HEIGHT - (ms / CHART_TOP_MS) * CHART_HEIGHT).toFixed(1);

function Switch({ on }: { readonly on: boolean }) {
  return (
    <span className="nt-debug-switch" data-on={on}>
      <span className="nt-debug-knob" />
    </span>
  );
}

function Rows({ rows }: { readonly rows: readonly (readonly [string, string, string?])[] }) {
  return (
    <div className="nt-debug-card">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="nt-debug-stat-row">
          <span className="nt-debug-grow">{k}</span>
          <span className="nt-debug-figure" data-tone={tone}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

function Head({ title, sub }: { readonly title: string; readonly sub?: string }) {
  return (
    <div className="nt-debug-slot-head">
      <span className="nt-debug-main">{title}</span>
      {sub === undefined ? null : <span className="nt-debug-sub">{sub}</span>}
    </div>
  );
}

export function Perf() {
  const monitor = theMonitor();
  const reading = useSyncExternalStore(monitor.subscribe, monitor.snapshot);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    monitor.want("tab", true);
    return () => monitor.want("tab", false);
  }, [monitor]);
  const { frames, canvas, memory, device } = reading;
  const bars = barsOf(frames.worst);
  const busyTone = frames.busy > 70 ? "long" : frames.busy > 40 ? "late" : undefined;
  return (
    <section className="nt-debug-body" aria-label="Performance">
      <div className="nt-debug-filter">
        <span className="nt-debug-live" data-live={reading.live} />
        <span className="nt-debug-main">{reading.live ? "Live" : "Paused"}</span>
        <span className="nt-debug-sub nt-debug-grow">last 30 s · every 0.5 s</span>
        <button type="button" className="nt-debug-chip" onClick={() => monitor.pause(reading.live)}>
          {reading.live ? "Pause" : "Resume"}
        </button>
        <button
          type="button"
          className="nt-debug-chip"
          data-accent="true"
          onClick={() => {
            void navigator.clipboard?.writeText(jsonOf(reading)).then(
              () => setCopied(true),
              () => {},
            );
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <Head
        title="Frames"
        sub="The worst frame of each half-second. Over 16.7 ms a frame is late; over 50 ms the pen lags."
      />
      <div className="nt-debug-frames">
        <div className="nt-debug-tiles">
          <div>
            <span className="nt-debug-sub">Frames a second</span>
            <span className="nt-debug-tile" data-tone={tone(1000 / Math.max(1, frames.fps))}>
              {frames.fps}
            </span>
          </div>
          <div>
            <span className="nt-debug-sub">Frame · p95</span>
            <span className="nt-debug-tile" data-tone={tone(frames.p95)}>
              {Math.round(frames.p95)} ms
            </span>
          </div>
          <div>
            <span className="nt-debug-sub">Over 50 ms</span>
            <span className="nt-debug-tile" data-tone={frames.long > 0 ? "long" : "good"}>
              {frames.long}
            </span>
          </div>
        </div>
        <svg
          className="nt-debug-chart"
          viewBox={`0 0 ${BUCKETS * BAR} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="The worst frame of each half-second, the last 30 seconds"
        >
          <path d={`M0 ${lineAt(FRAME_MS)}H${BUCKETS * BAR}`} data-line="good" />
          <path d={`M0 ${lineAt(LONG_MS)}H${BUCKETS * BAR}`} data-line="long" />
          <path d={bars.good} data-tone="good" />
          <path d={bars.late} data-tone="late" />
          <path d={bars.long} data-tone="long" />
        </svg>
        <div className="nt-debug-axis">
          <span>30 s ago</span>
          <span>16.7 ms · 50 ms</span>
          <span>now</span>
        </div>
      </div>
      <Head
        title="Main thread"
        sub="The share of time the page held its frames: the nearest a page gets to the CPU"
      />
      <div className="nt-debug-card">
        <div className="nt-debug-meter">
          <span style={{ inlineSize: `${frames.busy}%` }} data-tone={busyTone ?? "good"} />
        </div>
        <div className="nt-debug-stat-row">
          <span className="nt-debug-grow">Busy</span>
          <span className="nt-debug-figure nt-debug-strong" data-tone={busyTone}>
            {frames.busy}%
          </span>
        </div>
        <div className="nt-debug-stat-row">
          <span className="nt-debug-grow">Input waits · p95</span>
          <span className="nt-debug-figure">{frames.wait95.toFixed(1)} ms</span>
        </div>
        <div className="nt-debug-stat-row">
          <span className="nt-debug-grow">Longest frame</span>
          <span className="nt-debug-figure">{Math.round(frames.longest)} ms</span>
        </div>
      </div>
      <Head title="Canvas" sub="What the sheet holds and what a frame paints" />
      {canvas === undefined ? (
        <Rows rows={[["Canvas", "none on the screen"]]} />
      ) : (
        <Rows
          rows={[
            [
              "Strokes · points",
              `${canvas.strokes.toLocaleString("en-US")} · ${canvas.points.toLocaleString("en-US")}`,
            ],
            [
              "Painted by the last frame",
              canvas.last === undefined
                ? "nothing yet"
                : `${canvas.last.fills} ${canvas.last.fills === 1 ? "stroke" : "strokes"} · ${Math.round(canvas.last.area * 100)}% of the view`,
            ],
            ["Paint · p95", `${canvas.paint95.toFixed(1)} ms`],
            ["Frames · of the whole view", `${canvas.frames} · ${canvas.fullRepaints}`],
          ]}
        />
      )}
      <Head title="Memory · estimated" sub="From what the page holds" />
      <Rows
        rows={[
          [
            "Canvas buffers",
            canvas === undefined || canvas.buffers.length === 0
              ? "none"
              : `${canvas.buffers.length} · ${mb(memory.buffers)}`,
          ],
          [
            "Pictures, decoded",
            memory.pictureCount === 0 ? "none" : `${memory.pictureCount} · ${mb(memory.pictures)}`,
          ],
          ["Strokes", mb(memory.strokes)],
          [
            "JavaScript heap",
            memory.heap === undefined ? "not given by this browser" : mb(memory.heap),
            memory.heap === undefined ? "muted" : undefined,
          ],
          ["In all, about", mb(memory.total), "strong"],
        ]}
      />
      <Head title="Device" />
      <Rows
        rows={[
          ["Browser", device.browser],
          ["View", device.view],
          ["Cores, as reported", device.cores === undefined ? "not given" : String(device.cores)],
          ["CPU load, heat, battery", "not given to a page", "muted"],
        ]}
      />
      <div className="nt-debug-card">
        <button
          type="button"
          role="switch"
          className="nt-debug-row"
          aria-checked={reading.strip}
          onClick={() => monitor.strip(!reading.strip)}
        >
          <span className="nt-debug-two nt-debug-grow">
            <span className="nt-debug-main">Show on the canvas</span>
            <span className="nt-debug-sub nt-debug-wrap">
              The frames, busy time and memory in a strip, with this window closed
            </span>
          </span>
          <Switch on={reading.strip} />
        </button>
        <button
          type="button"
          role="switch"
          className="nt-debug-row"
          aria-checked={reading.flash}
          onClick={() => monitor.flash(!reading.flash)}
        >
          <span className="nt-debug-two nt-debug-grow">
            <span className="nt-debug-main">Flash what is repainted</span>
            <span className="nt-debug-sub nt-debug-wrap">
              Each rectangle a frame paints blinks red on the canvas
            </span>
          </span>
          <Switch on={reading.flash} />
        </button>
      </div>
      <p className="nt-debug-note">
        A page gets no CPU load, temperature or battery from the browser: the frames and the busy
        time stand in for them. The numbers stay on this device.
      </p>
    </section>
  );
}

/** The strip's line: frames, the p95, busy time and memory. */
export function stripText(reading: Reading): string {
  const { frames, memory } = reading;
  return `${frames.fps} fps · ${Math.round(frames.p95)} ms · busy ${frames.busy}% · ≈ ${Math.round(memory.total / 1048576)} MB`;
}

/**
 * The strip at the top left of the screen while its switch is on: it takes no touch. It stands
 * beside the debug button, which is on the screen of a task from paper alone, and while it is there
 * the strip and the flash keep the monitor measuring.
 */
export function Strip() {
  const monitor = theMonitor();
  const reading = useSyncExternalStore(monitor.subscribe, monitor.snapshot);
  useEffect(() => {
    monitor.want("strip", reading.strip);
    monitor.want("flash", reading.flash);
    return () => {
      monitor.want("strip", false);
      monitor.want("flash", false);
    };
  }, [monitor, reading.strip, reading.flash]);
  if (!reading.strip) return null;
  return createPortal(
    <output className="nt-debug-strip" aria-label="Performance">
      <span className="nt-debug-live" data-tone={tone(reading.frames.p95)} />
      {stripText(reading)}
    </output>,
    document.body,
  );
}
