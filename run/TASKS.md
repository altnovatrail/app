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

#### T101. Документы без истории: разделы 3.7 и 3.9 (R160 spec)

- **Цель:** разделы 3.7 «Deployment configuration» и 3.9 «Accessibility» [docs/architecture.md](../docs/architecture.md) держат текущее устройство, а не историю (R160 spec, «One home», «A done task»).
- **Почему:** T97 разделена по правилу 11 RUN.md, по разделам `docs/architecture.md`; эти разделы — эта задача.
- **Сделать:** как в T97 ([docs/plan/E5.md](../docs/plan/E5.md)): убрать «since T…», даты, версии и «until T…»; значение — файлом, где оно задано; решение — номером, без пересказа; ссылка на поправку записи, которую тег `spec` или задача переписали на месте, — на запись, а поправка, что ещё стоит в журнале, называется как есть; строки «Checked:» — что держат тесты сейчас, без хроники. Свои записи журнала — только те, что задача меняет, целиком на месте (R160 spec). Предел раздела в `docs-budgets.json` — по новому размеру с запасом 10–20 %, раздел не длиннее 24 КБ свой предел снимает.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; `/code-review high`.
- **Разделы:** R160 spec; RULES.md spec — The bar; [docs/architecture.md](../docs/architecture.md), 3.7 и 3.9.

#### T102. Документы без истории: раздел 3.8 (R160 spec)

- **Цель:** раздел 3.8 «Interface languages» [docs/architecture.md](../docs/architecture.md), с глоссарием, держит текущее устройство, а не историю (R160 spec, «One home», «A done task»).
- **Почему:** T97 разделена по правилу 11 RUN.md, по разделам `docs/architecture.md`; раздел 3.8 — 81 КБ, самый длинный, — эта задача.
- **Сделать:** как в T97 ([docs/plan/E5.md](../docs/plan/E5.md)): убрать «since T…», даты, версии и «until T…»; значение — файлом, где оно задано; решение — номером, без пересказа; ссылка на поправку записи, которую тег `spec` или задача переписали на месте, — на запись, а поправка, что ещё стоит в журнале, называется как есть; строки «Checked:» — что держат тесты сейчас, без хроники. Свои записи журнала — только те, что задача меняет, целиком на месте (R160 spec). Предел раздела в `docs-budgets.json` — по новому размеру с запасом 10–20 %, раздел не длиннее 24 КБ свой предел снимает.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; `/code-review high`.
- **Разделы:** R160 spec; RULES.md spec — The bar; [docs/architecture.md](../docs/architecture.md), 3.8.

#### T103. Комментарии кода по R160 spec: задача и холст

- **Цель:** комментарии `src/task/`, `src/canvas/`, `src/works/` и `src/essays/` говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** T98 разделена по правилу 11 RUN.md, по каталогам: она переписала комментарии `scripts/`, `mockup/`, `walk/`, `.github/`, `justfile` и `.devcontainer/`; эти каталоги — эта задача.
- **Сделать:** как в T98 ([docs/plan/E5.md](../docs/plan/E5.md)): без пересказа кода, истории, номеров задач и строк Д, разделов документов (`section 3.3 of docs/architecture.md`, `measurements 4`, `contract, section 15`) и поправок с датой — `the 2026-11-12 amendment to R16` → `R16`; `R53 in docs/decisions.md` → `R53`; номер решения сверить с записью. То же — строки с причинами в тестах, где они служат комментарием, и сообщения, что ссылаются на раздел. Имена таблиц README эталона, которые код читает («Contrast», «Where it differs»), остаются.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).

#### T104. Комментарии кода по R160 spec: хранилище, учётная запись и вход

- **Цель:** комментарии `src/storage/`, `src/account/`, `src/signin/` и `src/ownkey/` говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** T98 разделена по правилу 11 RUN.md, по каталогам; эти каталоги — эта задача.
- **Сделать:** как в T103.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).

#### T105. Комментарии кода по R160 spec: взрослые, уроки и карта навыков

- **Цель:** комментарии `src/adults/`, `src/lesson/`, `src/next/`, `src/skills/` и `src/subjects/` говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** T98 разделена по правилу 11 RUN.md, по каталогам; эти каталоги — эта задача.
- **Сделать:** как в T103.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).

#### T106. Комментарии кода по R160 spec: оболочка, api и голос

- **Цель:** комментарии `src/app/`, `src/boot/`, `src/config/`, `src/api/`, `src/tutor/`, `src/voice/`, `src/a11y/`, `src/test/` и `src/main.tsx` говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** T98 разделена по правилу 11 RUN.md, по каталогам; эти каталоги — эта задача.
- **Сделать:** как в T103. `src/app/icons.ts` пишет `scripts/icons.ts`: его комментарии правятся там, затем `just icons`.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).

#### T107. Комментарии кода по R160 spec: словари, правовые тексты, пакеты и тема

- **Цель:** комментарии `src/i18n/`, `src/legal/`, `src/packages/` и `src/theme/` говорят только то, чего не скажут код и имена (R160 spec, «Comments»).
- **Почему:** T98 разделена по правилу 11 RUN.md, по каталогам; эти каталоги — эта задача.
- **Сделать:** как в T103; в словарях — и описания строк (`/** … */`), где они ссылаются на раздел или задачу.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; проверки `.claude/rules/code.md`; `/code-review high`.
- **Разделы:** R160 spec, «Comments»; R32 spec; RULES.md spec — The bar; [.claude/rules/code.md](../.claude/rules/code.md).
