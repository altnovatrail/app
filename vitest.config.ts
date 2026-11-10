// The tests of the app: logic in Node, screens in Chromium, and the screens once more in two modes
// of the browser's context — forced colours and reduced motion — each in a project of its own, its
// mode there from the start, as canvas has it (R03 and R17 in docs/decisions.md; sections 3.1 and
// 3.9 of docs/architecture.md). Chrome Headless Shell comes from the toolchain stage of
// .devcontainer/Dockerfile, which names it in PLAYWRIGHT_BROWSERS_PATH (R79 in spec).
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defaultExclude, defineConfig } from "vitest/config";

/** The files of the two modes of the browser's context, each in a project of its own (R17). */
const FORCED_COLORS = "src/a11y/forced-colors.browser.test.tsx";
const REDUCED_MOTION = "src/a11y/reduced-motion.browser.test.tsx";

/** A project in Chromium: its files, and the options of the browser's context it opens with. */
function chromium(name: string, include: string[], contextOptions = {}, exclude: string[] = []) {
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
        instances: [{ browser: "chromium" as const, name }],
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
      chromium("browser", ["src/**/*.browser.test.{ts,tsx}"], {}, [FORCED_COLORS, REDUCED_MOTION]),
      chromium("forced colors", [FORCED_COLORS], { forcedColors: "active" }),
      chromium("reduced motion", [REDUCED_MOTION], { reducedMotion: "reduce" }),
    ],
  },
});
