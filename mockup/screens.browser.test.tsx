// app's screens against the interface mockup (R58 in docs/decisions.md): each entry draws a screen
// as the screen tests do, synthetic and with no api, at each size of the mockup, and compares its
// regions with the mockup's state of the same name in the same engine. An entry with `until` is a
// screen whose task of epic E5 has not come yet: its differences are reported in mockup/out/ and
// not held. Once that task has brought it to the mockup, `until` goes, and every difference but
// those a region's `differs` names fails the test.
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { commands, page } from "vitest/browser";
import "../src/theme/theme.css";
import { SignInScreen } from "../src/signin/SignInScreen.tsx";
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
}

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
];

describe.each(Object.keys(SIZES) as Device[])("on %s", (device) => {
  it.each(SCREENS)("$state as the mockup", async ({ state, draw, regions, until }) => {
    const [width, height] = SIZES[device];
    await page.viewport(width, height);
    render(draw());
    const differences = await commands.mockupCompare(state, device, regions);
    if (until === undefined) expect(differences.filter((d) => d.by === undefined)).toEqual([]);
  });
});
