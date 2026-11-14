# app's own recipes: the build of the app, and the four checks .github's typescript.yml runs in CI,
# one job each, in a new container of the toolchain stage of .devcontainer/Dockerfile — as the
# runner's user, with HOME=/tmp and with CI from the step's environment (R14 in
# docs/decisions.md; section 3.1 of docs/architecture.md). Of the four only ci-licenses reads spec/:
# it runs spec's recipes licenses-check-repo and release-verify-npm, and the licenses job alone gets
# the submodule; site-check, by hand and not in CI, runs spec's release-verify too. The documents
# are checked by spec's own recipe, just -f spec/justfile docs-check-repo.

set shell := ["bash", "-euo", "pipefail", "-c"]

# The tools are the packages package-lock.json pins, run from where npm ci puts them: nothing is
# fetched on the fly.
bin := "node_modules/.bin"

# The tag of the spec submodule, whose release the file in parts/ comes from: it moves with the
# submodule, by the task that moves to a new tag.
spec_tag := "v0.17.1"

# Run the four checks CI runs, before a pull request.
ci: ci-lint ci-test ci-vuln ci-licenses

# Fail on code Biome would format or flag, on a type error in either program — the app sees the
# DOM, the configuration, the scripts and the tests in Node see Node —, on a version in
# package.json that is not exact, and on a module of icons that is not what scripts/icons.ts writes.
ci-lint: _install
    {{ bin }}/biome ci
    {{ bin }}/tsc --noEmit -p tsconfig.app.json
    {{ bin }}/tsc --noEmit -p tsconfig.node.json
    node scripts/versions.ts
    node scripts/icons.ts --check

# The tests, in Node and in Chromium, with the coverage report coverage/lcov.info, which the shared
# typescript.yml sends to Codecov. The build comes first: typescript.yml runs no build of its own,
# so a build that fails fails this check (R14). Then the release's archive of that build and of a
# second build of the same tree, in a folder of its own: the same bytes, in the layout infra's
# rollout reads (R25).
ci-test: build
    {{ bin }}/vitest run --coverage
    again="$(mktemp -d)"; trap 'rm -rf "$again"' EXIT; {{ bin }}/vite build --outDir "$again" --emptyOutDir --logLevel warn && node scripts/release.ts --check "$again"

# npm audit reads the lock file and asks the registry, so nothing is installed first. Only what
# ships: the tools of development do not reach a learner (R39 in spec).
ci-vuln:
    npm audit --omit=dev --audit-level=high

# The licenses of package-lock.json, against spec's list and the exceptions of licenses.json
# (R39 in spec), and the signatures of the packages of @altnovatrail in it (R77 in spec); and a
# NOTICE that names every package the build ships, with their own NOTICE files, read from
# node_modules; and the file of spec's release the build and the tests take the part deployment/
# from, which the code reads instead of spec/ (R21 and R85 in spec).
ci-licenses: _install
    {{ quote(just_executable()) }} -f spec/justfile licenses-check-repo package-lock.json licenses.json
    {{ quote(just_executable()) }} -f spec/justfile release-verify-npm package-lock.json
    {{ quote(just_executable()) }} -f spec/justfile release-verify spec {{ spec_tag }} parts/deployment-1.tar.gz
    node scripts/notice.ts

# The build of the app into build/.
build: _install
    {{ bin }}/vite build

# The files of a release, for .github's release.yml, which runs this in the toolchain stage on the
# tree of the commit alone — no git, no spec submodule, no token — with the version as v0.1.0: the
# archive of the build, app_<version>.tar.gz, the one file of dist/, with NOTICE and LICENSE at its
# root, checked before it is written (R25 in docs/decisions.md; section 3.1 of
# docs/architecture.md). The build reads spec's part from parts/, which git holds.
release-files version: (_release-version version) build
    rm -rf dist
    node scripts/release.ts {{ quote(version) }}

# A version of a release, vX.Y.Z, checked before anything is built.
_release-version version:
    @node scripts/release.ts --name {{ quote(version) }} > /dev/null

# The development server, on 127.0.0.1, with canvas from npm whatever the shell has set.
dev: _install
    env -u NOVATRAIL_CANVAS {{ bin }}/vite

# The development server with a working copy of canvas, built into its lib/, in place of the
# package from npm; package.json and the lock file stay as they are (Д3 in RUN.md; R15).
# The folder is taken from where the command is typed.
dev-canvas folder: _install
    NOVATRAIL_CANVAS={{ quote(join(invocation_directory(), folder)) }} {{ bin }}/vite

# The build, served as the hosting would serve it.
preview: build
    {{ bin }}/vite preview

# Check a deployed site against the release of app it serves, as section 3.7 has it (R42): the
# archive and its signature from the release, the archive accepted by spec's release-verify, then
# scripts/site.ts — every file of the build at its path, /deployment.json as app reads it, the
# headers, and the page in Chromium up to the sign-in window, which it closes with nobody signed in.
# For the platform: just site-check https://novatrail.web.app <the release in infra's list>.
site-check origin version: _install (_release-version version)
    #!/usr/bin/env bash
    set -euo pipefail
    name="$(node scripts/release.ts --name {{ quote(version) }})"
    work="$(mktemp -d)"
    trap 'rm -rf "$work"' EXIT
    for file in "$name" "$name.sigstore.json"; do
        curl -fsSL --proto '=https' -o "$work/$file" "https://github.com/altnovatrail/app/releases/download/{{ version }}/$file"
    done
    {{ quote(just_executable()) }} -f spec/justfile release-verify app {{ quote(version) }} "$work/$name"
    node scripts/site.ts {{ quote(origin) }} "$work/$name"

# The path of the first slice in a browser, without the author (R44 in docs/decisions.md; section
# 3.7 of docs/architecture.md): walk/path.test.ts on the development server, against the api of
# api's just dev-app at http://api:8080, signed in by its development token, in each engine named —
# all three unless given, e.g. just walk webkit. Not in CI: it needs api's container. Its AI calls
# go to api's stub and spend the quota of the day of dev-app's profile (R55 and R67 in api).
walk *engines="chromium webkit firefox": _install
    #!/usr/bin/env bash
    set -euo pipefail
    if [[ ! -s /home/vscode/.novatrail-token/custom-token ]]; then
        echo "walk: no development token in /home/vscode/.novatrail-token: run just dev-app in api's container" >&2
        exit 1
    fi
    NOVATRAIL_WALK_ENGINES={{ quote(engines) }} {{ bin }}/vitest run --config walk/vitest.config.ts

# Write src/app/icons.ts again from the set of icons package-lock.json pins.
icons: _install
    node scripts/icons.ts

# Format and fix what Biome can.
fmt: _install
    {{ bin }}/biome check --write

# npm ci when package.json or the lock file changed since the last one: in CI each job starts from
# a fresh checkout, so it always installs.
[private]
_install:
    #!/usr/bin/env bash
    set -euo pipefail
    stamp=node_modules/.installed-from
    wanted="$(sha256sum package.json package-lock.json)"
    if [[ ! -f "$stamp" || "$(cat "$stamp")" != "$wanted" ]]; then
        npm ci --ignore-scripts --no-audit --no-fund
        printf '%s\n' "$wanted" > "$stamp"
    fi
