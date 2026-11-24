# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian. Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T01\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T94. Анализ расхода сессий по порогу R145 spec

- **Цель:** понять, отчего сессии `app` дорожают, и решить, нужен ли эпик сбережений.
- **Почему:** порог R145 spec пройден по бюджетам ([docs/measurements.md](../docs/measurements.md), раздел 10): `docs-budgets.json` поднимался девять раз с T55, семь из них — в E5, а порог — три. Контекст главного вызова за E5 — 185,4 тыс. за 4 140 вызовов; это первая опора `app` по measurements 1.9 spec — строка T124, 141,7 тыс., держит лишь 188 вызовов. Задачу записала T91 при архиве E5.
- **Сделать:** по стенограммам E5 (`tokens-report`) найти, что сессии читают и где контекст растёт: разделы 3.8 и 3.10 [docs/architecture.md](../docs/architecture.md) — 81 и 72 КБ, журнал решений, тела задач архива, вывод `just mockup-compare`; предложить, что сжать, разделить или перенести, по образцу анализа E10 `spec` (measurements 1.9 spec); при планировании решить, нужен ли эпик.
- **Как проверить:** `just -f spec/justfile docs-check-repo`.
- **Разделы:** R145 spec, R143 spec; measurements 1.9 spec; [docs/measurements.md](../docs/measurements.md), разделы 8 и 10.
