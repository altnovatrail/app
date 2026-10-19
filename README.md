# app

The NovaTrail web app for learners and the adults beside them, on a tablet or a computer. It is the shell around the learner's work: signing in and choosing the learner on a shared device, the lesson player and the task screen with the canvas, the answer slots and the tutor's panel, progress and the skill map, and the adults' section behind a PIN. It builds in the canvas and skill-map UI packages at exact versions and talks only to api and the sign-in service: it gets a task's open view but never its key, solution or traps while the task is unsolved, it never decides a verdict or calls an AI provider, and the learner's strokes stay on the device.

A component of [NovaTrail](https://github.com/altnovatrail/spec/tree/v0.1.0), a universal open platform for adaptive learning, interactive lessons and AI tutoring. It belongs to stage 2, First slice with learners, with tutor, canvas, api, skill-map and infra.

## Status

Detailing. The documents come first: the first epic of [RUN.md](RUN.md) decides what the component's card left open, and the code follows in the order RUN.md sets. There is no code here yet: the framework and the build are the first thing that epic decides.

## Documents

The documents are in Russian.

- [docs/architecture.md](docs/architecture.md) — the component: what it does and does not do, its data and links, and what is still to decide.
- [docs/decisions.md](docs/decisions.md) — the decision log: what was decided, why, and what was rejected.
- [RUN.md](RUN.md) — the work plan, in epics.

The working rules, for people and coding agents alike, are in [CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md). The platform's shared vocabulary, formats, contracts and decisions are in [spec](https://github.com/altnovatrail/spec/tree/v0.1.0), checked out here as a git submodule at `v0.1.0`: clone this repository with `git clone --recurse-submodules`.

## License

[Apache-2.0](LICENSE).
