# RUN.md — work plan of app

What app does, does not do and has still to decide — [docs/architecture.md](docs/architecture.md); why — [docs/decisions.md](docs/decisions.md). The platform is in `spec/`, a submodule at tag v0.18.12: the component's card — architecture 3.1 spec; the order of repositories — repositories 6 spec; learners' data and law — privacy spec; the platform's decisions — spec's log. Small tasks, one at a time, each reviewed by the author; only the current epic is in detail (R19 spec). Other tables, each a file opening with its rules (R153 spec): 2, epics for later — [run/EPICS.md](run/EPICS.md); 3, questions to the author — [run/QUESTIONS.md](run/QUESTIONS.md); 4, debt — [run/DEBT.md](run/DEBT.md). Open tasks outside an epic — [run/TASKS.md](run/TASKS.md) (R155 spec). «Как пользоваться» in older texts is Rules, «Как устроен план: эпики» is Epics, and «таблица 2, 3, 4» names the file above (R50).

Language (R154 spec): rules and tables in English, terse, for the session; the bodies of tasks in table 1 and in `run/TASKS.md` in Russian — the author writes and reviews them.

## Rules

A task starts with «Выполни задачу T01 из RUN.md» in a new session in the devcontainer. One task — one session (R143 spec): the hook `UserPromptSubmit` of [.claude/settings.json](.claude/settings.json) — `spec/tools/session/` — stops «Выполни задачу T…» or «планируй T…» of another task in the same session and names `/clear`; the same task passes. An epic across repositories runs as «Сделай эпик E…» in spec's orchestrator: each task a fresh `claude -p` in this container (R156 spec).

1. Do only the named task; touch other tasks' files only where it requires.
2. Read first: [CLAUDE.md](CLAUDE.md) with the rules it imports (RULES.md of `spec/`), the task — in table 1, or only its own body of `run/TASKS.md` (its opening says how) —, the sections it cites — its own and spec's —, [docs/decisions.md](docs/decisions.md).
   - Conflict with the documents or something missing — stop and ask; never guess.
   - A gap in the component itself — a subsection of [docs/architecture.md](docs/architecture.md), section 2. A gap across repositories — a row of [run/QUESTIONS.md](run/QUESTIONS.md) whose question opens with the mark «В реестр spec»: spec's session finds it on `main`, and it gets its О-, П- or Т- number once the author decides it there (R81 spec; RULES.md, Across repositories).
   - From `run/DEBT.md` and `run/QUESTIONS.md` take only the rows the task and its sections name and those `grep -n` finds by the paths and parts it changes (R143 spec).
3. **Devcontainer only.** If `NOVATRAIL_DEVCONTAINER` is not `1`, stop before the first edit and ask to reopen in the container; "only documents" is no reason to go on. If `spec/` is empty, ask for `git submodule update --init`. Exception: a cloud session the author started for the task runs the checks it can reach, and its report names each one that did not run.
4. Outside this repository — editing `spec` or other repositories, their settings, anything that costs money — only after a warning (what, where, cost) and the author's confirmation. `spec/` is read only here; a task of its own moves it to a new tag.
   - Exception, no confirmation: the task's checks by R146 spec — browser: Playwright in the devcontainer, custom-token sign-in of a stand-in user on the dev project; AI: the `tutor` stub in `api` dev mode. A real AI call only where the task checks the model's words: dev key under the author's spend limit at the provider, within the task's ceiling, or with confirmation where it has none; «Сделано» names the provider, the calls and the cost.
   - Nothing on devices: engines are Chromium, WebKit and Firefox in CI; what only a device shows — pen, device voices, VoiceOver and TalkBack, the home screen — stays a row of [run/DEBT.md](run/DEBT.md) until the author decides otherwise.
5. Facts on AI providers, laws, prices and other platforms — from the primary source, with quote and date read (RULES.md). What is not confirmed is not stated: it becomes an open question.
6. End with the checks of what the task changed. Documents: `just -f spec/justfile docs-check-repo` (R32 spec) — relative links lead to existing files and headings; each spec section and number — «architecture 3.5 spec», «R18 spec», О-, П-, Т- — exists in `spec/` at its tag; own sections exist, R numbers have no gaps or repeats and the log's opening names the next free one; numbers В in [run/QUESTIONS.md](run/QUESTIONS.md) and Д in [run/DEBT.md](run/DEBT.md) do not repeat and the next free one is above each. If the tag of `spec` is older than this check, check the same by hand. A code task also ends with the checks under table 1.

   Then `/code-review high`, one round: fix the findings, do not rerun. A small change may skip the review even if «Как проверить» names it.
7. Do not commit: the author commits after review. A run of spec's orchestrator, «Сделай эпик E…», is the author's word otherwise: its executor works by the contract `spec/tools/orchestrator/executor.md` — commits, pushes and opens the pull request, never merges (R156 spec). In a session the author started, not an orchestrator's run, the executor of E3 also merges, by the author's decision in the epic's description.
8. End with a short report in Russian: what was done, files, how to check, what the review found or why there was none, what is open and what goes «в реестр spec».
9. When done: table 1 `[ ]` → `[x]`; append to the body «Сделано (дата)» — what was done, how checked — and «Открыто». A question for the author from «Открыто» is also a row of [run/QUESTIONS.md](run/QUESTIONS.md); what is put off, a row of [run/DEBT.md](run/DEBT.md).
   - Then move the body verbatim, relative links fixed, to the epic archive `docs/plan/<epic>.md`, with a gist sentence — an unheaded list item at the start of the receiving section: «T01 — сделана <дата>: <итог одной фразой>». Neither stays here, and a search by heading finds one body, in the archive (R153 spec).
   - A task outside an epic leaves `run/TASKS.md` for the current epic's archive, section «Задачи вне эпика, сделанные за его время»; with no current epic, to the last done epic's archive, section «Задачи вне эпика, сделанные после него» (R19 spec and its 2026-11-13 amendment). Its row of table 1 stays (R13).
10. Language (R14 spec, R42 spec, R143 spec, R154 spec): this plan and `run/` in English, the bodies of tasks, the epic archives `docs/plan/` and the reports in Russian; `docs/` in English; README, CLAUDE.md, AGENTS.md, code, comments, schema descriptions, prompts and normative texts for authors in English.
11. A task larger than one review (≈ 30–60 minutes of reading): propose a split before starting.
12. Before a new task, close the findings on the previous one, once SonarCloud, CodeQL and Scorecard run here (R30 spec); an allowed departure from rule 1. SonarCloud sees merged code: its verdict on the previous task is in [New Code](https://sonarcloud.io/summary/new_code?id=altnovatrail_app); CodeQL and Scorecard — the Security tab, `gh api 'repos/altnovatrail/app/code-scanning/alerts?state=open'`. Fix in code first; "false positive" is the last resort, with the reason in words; what a change cannot close stays open — shared reasons in R33 spec, own ones in the log, like R51 canvas-api. Never skip silently. Report these fixes in a separate paragraph: the author commits them apart from the task.

**Statuses:** `[ ]` not started; `[x]` done, the executor marks it; `[-]` not done — the author's decision, reason in the task; `[?]` deferred — the author's decision, reason and when to return in the task. A task that fails the author's review returns to `[ ]` with what to fix.

**Who:** «Claude» — the executor does it, the author reviews; «Claude, проверяю я» — texts the author reads line by line; «я + Claude» — the author does some steps: decisions, sign-ins, GitHub settings, confirmations by rule 4.

**Plan:** «да» — plan mode first: decisions missing from the documents, or larger than one review (rule 11); «—» — run at once.

**Task body** (Russian): «Цель», «Сделать», «Как проверить», «Разделы»; as needed «Не делать», «Решить при планировании», «Мой шаг», «Стоимость», «Риски», «Ждёт»; from planning «Почему», «Решено автором (дата)», «Выяснилось при планировании»; when done «Сделано (дата)», «Открыто» (rule 9).

**Citations.** Own sections — `architecture 2`, own decisions — `R03`; spec's sections and decisions — «architecture 3.5 spec», «R18 spec», its open questions — «Т-22», «П-7», «О-2»: the repository keeps no registers; other NovaTrail repositories' decisions — «R03 api»; MathTrail's — «R44 canvas-api», «R163 standalone», in a list «canvas-api: R44, R59». Each log numbers its own: «R19 spec» and `R19` of this log differ. A task — «T03», from another repository «T03 app»; one not here is in `run/TASKS.md` or an archive: `grep -n '^#### T03\.' RUN.md run/TASKS.md docs/plan/*.md`. Task numbers are global and never reused: take the one free when writing it down.

## Epics

- **Table 1** is the current epic: its tasks in detail, run one at a time. A task outside an epic — a move to a tag of `spec` (RULES.md, Across repositories), a task of analysis by R145 spec — has its row in table 1 too, with or without an epic, and its body in `run/TASKS.md` (R13, R50).
- **Next epic.** Once table 1 is all checked, the author picks the next epic from [run/EPICS.md](run/EPICS.md) and splits it with Claude in plan mode into tasks of one review each, into table 1 and this file.
- **A done epic** goes to `docs/plan/<epic>.md` (R59 canvas-api): bodies and gist sentences are there already (rule 9); move its description and table of tasks verbatim; questions and debt stay in `run/`; until the next epic, table 1 reads «Current epic — none» and names it as the last done epic; measure the epic's sessions — `just -f spec/justfile tokens-report --since <first day of the epic> --row` — as a row of the table of measurements of [docs/measurements.md](docs/measurements.md), after measurements 1.9 spec; a new analysis by the threshold of R145 spec. Never read an archive whole: take the task cited.
- **Archives:** E1 — [docs/plan/E1.md](docs/plan/E1.md); E2 — [docs/plan/E2.md](docs/plan/E2.md); E3 — [docs/plan/E3.md](docs/plan/E3.md); E5, the current epic, its done tasks — [docs/plan/E5.md](docs/plan/E5.md).

## Table 1. Current epic — E5. Интерфейс по эталону

**Result:**
- `app`'s screens of the first slice look as the interface mockup of `spec/draft/mockup/` has them, on a phone, a tablet and a computer, by its README's «Two sizes, and the rules between them», «The style» and «Contrast»; the screens the mockup lacks — the section for adults, the legal pages, the failure screens, the task's states of the note `t155` of its `canvas.json` — by its rules of style (R148 spec and its amendments);
- the behaviour stays the documents', but for the one change R148 spec names: the tutor speaks of the work only while its panel is open (its second 2026-11-17 amendment);
- a session compares its screen with the mockup without the author: Playwright snapshots in Chromium, WebKit and Firefox, 390 × 844 and 1194 × 834 (R146 spec);
- Д24 closed; E4 of [run/EPICS.md](run/EPICS.md) builds the children's screens by the mockup.

T72–T74 are tasks outside an epic, done before E5 opened; their bodies are in [docs/plan/E3.md](docs/plan/E3.md), section «Задачи вне эпика, сделанные после него», and their rows stay here (R13, R50). T92 and T93 are tasks outside the epic, written down for spec's orchestrator (rule 6 of [COORDINATION.md](spec/COORDINATION.md)); their bodies are in [docs/plan/E5.md](docs/plan/E5.md), section «Задачи вне эпика, сделанные за его время».

| Статус | ID | Задача | Кто | План | Зависит от |
|---|---|---|---|---|---|
| [x] | T72 | Переход на тег `spec` v0.18.12 | Claude | — | — |
| [x] | T73 | «Проще» и «Сложнее» у уровня модуля | Claude | — | — |
| [x] | T74 | README без «Status», «License», фразы о языках и версии spec | Claude | — | — |
| [x] | T75 | Запись и план эпика «Интерфейс по эталону» | Claude | да | — |
| [x] | T88 | Слова наставника — только при открытой панели | Claude | — | T75 |
| [x] | T92 | С экрана «Мои сочинения» нельзя уйти | Claude | — | — |
| [x] | T76 | Эталон в трёх движках и сравнение снимков | Claude | — | T88 |
| [x] | T77 | Цвета, стекло, радиусы и движение эталона — поправка к R17 | Claude | — | T76 |
| [x] | T78 | Раскладка от ширины и всплывающие окна | Claude | — | T77 |
| [x] | T79 | Кнопки без подписи: значки, имена и подсказки | Claude | — | T78 |
| [x] | T80 | Канва строки 5.11: стеклянная полоса и 2.5.7 | Claude | — | T79 |
| [x] | T93 | README — только описание компонента и его место в архитектуре | Claude | — | — |
| [x] | T81 | Вход, профиль владельца с аватаром и «Кто учится?» | Claude | — | T80 |
| [x] | T82 | Главная: карточки модулей по `./states` и легенда | Claude | — | T81 |
| [x] | T83 | Помощь взрослого, меню профиля и карта навыков | Claude | — | T82 |
| [x] | T84 | Плеер урока | Claude | — | T83 |
| [x] | T85 | Экран задачи: условие, режим решения и ряд действий | Claude | — | T84 |
| [x] | T86 | Тетрадь и сочинение по эталону | Claude | — | T85 |
| [ ] | T87 | Панель наставника сбоку и лист на телефоне | Claude | — | T86 |
| [ ] | T89 | Раздел для взрослых по правилам стиля эталона | Claude | — | T87 |
| [ ] | T90 | Юридические страницы и экраны сбоев по правилам стиля | Claude | — | T89 |
| [ ] | T91 | Итог эпика E5 | Claude | — | T90 |

«Зависит от» names only tasks of this plan. What a task waits for from other repositories is its body's «Ждёт»: it is taken once the neighbour has done that, and until then the queue goes on.

A code task ends with the checks of rule 6: the recipes `ci-lint`, `ci-test`, `ci-engines`, `ci-vuln`, `ci-licenses` and `build` green locally and in CI; `codecov/patch` at least 90 % of the changed lines; `just -f spec/justfile docs-check-repo` green; then `/code-review high`, one round. A task's «Как проверить» names only what goes beyond them.

## Epic E5. Интерфейс по эталону

**Why.** Row 6.18 of [COORDINATION.md](spec/COORDINATION.md), the text of T157 `spec` (the third 2026-11-14 amendment to R76 spec); R148 spec and its amendments; Д24 and Д25. The epic changes the look, not the behaviour, but for the rule of the tutor's panel (the second 2026-11-17 amendment to R148 spec; the author's word of 2026-11-17).

**Decided by the author (2026-11-16, T52):** the place — after row 6.29 (T73) and before E4 ([run/EPICS.md](run/EPICS.md)). The third 2026-11-14 amendment to R76 spec left it to the author; no other decision of the plan is reserved for the author.

**Decided at planning (T75, 2026-11-17)** — the executor's choices in a run of the orchestrator, which nobody approves (R156 spec):
- **The tag of `spec`.** No move in the epic: the tag with T157 is here since v0.18.4 (R51), and v0.18.12 holds the rule of the panel too (R55). A newer tag is a task outside the epic, as before.
- **The split.** One review a task, in one chain, since every task touches `src/theme/` and the screens' CSS. The rule of the tutor's panel goes first, on the panel as it is (T88; the author's word of 2026-11-17: the tutor's words take about 97 % of the money spent on AI, measurements 3.20 `tutor`); then what all screens share — the mockup in the browser and the comparison (T76), the style (T77), the layout from the width and the pop-overs (T78), the buttons without a caption (T79), the canvas's bar (T80); then the screens in the path's order (T81–T87); T78 and every task after it keep T88's rule; then the screens the mockup lacks (T89, T90); the summary last (T91).
- **The comparison of snapshots** (T76 builds it and records it as a decision):
  - *Snapshots:* Playwright in Node, as `walk/`, in Chromium, WebKit and Firefox, viewports 390 × 844 and 1194 × 834, `reducedMotion: "reduce"`, `animations: "disabled"`; the mockup's `#frame` by its README, `app`'s screen as its screen tests draw it — the Vitest browser projects with the routing transport in place of `api` (R45), synthetic data, no `api` and no development token, so that it runs in CI —; the measurements of both sides are compared in Node, and how one run brings them together T76 decides; the PNGs are an artifact of the run, never committed.
  - *Regions, not pixels:* each compared state is a list of regions — a pair of locators, one in the mockup and one in `app` — the top bar, a card, a primary button, the tool bar, the tutor's panel, a pop-over, the row of actions. A region is measured by its box and its computed style: the background and border colours, the radius, the text's colour, size and weight, not its glyphs, nor a width that follows the text.
  - *Thresholds:* a box within 4 CSS px in x, y, width and height; a region whose width follows its caption is compared in height and place only, and its entry says so; a colour equal, each channel within 2 of 255, after the replacements of «Contrast» and with a translucent colour laid over what it stands on; a radius and a font size within 0.5 px; a weight equal.
  - *A difference:* a region missing, a box or a colour beyond the threshold. Not a difference: glyphs, the icons' shapes (inline SVG in the mockup shows place, size and weight — its README, «The style»), the text's width, and what the README's «Where it differs from the documents» names — each such region says which of its rows holds.
  - *The mockup across engines:* each state of «First slice» reaches `data-ready="true"` with no error in the console, and the regions of its three engines agree within 2 CSS px and with equal colours. A failure, or engines that disagree, is a row «В реестр spec» of [run/QUESTIONS.md](run/QUESTIONS.md) naming the run with the snapshots, not an edit of `app`'s screen (Д244 spec).
- **Rejected at planning:** a pixel diff of whole snapshots — glyphs and the system font differ by engine and device, and the mockup draws other fonts (R148 spec), so every state would differ; tighter thresholds — the engines round boxes differently, and 4 CSS px is below what the eye takes for another layout at these sizes; snapshots committed as references — a binary in every pull request, and no reference beyond the mockup itself; tasks in parallel — each touches `src/theme/` and the shared components, and the orchestrator would merge conflicting branches; a move to a newer tag of `spec` inside the epic — nothing of the epic needs it.
- **Where `app` departs from the mockup by the documents** — the screen keeps the documents' behaviour, and the comparison's entry for the region names the row of «Where it differs» or the decision.

**Each screen task** compares its states of the mockup's table «Screens and states» by T76's recipe in three engines and two sizes, holds `axe-core` and 320 CSS px (R17), writes its strings in `en` and `ru` with no first person of AI (R91, R92 spec), and keeps the behaviour of the documents.

**Not in the epic** (row 6.18): behaviour the documents do not have — the paper flow, the switch of canvas kinds, «Show where», the tutor's text field and microphone (epic E11 spec), the highlighter of the bar; the children's screens — E4.

**Waits:** T82 — `./states` of `skill-map`, row 6.19: in its package since 0.1.11, 0.1.15 the latest on 2026-11-17. Nothing else waits.

**E3's result** «с iPad, Android и компьютера» reads «с телефона, планшета и компьютера» (the second 2026-11-14 amendment to R76 spec).

## Задачи эпика

#### T87. Панель наставника сбоку и лист на телефоне

- **Цель:** панель наставника — по эталону: сбоку на планшете и компьютере, листом снизу на телефоне.
- **Почему:** вторая поправка 2026-11-14 к R148 spec — шаги решения в панели; поправка 2026-11-17 к R148 spec — `tools-hidden` под листом телефона; R123 spec — «Report a problem».
- **Сделать:**
  - состояния `task`, `task-steps`, `task-pill`, `task-hint`, `task-rung`, `task-alt`, `task-report`, `task-full`, `quota`;
  - панель 344 px справа от верхней панели до 16 px снизу, лист сдвигается влево; на телефоне лист на половину высоты, ручка 88 × 44 — на весь экран, `tools-hidden` на канве, пока лист открыт;
  - голова — доля квоты и динамик; шаги решения, пилюля шага при закрытой панели; Hint и «Explain differently»; вердикт строкой в открытой панели; «Report a problem» и её форма;
  - кнопка наставника 56 px у правого края, на телефоне над рядом; без поля ввода и микрофона.
- **Не делать:** нового правила слов — его дала T88: панель и лист его сохраняют, кнопка наставника, Hint и пилюля шага открывают панель, вердикт — нет.
- **Как проверить:** сравнение этих состояний (T76); тесты панели, листа и `tools-hidden`.
- **Разделы:** R148, R82, R123, R98 spec; R33, R37, R36; [docs/architecture.md](docs/architecture.md), раздел 3.3; README эталона.

#### T89. Раздел для взрослых по правилам стиля эталона

- **Цель:** раздел для взрослых, которого в эталоне нет, — по его правилам стиля.
- **Почему:** R148 spec — экраны, которых нет в эталоне, `app` рисует по правилам стиля.
- **Сделать:** страницы `#/adults` — профиль, «Это устройство», свой ключ, хранение работ, квота, прогресс и уровень модуля, модули — карточками, полями и окнами эталона, по раскладке T78 и кнопкам T79; аватар профиля (T81).
- **Как проверить:** тесты раздела в трёх движках; 320 CSS px; цвета и радиусы — роли «The style» (тест токенов T77).
- **Разделы:** R148 spec; R29, R30, R35, R37, R47, R56; README эталона — «The style».

#### T90. Юридические страницы и экраны сбоев по правилам стиля

- **Цель:** юридические страницы, «Accessibility» и экраны сбоев — по эталону и его правилам стиля.
- **Почему:** R148 spec; R130 spec — суть текста — `summary` его версии в силе.
- **Сделать:**
  - состояния `legal-privacy`, `legal-terms`, `legal-access`: на телефоне текст на весь экран;
  - уведомления о чужом коде, лицензии модулей, экраны сбоев загрузки и сети — по правилам стиля.
- **Как проверить:** сравнение трёх состояний (T76); тесты страниц.
- **Разделы:** R148, R130 spec; R31, R32, R46, R09; README эталона.

#### T91. Итог эпика E5

- **Цель:** E5 подведён и ушёл в архив, следующий — E4.
- **Почему:** RUN.md, раздел Epics.
- **Сделать:** README и [docs/architecture.md](docs/architecture.md), раздел 3.10; замер сессий эпика — строка таблицы [docs/measurements.md](docs/measurements.md); описание и таблица эпика — в [docs/plan/E5.md](docs/plan/E5.md); таблица 1 — «Current epic — none», следующий — E4 по слову автора 2026-11-16; строки «в реестр spec», которые эпик оставил, — в отчёт.
- **Как проверить:** `just -f spec/justfile docs-check-repo`.
- **Разделы:** RUN.md, Epics; R19 spec; measurements 1.9 spec.
