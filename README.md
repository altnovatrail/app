# app

[![CI](https://github.com/altnovatrail/app/actions/workflows/ci.yml/badge.svg)](https://github.com/altnovatrail/app/actions/workflows/ci.yml)
[![CodeQL](https://github.com/altnovatrail/app/actions/workflows/codeql.yml/badge.svg)](https://github.com/altnovatrail/app/actions/workflows/codeql.yml)
[![TypeScript version](https://img.shields.io/github/package-json/dependency-version/altnovatrail/app/dev/typescript)](package.json)
[![Coverage](https://codecov.io/gh/altnovatrail/app/branch/main/graph/badge.svg)](https://codecov.io/gh/altnovatrail/app)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/altnovatrail/app/badge)](https://scorecard.dev/viewer/?uri=github.com/altnovatrail/app)
[![License](https://img.shields.io/github/license/altnovatrail/app)](LICENSE)

[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=altnovatrail_app&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=altnovatrail_app)

The NovaTrail web app for learners and the adults beside them, on a tablet or a computer. It is the shell around the learner's work: signing in and choosing the learner on a shared device, the lesson player and the task screen with the canvas, the answer slots and the tutor's panel, progress and the skill map, and the adults' section behind a PIN. It builds in the canvas and skill-map UI packages at exact versions and talks only to api and the sign-in service: it gets a task's open view but never its key, solution or traps while the task is unsolved, it never decides a verdict or calls an AI provider, and the learner's strokes stay on the device.

A component of [NovaTrail](https://github.com/altnovatrail/spec/tree/v0.13.0), a universal open platform for adaptive learning, interactive lessons and AI tutoring. It belongs to stage 2, First slice with learners, with tutor, canvas, api, skill-map and infra.

## Status

Detailing is done: the first epic of [RUN.md](RUN.md) decided what the component's card left open, and [docs/architecture.md](docs/architecture.md) holds the result. The code has begun with epic E2, the first app: so far the scaffold — an empty React app that builds, is checked and is tested in Node and in Chromium, locally and in CI.

Run the four checks of the TypeScript code with `just ci` and the check of the documents with `just -f spec/justfile docs-check-repo` — CI runs both — the app with `just dev`, and its build with `just preview`, all inside the devcontainer.

## Documents

The documents are in Russian.

- [docs/architecture.md](docs/architecture.md) — the component: what it does and does not do, its data and links, and what is still to decide.
- [docs/decisions.md](docs/decisions.md) — the decision log: what was decided, why, and what was rejected.
- [RUN.md](RUN.md) — the work plan, in epics.

The working rules, for people and coding agents alike, are in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). The platform's shared vocabulary, formats, contracts and decisions are in [spec](https://github.com/altnovatrail/spec/tree/v0.13.0), checked out here as a git submodule at `v0.13.0`: clone this repository with `git clone --recurse-submodules`.

## License

[Apache-2.0](LICENSE).
