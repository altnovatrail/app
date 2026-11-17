# TASKS.md — tasks outside an epic of `app`

Open tasks outside the current epic, each as its body, in Russian (R154 spec, R155 spec). Each also has its row in table 1 of [RUN.md](../RUN.md) (R13, R50).

- Never read whole: a session reads only its own task — `grep -n '^#### T' run/TASKS.md` lists them, `awk '/^#### T01\./{p=1;print;next} /^#### /{p=0} p' run/TASKS.md` gives one body.
- A new task outside an epic goes here as a body, its number the one free when it is written down (RUN.md, Citations). When done, the body leaves for the archive (RUN.md rule 9).

## Tasks outside an epic

#### T71. Когда вернётся доступ: `access_returns` в отказе своего ключа

- **Цель:** когда свой ключ владельца упёрся в предел, `app` показывает не только причину предела, но и когда доступ вернётся, по `OwnKeyLimit.access_returns` от `api`: потолок тарифа — дата и время возврата (00:00 UTC первого дня следующего месяца, в часовом поясе и языке устройства); свой предел владельца — без срока, с тем, что делать. Закрыть Д22 там, где его закрывает путь с настоящим `api`.
- **Почему:** R76 spec, R156 spec; строка 6.14 «Порядка» [COORDINATION.md](../spec/COORDINATION.md): «`access_returns` — после строки 6.27»; строка 6.27 сделана — T103 `api`, релиз v0.1.57 (`access_returns` в `OwnKeyLimit` по `Outcome.AccessReturns` `tutor` v0.1.39 или новее; поправка 2026-11-16 к R80 api: на заглушке `-limit-tier` тоже даёт срок); строки `app` В65, `api` В73; Д22. Задача записана по тексту прогона всего «Порядка» оркестратором `spec` (правило 6 COORDINATION.md spec; слово автора 2026-11-16).
- **Сделать:**
  - поднять клиент контракта до версии с `access_returns` (из `spec` текущего тега или из `api` — как `app` берёт контракты);
  - в разделе взрослых и у задачи (где сейчас показана причина предела и `closesAI`) — строка «доступ вернётся …» с датой по `access_returns`, в языке интерфейса; без поля — как сейчас, без срока;
  - тесты: Node и экраны на маршрутизирующем транспорте (R47) — с полем и без; путь на заглушке `api` `-limit-tier` в `just dev-app`, если он есть (Д22);
  - Д22 — закрыть или сузить по тому, что проверено на настоящем `api`; `docs/decisions.md`, `docs/architecture.md`; релиз по правилам репозитория.
- **Как проверить:** `just ci` зелёный; codecov/patch ≥ 90 %; SonarCloud — 0 замечаний.
- **Разделы:** R47, R49; R80 api; строки В65 `app`, В73 `api`; Д22; [COORDINATION.md](../spec/COORDINATION.md), строки 6.14 и 6.27.
