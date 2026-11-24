// The debug button and its window, as the mockup's states `pick-debug` and `solve-debug-log`:
// a round button, an orange bug on a light orange, in the bottom bar of the page picked and of the
// screen of solving, with a line after it where `line` says so; its window at the right, 400 wide,
// and on a phone a sheet from the bottom with a grabber, drawn in the body, since the bar's glass
// would hold a fixed window inside it. Two tabs: Models — the model of every call, its effort and
// thinking, one for the Check and every other call — and Log, the calls by action, each opening
// to its figures and what the model returned, with the session's total. The slot loads it only once
// api's `GetDebug` answered, for an account with the debug right. Its words are English alone: it
// is the developer's, never a learner's.
import "./debug.css";
import type {
  DebugAction,
  DebugCall,
  DebugModel,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { DebugActionKind, DebugEffort } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useApi } from "../api/ApiContext.tsx";
import { RowLine } from "../task/TaskLayout.tsx";
import {
  actionKey,
  actionTime,
  actionTitle,
  answerOf,
  callLine,
  callName,
  callsOf,
  callTitle,
  choose,
  clear,
  costOf,
  EFFORTS,
  effortName,
  exportOf,
  failureOf,
  load,
  modelName,
  modelOf,
  OUTCOMES,
  type Pick,
  perMtok,
  type Sent,
  snapshot,
  statsOf,
  subscribe,
  type TaskTruth,
  type Truth,
  thinkingFixed,
  took,
  truthOf,
  usd,
} from "./debug.ts";

/**
 * Material Symbols' `bug-report-outline-rounded` from @iconify-json/material-symbols 1.2.99, under the
 * Apache License 2.0, as icons.ts: here, so that only the window's chunk holds it.
 */
const BUG =
  "M12 21q-1.625 0-3.012-.8T6.8 18H5q-.425 0-.712-.288T4 17t.288-.712T5 16h1.1q-.075-.5-.088-1T6 14H5q-.425 0-.713-.288T4 13t.288-.712T5 12h1q0-.5.013-1t.087-1H5q-.425 0-.712-.288T4 9t.288-.712T5 8h1.8q.35-.575.788-1.075T8.6 6.05l-.925-.95Q7.4 4.825 7.4 4.413t.3-.713q.275-.275.7-.275t.7.275l1.45 1.45q.7-.225 1.425-.225t1.425.225l1.5-1.475q.275-.275.687-.275t.713.3q.275.275.275.7t-.275.7l-.95.95q.575.375 1.037.863T17.2 8H19q.425 0 .713.288T20 9t-.288.713T19 10h-1.1q.075.5.088 1T18 12h1q.425 0 .712.288T20 13t-.288.713T19 14h-1q0 .5-.012 1t-.088 1H19q.425 0 .713.288T20 17t-.288.713T19 18h-1.8q-.8 1.4-2.187 2.2T12 21m0-2q1.65 0 2.825-1.175T16 15v-4q0-1.65-1.175-2.825T12 7T9.175 8.175T8 11v4q0 1.65 1.175 2.825T12 19m-1-3h2q.425 0 .713-.288T14 15t-.288-.712T13 14h-2q-.425 0-.712.288T10 15t.288.713T11 16m0-4h2q.425 0 .713-.288T14 11t-.288-.712T13 10h-2q-.425 0-.712.288T10 11t.288.713T11 12m1 1";

function Bug({ size }: { readonly size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={BUG} />
    </svg>
  );
}

function Switch({ on, dim = false }: { readonly on: boolean; readonly dim?: boolean }) {
  return (
    <span className="nt-debug-switch" data-on={on} data-dim={dim}>
      <span className="nt-debug-knob" />
    </span>
  );
}

/** The slot of the tab Models: the model of every call, or as admitted. */
function Slot({
  title,
  sub,
  models,
  admitted,
  pick,
  onPick,
}: {
  readonly title: string;
  readonly sub: string;
  readonly models: readonly DebugModel[];
  /** "As admitted": each call its model of the list, by api. */
  readonly admitted: readonly { readonly call: string; readonly model: string }[];
  /** The model chosen; none as admitted. */
  readonly pick: Pick | undefined;
  readonly onPick: (pick: Pick | undefined) => void;
}) {
  const [menu, setMenu] = useState(false);
  const effortId = useId();
  const model = pick === undefined ? undefined : modelOf(models, pick.model);
  const fixed = pick === undefined || thinkingFixed(model, pick.effort);
  return (
    <>
      <div className="nt-debug-slot-head">
        <span className="nt-debug-main">{title}</span>
        <span className="nt-debug-sub">{sub}</span>
      </div>
      <div className="nt-debug-card">
        <button
          type="button"
          className="nt-debug-row"
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          <span className="nt-debug-grow">Model</span>
          <span className="nt-debug-value">{model === undefined ? "As admitted" : model.name}</span>
        </button>
        {menu ? (
          <div className="nt-debug-menu" role="menu" aria-label="Model">
            {[
              { id: "", name: "As admitted", sub: "Each call its model of tutor's list" },
              ...models.map((m) => ({
                id: m.id,
                name: m.name,
                sub: `${m.id} · ${perMtok(m.inputMicroUsd)} / ${perMtok(m.outputMicroUsd)} per Mtok`,
              })),
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitemradio"
                aria-checked={(pick?.model ?? "") === item.id}
                onClick={() => {
                  setMenu(false);
                  onPick(
                    item.id === ""
                      ? undefined
                      : {
                          model: item.id,
                          effort: pick?.effort ?? DebugEffort.MEDIUM,
                          thinking: pick?.thinking ?? true,
                        },
                  );
                }}
              >
                <span className="nt-debug-main">{item.name}</span>
                <span className="nt-debug-sub">{item.sub}</span>
              </button>
            ))}
          </div>
        ) : null}
        {pick === undefined ? (
          <div className="nt-debug-admitted">
            {admitted.map((a) => (
              <div key={a.call}>
                <span className="nt-debug-main">{a.call}</span>
                <span className="nt-debug-strong">{a.model}</span>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="nt-debug-effort">
              <span id={effortId}>Effort</span>
              <fieldset aria-labelledby={effortId} className="nt-debug-plain">
                <div className="nt-debug-segments">
                  {EFFORTS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      aria-pressed={pick.effort === e}
                      onClick={() => onPick({ ...pick, effort: e })}
                    >
                      {effortName(e)}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
            <button
              type="button"
              role="switch"
              className="nt-debug-row"
              aria-checked={fixed || pick.thinking}
              aria-disabled={fixed}
              onClick={() => {
                if (!fixed) onPick({ ...pick, thinking: !pick.thinking });
              }}
            >
              <span className="nt-debug-two nt-debug-grow">
                <span className="nt-debug-main">Thinking</span>
                {fixed ? (
                  <span className="nt-debug-sub">
                    {model !== undefined && model.thinkingOffEfforts.length > 0
                      ? `Always on at ${effortName(pick.effort)}`
                      : `Always on for ${model?.name ?? pick.model}`}
                  </span>
                ) : null}
              </span>
              <Switch on={fixed || pick.thinking} dim={fixed} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

function Call({
  call,
  models,
}: {
  readonly call: DebugCall;
  readonly models: readonly DebugModel[];
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const failure = failureOf(call);
  const answer = answerOf(call);
  return (
    <>
      <button
        type="button"
        className="nt-debug-call-row"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className="nt-debug-dot" data-of={failure !== "" ? "failed" : "ai"} />
        <span className="nt-debug-two">
          <span className="nt-debug-main">{callTitle(call)}</span>
          <span className="nt-debug-sub">{callLine(models, call)}</span>
        </span>
        <span className="nt-debug-two nt-debug-end">
          <span className="nt-debug-main">{usd(call.costMicroUsd)}</span>
          <span className="nt-debug-sub">{took(call.durationMs)}</span>
        </span>
      </button>
      {open ? (
        <div className="nt-debug-open">
          <div className="nt-debug-stats">
            {statsOf(call).map((s) => (
              <div key={s.k}>
                <span className="nt-debug-sub">{s.k}</span>
                <span className="nt-debug-figure">{s.v}</span>
              </div>
            ))}
          </div>
          {answer === "" ? null : (
            <>
              <div className="nt-debug-json-head">
                <span className="nt-debug-grow">
                  What the model returned<code> · {call.model}</code>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    // A browser that does not let the page write the clipboard leaves Copy as it is.
                    void navigator.clipboard?.writeText(answer).then(
                      () => setCopied(true),
                      () => {},
                    );
                  }}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="nt-debug-json">{answer}</pre>
            </>
          )}
          {failure === "" ? null : <span className="nt-debug-failed">{failure}</span>}
        </div>
      ) : null}
    </>
  );
}

/** The file saved by the browser, as a download. */
function save(name: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * The export of a Check as a case of tutor-eval: the truth, filled in from what the calls gave, for
 * the developer to correct before the file is saved.
 */
function Export({
  action,
  sent,
  begin,
  onDone,
}: {
  readonly action: DebugAction;
  readonly sent: Sent;
  readonly begin: Truth;
  readonly onDone: () => void;
}) {
  const [truth, setTruth] = useState(begin);
  const [error, setError] = useState<string | undefined>(undefined);
  const id = useId();
  const task = (n: number, change: Partial<TaskTruth>) =>
    setTruth({
      ...truth,
      tasks: truth.tasks.map((t, at) => (at === n ? { ...t, ...change } : t)),
    });
  const field = (
    name: string,
    label: string,
    hint: string,
    value: string,
    onChange: (value: string) => void,
  ) => (
    <label className="nt-debug-field" htmlFor={`${id}-${name}`}>
      <span className="nt-debug-sub">{label}</span>
      <input
        id={`${id}-${name}`}
        value={value}
        placeholder={hint}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
  return (
    <div className="nt-debug-export">
      <p className="nt-debug-sub">
        What the models should have given, from the calls: correct what they got wrong.
      </p>
      {truth.tasks.map((t, n) => (
        // The tasks of a frame stay in their order: the place is the task's number.
        // biome-ignore lint/suspicious/noArrayIndexKey: the number of a task in its frame
        <fieldset key={n} className="nt-debug-plain nt-debug-task">
          <legend className="nt-debug-sub">Task {n + 1}</legend>
          <span className="nt-debug-sub">
            The Check: {t.checkVerdict === "" ? "no answer" : t.checkVerdict}
            {t.checkRead === "" ? "" : ` · read “${t.checkRead}”`}
          </span>
          {field(`statement-${n}`, "Statement", "as printed: 37 + 48 =", t.statement, (v) =>
            task(n, { statement: v }),
          )}
          {field(`read-${n}`, "Read · the answer the work holds", "none: no answer", t.read, (v) =>
            task(n, { read: v }),
          )}
          <div className="nt-debug-field">
            <span className="nt-debug-sub" id={`${id}-verdict-${n}`}>
              Verdict
            </span>
            <fieldset aria-labelledby={`${id}-verdict-${n}`} className="nt-debug-plain">
              <div className="nt-debug-segments">
                {OUTCOMES.map((o) => (
                  <button
                    key={o.outcome}
                    type="button"
                    aria-pressed={t.outcome === o.outcome}
                    onClick={() => task(n, { outcome: o.outcome })}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </fieldset>
      ))}
      {field("note", "Note", "what went wrong", truth.note, (v) => setTruth({ ...truth, note: v }))}
      {error === undefined ? null : (
        <p role="alert" className="nt-debug-failed">
          {error}
        </p>
      )}
      <div className="nt-debug-export-end">
        <button type="button" onClick={onDone}>
          Cancel
        </button>
        <button
          type="button"
          className="nt-debug-primary"
          onClick={() => {
            const file = exportOf(action, sent, truth);
            if ("error" in file) {
              setError(file.error);
              return;
            }
            save(file.name, file.json);
            onDone();
          }}
        >
          Save case
        </button>
      </div>
    </div>
  );
}

export default function DebugButton({ line = false }: { readonly line?: boolean }) {
  const api = useApi();
  const debug = useSyncExternalStore(subscribe, snapshot);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"models" | "log">("models");
  const [full, setFull] = useState(false);
  const [exporting, setExporting] = useState<string | undefined>(undefined);
  const button = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const opened = useRef(false);

  useEffect(() => {
    void load(api.debug);
  }, [api]);
  useEffect(() => {
    if (open) close.current?.focus();
    else if (opened.current) button.current?.focus();
    opened.current = open;
  }, [open]);

  if (debug.status !== "on") return null;
  const { models, actions } = debug;
  const total = usd(costOf(callsOf(actions)));
  const count = callsOf(actions).length;
  // A call of a task from paper has its models in the order of its attempts.
  const admitted = [...new Set(debug.admitted.map((a) => a.kind))].map((kind) => ({
    call: callName(kind),
    model: debug.admitted
      .flatMap((a) => (a.kind === kind && a.model !== undefined ? [a.model] : []))
      .map((m) => `${modelName(models, m.model)} · ${effortName(m.effort)}`)
      .join(" → "),
  }));
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };

  return (
    <>
      {/* It stays in the bar while its window is open, so that the row does not move. */}
      <button
        ref={button}
        type="button"
        className="nt-debug-button"
        aria-label="Debug: the models and their answers"
        title={`Debug · ${total}`}
        aria-expanded={open}
        data-busy={debug.busy > 0}
        onClick={() => setOpen(!open)}
      >
        <Bug size={20} />
      </button>
      {line ? <RowLine /> : null}
      {open
        ? createPortal(
            <div
              className="nt-debug-panel nt-glass"
              role="dialog"
              aria-label="Debug"
              data-size={full ? "full" : "half"}
              onKeyDown={onKey}
            >
              <button
                type="button"
                className="nt-debug-grab"
                aria-label={full ? "Half screen" : "Full screen"}
                aria-expanded={full}
                onClick={() => setFull(!full)}
              />
              <div className="nt-debug-head">
                <span className="nt-debug-disc">
                  <Bug size={19} />
                </span>
                <span className="nt-debug-two">
                  <span className="nt-debug-main">Debug</span>
                  <span className="nt-debug-sub">
                    {total} · {count} {count === 1 ? "call" : "calls"} this session
                  </span>
                </span>
                <button
                  ref={close}
                  type="button"
                  className="nt-debug-close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  ×
                </button>
              </div>
              <div role="tablist" aria-label="Debug" className="nt-debug-segments nt-debug-tabs">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "models"}
                  onClick={() => setTab("models")}
                >
                  Models
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "log"}
                  onClick={() => setTab("log")}
                >
                  Log
                  {count > 0 ? <span className="nt-debug-count">{count}</span> : null}
                </button>
              </div>
              {tab === "models" ? (
                <section className="nt-debug-body" aria-label="Models">
                  <Slot
                    title="Model — every call"
                    sub="Find tasks, the statement, the Check and Explain differently"
                    models={models}
                    admitted={admitted}
                    pick={debug.first}
                    onPick={(first) => void choose(api.debug, first)}
                  />
                  {debug.refused === undefined ? null : (
                    <p role="alert" className="nt-debug-failed">
                      {debug.refused}
                    </p>
                  )}
                  <p className="nt-debug-warning">
                    The choice bypasses the admission list, in every profile. Only an account with
                    the debug right has this window.
                  </p>
                </section>
              ) : (
                <>
                  <section className="nt-debug-body" aria-label="Log of the models">
                    {actions.length === 0 ? (
                      <p className="nt-debug-empty">
                        No calls yet. Take a photo of a page, or Check a task.
                      </p>
                    ) : (
                      [...actions].reverse().map((action) => {
                        const key = actionKey(action);
                        const sent = debug.sent.get(key);
                        const request = debug.asked.get(key);
                        return (
                          <div key={key} className="nt-debug-group">
                            <div className="nt-debug-group-head">
                              <span className="nt-debug-main">{actionTitle(action)}</span>
                              <span className="nt-debug-sub">{actionTime(action)}</span>
                              <span className="nt-debug-figure">{usd(costOf(action.calls))}</span>
                              {action.kind === DebugActionKind.CHECK && sent !== undefined ? (
                                <button
                                  type="button"
                                  className="nt-debug-link"
                                  aria-expanded={exporting === key}
                                  onClick={() => setExporting(exporting === key ? undefined : key)}
                                >
                                  Export
                                </button>
                              ) : null}
                            </div>
                            <div className="nt-debug-card">
                              {action.calls.map((call) => (
                                <Call
                                  key={`${call.kind}-${call.attempt}`}
                                  call={call}
                                  models={models}
                                />
                              ))}
                            </div>
                            {request === undefined ? null : (
                              <span className="nt-debug-foot">Request: “{request}”</span>
                            )}
                            {exporting === key && sent !== undefined ? (
                              <Export
                                action={action}
                                sent={sent}
                                begin={truthOf(actions, action, sent)}
                                onDone={() => setExporting(undefined)}
                              />
                            ) : null}
                          </div>
                        );
                      })
                    )}
                  </section>
                  <div className="nt-debug-total">
                    <span className="nt-debug-two">
                      <span className="nt-debug-main">Session total {total}</span>
                      <span className="nt-debug-sub">Counted in the tutor time, like any call</span>
                    </span>
                    <button
                      type="button"
                      aria-disabled={actions.length === 0}
                      onClick={() => {
                        if (actions.length > 0) clear();
                      }}
                    >
                      Clear log
                    </button>
                  </div>
                </>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
