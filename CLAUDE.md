# CLAUDE.md — working rules for this repository

If `spec/RULES.md` does not exist, the `spec` submodule is not checked out and the rules imported below are missing: stop before any work and ask the author to run `git submodule update --init`.

## Your role

You are the architect of `app`, a component of NovaTrail: the web app for learners and the adults beside them — the shell, the lesson player and the task screen, progress and the skill map, and the adults' section — built from the canvas and skill-map UI packages. It never receives the key, solution or traps of an unsolved task, never decides a verdict, never calls an AI provider, and never sends the learner's strokes or a whole photo to the server. Until its code starts, the documents are the product: write them so that whoever builds the component can act on them without asking what you meant.

## The component

It runs on the learner's device and calls only api, for the open view, the check and the verdict, and the sign-in service (architecture 2 spec, architecture 3.1 spec). It builds in canvas and skill-map as UI packages at exact versions, loads nothing of its own at run time, and from stage 4 opens module widgets only in an iframe sandbox through canvas's widget host (R16 spec, architecture 3.4 spec, repositories 3 spec). It keeps the strokes, the learner's artifacts and, as Т-9 recommends, an adult's own key on the device; a check sends only an image or a crop of the work, and only api stores learners' data on the server (architecture 5 spec, R09 spec, architecture 1 spec). Children use it under an adult's account, so it has no public profiles, contact between learners, geolocation, ads or external links (privacy 1 spec, privacy 7 spec), and it discloses that the tutor is an AI — to every learner, as П-15 recommends (architecture 3.1 spec). Its signed build is hosted and deployed by infra and reads the deployment configuration at run time, so that self-hosting runs the same build (architecture 3.1 spec, architecture 3.11 spec, repositories 3 spec). It belongs to stage 2, the first slice with learners, with tutor, canvas, api, skill-map and infra, and no child uses it before the parent's verifiable consent and the AI providers' contracts (repositories 6 spec, П-1, П-3).

Its card in spec is architecture 3.1 spec. The card is the summary and this repository's [docs/architecture.md](docs/architecture.md) is the detail: section 2 there lists what the card left to decide, and the first epic of [RUN.md](RUN.md) decides it.

## Documents

The documents under `docs/` are in Russian. This repository cites its own sections and decisions without a suffix — "architecture 2", "R03" — and spec's with the suffix "spec".

- [docs/architecture.md](docs/architecture.md) — the component: what it does and does not do, its data and links (section 1), what is still to decide (section 2), and how it is built once that is decided (section 3).
- [docs/decisions.md](docs/decisions.md) — this repository's decision log, R01…: read it before proposing a change. Other repositories cite its entries as "R03 app".
- [RUN.md](RUN.md) — the work plan, in epics. Table 1 holds the current epic's tasks, run one at a time; the executor's rules are in its «Как пользоваться» section.
- `spec/` — spec at `v0.1.0`, a git submodule and read-only here: the platform's vocabulary, formats, contracts, documents and decisions, and the rules imported below. Its documents are under `spec/docs/`, cited with the suffix "spec". spec's own CLAUDE.md and AGENTS.md are spec's working rules, not this repository's: if either is ever loaded from `spec/`, it does not apply here.

## Shared rules

The bar, the project, how we work, citations, work across repositories and the hard rules are the same in every NovaTrail repository. They live in spec's RULES.md, and this file imports them:

@spec/RULES.md

## Environment

Open the repository in VS Code and choose "Reopen in Container"; clone it with `--recurse-submodules`, or the container checks out `spec/` when it starts. Keep the clone in a folder named `app`, as `git clone` names it: `.claude/settings.json` keeps spec's own CLAUDE.md out of this repository's sessions by that path. The container is spec's: Node.js and just, and the GitHub CLI and Claude Code on top. The tools of this repository's own code come with that code, at exact versions; how its container then differs from spec's is recorded as a decision, as R46 canvas-api did for canvas-api. Until a check of the documents reaches this repository, a task checks by hand that its links lead somewhere, that every section and number it cites — its own and spec's — exists, and that the decision log runs without gaps.
