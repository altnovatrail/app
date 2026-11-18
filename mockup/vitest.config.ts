// The comparison with the interface mockup (R58): `just mockup-compare` runs both projects, in
// Chromium, WebKit and Firefox, whose browsers draw system-ui by mockup/fonts.conf. "mockup
// engines", in Node, opens every state of the mockup's first slice in the three engines and holds
// them to each other; "mockup", in the browser, draws app's screens as the screen tests do — the
// routing transport in place of api, synthetic data — and compares each with its state of the
// mockup by the command of compare.ts. Not a part of ci-test or of its coverage: it reads spec/,
// which only CI's job Mockup checks out.
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import { FONTS } from "../scripts/mockup.ts";
import { mockupCompare } from "./compare.ts";

/** The browsers' environment: the system's, with the fonts of the comparison, as engines.node.test.ts launches its own. */
const env = { ...process.env, FONTCONFIG_FILE: FONTS } as Record<string, string>;

export default defineConfig({
  test: {
    // What each state found is the run's report.
    silent: false,
    projects: [
      {
        test: {
          name: "mockup engines",
          include: ["mockup/**/*.node.test.ts"],
          environment: "node",
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
      {
        plugins: [react()],
        test: {
          name: "mockup",
          include: ["mockup/**/*.browser.test.tsx"],
          setupFiles: ["src/test/browser.setup.ts"],
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({
              launchOptions: { env },
              contextOptions: { reducedMotion: "reduce" },
            }),
            instances: (["chromium", "webkit", "firefox"] as const).map((browser) => ({
              browser,
              name: `mockup (${browser})`,
            })),
            commands: { mockupCompare },
          },
        },
      },
    ],
  },
});
