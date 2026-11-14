// The path of the first slice in a browser, without the author (R44 in docs/decisions.md; section
// 3.7 of docs/architecture.md): `just walk` runs walk/path.test.ts on the development server against
// a local api, in each engine NOVATRAIL_WALK_ENGINES names. It is not a part of ci-test or of its
// coverage: it needs api's `just dev-app` running, which CI does not have.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "walk",
    include: ["walk/**/*.test.ts"],
    environment: "node",
    // One engine after another, each on the one development server of port 5173.
    fileParallelism: false,
    // What the walk met on the way — the lesson, the kind of each task — is its report.
    silent: false,
    testTimeout: 300_000,
    hookTimeout: 120_000,
    // A screen waits on api and the packages' views: polls wait as long as Playwright's own waits.
    expect: { poll: { timeout: 30_000 } },
  },
});
