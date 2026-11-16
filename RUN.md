# RUN.md — work plan of app

What app does, does not do and has still to decide — [docs/architecture.md](docs/architecture.md); why — [docs/decisions.md](docs/decisions.md). The platform is in `spec/`, a submodule at tag v0.18.3: the component's card — architecture 3.1 spec; the order of repositories — repositories 6 spec; learners' data and law — privacy spec; the platform's decisions — spec's log. Small tasks, one at a time, each reviewed by the author; only the current epic is in detail (R19 spec). Other tables, each a file opening with its rules (R153 spec): 2, epics for later — [run/EPICS.md](run/EPICS.md); 3, questions to the author — [run/QUESTIONS.md](run/QUESTIONS.md); 4, debt — [run/DEBT.md](run/DEBT.md). Open tasks outside an epic — [run/TASKS.md](run/TASKS.md) (R155 spec). «Как пользоваться» in older texts is Rules, «Как устроен план: эпики» is Epics, and «таблица 2, 3, 4» names the file above (R50).

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
- **Archives:** E1 — [docs/plan/E1.md](docs/plan/E1.md); E2 — [docs/plan/E2.md](docs/plan/E2.md); E3, under way — [docs/plan/E3.md](docs/plan/E3.md).

## Table 1. Current epic — E3. Первый срез со взрослыми учениками

**Результат:**
- сборку `app` выкатил `infra` вместе с `api` (R106 spec; строка 6.9 [COORDINATION.md](spec/COORDINATION.md)), и на ней учатся взрослые ученики — я, а по инвайт-кодам и другие взрослые, — с iPad, Android и компьютера;
- построено то, что карточка поручает `app` до первого ребёнка, кроме экранов детей ([docs/architecture.md](docs/architecture.md), раздел 3.10; product 10 spec):
  - раздел для взрослых — настройки профиля, «Это устройство», свой ключ, хранение работ на сервере, квота ИИ платформы и прогресс;
  - «Карта навыков» пакетом `skill-map`;
  - озвучка;
  - модули тетради и сочинений — привязка `sheet` и отзыв по рубрике;
  - раскрытие, что наставник — ИИ, учебные материалы и «сообщить о проблеме»;
  - юридические страницы, «Доступность», уведомления о чужом коде и лицензии модулей;
- долги Д5, Д6, Д8 и Д14 закрыты, а ручные проверки Д4, Д9 и Д13 пройдены на устройствах.

| Статус | ID | Задача | Кто | План | Зависит от |
|---|---|---|---|---|---|
| [x] | T35 | Добор пути T30 и слова наставника на `api` | я + Claude | — | — |
| [x] | T36 | Канва 0.3.13 | Claude | да | T35 |
| [x] | T37 | Раздел для взрослых: вход и настройки профиля | Claude | да | T35 |
| [x] | T38 | «Это устройство» и байты в IndexedDB | Claude | да | T37 |
| [x] | T39 | Хранение работ на сервере | Claude | да | T37, T38 |
| [x] | T40 | Юридические страницы, «Доступность» и уведомления о чужом коде | Claude, проверяю я | да | T36, T37 |
| [x] | T41 | Лицензии модулей | Claude | — | T40 |
| [x] | T42 | Раскрытие, что наставник — ИИ, учебные материалы и «Сообщить о проблеме» | Claude, проверяю я | да | T35, T40 |
| [x] | T43 | «Карта навыков» ученика | Claude | да | T35 |
| [x] | T44 | Прогресс в разделе для взрослых | Claude | — | T37, T43 |
| [x] | T45 | Озвучка | Claude | да | T37, T38 |
| [x] | T46 | Свой ключ | Claude | да | T37, T38 |
| [ ] | T47 | Сочинения: `sheet`, отзыв по рубрике и напоминание не писать имён | Claude | да | T36, T38, T39, T42 |
| [ ] | T48 | Рабочая тетрадь | Claude | да | T36 |
| [x] | T49 | Квота ИИ платформы | я + Claude | да | T37 |
| [x] | T50 | Развёртывание с `infra` | я + Claude | да | — |
| [-] | T51 | Проверки на устройствах — вошла в T57 | я + Claude | да | T45, T50, T56 |
| [ ] | T52 | Итог E3 | я + Claude | — | T35–T50, T57–T60 |
| [x] | T53 | Переход на `spec` v0.16.3, перестройка документов, названия в прогрессе и доля квоты | Claude | да | — |
| [x] | T54 | Перевод: `docs/architecture.md`, `docs/sources.md` и `docs/measurements.md` | Claude | да | T53 |
| [x] | T55 | Перевод: журнал решений; бюджеты документов | Claude | да | T54 |
| [-] | T56 | Путь в браузере без автора — вошла в T57 | Claude | да | T53 |
| [x] | T57 | Переход на `spec` v0.17.1, путь в браузере без автора и проверки на трёх движках | я + Claude | да | T45, T50, T53 |
| [x] | T58 | Следующая версия юридического текста и оператор копии | Claude | да | T57 |
| [x] | T59 | Пинг gapi в WebKit — ожидаемый отказ CSP | Claude | — | T58 |
| [x] | T60 | Путь в браузере: штатный отказ и начатый урок | Claude | — | T58 |
| [x] | T61 | Переход на `spec` v0.17.9 | Claude | — | — |
| [ ] | T62 | Работы на сервере: `PutWork` | Claude | — | T39, T46 |
| [x] | T63 | Переход на `spec` v0.18.3: тег, пакеты и контейнер | Claude | да | — |
| [x] | T64 | Переход на `spec` v0.18.3: таблицы плана в `run/` и план на английском | Claude | — | T63 |
| [x] | T65 | CI на общих процессах `.github` v0.1.24 | Claude | — | T64 |
| [x] | T66 | Слова отказа `CAUSE_KEY_CHECKS_EXHAUSTED` — Д28 | Claude | — | — |
| [ ] | T67 | Скорость CI: строка 7.22 | Claude | — | — |
| [ ] | T68 | Скорость CI: WebKit и Firefox своей проверкой — строка 7.22 | Claude | — | T67 |
| [ ] | T69 | Скорость CI: переход на `spec` со стадией `toolchain-core` — строка 7.22 | Claude | — | T68 |

«Зависит от» names only tasks of this plan. What a task waits for from other repositories is its body's «Ждёт»: it is taken once the neighbour has done that, and until then the queue goes on.

A code task ends with the checks of rule 6: the recipes `ci-lint`, `ci-test`, `ci-vuln`, `ci-licenses` and `build` green locally and in CI; `codecov/patch` at least 90 % of the changed lines; `just -f spec/justfile docs-check-repo` green; then `/code-review high`, one round. A task's «Как проверить» names only what goes beyond them.

**Почему такой порядок.**
- T47 и T48 ждут соседей: сочинения и тетрадь — их допуска в `api`. Их порядок — тот, в каком соседи их откроют.
- T62 ждёт `canvas`: картинку работы для `PutWork` рисует канва, а её метода ещё нет (В66).
- T68 и T69 ждут соседей по строке 7.22 [COORDINATION.md](spec/COORDINATION.md): T68 — релиза `.github` строки 7.13, T69 — тега `spec` строки 7.14 и релиза `.github` с `toolchain-core`. T69 меняет `.devcontainer/` и потому идёт последней.
- T52 — итог эпика, когда сделано остальное.

## Epic E3. Первый срез со взрослыми учениками

**Почему эпик такой.**
- E3 — первый срез этапа 2 без детей. В нём всё, что карточка поручает `app`, кроме того, что нужно только с ребёнком: профилей детей, согласия, PIN, раздела «Помощь», выгрузки и удаления. Это E4 (таблица 2; [docs/architecture.md](docs/architecture.md), раздел 3.10; repositories 6 spec).

**Не входит:**
- в E4 (таблица 2; Д7, Д10):
  - профили детей, согласие родителя и подростка;
  - PIN раздела для взрослых и профиля владельца;
  - раздел «Помощь» и строка ребёнку о прогрессе;
  - показ решения ребёнку;
  - выгрузка и удаление, а с ним — отзыв токена Google;
  - ручные проверки доступности;
- позже, этапами платформы:
  - тарифы и оплата — этап 3 (О-14);
  - виджеты модулей — этап 4 (R16 spec);
  - задача с бумаги — этап 5 (О-11);
- класс ученика — с первым модулем, чей паспорт называет классы.

**Решено автором (2026-11-12)**, при планировании эпика, все три — по рекомендациям плана; второе, о В51, сделала T38, и оно — в архиве E3:
- **Кто коммитит.** Коммит, push, pull request и мерж каждой задачи E3 делает исполнитель, как в E2:
  - мерж — merge-коммитом и только когда все проверки pull request зелёные (R30 spec);
  - правило 7 в E3 не действует, как и «Do not commit» в RULES.md, How we work;
  - шаги в настройках GitHub и сервисов и всё, что стоит денег, — по-прежнему мои (правило 4);
  - проверяю я после мержа: задачу, которую верну в `[ ]`, исполнитель правит новым pull request;
  - так же уходит и само планирование эпика.
- **Развёртывание — как только его готов сделать `infra`.**
  - T50 ждёт T24 `infra`. А та ждёт моего решения по строке 6.9 [COORDINATION.md](spec/COORDINATION.md) и оплаты не пробным периодом (Д8 `infra`).
  - Сразу за T50 идут проверки на устройствах, T51.
  - Инвайт-коды взрослым, кроме меня, — только когда в выкатке есть:
    - юридические страницы — T40;
    - раскрытие, что наставник — ИИ, и «сообщить о проблеме» — T42.

**Выяснилось при планировании** — разведка 2026-11-12 по соседям — в архиве [docs/plan/E3.md](docs/plan/E3.md), раздел «Из описания эпика в RUN.md»: задача сверяет соседей заново, на день своего планирования.


#### T47. Сочинения: `sheet`, отзыв по рубрике и напоминание не писать имён

- **Цель:** ученик пишет сочинение `english-essays` на листе, отправляет его и получает отзыв по рубрике, перечитывает и закрывает попытку «Готово». Перед отправкой он видит напоминание не писать имён.
- **Почему:** модуль сочинений — один из трёх модулей первого среза (R41 spec). Привязка `sheet` и отзыв по рубрике — экраны E3 (раздел 3.10), а напоминание — R127 spec.
- **Сделать:**
  - задача с одной ячейкой `sheet` и рубрикой:
    - «Проверить» — `SubmitEssay` с вырезкой листа;
    - исходы — отзыв, `blank` и `illegible`, «без проверки»; пустой отзыв — «отзыва на этот раз нет»;
    - «Готово» — после первой отправки, это `Done`;
    - «Показать решение» нет;
  - шаги «План», «Пишу» и «Перечитываю» — по разделу 3.3;
  - напоминание не писать имён — перед каждой отправкой работы, которая уходит к ИИ целиком (R127 spec);
  - сочинение с отзывом лежит на устройстве, пока его не сотрут (R04): хранилище в базе профиля, строка со «Стереть» на «Это устройство», место, где ученик перечитывает (раздел 3.10);
  - «Сообщить о проблеме» у отзыва (T42).
- **Ждёт:** допуска задач с рубрикой в `api` (Д26 `api`).
- **Решить при планировании:**
  - где ученик перечитывает сочинение (R06; раздел 3.10);
  - как напоминание не мешает каждой отправке;
  - что `modules` убирает из условий пяти задач, когда `app` показывает напоминание сам (Д9 `modules`).
- **Как проверить:** тесты исходов `SubmitEssay`; руками на `api` — платный вызов, по правилу 4.
- **Разделы:** R04, R05, R06, R16; [docs/architecture.md](docs/architecture.md), разделы 3.2, 3.3 и 3.10; R75, R87, R113, R127 spec; [текст формата](spec/format/README.md), разделы 14 и 15.

#### T48. Рабочая тетрадь

- **Цель:** ученик решает задачи `grade-3-math` в рабочей тетради: окошки строк, вырезки окошек на проверку, вердикт у каждого окошка.
- **Почему:** школьная математика 3 класса на тетради — модуль первого среза (R41 spec; product 10 spec).
- **Сделать:**
  - экран задачи с тетрадью: строку пункта показывает канва (architecture 3.1 spec);
  - «Проверить» — `SubmitWork` с `WorkbookWork`: вырезка каждого заполненного окошка с его ячейкой, без текста пункта и черновика (R53 spec);
  - вердикт и пометки — у окошка, `answer_slot`, а вердикт пункта складывается из них (R56 spec);
  - путь по шагам тетради — по разделу 3.3;
  - урок с примерами на тетради, если модуль их даёт.
- **Ждёт:** допуска тетради в `api` (Д24 `api`).
- **Как проверить:** тест: черновик и пустые окошки в запрос не уходят; руками на `api` — платный вызов, по правилу 4.
- **Разделы:** R05, R20, R21; [docs/architecture.md](docs/architecture.md), раздел 3.3; R53, R56 spec; [текст формата](spec/format/README.md), раздел 14.

#### T62. Работы на сервере: `PutWork`

- **Цель:** работы профиля с включённым хранением уходят на сервер по `PutWork`. «Это устройство» снимает предупреждение «работы только на этом устройстве» у профиля, когда каждая его работа на устройстве лежит и на сервере.
- **Почему:** Д16. С поправки 2026-11-13 к R113 spec сервер хранит работы по `WorkService` (Д233 spec; [текст контрактов](spec/contracts/README.md), раздел 15, «Stored works»), и `api` держит их с T75 `api` (R70 api). А `app` всё ещё пишет, что сервер работ не хранит, и предупреждает о потере у каждого профиля (R30): текст `storage-consent` обещает хранение, а работы на сервер не идут.
- **Решено автором (2026-11-14)** — все три по рекомендациям исполнителя, на моё «делай Д16»:
  - **картинку работы рисует канва.** `StoredWork.picture` — «the PNG of the strokes the surface shows at the end, as the device draws it», и `api` проверяет её подпись PNG (`work.proto`). Канва 0.3.15 её не даёт, и релизы до v0.3.18 тоже: `exportPNG()` убрала R27 canvas, а `exportWork()` даёт вырезку на проверку, на тетради — вырезки окошек. Рисует тот же, кто рисует лист и вырезку, — вопрос «в реестр spec» В66. Отвергнуто: `app` рисует сам по `replay(history)` — второй рисунок той же работы, не такой, как лист; вырезка последней сдачи — не то, что называет контракт: на тетради это не одна картинка, а до первой сдачи слать нечего;
  - **объём — только `PutWork`.** Список работ на сервере и стирание по одной, `ListWorks` и `DeleteWork`, — Д26; продолжение открытой попытки с работой другого устройства, `GetWork`, — Д27;
  - **предупреждение — по работам.** «Это устройство» снимает его у профиля, только когда хранение включено и последняя `PutWork` каждой работы профиля на устройстве прошла. Работа больше 4 МиБ, отказ и сбой сети предупреждение оставляют. Отвергнуто: по профилю, как предлагала строка Д16, — тогда работа, что не дошла до сервера, лежала бы только здесь без предупреждения (R113 spec).
- **Ждёт:** релиза `canvas` с методом картинки работы — В66.
- **Сделать:**
  - клиент `WorkService` в `src/api/client.ts`, рядом с прочими службами;
  - `PutWork` — пока `Profile.work_storage` включено, когда `app` пишет работу на устройство: на каждой сдаче и когда попытка закрывается (`work.proto`). `StoredWork` — `attempt_id`, история письма — JSON её массива в UTF-8, сдачи — JSON контекста каждой и `history_length`, по порядку, — и картинка от канвы, без `kind` и `stored_at`. Размер — сумма байтов истории, контекстов и картинки: больше 4 194 304 байт работа не уходит и остаётся только на устройстве;
  - ответы:
    - прошла — у попытки в базе профиля отметка, до какой длины истории и какого числа сдач работа на сервере;
    - `CAUSE_WORK_TOO_LARGE` — работа только здесь;
    - `CAUSE_STORAGE_OFF` — профиль перечитывается, как после `SetWorkStorage` (R30);
    - `unimplemented` — `api` без `WorkService`: всё как сейчас, по образцу R40;
    - сбой сети — отметки нет, и следующая `PutWork` этой попытки несёт работу заново;
  - включение хранения шлёт работы, что уже лежат на устройстве у этого профиля, а выключение снимает отметки: сервер свои копии стёр;
  - «Это устройство»: `copiedOnServer` в `src/adults/DevicePage.tsx` — по отметкам работ профиля, а не «нет» всегда;
  - раздел «Хранение работ на сервере», `src/adults/WorkStorage.tsx`: строка «сервер пока работ не хранит» уходит, а описание кнопки выключения — «копии работ на сервере стираются», без «если они есть»;
  - поправка к R30, а если отметка — поле записи попытки, то и к R16; разделы 3.2 и 3.10 [docs/architecture.md](docs/architecture.md); строка Д16 уходит. Сочинения T47 идут тем же путём.
- **Как проверить:**
  - тесты в Node: форма `StoredWork`, предел 4 МиБ, каждый ответ и `unimplemented`, включение и выключение хранения;
  - тест в браузере: картинка канвы начинается с подписи PNG, и работа с ней проходит ту проверку формы, что делает `api`;
  - участок `just walk` с включённым хранением на локальном `api`: `PutWork` прошла, а на «Это устройство» нет предупреждения.
- **Разделы:** R16, R30, R40, R45; [docs/architecture.md](docs/architecture.md), разделы 3.2 и 3.10; R113 spec и её поправка 2026-11-13; [текст контрактов](spec/contracts/README.md), раздел 15; R27 canvas; R70 api; Д16, Д26, Д27, В66.

#### T52. Итог E3

- **Цель:** E3 подведён и ушёл в архив, а следующий эпик выбран.
- **Почему:** после эпика в RUN.md остаётся только живое, а следующий эпик берётся из таблицы 2.
- **Сделать:**
  - README — статус;
  - раздел 3.10 — что E3 взял и что осталось;
  - если детализация изменила то, что говорит карточка architecture 3.1 spec, — строка «в реестр spec» в таблице 3;
  - E3 — в архив `docs/plan/E3.md`, а следующий эпик — из таблицы 2.
- **Мой шаг:** выбор следующего эпика.
- **Как проверить:** `just -f spec/justfile docs-check-repo` зелёный, а в RUN.md — только живое.
- **Разделы:** [docs/architecture.md](docs/architecture.md), раздел 3.10; T31 в [docs/plan/E2.md](docs/plan/E2.md).
