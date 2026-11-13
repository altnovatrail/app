# app

[![CI](https://github.com/altnovatrail/app/actions/workflows/ci.yml/badge.svg)](https://github.com/altnovatrail/app/actions/workflows/ci.yml)
[![Release](https://github.com/altnovatrail/app/actions/workflows/release.yml/badge.svg)](https://github.com/altnovatrail/app/actions/workflows/release.yml)
[![CodeQL](https://github.com/altnovatrail/app/actions/workflows/codeql.yml/badge.svg)](https://github.com/altnovatrail/app/actions/workflows/codeql.yml)
[![Latest release](https://img.shields.io/github/v/release/altnovatrail/app)](https://github.com/altnovatrail/app/releases/latest)
[![TypeScript version](https://img.shields.io/github/package-json/dependency-version/altnovatrail/app/dev/typescript)](package.json)
[![Coverage](https://codecov.io/gh/altnovatrail/app/branch/main/graph/badge.svg)](https://codecov.io/gh/altnovatrail/app)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/16599/badge)](https://www.bestpractices.dev/projects/16599)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/altnovatrail/app/badge)](https://scorecard.dev/viewer/?uri=github.com/altnovatrail/app)
[![License](https://img.shields.io/github/license/altnovatrail/app)](LICENSE)

[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)

The NovaTrail web app for learners and the adults beside them, on a tablet or a computer. It is the shell around the learner's work: signing in and choosing the learner on a shared device, the lesson player and the task screen with the canvas, the answer slots and the tutor's panel, progress and the skill map, and the adults' section behind a PIN. It builds in the canvas and skill-map UI packages at exact versions and talks only to api and the sign-in service: it gets a task's open view but never its key, solution or traps while the task is unsolved, it never decides a verdict or calls an AI provider, and the learner's strokes stay on the device.

A component of [NovaTrail](https://github.com/altnovatrail/spec/tree/v0.16.3), a universal open platform for adaptive learning, interactive lessons and AI tutoring. It belongs to stage 2, First slice with learners, with tutor, canvas, api, skill-map and infra.

## Status

Detailing is done: the first epic of [RUN.md](RUN.md) decided what the component's card left open, and [docs/architecture.md](docs/architecture.md) holds the result. The second epic, E2, built the first app, which an adult learner uses against a local api, with no children yet and no deployment: signing in with Google, the account with the texts in force and the owner's own profile, "My subjects" with the catalog of modules, the lesson player, the task screen with the canvas — the steps, the choice of options, the check of handwriting, the hint, "Explain differently" and the solution shown —, and what the engine chose next. Its screens are in English and Russian, and every one passes axe-core in CI. The tutor's own words are not in yet: until tutor gives them, a learner gets the rung's fallback text. E2 ended on 2026-11-12 with the first signed release of the build, v0.1.0, which infra deploys; deployment, the adult's own key, speech, the skill map and the adults' section come next, and children's profiles after them.

Run the four checks of the TypeScript code with `just ci` and the check of the documents with `just -f spec/justfile docs-check-repo` — CI runs both — the app with `just dev` — with a working copy of canvas, built, by `just dev-canvas <folder>` — and its build with `just preview`, all inside the devcontainer.

### Run locally with api

The first app runs against a local api, in api's own devcontainer, with the dev project of Firebase (section 3.7 of [docs/architecture.md](docs/architecture.md)):

1. In the dev project of Firebase, register a Web App for app, if there is none yet, and put `127.0.0.1` among the authorized domains of Authentication.
2. Copy `deployment.example.json` to `deployment.local.json` and fill in the parameters of that Web App's config, `apiKey` included, from the project settings of Firebase; `api` stays `http://127.0.0.1:5173`, app's own origin, whose paths of api the development server sends on.
3. In api's container: `just dev migrate`, `just dev countries allow <XX>` for the owner's country, `just dev invite` for an invite code — a new one each time the account was deleted — then `just dev serve`, and `hostname -i` for the address of the container.
4. In this container, which is on api's network too: `NOVATRAIL_API=http://<that address>:8080 just dev`, then open `http://127.0.0.1:5173`. VS Code forwards the port by itself when `just dev` runs in its terminal; otherwise forward 5173 in its Ports panel, to the same port 5173 on the host: the origin is app's, and the authorized domain of Firebase.

## Releases

A release comes out by itself once the checks pass on `main` and a change touches what the build is made from: the next patch of the line 0.1, tagged `vX.Y.Z` with the release, and nobody tags by hand. Releases are immutable, and a ruleset keeps every tag `v*` on its commit.

A release holds the archive of the build, `app_<version>.tar.gz`, signed with cosign by NovaTrail's shared release workflow, and beside it its bundle, `app_<version>.tar.gz.sigstore.json`, which the check of the signature reads. At the archive's root are `index.html`, `assets/`, `deployment.schema.json` — the schema of the deployment configuration, `/deployment.json`, which the page reads at every start and the archive does not hold —, `csp.json` — the template of the Content-Security-Policy header the host sends —, and `NOTICE` and `LICENSE`. The same build serves the platform and every self-hosted copy. infra deploys it; whoever hosts it takes it at an exact tag, checks it before serving it with spec's `just -f spec/justfile release-verify app <tag> <file>`, which checks the signature against Sigstore's trust root and everything its certificate names (R77 spec), and writes `deployment.json` of their own by spec's [part `deployment/`](https://github.com/altnovatrail/spec/tree/v0.16.3/deployment).

## Contributing

Report a bug or propose a change in an [issue](https://github.com/altnovatrail/app/issues), in English or Russian, and open one before a pull request unless the pull request fixes a typo or a broken link. How a change comes in, with every commit signed off, and what every change keeps to are in the organization's [CONTRIBUTING.md](https://github.com/altnovatrail/.github/blob/main/CONTRIBUTING.md); the rules every NovaTrail repository shares are in spec's [RULES.md](https://github.com/altnovatrail/spec/blob/v0.16.3/RULES.md): code comes with its tests, and no learner's data, not even in examples. Report a vulnerability privately, as the [security policy](https://github.com/altnovatrail/app/security/policy) says, never in a public issue.

Work in the devcontainer: open the repository in VS Code and choose "Reopen in Container". It holds every tool at the version the repository pins, and the packages are those `package-lock.json` pins. The checks are recipes of the [justfile](justfile), and `just --list` names each with its arguments:

- `just ci-lint` — Biome, the TypeScript compiler on the app and on the scripts and tests in Node, that every version in `package.json` is exact, and that the module of icons is what `scripts/icons.ts` writes;
- `just ci-test` — the build, then every test with Vitest, in Node and in Chromium, among them the accessibility checks of every screen with axe-core; it writes the coverage to `coverage/lcov.info`, then builds the tree again and checks that both archives of a release are the same bytes;
- `just ci-vuln` — `npm audit` of what ships; `just ci-licenses` — the licenses of the lock file against spec's list, the signatures of the packages of `@altnovatrail`, the file of spec's release the build takes the deployment format from, and that `NOTICE` names every package the build ships;
- `just build` — the app into `build/`; `just release-files <version>` — the archive of a release into `dist/`.

A check exits with a non-zero status when it finds a problem. CI runs them all on every pull request and on `main`, and a pull request merges only when they pass. Documents are checked by `just -f spec/justfile docs-check-repo`.

## Documents

The documents are in English; the work plan, its technical debt and the archives of its epics are in Russian.

- [docs/architecture.md](docs/architecture.md) — the component: what it does and does not do, its data and links, and what is still to decide.
- [docs/decisions.md](docs/decisions.md) — the decision log: what was decided, why, and what was rejected.
- [docs/sources.md](docs/sources.md) — the external facts the documents rely on, each with its source, its date and its quote; [docs/measurements.md](docs/measurements.md) — the results of measurements.
- [RUN.md](RUN.md) — the work plan, in epics.
- [DEBT.md](DEBT.md) — the technical debt, in Russian: table 4 of the work plan.

The working rules, for people and coding agents alike, are in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). The platform's shared vocabulary, formats, contracts and decisions are in [spec](https://github.com/altnovatrail/spec/tree/v0.16.3), checked out here as a git submodule at `v0.16.3`: clone this repository with `git clone --recurse-submodules`.

## License

[Apache-2.0](LICENSE).
