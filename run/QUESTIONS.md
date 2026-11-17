# QUESTIONS.md — questions to the author of `app`

Table 3 of [RUN.md](../RUN.md): the author's open questions from tasks' «Открыто» (R153 spec, R154 spec).

- Never read whole: take the rows the task and its sections name — `grep -n '^| В64 ' run/QUESTIONS.md`.
- A row comes from a task's «Открыто» (RUN.md rule 9). Record the author's answer where it belongs — the task, a document or [DEBT.md](DEBT.md) — and delete the row.
- A row whose question opens with the mark «В реестр spec» is for `spec`: its session finds it on `main` (R81 spec; RULES.md, Across repositories). It leaves once `spec` has recorded it: the task that rests on it names its number.

## Table 3. Questions to the author

Numbers are not reused: next — В70.

| ID | Question | From | Options | Recommendation |
|---|---|---|---|---|
| В64 | The ping `https://apis.google.com/js/gen_204` is sent by the module `gapi_iframes` wherever it runs — once in a hundred resets of the counter ([docs/sources.md](../docs/sources.md), section 7.6) —, not only in WebKit: on a computer, after the tap on «Sign in with Google». The built-page test gives Chromium and Firefox a gapi stub, while `site-check` gets Google's real script, and there the same `connect-src` refusal will now and then fail the check: by T59's decision the refusal is expected only in WebKit (the 2026-11-14 amendment to R45). Expect it in `site-check` in every engine? | T59 | (a) in `site-check` a refused ping is no violation in any engine, and in the built-page test, as now, only in WebKit: there Chromium and Firefox have a gapi stub; (b) keep WebKit alone and rerun `site-check` if it fails on the ping | (a): the CSP refuses the ping in every engine, telling engines apart protects nothing, and a false failure of the check after a rollout confuses more than a rerun |
| В69 | «В реестр spec». Since T62 `app` takes canvas 0.3.25 and puts works by `PutWork` with the picture of `exportPicture()` (the 2026-11-17 amendments to R15 and R30). Row 5.14 of COORDINATION.md spec puts the method «в соглашении элемента (R36)», but `CanvasElement` of `@altnovatrail/spec/canvas` 0.18.6, as of 0.18.12, has no `exportPicture()`: `app` takes its type from canvas's own `NovatrailCanvas`, and `ElementHoldsContract` (`src/canvas/jsx.ts`) does not hold it. And once T62 is merged, architecture 3.2 spec («until then `app` puts no work (T62 app)») and row 6.14 («работы на сервере, T62 — с релизом `canvas` строки 5.14») say what no longer holds. Does the agreement's type take the method? | T62 | (a) `spec` adds `exportPicture(): Promise<Blob>` to `CanvasElement` at its next tag, worded as R83 `canvas` has it, and updates architecture 3.2 spec and row 6.14; `app` takes it with its move to that tag, and `ElementHoldsContract` holds the method both ways; (b) `spec` updates only the two texts, and the method stays in canvas's type alone — a change of it in `canvas` reaches `app` unchecked by the agreement | (a): the method is part of the agreement by row 5.14 and R36 spec, and the types of the agreement are `spec`'s (R74 spec) |
