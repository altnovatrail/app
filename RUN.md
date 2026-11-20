# RUN.md — work plan of app

What app does, does not do and has still to decide — [docs/architecture.md](docs/architecture.md); why — [docs/decisions.md](docs/decisions.md). The platform is in `spec/`, a submodule at tag v0.19.4: the component's card — architecture 3.1 spec; the order of repositories — repositories 6 spec; learners' data and law — privacy spec; the platform's decisions — spec's log. Small tasks, one at a time, each reviewed by the author; only the current epic is in detail (R19 spec). Other tables, each a file opening with its rules (R153 spec): 2, epics for later — [run/EPICS.md](run/EPICS.md); 3, questions to the author — [run/QUESTIONS.md](run/QUESTIONS.md); 4, debt — [run/DEBT.md](run/DEBT.md). Open tasks outside an epic — [run/TASKS.md](run/TASKS.md) (R155 spec). «Как пользоваться» in older texts is Rules, «Как устроен план: эпики» is Epics, and «таблица 2, 3, 4» names the file above (R50).

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
9. When done: table 1 `[ ]` → `[x]`; append to the body «Сделано (дата)» — one line, what was done and its pull request, which says how it was checked; where the author commits after review, the report says it. What stays open is rows, not text: a question for the author, of [run/QUESTIONS.md](run/QUESTIONS.md); what is put off, of [run/DEBT.md](run/DEBT.md) (R160 spec).
   - Then move the body verbatim, relative links fixed, to the epic archive `docs/plan/<epic>.md`, with a gist sentence — an unheaded list item at the start of the receiving section: «T01 — сделана <дата>: <итог одной фразой>». Neither stays here, and a search by heading finds one body, in the archive (R153 spec).
   - A task outside an epic leaves `run/TASKS.md` for the current epic's archive, section «Задачи вне эпика, сделанные за его время»; with no current epic, to the last done epic's archive, section «Задачи вне эпика, сделанные после него» (R19 spec and its 2026-11-13 amendment). Its row of table 1 stays (R13).
10. Language (R14 spec, R42 spec, R143 spec, R154 spec): this plan and `run/` in English, the bodies of tasks, the epic archives `docs/plan/` and the reports in Russian; `docs/` in English; README, CLAUDE.md, AGENTS.md, code, comments, schema descriptions, prompts and normative texts for authors in English; commit messages and a pull request's title and description in English and terse, for the session, never a copy of the report.
11. A task larger than one review (≈ 30–60 minutes of reading): propose a split before starting.
12. Before a new task, close the findings on the previous one, once SonarCloud, CodeQL and Scorecard run here (R30 spec); an allowed departure from rule 1. SonarCloud sees merged code: its verdict on the previous task is in [New Code](https://sonarcloud.io/summary/new_code?id=altnovatrail_app); CodeQL and Scorecard — the Security tab, `gh api 'repos/altnovatrail/app/code-scanning/alerts?state=open'`. Fix in code first; "false positive" is the last resort, with the reason in words; what a change cannot close stays open — shared reasons in R33 spec, own ones in the log, like R51 canvas-api. Never skip silently. Report these fixes in a separate paragraph: the author commits them apart from the task.

**Statuses:** `[ ]` not started; `[x]` done, the executor marks it; `[-]` not done — the author's decision, reason in the task; `[?]` deferred — the author's decision, reason and when to return in the task. A task that fails the author's review returns to `[ ]` with what to fix.

**Who:** «Claude» — the executor does it, the author reviews; «Claude, проверяю я» — texts the author reads line by line; «я + Claude» — the author does some steps: decisions, sign-ins, GitHub settings, confirmations by rule 4.

**Plan:** «да» — plan mode first: decisions missing from the documents, or larger than one review (rule 11); «—» — run at once.

**Task body** (Russian): «Цель», «Сделать», «Как проверить», «Разделы»; as needed «Не делать», «Решить при планировании», «Мой шаг», «Стоимость», «Риски», «Ждёт»; from planning «Почему», «Решено автором (дата)», «Выяснилось при планировании»; when done «Сделано (дата)» (rule 9).

**Citations.** Own sections — `architecture 2`, own decisions — `R03`; spec's sections and decisions — «architecture 3.5 spec», «R18 spec», its open questions — «Т-22», «П-7», «О-2»: the repository keeps no registers; other NovaTrail repositories' decisions — «R03 api»; MathTrail's — «R44 canvas-api», «R163 standalone», in a list «canvas-api: R44, R59». Each log numbers its own: «R19 spec» and `R19` of this log differ. A task — «T03», from another repository «T03 app»; one not here is in `run/TASKS.md` or an archive: `grep -n '^#### T03\.' RUN.md run/TASKS.md docs/plan/*.md`. Task numbers are global and never reused: take the one free when writing it down.

## Epics

- **Table 1** is the current epic: its tasks in detail, run one at a time. A task outside an epic — a move to a tag of `spec` (RULES.md, Across repositories), a task of analysis by R145 spec — has its row in table 1 too, with or without an epic, and its body in `run/TASKS.md` (R13, R50).
- **Next epic.** Once table 1 is all checked, the author picks the next epic from [run/EPICS.md](run/EPICS.md) and splits it with Claude in plan mode into tasks of one review each, into table 1 and this file.
- **A done epic** goes to `docs/plan/<epic>.md` (R59 canvas-api): bodies and gist sentences are there already (rule 9); move its description and table of tasks verbatim; questions and debt stay in `run/`; until the next epic, table 1 reads «Current epic — none» and names it as the last done epic; measure the epic's sessions — `just -f spec/justfile tokens-report --since <first day of the epic> --row` — as a row of the table of measurements of [docs/measurements.md](docs/measurements.md), after measurements 1.9 spec; a new analysis by the threshold of R145 spec. Never read an archive whole: take the task cited.
- **Archives:** E1 — [docs/plan/E1.md](docs/plan/E1.md); E2 — [docs/plan/E2.md](docs/plan/E2.md); E3 — [docs/plan/E3.md](docs/plan/E3.md); E5 — [docs/plan/E5.md](docs/plan/E5.md).

## Table 1. Current epic — none

No current epic. The last done one is E5 «Интерфейс по эталону», archive — [docs/plan/E5.md](docs/plan/E5.md). Next, by the author's word of 2026-11-16 (T52): E4 of [run/EPICS.md](run/EPICS.md), which the author splits with Claude in plan mode (Epics). A row outside an epic has its body in [run/TASKS.md](run/TASKS.md) while open, and in the archive of E5 once done (R13, R50).

| Статус | ID | Задача | Кто | План | Зависит от |
|---|---|---|---|---|---|
| [ ] | T94 | Анализ расхода сессий по порогу R145 spec | Claude | да | — |
| [x] | T95 | Иконки: `canvas` v0.3.30 и `skill-map` с набором 1.2.99 | Claude | — | — |
| [x] | T96 | Тексты без истории (R160 spec) и тег spec v0.18.34 | Claude | — | — |
| [x] | T97 | Документы без истории (R160 spec) | Claude | — | T96 |
| [x] | T98 | Комментарии кода по R160 spec | Claude | — | T96 |
| [x] | T99 | Документы без истории: разделы 3.2 и 3.3 (R160 spec) | Claude | — | T97 |
| [x] | T100 | Документы без истории: разделы 3.4–3.6 (R160 spec) | Claude | — | T97 |
| [x] | T101 | Документы без истории: разделы 3.7 и 3.9 (R160 spec) | Claude | — | T97 |
| [x] | T102 | Документы без истории: раздел 3.8 (R160 spec) | Claude | — | T97 |
| [x] | T103 | Комментарии кода по R160 spec: задача и холст | Claude | — | T98 |
| [x] | T104 | Комментарии кода по R160 spec: хранилище, учётная запись и вход | Claude | — | T98 |
| [x] | T105 | Комментарии кода по R160 spec: взрослые, уроки и карта навыков | Claude | — | T98 |
| [x] | T106 | Комментарии кода по R160 spec: оболочка, api и голос | Claude | — | T98 |
| [x] | T107 | Комментарии кода по R160 spec: словари, правовые тексты, пакеты и тема | Claude | — | T98 |
| [x] | T108 | Переход на тег `spec` v0.19.4 | Claude | — | — |

«Зависит от» names only tasks of this plan. What a task waits for from other repositories is its body's «Ждёт»: it is taken once the neighbour has done that, and until then the queue goes on.

A code task ends with the checks of rule 6: the recipes `ci-lint`, `ci-test`, `ci-engines`, `ci-vuln`, `ci-licenses` and `build` green locally and in CI; `codecov/patch` at least 90 % of the changed lines; `just -f spec/justfile docs-check-repo` green; then `/code-review high`, one round. A task's «Как проверить» names only what goes beyond them.
