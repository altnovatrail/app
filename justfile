# app's own recipes: the build of the app, and the four checks .github's typescript.yml runs in CI,
# one job each, in a new container of the toolchain stage of .devcontainer/Dockerfile — as the
# runner's user, with HOME=/tmp and with CI from the step's environment (R14 in
# docs/decisions.md; section 3.1 of docs/architecture.md). Only ci-licenses reads spec/: it runs
# spec's recipes licenses-check-repo and release-verify-npm, and the licenses job alone gets the
# submodule. The documents are checked by spec's own recipe, just -f spec/justfile docs-check-repo.

set shell := ["bash", "-euo", "pipefail", "-c"]

# The tools are the packages package-lock.json pins, run from where npm ci puts them: nothing is
# fetched on the fly.
bin := "node_modules/.bin"

# Run the four checks CI runs, before a pull request.
ci: ci-lint ci-test ci-vuln ci-licenses

# Fail on code Biome would format or flag, on a type error in either program — the app sees the
# DOM, the configuration, the scripts and the tests in Node see Node — and on a version in
# package.json that is not exact.
ci-lint: _install
    {{ bin }}/biome ci
    {{ bin }}/tsc --noEmit -p tsconfig.app.json
    {{ bin }}/tsc --noEmit -p tsconfig.node.json
    node scripts/versions.ts

# The tests, in Node and in Chromium, with the coverage report coverage/lcov.info, which the shared
# typescript.yml sends to Codecov. The build comes first: typescript.yml runs no build of its own,
# so a build that fails fails this check (R14).
ci-test: build
    {{ bin }}/vitest run --coverage

# npm audit reads the lock file and asks the registry, so nothing is installed first. Only what
# ships: the tools of development do not reach a learner (R39 in spec).
ci-vuln:
    npm audit --omit=dev --audit-level=high

# The licenses of package-lock.json, against spec's list and the exceptions of licenses.json
# (R39 in spec), and the signatures of the packages of @altnovatrail in it (R77 in spec); and a
# NOTICE that names every package the build ships.
ci-licenses:
    {{ quote(just_executable()) }} -f spec/justfile licenses-check-repo package-lock.json licenses.json
    {{ quote(just_executable()) }} -f spec/justfile release-verify-npm package-lock.json
    node scripts/notice.ts

# The build of the app into build/.
build: _install
    {{ bin }}/vite build

# The development server, on 127.0.0.1.
dev: _install
    {{ bin }}/vite

# The build, served as the hosting would serve it.
preview: build
    {{ bin }}/vite preview

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
