# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian (R154 spec, R155 spec). Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T01\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T67. Скорость CI: строка 7.22

- **Цель:** CI `app` быстрее по строке 7.22 [COORDINATION.md](../spec/COORDINATION.md); что проверки доказывают, не меняется.
- **Почему:** R76 spec, R156 spec, строка 7.22 COORDINATION.md spec и шестая поправка 2026-11-15 к R76 spec; замеры — measurements 3.1 spec; общая часть — строки 7.13 (`.github`) и 7.14 (T166 spec). Слово автора 2026-11-16: ускорение CI — сейчас, в прогоне оркестратора T171 spec.
- **Что нужно** (строка 7.22): WebKit и Firefox — своей проверкой через вход `typescript.yml` строки 7.13, покрытие — в Chromium; предупреждения React `act()` в тестах — исправить; релиз — в `toolchain-core`; apt — только снимок, по T166
- **Ждёт** (строка 7.22, «Зависит от»): 7.13, 7.14
- **Сделать:**
  1. Сейчас — всё из «Что нужно», что не ждёт ни релиза `.github` строки 7.13, ни тега `spec` строки 7.14, ни другой строки.
  2. То, что их ждёт, — следующей задачей (или задачами) этого плана, записанной по его правилам и названной в отчёте: оркестратор запустит её, когда релиз выйдет. Переход на тег `spec` со стадией `toolchain-core` меняет `.devcontainer/` — его делает последняя из них.
  3. `.devcontainer/` в этой задаче не меняй: пересобрать контейнер ночью некому.
  4. Если сейчас делать нечего — запиши задачу с её частью, что ждёт, и верни done без pull request.
- **Как проверить:** проверки тронутых частей по правилам этого репозитория; CI pull request зелёный; время изменённых job до и после — в отчёте, по прогонам `main` и этого pull request; `/code-review high`, один круг.
- **Разделы:** строка 7.22 COORDINATION.md spec; measurements 3.1 spec; R76 spec, R156 spec.

#### T68. Скорость CI: WebKit и Firefox своей проверкой — строка 7.22

- **Цель:** тесты экранов в WebKit и Firefox — своей проверкой CI, рядом с проверкой Chromium, а не после неё в одном job; покрытие — по-прежнему Node и Chromium; что проверки доказывают, не меняется.
- **Почему:** строка 7.22 [COORDINATION.md](../spec/COORDINATION.md): job TypeScript / test — самый долгий в CI `app`, 278 с, из них Chromium с покрытием 88 с и WebKit с Firefox 120 с, один за другим (measurements 3.1 spec). Вход для этого даёт `typescript.yml` релиза `.github` строки 7.13; T67 сделала то, что его не ждёт.
- **Ждёт:** релиза `.github` строки 7.13 со входом `typescript.yml` для WebKit и Firefox своей проверкой.
- **Сделать:**
  - каждый `uses:` `.github/workflows/` — на SHA этого релиза с комментарием версии; что ещё изменили входы и права общих процессов с v0.1.24 — `gh api repos/altnovatrail/.github/compare/v0.1.24...<релиз>` — взять в вызовы;
  - `ci-test` и рецепт движков в `justfile` — так, как вход релиза их зовёт: Chromium с покрытием, сборка и архив релиза дважды — в одном, WebKit и Firefox без покрытия — в другом;
  - поправки к R45 и к R14; [docs/architecture.md](../docs/architecture.md), раздел 3.1; [.claude/rules/code.md](../.claude/rules/code.md).
- **Не делать:** `.devcontainer/` не трогать — его меняет T69.
- **Как проверить:** CI pull request зелёный, обе проверки тестов — в нём; время job тестов до и после — в отчёте, по прогонам `main` и pull request; `/code-review high`, один круг.
- **Разделы:** строка 7.22 COORDINATION.md spec; measurements 3.1 spec; R14, R45; R76 spec, R156 spec.

#### T69. Скорость CI: переход на `spec` со стадией `toolchain-core` — строка 7.22

- **Цель:** `app` — на теге `spec` строки 7.14: релиз строится в стадии `toolchain-core`, без браузеров и apt; apt контейнера — только из источников снимка; что проверки доказывают, не меняется.
- **Почему:** строка 7.22 [COORDINATION.md](../spec/COORDINATION.md): «Work out the version» релиза `app` — 391 с, сборка всей стадии с браузерами и apt ради `release-version`, а `apt-get update --snapshot` тянет и живой архив, и снимок (measurements 3.1 spec). Стадию `toolchain-core` и apt шаблона по снимку даёт тег `spec` строки 7.14 (T166 spec), а релиз в ней — релиз `.github` строки 7.13.
- **Ждёт:** тега `spec` строки 7.14 и релиза `.github` строки 7.13, где релиз и проверки без браузера идут в `toolchain-core`.
- **Сделать:**
  - переход на тег, как T63 (R49): подмодуль, `@altnovatrail/spec` и `@altnovatrail/contracts`, `parts/deployment-1.tar.gz`, `spec_tag` в `justfile`; `.devcontainer/` — по выводу `just new-repo-draft app typescript 3.1 <тег>` в клоне `spec` вне репозитория, со стадией `toolchain-core` и apt только по снимку, а различия `app` — те же (R19, R43);
  - `uses:` — на SHA релиза `.github`, если T68 взяла не его;
  - новая запись журнала о теге; поправки к R14 и R25; [docs/architecture.md](../docs/architecture.md), раздел 3.1; [.claude/rules/code.md](../.claude/rules/code.md);
  - что тег решил за `app` сверх этого — строками [run/DEBT.md](DEBT.md) или задачами плана.
- **Как проверить:** CI и пробный прогон Release pull request зелёные; время «Work out the version» и job тестов до и после — в отчёте; `/code-review high`, один круг.
- **Разделы:** строка 7.22 COORDINATION.md spec; measurements 3.1 spec; T166 spec; R14, R25, R49; R76 spec, R156 spec.
