# app — замеры

> Итоги замеров `app`: что замерено, как, на чём и какие вышли числа. Документ, который описывает устройство, — [architecture.md](architecture.md) — ссылается сюда и чисел замеров сам не держит (RULES.md, How we work; R143 spec). Замер цитируют по разделу, как любой документ: `measurements 2`, а из другого репозитория — `measurements 2 app`.
>
> Внешний факт, на котором стоит замер, — запись [sources.md](sources.md). Новый замер — новый раздел в конце файла, а номер раздела не меняется. До T53, 2026-11-12, эти итоги стояли в architecture 3.2 и 4; там остались утверждения и ссылки сюда.

## 1. История письма мышью, T25, 2026-11-10

Сколько байт занимает история письма попытки — для оценки «Сколько места» architecture 3.2.
- Замер мышью, T25, 2026-11-10 — тест собранной страницы в Chromium (`scripts/page.test.ts`): ответ «180 : 30 = 6, 6 + 1 = 7» двадцатью штрихами по 16 движений мыши через 8 мс — 20 штрихов, 360 точек, 23 199 байт JSON истории, около 64 байт на точку и 18 точек на штрих.
- Это внутри оценки architecture 3.2: работа в сотни штрихов — сотни КБ, и вывод, что своего предела не нужно, держится. Пером и пальцем частота точек выше — их замер ждёт устройств в E3.

## 2. WebKit и Firefox, разово, вне CI, T34, 2026-11-11

Проверено 2026-11-11 — WebKit и Firefox, разово, вне CI (T34; Д8, Д9, Д10 и Д13 в таблице 4 RUN.md). Браузеры — сборки Playwright 1.64.1, WebKit 27.2 (`webkit-2370`) и Firefox 157 (`firefox-1555`), во временной папке, а их системные библиотеки и шрифты — из снимка Ubuntu `20261021T000000Z`, как у Chromium в Dockerfile. Это движки WebKit и Gecko на Linux, а не Safari на iPad:
- тесты в браузере, 331, и тест собранной страницы, 10, — копией конфигурации Vitest на WebKit и Firefox. В Firefox прошли все, а один тест входа — только с временем на тест больше 15 с: Firefox здесь медленнее. В WebKit не прошли три теста: запись Blob в IndexedDB — дважды, — и `forced-color-adjust`, которого у WebKit нет. Проверки, привязанные к странице ошибки Chrome во фрейме, `chrome-error://chromewebdata/`, — свои у каждого движка;
- **IndexedDB** (architecture 3.2): открытие без создания, `versionchange`, отказ на новой версии, `blocked` при удалении и транзакция, чья работа упала, — как в Chromium, в обоих движках. Blob WebKit не пишет в эфемерной сессии — ею идёт контекст Playwright без профиля: `put` падает с `UnknownError: Error preparing Blob/File data to be stored in object store`, а в постоянном профиле WebKit и в обоих видах контекста Firefox Blob пишется. Работу `app` тогда не сохраняет, `unsaved`, и говорит об этом. `close` при стирании данных сайта тестом не покрыт ни в одном движке;
- **CSP** (architecture 3.7): страница стартует под нижним слоем и заголовком без нарушений, а модули и `modulepreload` Vite работают; встроенные скрипт и стиль, вставленные в копию собранного `index.html`, нижний слой без заголовка блокирует в обоих движках, как в Chromium: WebKit — «Refused to execute a script because its hash, its nonce, or 'unsafe-inline' does not appear in the script-src directive», Firefox — «The page’s settings blocked an inline script (script-src-elem)»; элемент канвы под заголовком ставит стили, показывает картинку по `blob:` и принимает штрих; под `frame-ancestors 'none'` фрейм остаётся пустым и `/deployment.json` не просит;
- **вход** (architecture 3.7): Firefox до касания «Войти через Google» Google не зовёт. WebKit — с адресом Safari в `User-Agent` — при старте грузит скрипт `apis.google.com/js/api.js`, его модуль `gapi_iframes` с того же хоста и скрытый iframe `https://<authDomain>/__/auth/iframe`, как и ждёт architecture 3.7 для Safari, — и без нарушений CSP: это настоящий скрипт Google, а не заглушка;
- **принудительные цвета** (architecture 3.9): проект `forcedColors: "active"` в Firefox прошёл; у WebKit режима нет;
- **имя языка** (architecture 3.8): `Intl.DisplayNames` WebKit по-русски даёт «Английский», с прописной.
