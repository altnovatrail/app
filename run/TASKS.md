# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian (R154 spec, R155 spec). Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T65\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T65. CI на общих процессах `.github` v0.1.24

- **Цель:** каждый `uses:` `.github/workflows/` — на SHA релиза `.github` v0.1.24, последнего на 2026-11-16.
- **Почему:** CI `app` — на v0.1.22 (R14; R49), а волна 0 прогона «Сделай эпик E…» ставит каждый репозиторий на последний релиз `.github` следующей задачей после перехода на тег (R156 spec). Кеш образа `toolchain` (Д146 `spec`) у `app` есть с v0.1.22, а группа Dependabot `shared-workflows` (Д88 `spec`) — в `.github/dependabot.yml`: что несут v0.1.23 и v0.1.24, задача читает в их релизах.
- **Сделать:**
  - SHA тега v0.1.24 — в каждый `uses:` с комментарием `# v0.1.24`;
  - что изменили входы и права общих процессов между v0.1.22 и v0.1.24 — `gh api repos/altnovatrail/.github/compare/v0.1.22...v0.1.24` — взять в вызовы;
  - поправка к R14 о версии общих процессов; [docs/architecture.md](../docs/architecture.md), раздел 3.1, — если он называет версию.
- **Как проверить:** проверки pull request зелёные; `just -f spec/justfile docs-check-repo` — зелёный.
- **Разделы:** R14, R49; Д88 и Д146 `spec`; R156 spec.
