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

The NovaTrail web app for learners and the adults beside them, on a phone, a tablet or a computer. It is the shell around the learner's work: signing in and choosing the learner on a shared device, the lesson player and the task screen with the canvas, the answer slots and the tutor's panel, progress and the skill map, and the adults' section behind a PIN. It gets a task's open view but never its key, solution or traps while the task is unsolved, it never decides a verdict or calls an AI provider, and the learner's strokes stay on the device.

A component of [NovaTrail](https://github.com/altnovatrail/spec), a universal open platform for adaptive learning, interactive lessons and AI tutoring.

It runs on the learner's device and stands between the learner and the platform's server:

- api — the only server it talks to: the task's open view, the check of the learner's work and the verdict, progress and the profiles;
- the sign-in service — the adult's account;
- canvas and skill-map — UI packages it builds in: the canvas the learner writes on, and the skill map;
- infra — hosts and deploys its signed build, and a self-hosted copy runs the same build.

Its card is in the architecture of [spec](https://github.com/altnovatrail/spec); its own documents, its decisions and its plan are in [docs/](docs/README.md).
