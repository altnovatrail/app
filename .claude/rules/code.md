---
paths:
  - "/src/**"
  - "/scripts/**"
  - "/package.json"
  - "/package-lock.json"
  - "/vite.config.ts"
  - "/vitest.config.ts"
  - "/tsconfig*.json"
  - "/biome.json"
  - "/index.html"
  - "/csp.json"
  - "/licenses.json"
  - "/deployment.*.json"
  - "/NOTICE"
  - "/justfile"
  - "/parts/**"
  - "/.devcontainer/**"
---

# The code: the web app

The web app is React and TypeScript under `src/`, built by Vite into `build/`, with its scripts under `scripts/` and its tools at the exact versions `package-lock.json` pins (section 3.1 of [docs/architecture.md](../../docs/architecture.md); R14 and R15 in [docs/decisions.md](../../docs/decisions.md)). Code comes with its tests: Vitest runs `*.node.test.ts` in Node and `*.browser.test.tsx` in Chromium through Playwright.

A task that touches the code ends with these green, locally and in CI (rule 6 of [RUN.md](../../RUN.md)):

- `just ci`, which runs the four recipes CI runs, one job each:
  - `ci-lint` — Biome, both TypeScript programs, exact versions in `package.json`, and the icons module as `scripts/icons.ts` writes it;
  - `ci-test` — the build, the tests with coverage, and the release's archive built twice to the same bytes (R25);
  - `ci-vuln` — `npm audit` of what ships;
  - `ci-licenses` — the licenses of the lock file against spec's list and `licenses.json`, `release-verify-npm` of the packages of `@altnovatrail`, `release-verify` of `parts/deployment-1.tar.gz` at `spec_tag`, and `node scripts/notice.ts`;
- `codecov/patch` on the pull request: at least 90% of the changed lines covered (R48 spec);
- then `/code-review high`, one round.

What moves together:
- `playwright` in `package.json`, the tag and digest of `mcr.microsoft.com/playwright` in `.devcontainer/Dockerfile`, and `PLAYWRIGHT_HEADLESS_SHELL_REVISION`, `PLAYWRIGHT_WEBKIT_REVISION` and `PLAYWRIGHT_FIREFOX_REVISION` beside it, the revisions that version's `browsers.json` names (R14; R43). Until the container is rebuilt with a new revision, the browser tests run locally with that revision downloaded into a temporary folder named by `PLAYWRIGHT_BROWSERS_PATH`;
- a new package or version in the lock file, and `NOTICE`, which `scripts/notice.ts` holds to it; a package the build ships needs a license compatible with Apache-2.0;
- `@altnovatrail/contracts` and `@altnovatrail/spec`, at the tag of the `spec` submodule, with `@bufbuild/protobuf` at the version the contracts name (`scripts/pins.ts`; R15);
- the words the screens show, in both `src/i18n/ru.ts` and `src/i18n/en.ts`.

A change to what the code does changes the section of `docs/architecture.md` that describes it, and what it decides goes to the decision log.
