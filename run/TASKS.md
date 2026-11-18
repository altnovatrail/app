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

#### T99. Документы без истории: разделы 3.2 и 3.3 (R160 spec)

- **Цель:** разделы 3.2 «Storage on the device» и 3.3 «Solving steps» [docs/architecture.md](../docs/architecture.md) держат текущее устройство, а не историю (R160 spec, «One home», «A done task»).
- **Почему:** T97 разделена по правилу 11 RUN.md, по разделам `docs/architecture.md`: она переписала заголовок, разделы 1, 2, 3.1, 3.10 и 4, README и CLAUDE.md; этот раздел — эта задача.
- **Сделать:** как в T97 ([docs/plan/E5.md](../docs/plan/E5.md)): убрать «since T…», даты, версии и «until T…»; значение — файлом, где оно задано; решение — номером, без пересказа; ссылка на поправку записи, которую тег `spec` или задача переписали на месте, — на запись, а поправка, что ещё стоит в журнале, называется как есть; строки «Checked:» — что держат тесты сейчас, без хроники. Свои записи журнала — только те, что задача меняет, целиком на месте (R160 spec). Предел раздела в `docs-budgets.json` — по новому размеру с запасом 10–20 %, раздел не длиннее 24 КБ свой предел снимает.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; `/code-review high`.
- **Разделы:** R160 spec; RULES.md spec — The bar; [docs/architecture.md](../docs/architecture.md), 3.2 и 3.3.

#### T100. Документы без истории: разделы 3.4–3.6 (R160 spec)

- **Цель:** разделы 3.4 «The lesson player», 3.5 «Voicing» и 3.6 «Own key» [docs/architecture.md](../docs/architecture.md) держат текущее устройство, а не историю (R160 spec, «One home», «A done task»).
- **Почему:** T97 разделена по правилу 11 RUN.md, по разделам `docs/architecture.md`; эти разделы — эта задача.
- **Сделать:** как в T97 ([docs/plan/E5.md](../docs/plan/E5.md)): убрать «since T…», даты, версии и «until T…»; значение — файлом, где оно задано; решение — номером, без пересказа; ссылка на поправку записи, которую тег `spec` или задача переписали на месте, — на запись, а поправка, что ещё стоит в журнале, называется как есть; строки «Checked:» — что держат тесты сейчас, без хроники. Свои записи журнала — только те, что задача меняет, целиком на месте (R160 spec). Предел раздела в `docs-budgets.json` — по новому размеру с запасом 10–20 %, раздел не длиннее 24 КБ свой предел снимает.
- **Как проверить:** `just -f spec/justfile docs-check-repo`; `/code-review high`.
- **Разделы:** R160 spec; RULES.md spec — The bar; [docs/architecture.md](../docs/architecture.md), 3.4–3.6.

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
