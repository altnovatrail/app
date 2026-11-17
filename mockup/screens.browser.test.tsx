// app's screens against the interface mockup (R58 in docs/decisions.md): each entry draws a screen
// as the screen tests do, synthetic and with no api, at each size of the mockup, and compares its
// regions with the mockup's state of the same name in the same engine. An entry with `until` is a
// screen whose task of epic E5 has not come yet: its differences are reported in mockup/out/ and
// not held. Once that task has brought it to the mockup, `until` goes, and every difference but
// those a region's `differs` names fails the test.
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import "@altnovatrail/canvas";
import "../src/theme/theme.css";
import { Example } from "../src/lesson/Example.tsx";
import { ContinueButton, LessonScreen } from "../src/lesson/LessonScreen.tsx";
import { SignInScreen } from "../src/signin/SignInScreen.tsx";
import { NO_VERDICTS } from "../src/task/attempt.ts";
import { initialState } from "../src/task/steps.ts";
import { TaskScreen } from "../src/task/TaskScreen.tsx";
import { inLanguage } from "../src/test/language.tsx";
import { type Device, type Difference, type Region, SIZES } from "./regions.ts";

declare module "vitest/browser" {
  interface BrowserCommands {
    mockupCompare: (
      state: string,
      device: Device,
      regions: readonly Region[],
    ) => Promise<Difference[]>;
  }
}

interface Compared {
  /** The state of the mockup's table «Screens and states». */
  readonly state: string;
  readonly draw: () => ReactNode;
  readonly regions: readonly Region[];
  /** The task of epic E5 that brings the screen to the mockup, while it has not. */
  readonly until?: string;
  /** What a screen that draws in an effect waits for before it is read: its last element shown. */
  readonly settle?: () => Promise<unknown>;
  /** The sizes it is compared at, when not both. */
  readonly devices?: readonly Device[];
}

const noMedia = () => Promise.reject(new Error("no file in this test"));

/** The task screen on a squared sheet, on my own, with nothing written: the canvas's bar of tools. */
function sheetTask() {
  return inLanguage(
    <TaskScreen
      task={{
        id: "rungs",
        statement: [{ text: "The rungs are 30 cm apart." }],
        canvas: { kind: "handwriting_sheet", grid: "squares" },
        items: [{ text: "How many rungs?", answer_slots: [{ binding: "anywhere" }] }],
      }}
      manifest={undefined}
      steps={[]}
      catalog={undefined}
      state={initialState("self")}
      mode="self"
      verdicts={NO_VERDICTS}
      filled={[[false]]}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={false}
      blink={false}
      panelOpen={false}
      onHistoryChange={() => {}}
      onMode={() => {}}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onChoose={() => {}}
      onCheck={() => {}}
      onHint={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
    />,
  );
}

/** A lesson's worked example before Next, its Continue in the canvas's row. */
function workedExample() {
  return inLanguage(
    <LessonScreen
      title="Gaps and posts"
      language="en"
      course={{ kinds: ["explanation", "example", "task"], ended: new Set() }}
      place={2}
      shown={2}
      unsaved={false}
      pending={false}
      onGoTo={() => {}}
      onNote={() => {}}
      onLeave={() => {}}
    >
      <Example
        example={{
          statement: [{ text: "A path is 20 m long, with a tree every 5 m." }],
          canvas: { kind: "handwriting_sheet", grid: "squares" },
          demo: [{ text: "20 ÷ 5 = 4 gaps." }, { text: "5 trees." }],
        }}
        manifest={undefined}
        media={noMedia}
        demo={undefined}
        onDemo={() => {}}
        actions={<ContinueButton slot="actions" pending={false} onContinue={() => {}} />}
      />
    </LessonScreen>,
  );
}

/**
 * The element's own buttons drawn, its shadow tree holding the toolbar, and the page scrolled to
 * the element's top, where the mockup's sheet stands: the bar's band is then the window's.
 */
async function barDrawn() {
  let element: Element | null = null;
  await waitFor(() => {
    element = document.querySelector("novatrail-canvas");
    expect(element?.shadowRoot?.querySelector('[role="toolbar"] button')).toBeTruthy();
  });
  (element as Element | null)?.scrollIntoView({ block: "start" });
}

/**
 * Why the canvas's bar stands elsewhere than the mockup has it, the sheet scrolled to the top: the
 * screen keeps its padding of 16 around the element (R59), till the task screen and the lesson are
 * drawn as the mockup, T84 and T85; and "Draw with finger" with its line, 57 px, comes only in pen
 * mode (R29 in canvas), so the bar is that much lower and its top half of it further down.
 */
const PLACED =
  'the screen\'s padding of 16, R59; "Draw with finger" only in pen mode, R29 in canvas';

/** A button the bar shows by its icon alone: the font of its caption, out of sight, is not drawn. */
const ICON_ALONE = "the caption is out of sight (R60; R84 in canvas)";

/** The canvas's bar of glass, its first tool and the zoom (R84 in canvas). */
const BAR: readonly Region[] = [
  {
    name: "the tool bar",
    mockup: { css: 'div.glass:has(> button[aria-label="Zoom in"])' },
    app: { role: "toolbar", name: "Sheet buttons" },
    differs: { what: ["x", "y", "height", "font-size"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "the pen, the tool in use",
    mockup: { role: "button", name: "Pen" },
    app: { role: "radio", name: "Pen" },
    differs: { what: ["x", "y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
  },
  {
    name: "Zoom in",
    mockup: { role: "button", name: "Zoom in" },
    app: { role: "button", name: "Zoom in" },
    differs: { what: ["x", "y", "font-size", "font-weight"], by: `${PLACED}; ${ICON_ALONE}` },
  },
];

const SCREENS: readonly Compared[] = [
  {
    state: "signin",
    until: "T81",
    draw: () =>
      inLanguage(<SignInScreen onSignIn={async () => ({ kind: "closed" })} onLegal={() => {}} />),
    regions: [
      {
        name: "the heading",
        mockup: { text: "Learn anything" },
        app: { role: "heading", name: "Sign in" },
      },
      {
        name: "the primary button",
        mockup: { role: "button", name: "Continue with Google" },
        app: { role: "button", name: "Sign in with Google" },
      },
      {
        name: "the line for grown-ups",
        mockup: { text: "Accounts are for grown-ups" },
        app: { text: "Accounts are for grown-ups" },
      },
      {
        name: "the way to the legal texts",
        mockup: { role: "button", name: "Privacy Policy" },
        app: { role: "button", name: "Privacy and legal information" },
        followsText: "start",
      },
    ],
  },
  ...(["task-pill", "task-empty"] as const).map((state) => ({
    state,
    draw: sheetTask,
    settle: barDrawn,
    regions: BAR,
  })),
  { state: "task", devices: ["ipad"], draw: sheetTask, settle: barDrawn, regions: BAR },
  {
    state: "example",
    devices: ["ipad"],
    draw: workedExample,
    settle: barDrawn,
    regions: [
      {
        name: "the row of Next, Demo and Continue",
        mockup: { css: 'div.glass:has(> button:text-is("Next"))' },
        app: { css: ".tools.row" },
        followsText: "centre",
        // Its words are its buttons', compared below.
        differs: { what: ["font-size"], by: "no text of its own (R84 in canvas)" },
      },
      {
        name: "Next",
        mockup: { role: "button", name: "Next" },
        app: { role: "button", name: "Next" },
        followsText: "start",
      },
      {
        name: "Continue",
        mockup: { role: "button", name: "Continue" },
        app: { role: "button", name: "Continue" },
        followsText: "end",
      },
    ],
  },
];

describe.each(Object.keys(SIZES) as Device[])("on %s", (device) => {
  const compared = SCREENS.filter((screen) => screen.devices?.includes(device) ?? true);
  it.each(compared)("$state as the mockup", async ({ state, draw, regions, until, settle }) => {
    const [width, height] = SIZES[device];
    await page.viewport(width, height);
    render(draw());
    // As the mockup's page sets data-ready: the screen drawn, its fonts loaded, a frame painted.
    await settle?.();
    await document.fonts.ready;
    await new Promise((painted) => requestAnimationFrame(painted));
    const differences = await commands.mockupCompare(state, device, regions);
    if (until === undefined) expect(differences.filter((d) => d.by === undefined)).toEqual([]);
  });
});
