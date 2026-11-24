# The documents of app

What the [README](../README.md) of the repository leaves out, which says only what the component is and where it stands in NovaTrail: the index of the documents, how to run app against a local api, how a release comes out and what it holds, and how to contribute.

## Documents

- [architecture.md](architecture.md) — the component: what it does and does not do, its data and links, and what is still to decide.
- [decisions.md](decisions.md) — the decision log: what was decided, why, and what was rejected.
- [sources.md](sources.md) — the records of the facts no run checks that the documents rest on, each with its address, the date read and a quote; [measurements.md](measurements.md) — the results of measurements.
- `plan/` — the archives of the done epics, in Russian.
- [RUN.md](../RUN.md) — the work plan, in epics.
- `run/` — the plan's other tables: [the epics for later](../run/EPICS.md), [the open questions](../run/QUESTIONS.md), [the technical debt](../run/DEBT.md) and [the tasks outside an epic](../run/TASKS.md).

The working rules, for people and coding agents alike, are in [CLAUDE.md](../CLAUDE.md) and [AGENTS.md](../AGENTS.md). The platform's shared vocabulary, formats, contracts and decisions are in [spec](https://github.com/altnovatrail/spec), checked out here as a git submodule: clone this repository with `git clone --recurse-submodules`.

## Run locally with api

The first app runs against a local api, in api's own devcontainer, with the dev project of Firebase:

1. In the dev project of Firebase, register a Web App for app, if there is none yet, and put `127.0.0.1` among the authorized domains of Authentication.
2. Copy `deployment.example.json` to `deployment.local.json` and fill in the parameters of that Web App's config, `apiKey` included, from the project settings of Firebase; `api` stays `http://127.0.0.1:5173`, app's own origin, whose paths of api the development server sends on.
3. In api's container: `just dev migrate`, `just dev countries allow <XX>` for the owner's country, `just dev invite` for an invite code — a new one each time the account was deleted — then `just dev serve`. Or `just dev-app`, which does all of it for its own test account, on the stub of tutor, and keeps that account's sign-in token in a volume this container reads: then app's button «Sign in with Google» signs in by that token, with no Google window.
4. In this container, which is on api's network too: `just dev`, whose proxy finds api's container by its name, `http://api:8080` — `NOVATRAIL_API` names another address —, then open `http://127.0.0.1:5173`. VS Code forwards the port by itself when `just dev` runs in its terminal; otherwise forward 5173 in its Ports panel, to the same port 5173 on the host: the origin is app's, and the authorized domain of Firebase.

## Releases

A release comes out by itself once the checks pass on `main` and a change touches what the build is made from: the next patch of the line that `RELEASE_LINE` of `.github/workflows/release.yml` names, tagged `vX.Y.Z` with the release, and nobody tags by hand. Releases are immutable, and a ruleset keeps every tag `v*` on its commit.

A release holds the archive of the build, `app_<version>.tar.gz`, signed with cosign by NovaTrail's shared release workflow, and beside it its bundle, `app_<version>.tar.gz.sigstore.json`, which the check of the signature reads. At the archive's root are `index.html`, `assets/`, `deployment.schema.json` — the schema of the deployment configuration, `/deployment.json`, which the page reads at every start and the archive does not hold —, `csp.json` — the template of the Content-Security-Policy header the host sends —, and `NOTICE` and `LICENSE`. The same build serves the platform and every self-hosted copy. infra deploys it; whoever hosts it takes it at an exact tag, checks it before serving it with spec's `just -f spec/justfile release-verify app <tag> <file>`, which checks the signature against Sigstore's trust root and everything its certificate names, and writes `deployment.json` of their own by spec's part `deployment/` at the tag the submodule `spec/` pins, [`spec/deployment/`](../spec/deployment/README.md).

## Contributing

Report a bug or propose a change in an [issue](https://github.com/altnovatrail/app/issues), in English or Russian, and open one before a pull request unless the pull request fixes a typo or a broken link. How a change comes in, with every commit signed off, and what every change keeps to are in the organization's [CONTRIBUTING.md](https://github.com/altnovatrail/.github/blob/main/CONTRIBUTING.md); the rules every NovaTrail repository shares are in spec's RULES.md, at the tag the submodule pins, [`spec/RULES.md`](../spec/RULES.md): code comes with its tests, and no learner's data, not even in examples. Report a vulnerability privately, as the [security policy](https://github.com/altnovatrail/app/security/policy) says, never in a public issue.

Work in the devcontainer: open the repository in VS Code and choose "Reopen in Container". It holds every tool at the version the repository pins, and the packages are those `package-lock.json` pins. The checks are recipes of the [justfile](../justfile), and `just --list` names each with its arguments:

- `just ci-lint` — Biome, the TypeScript compiler on the app and on the scripts and tests in Node, that every version in `package.json` is exact, and that the module of icons is what `scripts/icons.ts` writes;
- `just ci-test` — the build, then the tests with Vitest in Node and in Chromium, among them the accessibility checks of every screen with axe-core; it writes their coverage to `coverage/lcov.info`, then builds the tree again and checks that both archives of a release are the same bytes; `just ci-engines` — the same tests of the screens in WebKit and Firefox, without coverage;
- `just ci-vuln` — `npm audit` of what ships; `just ci-licenses` — the licenses of the lock file against spec's list, the signatures of the packages of `@altnovatrail`, the file of spec's release the build takes the deployment format from, and that `NOTICE` names every package the build ships;
- `just mockup-compare [spec]` — the interface mockup of `spec/draft/mockup/` in Chromium, WebKit and Firefox, each state of its first slice against the other engines, and app's screens against it, region by region, with the snapshots and the reports in `mockup/out/`; a folder of a newer spec, a clone, compares with its mockup; in CI the job Mockup;
- `just walk` — the path of the first slice in Chromium, WebKit and Firefox, against api's `just dev-app`, with no one at the keyboard; not in CI;
- `just build` — the app into `build/`; `just release-files <version>` — the archive of a release into `dist/`; `just dev` — the app on the development server, with a working copy of canvas, built, by `just dev-canvas <folder>`; `just preview` — its build.

A check exits with a non-zero status when it finds a problem. CI runs them all on every pull request and on `main`, and a pull request merges only when they pass. Documents are checked by `just -f spec/justfile docs-check-repo`.
