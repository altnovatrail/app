# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian (R154 spec, R155 spec). Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T01\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T94. Анализ расхода сессий по порогу R145 spec

- **Цель:** понять, отчего сессии `app` дорожают, и решить, нужен ли эпик сбережений.
- **Почему:** порог R145 spec пройден по бюджетам ([docs/measurements.md](../docs/measurements.md), раздел 10): `docs-budgets.json` поднимался девять раз с T55, семь из них — в E5, а порог — три. Контекст главного вызова за E5 — 185,4 тыс. за 4 140 вызовов; это первая опора `app` по measurements 1.9 spec — строка T124, 141,7 тыс., держит лишь 188 вызовов. Задачу записала T91 при архиве E5.
- **Сделать:** по стенограммам E5 (`tokens-report`) найти, что сессии читают и где контекст растёт: разделы 3.8 и 3.10 [docs/architecture.md](../docs/architecture.md) — 81 и 72 КБ, журнал решений, тела задач архива, вывод `just mockup-compare`; предложить, что сжать, разделить или перенести, по образцу анализа E10 `spec` (measurements 1.9 spec); при планировании решить, нужен ли эпик.
- **Как проверить:** `just -f spec/justfile docs-check-repo`.
- **Разделы:** R145 spec, R143 spec; measurements 1.9 spec; [docs/measurements.md](../docs/measurements.md), разделы 8 и 10.

#### T97. Документы без истории (R160 spec)

- **Цель:** `docs/`, README и CLAUDE.md держат текущее состояние, а не историю (R160 spec, «One home», «A done task»).
- **Почему:** правило R160 spec взято переходом на тег в T96; T96 разделена по правилу 11, документы — эта задача.
- **Сделать:**
  - Убрать хроники версий, статусов и повышений — «since T17», «since v0.17.9», «released 2026-11-18», «0.3.4 stood before it»: документ называет файл, где задано значение (`package.json`, `.devcontainer/Dockerfile`, подмодуль, `deployment.*.json`), а не значение. Начать с раздела 3.1 и сводок эпиков раздела 3.10 [docs/architecture.md](../docs/architecture.md): эпик — одна строка со ссылкой на архив.
  - Архитектура описывает текущее устройство и ссылается на решение номером, не пересказывая его.
  - Ссылка на поправку записи `spec`, которую тег переписал на месте (R143, R145, R154, R155 spec и те, что перепишут задачи E16 `spec`), — на запись; ссылка на поправку R15 — на R15, она переписана в T96.
  - Свои записи журнала — только те, что задача меняет, переписать целиком на месте (R160 spec); запись короче 12 КБ снимает свой предел из `entries` `docs-budgets.json`.
  - Вне правила: `docs/sources.md`, `docs/measurements.md`, архивы `docs/plan/`.
  - Больше одного ревью — разделить по правилу 11, по разделам `docs/architecture.md`.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; `/code-review high`.
- **Разделы:** R160 spec; RULES.md spec — The bar; [docs/architecture.md](../docs/architecture.md); [docs/README.md](../docs/README.md); CLAUDE.md.

#### T98. Комментарии кода по R160 spec

- **Цель:** комментарии кода говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** правило R160 spec взято переходом на тег в T96; T96 разделена по правилу 11, комментарии — эта задача.
- **Сделать:**
  - Комментарии `src/`, `scripts/`, `mockup/`, `walk/`, `.github/`, `justfile` и `.devcontainer/`: почему, ограничение, ловушка, контракт экспортируемого API; без пересказа кода, истории, номеров задач («T88») и разделов документов («section 3.3 of docs/architecture.md», «row 5.14 of COORDINATION.md»).
  - Номер решения — якорем в конце, `(R25)`; «R53 in docs/decisions.md» → `R53`. `docs-check` ловит номер, которого нет в журнале, но не решение `spec` до R70 без суффикса: сверить такие номера с записью, на которую ссылается текст.
  - То же — строки с причинами в тестах, где они служат комментарием.
  - Больше одного ревью — разделить по правилу 11, по каталогам.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).
