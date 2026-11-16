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
