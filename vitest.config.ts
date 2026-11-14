// The tests of the app: logic in Node, screens in Chromium, WebKit and Firefox, and the screens once
// more in two modes of the browser's context — forced colours and reduced motion — each in a project
// of its own, its mode there from the start, as canvas has it (R03, R17 and R45 in
// docs/decisions.md; sections 3.1 and 3.9 of docs/architecture.md). The three engines come from the
// toolchain stage of .devcontainer/Dockerfile, which names them in PLAYWRIGHT_BROWSERS_PATH (R79 in
// spec). Each project has an instance per engine, named "<project> (<engine>)": ci-test takes the
// coverage of Node and Chromium alone, since Vitest's v8 coverage works in Chromium only (sources 2.5).
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defaultExclude, defineConfig } from "vitest/config";

/** The files of the two modes of the browser's context, each in a project of its own (R17). */
const FORCED_COLORS = "src/a11y/forced-colors.browser.test.tsx";
const REDUCED_MOTION = "src/a11y/reduced-motion.browser.test.tsx";

type Engine = "chromium" | "webkit" | "firefox";

/** Every engine the screens are tested in (R45). */
const ENGINES: Engine[] = ["chromium", "webkit", "firefox"];

/**
 * A project of the screens: its files, the options of the browser's context it opens with, and the
 * engines it runs in.
 */
function screens(
  name: string,
  include: string[],
  { contextOptions = {}, exclude = [] as string[], engines = ENGINES } = {},
) {
  return {
    plugins: [react()],
    test: {
      name,
      include,
      exclude: [...defaultExclude, ...exclude],
      setupFiles: ["src/test/browser.setup.ts"],
      browser: {
        enabled: true,
        provider: playwright({ contextOptions }),
        // Headless whatever CI says: there is no display in the container or on the runner.
        headless: true,
        instances: engines.map((browser) => ({ browser, name: `${name} (${browser})` })),
      },
    },
  };
}

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      // Every module of the app and of its scripts, so that one no test loads shows with zeros.
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.ts"],
      // The entry only renders the shell into index.html, which the built page test of T17 opens;
      // the setup of the browser tests is no code of the app.
      exclude: ["**/*.test.{ts,tsx}", "src/main.tsx", "src/test/**"],
      reporter: ["lcovonly", "text-summary"],
    },
    projects: [
      {
        test: {
          name: "node",
          include: ["src/**/*.node.test.ts", "scripts/**/*.test.ts"],
          environment: "node",
        },
      },
      screens("browser", ["src/**/*.browser.test.{ts,tsx}"], {
        exclude: [FORCED_COLORS, REDUCED_MOTION],
      }),
      // WebKit has no forced colours to emulate (measurements 2).
      screens("forced colors", [FORCED_COLORS], {
        contextOptions: { forcedColors: "active" },
        engines: ["chromium", "firefox"],
      }),
      screens("reduced motion", [REDUCED_MOTION], { contextOptions: { reducedMotion: "reduce" } }),
    ],
  },
});
