// The tests of the app: logic in Node, screens in Chromium (R03 in docs/decisions.md; section 3.1
// of docs/architecture.md). Chrome Headless Shell comes from the toolchain stage of
// .devcontainer/Dockerfile, which names it in PLAYWRIGHT_BROWSERS_PATH (R79 in spec).
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

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
      {
        plugins: [react()],
        test: {
          name: "browser",
          include: ["src/**/*.browser.test.{ts,tsx}"],
          setupFiles: ["src/test/browser.setup.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            // Headless whatever CI says: there is no display in the container or on the runner.
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
