# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian (R154 spec, R155 spec). Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T01\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T73. «Проще» и «Сложнее» у уровня модуля

- **Цель:** взрослый за PIN ставит уровень модуля за шаг, ученик видит, что это сделал взрослый.
- **Почему:** R157 `spec` и её поправка T173; строка 6.29 COORDINATION.md `spec`; architecture 3.1 и privacy 7 `spec`.
- **Сделать:** в разделе взрослых, у уровня каждого модуля профиля, — «Проще» и «Сложнее», шаг на полосу, методом строки 1.22; в прогрессе ученика — «уровень поставил взрослый» с датой, у каждого ученика; слова — по таблице слов (R91 spec); тесты; релиз. Кнопки выходят к детям, когда тексты для семьи называют поправку (Д259 `spec`).
  - Дополнение T178 `spec` (контракт строки 1.22): «Проще» и «Сложнее» — полосы рядом с `level_band` по порядку полос манифеста; у нижней нет «Проще», у верхней — «Сложнее»; на `CAUSE_BAND_NOT_NEXT` — перечитать карту; «уровень поставил взрослый» с датой — по `level_set_at` карты навыков, у каждого ученика.
- **Как проверить:** проверки `app` по его RUN.md; снимки экрана раздела взрослых и прогресса.
- **Разделы:** строки 6.28 и 6.29 [COORDINATION.md](../spec/COORDINATION.md) `spec`; R157 spec, architecture 3.1 spec, privacy 7 spec; Д259 `spec`; Д33.
- **Ждёт:** строки 6.28 `api` — релиз v0.1.59 (T105 `api`), последний — v0.1.60.
