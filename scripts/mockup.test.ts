// The comparison with the interface mockup (R58 in docs/decisions.md): the colours laid over what
// they stand on, the thresholds of a region and of the engines, and what is read in a page —
// here in Chromium, on synthetic pages: CI's job of the tests has no spec/, whose mockup
// `just mockup-compare` opens in the three engines.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Browser, chromium, type Page } from "playwright";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Region } from "../mockup/regions.ts";
import {
  compareRegion,
  composite,
  deviceContext,
  disagreements,
  hex,
  type Measure,
  measure,
  OUT,
  openState,
  outName,
  over,
  type PageElement,
  parseColour,
  px,
  type Raw,
  readElement,
  readRegion,
  readShapes,
  reportLines,
  ringColour,
  type Shape,
  sameColour,
  serveMockup,
  stateUrl,
  writeOut,
} from "./mockup.ts";

const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const INK = { r: 29, g: 29, b: 31, a: 1 };

describe("colours", () => {
  it("reads what CSS and the engines write", () => {
    expect(parseColour("#fff")).toEqual(WHITE);
    expect(parseColour("#1D1D1F")).toEqual(INK);
    expect(parseColour("rgb(29, 29, 31)")).toEqual(INK);
    expect(parseColour("rgba(255, 255, 255, 0.76)")).toEqual({ ...WHITE, a: 0.76 });
    expect(parseColour("rgb(255 255 255 / 50%)")).toEqual({ ...WHITE, a: 0.5 });
    expect(parseColour("rgb(100% 0% 50%)")).toEqual({ r: 255, g: 0, b: 127.5, a: 1 });
    expect(parseColour(" Transparent ")).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("takes nothing else", () => {
    for (const text of ["", "red", "#12", "rgb(1, 2)", "rgb(1, 2, x)", "hsl(0 0% 0%)"])
      expect(parseColour(text)).toBeNull();
  });

  it("lays a translucent colour over what it stands on, and all over white", () => {
    expect(hex(over({ ...WHITE, a: 0.76 }, parseColour("#F2F2F7") ?? WHITE))).toBe("#fcfcfd");
    expect(over({ ...WHITE, a: 0 }, { ...WHITE, a: 0 })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(hex(composite(["rgba(0, 0, 0, 0)", "rgba(118, 118, 128, 0.12)", "#FFFFFF"]))).toBe(
      "#efeff0",
    );
    expect(composite(["not a colour"])).toEqual(WHITE);
    expect(composite([])).toEqual(WHITE);
  });

  it("agree within 2 of 255 in each channel", () => {
    expect(sameColour(INK, { r: 31, g: 27, b: 31, a: 1 })).toBe(true);
    expect(sameColour(INK, { r: 32, g: 29, b: 31, a: 1 })).toBe(false);
    expect(sameColour(INK, { r: 29, g: 29, b: 34, a: 1 })).toBe(false);
    expect(sameColour(INK, { r: 29, g: 26, b: 31, a: 1 })).toBe(false);
  });

  it("finds the ring of a shadow, inset or not, and no other shadow", () => {
    expect(
      ringColour("rgb(210, 210, 215) 0px 0px 0px 1px inset, rgba(0, 0, 0, 0.04) 0px 1px 2px 0px"),
    ).toEqual({ r: 210, g: 210, b: 215, a: 1 });
    expect(ringColour("rgba(0, 0, 0, 0.04) 0px 1px 2px 0px, #8E8E93 0px 0px 0px 0.5px")).toEqual({
      r: 142,
      g: 142,
      b: 147,
      a: 1,
    });
    expect(ringColour("rgba(0, 0, 0, 0.08) 0px 8px 28px 0px")).toBeNull();
    expect(ringColour("none")).toBeNull();
    expect(ringColour("rgb(0, 0, 0) 0px 0px")).toBeNull();
  });
});

describe("lengths", () => {
  it("reads px and a share of the width", () => {
    expect(px("14px")).toBe(14);
    expect(px("50%", 44)).toBe(22);
    expect(px("auto")).toBe(0);
  });
});

const RAW: Raw = {
  box: { x: 10, y: 20, width: 100, height: 52 },
  backgrounds: ["rgba(0, 0, 0, 0)", "rgb(255, 255, 255)"],
  borderWidth: 0,
  borderColour: "rgb(0, 0, 0)",
  shadow: "rgb(210, 210, 215) 0px 0px 0px 1px inset",
  radius: "14px",
  colour: "rgb(29, 29, 31)",
  fontSize: "16px",
  fontWeight: "600",
};

describe("a measure", () => {
  it("lays every colour over the background, and takes a ring for an edge", () => {
    expect(measure(RAW)).toEqual({
      box: RAW.box,
      background: WHITE,
      border: { r: 210, g: 210, b: 215, a: 1 },
      radius: 14,
      colour: INK,
      fontSize: 16,
      fontWeight: 600,
    });
  });

  it("takes a border before a ring, and no edge that cannot be seen", () => {
    expect(measure({ ...RAW, borderWidth: 1, borderColour: "#8E8E93" }).border).toEqual({
      r: 142,
      g: 142,
      b: 147,
      a: 1,
    });
    expect(measure({ ...RAW, shadow: "rgba(0, 0, 0, 0) 0px 0px 0px 1px" }).border).toBeNull();
    expect(measure({ ...RAW, shadow: "none" }).border).toBeNull();
    expect(measure({ ...RAW, borderWidth: 1, borderColour: "rgba(0, 0, 0, 0)" }).border).toEqual({
      r: 210,
      g: 210,
      b: 215,
      a: 1,
    });
  });
});

const BUTTON: Measure = measure(RAW);
const REGION: Region = {
  name: "the primary button",
  mockup: { role: "button", name: "Continue with Google" },
  app: { role: "button", name: "Continue with Google" },
};

describe("a region", () => {
  it("holds nothing within the thresholds", () => {
    const near: Measure = {
      ...BUTTON,
      box: { x: 14, y: 16, width: 104, height: 48 },
      colour: { r: 31, g: 27, b: 29, a: 1 },
      radius: 14.5,
      fontSize: 15.5,
    };
    expect(compareRegion(REGION, BUTTON, near)).toEqual([]);
  });

  it("names a side where it is not found", () => {
    expect(compareRegion(REGION, BUTTON, "not found")).toEqual([
      { region: "the primary button", what: "missing", mockup: "found", app: "not found" },
    ]);
    expect(compareRegion(REGION, "2 found", BUTTON)).toEqual([
      { region: "the primary button", what: "missing", mockup: "2 found", app: "found" },
    ]);
  });

  it("names each property beyond its threshold, with both sides' numbers", () => {
    const other: Measure = {
      box: { x: 10, y: 20, width: 104.5, height: 52 },
      background: { r: 0, g: 113, b: 227, a: 1 },
      border: null,
      radius: 13,
      colour: WHITE,
      fontSize: 15,
      fontWeight: 500,
    };
    expect(compareRegion(REGION, BUTTON, other)).toEqual([
      {
        region: "the primary button",
        what: "box",
        mockup: "x 10, y 20, height 52, width 100",
        app: "x 10, y 20, height 52, width 104.5",
      },
      { region: "the primary button", what: "background", mockup: "#ffffff", app: "#0071e3" },
      { region: "the primary button", what: "border", mockup: "#d2d2d7", app: "none" },
      { region: "the primary button", what: "colour", mockup: "#1d1d1f", app: "#ffffff" },
      { region: "the primary button", what: "radius", mockup: "14px", app: "13px" },
      { region: "the primary button", what: "font-size", mockup: "16px", app: "15px" },
      { region: "the primary button", what: "font-weight", mockup: "600", app: "500" },
    ]);
  });

  it("reads a region whose width follows its caption by the edge it names", () => {
    const wider = { ...BUTTON, box: { ...BUTTON.box, x: 0, width: 120 } };
    const boxes = (followsText: Region["followsText"], app: Measure) =>
      compareRegion({ ...REGION, followsText }, BUTTON, app).map((d) => `${d.mockup} | ${d.app}`);
    expect(boxes("centre", wider)).toEqual([]);
    expect(boxes("start", wider)).toEqual(["x 10, y 20, height 52 | x 0, y 20, height 52"]);
    expect(boxes("end", wider)).toEqual([
      "right x 110, y 20, height 52 | right x 120, y 20, height 52",
    ]);
    expect(boxes("start", { ...BUTTON, box: { ...BUTTON.box, width: 300 } })).toEqual([]);
  });

  it("holds the colours of «Contrast» on either side", () => {
    const link: Measure = { ...BUTTON, border: null, colour: parseColour("#0071E3") ?? WHITE };
    const contrast = [{ property: "colour" as const, mockup: "#0071E3", app: "#0066CC" }];
    const region = { ...REGION, contrast };
    expect(
      compareRegion(region, link, { ...link, colour: parseColour("#0066CC") ?? WHITE }),
    ).toEqual([]);
    expect(compareRegion(region, link, link)).toEqual([
      {
        region: "the primary button",
        what: "colour",
        mockup: "#0071e3, by «Contrast» #0071E3",
        app: "#0071e3, by «Contrast» #0066CC",
      },
    ]);
    expect(
      compareRegion(
        { ...REGION, contrast: [{ property: "border", mockup: "#C7C7CC", app: "#8E8E93" }] },
        link,
        link,
      ).map((d) => d.what),
    ).toEqual(["border"]);
  });

  it("reports what a row of the README holds, with the row", () => {
    const region: Region = {
      ...REGION,
      differs: { what: ["font-weight", "missing"], by: "«Where it differs», the system font" },
    };
    expect(compareRegion(region, BUTTON, { ...BUTTON, fontWeight: 400 })).toEqual([
      {
        region: "the primary button",
        what: "font-weight",
        mockup: "600",
        app: "400",
        by: "«Where it differs», the system font",
      },
    ]);
    expect(compareRegion(region, BUTTON, "hidden")[0]?.by).toBe(
      "«Where it differs», the system font",
    );
  });

  it("is reported line by line", () => {
    expect(reportLines("signin", "phone", "webkit", [])).toEqual([
      "signin on phone in webkit: as the mockup",
    ]);
    expect(
      reportLines("signin", "ipad", "firefox", [
        { region: "the art", what: "missing", mockup: "found", app: "not found" },
        { region: "the heading", what: "font-size", mockup: "32px", app: "28px", by: "R17" },
      ]),
    ).toEqual([
      "signin on ipad in firefox: 2 differences",
      "  the art — missing: mockup found; app not found",
      "  the heading — font-size: mockup 32px; app 28px (by R17)",
    ]);
  });
});

const shape = (x: number, style = "rgb(255, 255, 255) 14px rgb(29, 29, 31) 16px 600"): Shape => ({
  path: 'button "Continue"',
  box: { x, y: 0, width: 44, height: 44 },
  style,
});

describe("the engines", () => {
  it("agree within 2 CSS px, read to a tenth, and with the same styles", () => {
    expect(disagreements({})).toEqual([]);
    expect(
      disagreements({ chromium: [shape(10)], webkit: [shape(12)], firefox: [shape(7.97)] }),
    ).toEqual([]);
  });

  it("part by a count, a box or a style", () => {
    expect(
      disagreements({
        chromium: [shape(10)],
        webkit: [shape(12.5)],
        firefox: [shape(10, "rgb(0, 0, 0) 14px rgb(29, 29, 31) 16px 600")],
        other: [],
      }),
    ).toEqual([
      'webkit: button "Continue" x 12.5, chromium 10',
      'firefox: button "Continue" rgb(0, 0, 0) 14px rgb(29, 29, 31) 16px 600, chromium rgb(255, 255, 255) 14px rgb(29, 29, 31) 16px 600',
      "other: 0 shapes, chromium 1",
    ]);
  });
});

describe("the files of a run", () => {
  it("are named by state, device and engine in mockup/out/", () => {
    expect(outName("home", "phone", "webkit", "app.png")).toBe(
      join(OUT, "home.phone.webkit.app.png"),
    );
    expect(stateUrl("http://127.0.0.1:1", "task-pill", "ipad")).toBe(
      "http://127.0.0.1:1/tools/mockup/?screen=task-pill&device=ipad",
    );
  });

  it("are written with their folder", () => {
    const folder = mkdtempSync(join(tmpdir(), "mockup-"));
    try {
      const file = join(folder, "out", "a.json");
      writeOut(file, "{}\n");
      expect(readFileSync(file, "utf8")).toBe("{}\n");
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

/** An element of a stand-in page: its box, its style, and its place in the tree. */
interface StandIn {
  rect: { x: number; y: number; width: number; height: number; left: number; top: number };
  style: Record<string, string>;
  tagName: string;
  parentElement: StandIn | null;
  /** The host of the shadow root the element is in. */
  host?: StandIn;
  classes: string[];
  label: string | null;
  text: string | null;
}

function standIn(
  x: number,
  width: number,
  style: Record<string, string>,
  parent: StandIn | null = null,
  {
    tagName = "DIV",
    classes = [] as string[],
    label = null as string | null,
    text = "" as string | null,
  } = {},
): StandIn {
  return {
    rect: { x, y: 0, width, height: 10, left: x, top: 0 },
    style: {
      backgroundColor: "rgba(0, 0, 0, 0)",
      borderTopWidth: "0px",
      borderTopColor: "rgb(0, 0, 0)",
      boxShadow: "none",
      borderTopLeftRadius: "0px",
      color: "rgb(0, 0, 0)",
      fontSize: "16px",
      fontWeight: "400",
      visibility: "visible",
      ...style,
    },
    tagName,
    parentElement: parent,
    classes,
    label,
    text,
  };
}

/**
 * The DOM the two functions that run in a page read, stood in for in Node: v8's coverage sees no
 * code a page runs, and the tests below run them in Chromium as well.
 */
function asElement(
  item: StandIn,
  stack: readonly StandIn[] | null,
  made = new Map<StandIn, PageElement>(),
): PageElement {
  const known = made.get(item);
  if (known !== undefined) return known;
  const element = {
    getBoundingClientRect: () => item.rect,
    get parentElement() {
      return item.parentElement === null ? null : asElement(item.parentElement, stack, made);
    },
    contains: (other: { item?: StandIn }) => other.item === item,
    item,
    tagName: item.tagName,
    classList: { contains: (name: string) => item.classes.includes(name) },
    getAttribute: () => item.label,
    textContent: item.text,
    style: { pointerEvents: "none" },
    getRootNode: () => ({
      host: item.host === undefined ? undefined : asElement(item.host, stack, made),
      elementsFromPoint: () => (stack ?? []).map((under) => asElement(under, stack, made)),
    }),
    ownerDocument: {
      defaultView: stack === null ? null : { innerWidth: 390, innerHeight: 844 },
    },
  } as unknown as PageElement;
  made.set(item, element);
  return element;
}

describe("what runs in the page, stood in for in Node", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads an element over what it stands on, or over its ancestors", () => {
    const sheet = standIn(0, 390, { backgroundColor: "rgb(255, 255, 255)" });
    const page = standIn(0, 390, { backgroundColor: "rgb(242, 242, 247)" });
    const glass = standIn(16, 52, { backgroundColor: "rgba(255, 255, 255, 0.76)" }, page);
    const icon = standIn(20, 20, {}, glass);
    vi.stubGlobal("getComputedStyle", (element: { item: StandIn }) => element.item.style);
    const stacked = readElement(asElement(glass, [icon, glass, sheet, page]));
    expect(stacked.backgrounds).toEqual([
      "rgba(255, 255, 255, 0.76)",
      "rgb(255, 255, 255)",
      "rgb(242, 242, 247)",
    ]);
    expect(stacked.box).toEqual({ x: 16, y: 0, width: 52, height: 10 });
    const alone = readElement(asElement(glass, null));
    expect(alone.backgrounds).toEqual(["rgba(255, 255, 255, 0.76)", "rgb(242, 242, 247)"]);
    const shadowed = standIn(20, 20, { backgroundColor: "rgba(0, 0, 0, 0.1)" });
    shadowed.host = glass;
    expect(readElement(asElement(shadowed, [])).backgrounds).toEqual([
      "rgba(0, 0, 0, 0.1)",
      "rgba(255, 255, 255, 0.76)",
      "rgb(242, 242, 247)",
    ]);
    const element = asElement(glass, []);
    readElement(element);
    expect(element.style?.pointerEvents).toBe("none");
    expect(alone.borderWidth).toBe(0);
    expect(readElement(asElement(standIn(0, 1, { borderTopWidth: "auto" }), [])).borderWidth).toBe(
      0,
    );
  });

  it("reads the shapes of a frame", () => {
    const frame = standIn(0, 390, {});
    const items = [
      standIn(0, 44, {}, frame, { tagName: "BUTTON", label: "Pen" }),
      standIn(0, 52, {}, frame, { classes: ["glass"], text: null }),
      standIn(0, 10, { backgroundColor: "rgb(52, 199, 89)" }, frame, { text: " a  b " }),
      standIn(0, 10, { borderTopLeftRadius: "4px" }, frame),
      standIn(0, 10, { backgroundColor: "transparent" }, frame),
      standIn(0, 0, { backgroundColor: "red" }, frame),
      standIn(0, 10, { backgroundColor: "red", visibility: "hidden" }, frame),
    ];
    vi.stubGlobal("getComputedStyle", (element: { item: StandIn }) => element.item.style);
    vi.stubGlobal("document", {
      getElementById: () => ({ querySelectorAll: () => items.map((i) => asElement(i, [])) }),
    });
    expect(readShapes().map((shape) => shape.path)).toEqual([
      'button "Pen"',
      'div ""',
      'div "a b"',
      'div ""',
    ]);
    vi.stubGlobal("document", { getElementById: () => null });
    expect(readShapes()).toEqual([]);
  });
});

/** Pages of a synthetic mockup, by the path the server is asked. */
const PAGES: Record<string, string> = {
  "/ready": `<html><body><div id="frame"><button>Go</button></div><script>document.documentElement.dataset.ready = "true"</script></body></html>`,
  "/error": `<html><body><div id="frame"><p class="error">no state nowhere</p></div><script>document.documentElement.dataset.ready = "error"</script></body></html>`,
  "/bare": `<html><body><script>document.documentElement.dataset.ready = "error"</script></body></html>`,
  "/noisy": `<html><body><script>console.error("broken"); setTimeout(() => { throw new Error("late") }); setTimeout(() => { document.documentElement.dataset.ready = "true" }, 50)</script></body></html>`,
};

describe("in a browser", () => {
  let browser: Browser;
  let server: Server;
  let origin = "";
  let spec = "";

  beforeAll(async () => {
    browser = await chromium.launch();
    server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      response.end(PAGES[request.url ?? ""] ?? "");
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const address = server.address();
    origin = `http://127.0.0.1:${typeof address === "object" && address !== null ? address.port : 0}`;
    spec = mkdtempSync(join(tmpdir(), "spec-"));
  });

  afterAll(async () => {
    await browser.close();
    server.close();
    rmSync(spec, { recursive: true, force: true });
  });

  async function draw(html: string, run: (page: Page) => Promise<void>) {
    const context = await deviceContext(browser, "phone");
    try {
      const page = await context.newPage();
      await page.setContent(html);
      await run(page);
    } finally {
      await context.close();
    }
  }

  it("opens a context at the size of a device, without motion", async () => {
    const context = await deviceContext(browser, "ipad");
    const page = await context.newPage();
    expect(
      await page.evaluate(
        "[innerWidth, innerHeight, matchMedia('(prefers-reduced-motion: reduce)').matches]",
      ),
    ).toEqual([1194, 834, true]);
    await context.close();
  });

  it("opens a state that is ready, and says why one is not", async () => {
    const context = await deviceContext(browser, "phone");
    try {
      expect((await openState(context, `${origin}/ready`)).problems).toEqual([]);
      expect((await openState(context, `${origin}/error`)).problems).toEqual([
        'data-ready="error": no state nowhere',
      ]);
      expect((await openState(context, `${origin}/bare`)).problems).toEqual(['data-ready="error"']);
      const noisy = await openState(context, `${origin}/noisy`);
      await noisy.page.waitForTimeout(100);
      expect(noisy.problems).toEqual(["console: broken", "exception: late"]);
    } finally {
      await context.close();
    }
  });

  it("reads a region over what it stands on, by role, text or CSS", async () => {
    await draw(
      `<body style="margin:0;background:#F2F2F7">
        <div style="position:absolute;inset:0;background:#fff"></div>
        <div class="bar" style="position:absolute;left:16px;top:14px;width:158px;height:48px;border-radius:24px;background:rgba(255,255,255,0.76);box-shadow:0 0 0 0.5px rgba(0,0,0,0.08)">
          <button style="all:unset;display:block;width:44px;height:44px;border-radius:50%;color:#1D1D1F;font:600 14px sans-serif">Back</button>
        </div>
        <p style="position:absolute;top:100px;pointer-events:none;color:#6E6E73;font:13px sans-serif">Accounts are<br>for grown-ups</p>
        <i style="display:none">Hidden</i>
        <span>Twice</span><span>Twice</span>
      </body>`,
      async (page) => {
        const bar = await readRegion(page, { css: ".bar" });
        expect(typeof bar === "object" && hex(bar.background)).toBe("#ffffff");
        expect(typeof bar === "object" && bar.box).toEqual({
          x: 16,
          y: 14,
          width: 158,
          height: 48,
        });
        expect(typeof bar === "object" && bar.border !== null && hex(bar.border)).toBe("#ebebeb");
        const back = await readRegion(page, { role: "button", name: "Back" });
        expect(
          typeof back === "object" && [back.radius, back.fontWeight, hex(back.colour)],
        ).toEqual([22, 600, "#1d1d1f"]);
        const line = await readRegion(page, { text: "Accounts are" });
        expect(typeof line === "object" && hex(line.background)).toBe("#ffffff");
        expect(await page.locator("p").evaluate((p) => p.style.pointerEvents)).toBe("none");
        expect(await readRegion(page, { role: "button", name: "Next" })).toBe("not found");
        expect(await readRegion(page, { text: "Twice" })).toBe("2 found");
        expect(await readRegion(page, { css: "i" })).toBe("hidden");
      },
    );
  });

  it("reads the shapes of the mockup's frame", async () => {
    await draw(
      `<div id="frame">
        <div class="glass" style="width:52px;height:100px"></div>
        <button aria-label="Pen" style="width:44px;height:44px;background:rgba(0,113,227,0.12);border-radius:22px"></button>
        <span style="display:inline-block;width:10px;height:10px;background:#34C759">  mastered
        skill </span>
        <span>plain text</span>
        <div style="width:0;height:10px;background:red"></div>
        <div style="visibility:hidden;width:10px;height:10px;background:red"></div>
      </div>`,
      async (page) => {
        expect((await page.evaluate(readShapes)).map((s) => s.path)).toEqual([
          'div ""',
          'button "Pen"',
          'span "mastered skill"',
        ]);
      },
    );
    await draw("<p>No frame</p>", async (page) => {
      expect(await page.evaluate(readShapes)).toEqual([]);
    });
  });

  it("serves the mockup from the spec folder given", async () => {
    writeFileSync(
      join(spec, "serve.mjs"),
      `import http from "node:http";
       export const createServer = () => http.createServer((q, s) => s.end("mockup " + q.url));`,
    );
    const tools = join(spec, "tools", "mockup");
    mkdirSync(tools, { recursive: true });
    writeFileSync(join(tools, "serve.mjs"), readFileSync(join(spec, "serve.mjs")));
    const served = await serveMockup(spec);
    try {
      expect(await (await fetch(`${served.origin}/tools/mockup/`)).text()).toBe(
        "mockup /tools/mockup/",
      );
    } finally {
      served.server.close();
    }
  });
});
