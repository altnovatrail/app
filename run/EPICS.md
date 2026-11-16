# EPICS.md — epics for later of `app`

Table 2 of [RUN.md](../RUN.md) (R153 spec, R154 spec).

- A row has a result and a basis, no tasks yet. Row order is the order epics are taken, until the author decides otherwise. T08 proposed the order of the code epics; what each takes of E1's decisions is in [docs/architecture.md](../docs/architecture.md), section 3.10.
- Read by the choice and planning of the next epic, not by each task. Once an epic is split into tasks, they go to table 1 and the body of RUN.md, and its row leaves (RUN.md, Epics).

## Table 2. Epics for later

| ID | Epic | Result | Basis |
|---|---|---|---|
| E4 | Before the first child | child profiles; starting work with the parent's consent — a signed form (R116 spec), a child profile in two steps (R98 spec) and the consent contract of `spec` v0.15.0 — the request code, the form scan `SendConsentForm`, `CancelChildConsent`, a teenager's own consent `GiveOwnConsent` and its withdrawal, `child-notice` and `teen-notice`, the age stated again `RestateAge`, and the screens for learners from the USA (R132, R134, R136, R140, R141 spec; Д168, Д175, Д183, Д201 and Д204 in table 4 of RUN.md of `spec`); the section «Help» for a learner under 18 (R127 spec); the line telling a child that the adult sees their progress (Д157 in table 4 of `spec`); the PIN of the adults' section and the choice of a learner among child profiles — the choice with one owner profile E2 builds (T22); export and deletion — by profile and of the whole account, the export by the format `export/` of version 3: the stored works as files beside `api.zip`, each by `GetWork` (R135 spec and its 2026-11-13 amendment; R151 spec; Д180; Д233 spec; R49); showing the solution to a child — with the setting «ask before showing» and the adult's action behind the PIN (R82 spec); the owner profile's closing timeout — Д7; manual accessibility checks on devices — Д10 | repositories 6 spec; R116–R119, R122, R123, R127, R129, R132–R141 spec; П-26; R04, R08, R11; [docs/architecture.md](../docs/architecture.md), section 3.10. Waits for: E3; the contract, the family texts and the formats are in `spec` since v0.15.0 |
