# QUESTIONS.md — questions to the author of `app`

Table 3 of [RUN.md](../RUN.md): the author's open questions from tasks' «Открыто» (R153 spec, R154 spec).

- Never read whole: take the rows the task and its sections name — `grep -n '^| В64 ' run/QUESTIONS.md`.
- A row comes from a task's «Открыто» (RUN.md rule 9). Record the author's answer where it belongs — the task, a document or [DEBT.md](DEBT.md) — and delete the row.
- A row whose question opens with the mark «В реестр spec» is for `spec`: its session finds it on `main` (R81 spec; RULES.md, Across repositories). It leaves once `spec` has recorded it: the task that rests on it names its number.

## Table 3. Questions to the author

Numbers are not reused: next — В68.

| ID | Question | From | Options | Recommendation |
|---|---|---|---|---|
| В64 | The ping `https://apis.google.com/js/gen_204` is sent by the module `gapi_iframes` wherever it runs — once in a hundred resets of the counter ([docs/sources.md](../docs/sources.md), section 7.6) —, not only in WebKit: on a computer, after the tap on «Sign in with Google». The built-page test gives Chromium and Firefox a gapi stub, while `site-check` gets Google's real script, and there the same `connect-src` refusal will now and then fail the check: by T59's decision the refusal is expected only in WebKit (the 2026-11-14 amendment to R45). Expect it in `site-check` in every engine? | T59 | (a) in `site-check` a refused ping is no violation in any engine, and in the built-page test, as now, only in WebKit: there Chromium and Firefox have a gapi stub; (b) keep WebKit alone and rerun `site-check` if it fails on the ping | (a): the CSP refuses the ping in every engine, telling engines apart protects nothing, and a false failure of the check after a rollout confuses more than a rerun |
