// The comparison of app's screens with the interface mockup of spec's draft/mockup/ (R58 in
// docs/decisions.md; section 3.9 of docs/architecture.md; R146 and R148 spec): the mockup's own
// server and page, a state of it opened in a browser, and what is measured of each region on
// either side — its box and its computed style — and compared here, in Node. A state of the
// mockup is also held across the three engines: each reaches data-ready="true" with no error, and
// the shapes it draws agree. Nothing here reads spec/ by itself: the folder of the spec whose
// mockup is opened is the caller's, so that a session can compare with a newer spec in a clone.
import { mkdirSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Browser, BrowserContext, Frame, Locator, Page } from "playwright";
import {
  type ColourProperty,
  type Device,
  type Difference,
  type Find,
  type Property,
  type Region,
  SIZES,
} from "../mockup/regions.ts";

/**
 * The thresholds of a difference (R58): a box within 4 CSS px on either side, a colour within 2 of
 * 255 in each channel, a radius and a font size within half a pixel, a weight equal; across engines
 * the mockup's boxes within 2 CSS px, read to a tenth of a pixel, and its styles equal.
 */
export const THRESHOLDS = { box: 4, colour: 2, length: 0.5, engines: 2 } as const;

/** The fontconfig file the browsers of the comparison draw by: system-ui is FreeSans (R58). */
export const FONTS = fileURLToPath(new URL("../mockup/fonts.conf", import.meta.url));

/** Where a run writes its snapshots and reports: an artifact of the run, never committed. */
export const OUT = fileURLToPath(new URL("../mockup/out", import.meta.url));

export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What the page gives of an element: its box and its computed style, as the engine writes them. */
export interface Raw {
  readonly box: Box;
  /** The element's background, then those of what it stands on, from the nearest down. */
  readonly backgrounds: readonly string[];
  readonly borderWidth: number;
  readonly borderColour: string;
  /** The computed box-shadow, whose ring — no offset, no blur, a spread — is an edge too. */
  readonly shadow: string;
  readonly radius: string;
  readonly colour: string;
  readonly fontSize: string;
  readonly fontWeight: string;
}

/** A colour, its channels 0–255 and its alpha 0–1. */
export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

/** A region as it is compared: every colour laid over what it stands on, every length in px. */
export interface Measure {
  readonly box: Box;
  readonly background: Rgba;
  /** The colour of its edge — its border, or else a ring of its shadow —, when it has one. */
  readonly border: Rgba | null;
  readonly radius: number;
  readonly colour: Rgba;
  readonly fontSize: number;
  readonly fontWeight: number;
}

/** A colour as CSS writes it — #rgb, #rrggbb, rgb() or rgba(), with commas or spaces — or null. */
export function parseColour(text: string): Rgba | null {
  const value = text.trim().toLowerCase();
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1];
  if (hex !== undefined) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = /^rgba?\(([^)]*)\)$/.exec(value)?.[1];
  if (fn === undefined) return null;
  const parts = fn.split(/[\s,/]+/).filter((part) => part !== "");
  if (parts.length !== 3 && parts.length !== 4) return null;
  // A share is of 255 for a channel and of 1 for the alpha.
  const numbers = parts.map((part, i) =>
    part.endsWith("%") ? (Number.parseFloat(part) / 100) * (i < 3 ? 255 : 1) : Number(part),
  );
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [r, g, b, a = 1] = numbers as [number, number, number, number?];
  return { r, g, b, a };
}

/** A colour laid over another, by the operator "source over". */
export function over(top: Rgba, below: Rgba): Rgba {
  const a = top.a + below.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, u: number) => (t * top.a + u * below.a * (1 - top.a)) / a;
  return { r: mix(top.r, below.r), g: mix(top.g, below.g), b: mix(top.b, below.b), a };
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };

/** The colours of a stack, the nearest first, laid each over the next and all over white. */
export function composite(stack: readonly string[]): Rgba {
  let colour = WHITE;
  for (const text of [...stack].reverse()) {
    const layer = parseColour(text);
    if (layer !== null) colour = over(layer, colour);
  }
  return colour;
}

/** A colour as #rrggbb, rounded. */
export function hex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** Whether two colours agree within the threshold, channel by channel. */
export function sameColour(one: Rgba, other: Rgba, within: number = THRESHOLDS.colour): boolean {
  return (
    Math.abs(one.r - other.r) <= within &&
    Math.abs(one.g - other.g) <= within &&
    Math.abs(one.b - other.b) <= within
  );
}

/** A length of computed style in px: "14px", or a share of the width, "50%". */
export function px(text: string, width = 0): number {
  const value = Number.parseFloat(text);
  if (!Number.isFinite(value)) return 0;
  return text.trim().endsWith("%") ? (value / 100) * width : value;
}

/** The layers of a computed box-shadow: its commas outside a colour's parentheses. */
function shadowLayers(shadow: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < shadow.length; i++) {
    if (shadow[i] === "(") depth++;
    else if (shadow[i] === ")") depth--;
    else if (shadow[i] === "," && depth === 0) {
      layers.push(shadow.slice(start, i));
      start = i + 1;
    }
  }
  layers.push(shadow.slice(start));
  return layers;
}

/**
 * The colour of the first ring of a computed box-shadow — "rgb(…) 0px 0px 0px 1px inset", inset or
 * not —, or null: a shadow that is offset or blurred is no edge.
 */
export function ringColour(shadow: string): Rgba | null {
  for (const layer of shadowLayers(shadow)) {
    const colour = /rgba?\([^)]*\)|#[0-9a-f]+/i.exec(layer)?.[0];
    const lengths = layer
      .replace(colour ?? "", "")
      .replace("inset", "")
      .trim()
      .split(/\s+/)
      .map((length) => Number.parseFloat(length));
    if (colour === undefined || lengths.length !== 4 || lengths.some((n) => !Number.isFinite(n)))
      continue;
    const [x, y, blur, spread] = lengths as [number, number, number, number];
    if (x === 0 && y === 0 && blur === 0 && spread > 0) return parseColour(colour);
  }
  return null;
}

/** What the page gave, as the comparison reads it. */
export function measure(raw: Raw): Measure {
  const background = composite(raw.backgrounds);
  const drawn = raw.borderWidth > 0 ? parseColour(raw.borderColour) : null;
  const border = drawn !== null && drawn.a > 0 ? drawn : ringColour(raw.shadow);
  return {
    box: raw.box,
    background,
    border: border !== null && border.a > 0 ? over(border, background) : null,
    radius: px(raw.radius, raw.box.width),
    colour: over(parseColour(raw.colour) ?? WHITE, background),
    fontSize: px(raw.fontSize),
    fontWeight: Number.parseInt(raw.fontWeight, 10),
  };
}

const round = (n: number) => Math.round(n * 10) / 10;

/** The box's numbers that a region compares: x of the edge named, y, and width unless it follows text. */
function boxNumbers(box: Box, follows: Region["followsText"]): Record<string, number> {
  const numbers: Record<string, number> = { y: box.y, height: box.height };
  if (follows === undefined) return { x: box.x, ...numbers, width: box.width };
  if (follows === "start") return { x: box.x, ...numbers };
  if (follows === "centre") return { "centre x": box.x + box.width / 2, ...numbers };
  return { "right x": box.x + box.width, ...numbers };
}

function boxText(numbers: Record<string, number>): string {
  return Object.entries(numbers)
    .map(([key, value]) => `${key} ${round(value)}`)
    .join(", ");
}

/**
 * The differences of one region, by the thresholds: a side where it is not found, its box, its
 * colours after «Contrast», its radius, its font's size and weight. A difference the region's
 * `differs` names carries its row.
 */
export function compareRegion(
  region: Region,
  mockup: Measure | string,
  app: Measure | string,
): Difference[] {
  const found: Difference[] = [];
  const add = (what: Property | "missing", m: string, a: string) => {
    const by = region.differs?.what.includes(what) ? region.differs.by : undefined;
    found.push({ region: region.name, what, mockup: m, app: a, ...(by ? { by } : {}) });
  };
  if (typeof mockup === "string" || typeof app === "string") {
    add(
      "missing",
      typeof mockup === "string" ? mockup : "found",
      typeof app === "string" ? app : "found",
    );
    return found;
  }
  const mBox = boxNumbers(mockup.box, region.followsText);
  const aBox = boxNumbers(app.box, region.followsText);
  if (
    Object.keys(mBox).some((key) => Math.abs((mBox[key] ?? 0) - (aBox[key] ?? 0)) > THRESHOLDS.box)
  )
    add("box", boxText(mBox), boxText(aBox));
  const colours: Record<ColourProperty, [Rgba | null, Rgba | null]> = {
    background: [mockup.background, app.background],
    border: [mockup.border, app.border],
    colour: [mockup.colour, app.colour],
  };
  for (const [property, [m, a]] of Object.entries(colours) as [
    ColourProperty,
    [Rgba | null, Rgba | null],
  ][]) {
    const replaced = region.contrast?.find((c) => c.property === property);
    const show = (c: Rgba | null) => (c === null ? "none" : hex(c));
    if (replaced !== undefined) {
      const want = [parseColour(replaced.mockup), parseColour(replaced.app)];
      const holds = (c: Rgba | null, w: Rgba | null) =>
        c !== null && w !== null && sameColour(c, w);
      if (!holds(m, want[0] ?? null) || !holds(a, want[1] ?? null))
        add(
          property,
          `${show(m)}, by «Contrast» ${replaced.mockup}`,
          `${show(a)}, by «Contrast» ${replaced.app}`,
        );
    } else if (m === null || a === null ? m !== a : !sameColour(m, a)) {
      add(property, show(m), show(a));
    }
  }
  if (Math.abs(mockup.radius - app.radius) > THRESHOLDS.length)
    add("radius", `${round(mockup.radius)}px`, `${round(app.radius)}px`);
  if (Math.abs(mockup.fontSize - app.fontSize) > THRESHOLDS.length)
    add("font-size", `${mockup.fontSize}px`, `${app.fontSize}px`);
  if (mockup.fontWeight !== app.fontWeight)
    add("font-weight", String(mockup.fontWeight), String(app.fontWeight));
  return found;
}

/** What the functions that run in a page read of its style: Node's program has no DOM. */
interface PageStyle {
  readonly backgroundColor: string;
  readonly borderTopWidth: string;
  readonly borderTopColor: string;
  readonly boxShadow: string;
  readonly borderTopLeftRadius: string;
  readonly color: string;
  readonly fontSize: string;
  readonly fontWeight: string;
  readonly visibility: string;
  pointerEvents: string;
}

/** A tree a page's element is in: the document, or a shadow root with its host. */
interface PageRoot {
  readonly host?: PageElement;
  elementsFromPoint(x: number, y: number): PageElement[];
}

/** What the functions that run in a page read of an element. */
export interface PageElement {
  getBoundingClientRect(): Box & { readonly left: number; readonly top: number };
  getRootNode(): PageRoot;
  getAttribute(name: string): string | null;
  contains(other: PageElement): boolean;
  readonly parentElement: PageElement | null;
  readonly tagName: string;
  readonly classList: { contains(name: string): boolean };
  readonly textContent: string | null;
  readonly style?: { pointerEvents: string };
  readonly ownerDocument: {
    readonly defaultView: { readonly innerWidth: number; readonly innerHeight: number } | null;
  };
}

declare function getComputedStyle(element: PageElement): PageStyle;
declare const document: {
  getElementById(id: string): { querySelectorAll(selectors: string): Iterable<PageElement> } | null;
};

/**
 * Reads an element in its page: its box, its computed style, and the backgrounds of what it stands
 * on — the elements under the centre of its box, in the order they are painted, in its own tree
 * and through the host of a shadow root, the element made to take the pointer for the moment of
 * the reading; or, when another covers it there, its ancestors. It runs in the page, so it refers
 * to nothing outside itself.
 */
export function readElement(element: PageElement): Raw {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const view = element.ownerDocument.defaultView;
  const width = view?.innerWidth ?? rect.left + rect.width;
  const height = view?.innerHeight ?? rect.top + rect.height;
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), width - 1);
  const y = Math.min(Math.max(rect.top + rect.height / 2, 0), height - 1);
  const was = element.style?.pointerEvents;
  if (element.style !== undefined) element.style.pointerEvents = "auto";
  const stack = element.getRootNode().elementsFromPoint(x, y);
  if (element.style !== undefined) element.style.pointerEvents = was ?? "";
  const at = stack.indexOf(element);
  const below: PageElement[] = [];
  if (at >= 0) {
    for (const under of stack.slice(at + 1)) if (!element.contains(under)) below.push(under);
  } else {
    const parent = (e: PageElement) => e.parentElement ?? e.getRootNode().host ?? null;
    for (let up = parent(element); up !== null; up = parent(up)) below.push(up);
  }
  return {
    box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    backgrounds: [style.backgroundColor, ...below.map((e) => getComputedStyle(e).backgroundColor)],
    borderWidth: Number.parseFloat(style.borderTopWidth) || 0,
    borderColour: style.borderTopColor,
    shadow: style.boxShadow,
    radius: style.borderTopLeftRadius,
    colour: style.color,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
  };
}

/** The locator of a region on its side. */
export function locate(where: Page | Frame, find: Find): Locator {
  if ("role" in find)
    return where.getByRole(find.role as Parameters<Page["getByRole"]>[0], {
      name: find.name,
      exact: true,
    });
  if ("text" in find) return where.getByText(find.text);
  return where.locator(find.css);
}

/** A region read on its side, or why it could not be: not there, hidden, or more than one. */
export async function readRegion(where: Page | Frame, find: Find): Promise<Measure | string> {
  const found = locate(where, find);
  const count = await found.count();
  if (count === 0) return "not found";
  if (count > 1) return `${count} found`;
  if (!(await found.isVisible())) return "hidden";
  return measure(await found.evaluate(readElement));
}

/** The address of a state on the mockup's page. */
export function stateUrl(origin: string, state: string, device: Device): string {
  return `${origin}/tools/mockup/?screen=${encodeURIComponent(state)}&device=${device}`;
}

/** A state of the mockup open in a page of its own, with what went wrong on the way. */
export interface Opened {
  readonly page: Page;
  readonly problems: string[];
}

/**
 * Opens a state in a new page of the context: it has to reach data-ready="true" with no error in
 * the console and no uncaught exception; "error" brings the reason the page writes.
 */
export async function openState(context: BrowserContext, url: string): Promise<Opened> {
  const page = await context.newPage();
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`exception: ${error.message}`));
  await page.goto(url);
  await page.waitForSelector("html[data-ready]");
  const ready = await page.getAttribute("html", "data-ready");
  if (ready !== "true") {
    const reason = await page
      .locator(".error")
      .first()
      .textContent({ timeout: 1000 })
      .catch(() => null);
    problems.push(`data-ready="${ready}"${reason ? `: ${reason}` : ""}`);
  }
  return { page, problems };
}

/** A new context of the browser at a size of the mockup, without motion (its README). */
export function deviceContext(browser: Browser, device: Device): Promise<BrowserContext> {
  const [width, height] = SIZES[device];
  return browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
}

/** One shape the mockup draws, for the agreement of the engines. */
export interface Shape {
  readonly path: string;
  readonly box: Box;
  readonly style: string;
}

/**
 * The shapes of the mockup's frame, in the order of its tree: each button, field and glass, and
 * each element with a fill or a radius, with a box of its own. It runs in the page.
 */
export function readShapes(): Shape[] {
  const frame = document.getElementById("frame");
  const shapes: Shape[] = [];
  if (frame === null) return shapes;
  for (const element of frame.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    const filled =
      style.backgroundColor !== "rgba(0, 0, 0, 0)" && style.backgroundColor !== "transparent";
    const shaped =
      ["BUTTON", "INPUT", "TEXTAREA"].includes(element.tagName) ||
      element.classList.contains("glass") ||
      filled ||
      Number.parseFloat(style.borderTopLeftRadius) > 0;
    const rect = element.getBoundingClientRect();
    if (!shaped || rect.width === 0 || rect.height === 0 || style.visibility === "hidden") continue;
    const label =
      element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 32) ?? "";
    shapes.push({
      path: `${element.tagName.toLowerCase()} "${label.replace(/\s+/g, " ")}"`,
      box: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      style: [
        style.backgroundColor,
        style.borderTopLeftRadius,
        style.color,
        style.fontSize,
        style.fontWeight,
      ].join(" "),
    });
  }
  return shapes;
}

/**
 * Where the engines' shapes of one state part: a count that differs, a box beyond 2 CSS px read to
 * a tenth of a pixel, a style that is not the same. The first engine is the one the others are
 * read against.
 */
export function disagreements(byEngine: Readonly<Record<string, readonly Shape[]>>): string[] {
  const [first, ...others] = Object.entries(byEngine);
  if (first === undefined) return [];
  const [base, shapes] = first;
  const found: string[] = [];
  for (const [engine, theirs] of others) {
    if (theirs.length !== shapes.length) {
      found.push(`${engine}: ${theirs.length} shapes, ${base} ${shapes.length}`);
      continue;
    }
    shapes.forEach((shape, i) => {
      const their = theirs[i] as Shape;
      const apart = (["x", "y", "width", "height"] as const).filter(
        (key) => round(Math.abs(shape.box[key] - their.box[key])) > THRESHOLDS.engines,
      );
      if (apart.length > 0)
        found.push(
          `${engine}: ${shape.path} ${apart.map((k) => `${k} ${round(their.box[k])}, ${base} ${round(shape.box[k])}`).join("; ")}`,
        );
      if (their.style !== shape.style)
        found.push(`${engine}: ${shape.path} ${their.style}, ${base} ${shape.style}`);
    });
  }
  return found;
}

/** The mockup's server, from the spec folder given, on a free port of 127.0.0.1. */
export async function serveMockup(spec: string): Promise<{ origin: string; server: Server }> {
  const module = (await import(
    pathToFileURL(join(resolve(spec), "tools/mockup/serve.mjs")).href
  )) as {
    createServer: () => Server;
  };
  const server = module.createServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  server.unref();
  const address = server.address();
  if (address === null || typeof address === "string")
    throw new Error("the mockup's server has no port");
  return { origin: `http://127.0.0.1:${address.port}`, server };
}

/** The file name of a state's output in a device and an engine. */
export function outName(state: string, device: Device, engine: string, what: string): string {
  return join(OUT, `${state}.${device}.${engine}.${what}`);
}

/** Writes a file of the run's output, its folder first. */
export function writeOut(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

/** The lines of a report: one per difference, with its numbers, and the row that holds it. */
export function reportLines(
  state: string,
  device: Device,
  engine: string,
  differences: readonly Difference[],
): string[] {
  if (differences.length === 0) return [`${state} on ${device} in ${engine}: as the mockup`];
  return [
    `${state} on ${device} in ${engine}: ${differences.length} differences`,
    ...differences.map(
      (d) =>
        `  ${d.region} — ${d.what}: mockup ${d.mockup}; app ${d.app}${d.by ? ` (by ${d.by})` : ""}`,
    ),
  ];
}
