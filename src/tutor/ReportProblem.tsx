// "Report a problem" beside a reply of the tutor (R123 in spec and its amendments; section 15 of
// the text of the contracts; R33 in docs/decisions.md): a button, and in its place a form — one of
// the six kinds of a problem, a text of up to 1000 characters with the plea to write no name in
// it, the words that go with it and what to do when someone is in danger now. "Send" is
// `ReportProblem` with one idempotency key for the report, the same with every repeat of it, so
// that a reply lost on the way brings no second report; another kind or another text is another
// report, with a key of its own. The answer says by when the operator reviews it, by `review_by`.
// The form opens in a pop-over over the screen, the words it is about quoted at its top, as the
// mockup's `task-report` (the second 2026-11-14 amendment to R148 in spec; R67): leaving the screen
// would lose the words after a correct answer, which api keeps none of. What it holds stays while
// it is closed, by Cancel or Escape, and comes back as it was once it opens again.
import type { ProblemKind } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useEffect, useId, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { failureText } from "../api/words.ts";
import { PopOver } from "../app/PopOver.tsx";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { KINDS, reportRequest, type Said, TEXT_LIMIT, unsendable } from "./report.ts";

export interface ReportProblemProps {
  readonly profileId: string;
  readonly attemptId: string;
  /** The words the report is about, as the screen shows them, and the reply that brought them. */
  readonly said: Said;
  /** The module's explanation language, the words' `lang`. */
  readonly language?: string | undefined;
}

/** Where the report stands: a form behind its button, or sent with the day of its review. */
type Stage = { readonly is: "form" } | { readonly is: "sent"; readonly reviewBy: Date | undefined };

export function ReportProblem({ profileId, attemptId, said, language: of }: ReportProblemProps) {
  const api = useApi();
  const { language, words } = useLanguage();
  const id = useId();
  const [stage, setStage] = useState<Stage>({ is: "form" });
  const [kind, setKind] = useState<ProblemKind | undefined>(undefined);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState<ReturnType<typeof unsendable>>(undefined);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [pending, setPending] = useState(false);
  // The key of the report as the form holds it: the same with every repeat, new with an edit.
  const key = useRef<string | undefined>(undefined);
  // The focus goes into the pop-over as it opens and back to its button as it closes, and to the
  // answer once the report is sent.
  const answer = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (stage.is === "sent") answer.current?.focus();
  }, [stage]);

  const edited = () => {
    key.current = undefined;
    setInvalid(undefined);
    setFailure(undefined);
  };

  const send = () => {
    if (pending) return;
    const why = unsendable(kind, text);
    setInvalid(why);
    setFailure(undefined);
    if (why !== undefined || kind === undefined) return;
    key.current ??= idempotencyKey();
    setPending(true);
    void api.attempt
      .reportProblem(reportRequest({ profileId, attemptId, key: key.current, said, kind, text }))
      .then(
        (given) => {
          key.current = undefined;
          setStage({
            is: "sent",
            reviewBy: given.reviewBy === undefined ? undefined : timestampDate(given.reviewBy),
          });
        },
        (reason: unknown) => {
          const found = parseFailure(reason);
          // A refusal is the end of the report; anything else — a reply lost, one still under way
          // for longer than the client waits — may have reached api, and goes again with its key,
          // which gets the same report.
          if (found.kind === "refused") key.current = undefined;
          setFailure(found);
        },
      )
      .finally(() => setPending(false));
  };

  if (stage.is === "sent") {
    return (
      <p ref={answer} role="status" tabIndex={-1} className="nt-report">
        {stage.reviewBy === undefined
          ? words.text("report.sent-undated")
          : words.text("report.sent", {
              date: dateTimeFormat(language, { dateStyle: "long" }).format(stage.reviewBy),
            })}
      </p>
    );
  }
  const errorId = `${id}-error`;
  return (
    <PopOver
      label={words.text("report.button")}
      className="nt-report-open"
      popClassName="nt-pop-report"
      holds={pending}
      onClosed={() => {
        setInvalid(undefined);
        setFailure(undefined);
      }}
    >
      {(close) => (
        <form
          aria-labelledby={`${id}-title`}
          className="nt-report"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <h3 id={`${id}-title`}>{words.text("report.title")}</h3>
          <blockquote className="nt-report-said" {...(of === undefined ? {} : { lang: of })}>
            {said.text}
          </blockquote>
          <p className="nt-hint">{words.text("report.words")}</p>
          <fieldset
            className="nt-choices"
            {...(invalid === "report.no-kind" ? { "aria-describedby": errorId } : {})}
          >
            <legend>{words.text("report.kind")}</legend>
            {KINDS.map(([value, word]) => (
              <div key={value} className="nt-option">
                <label>
                  <input
                    type="radio"
                    name={`${id}-kind`}
                    checked={kind === value}
                    onChange={() => {
                      setKind(value);
                      edited();
                    }}
                  />
                  {words.text(word)}
                </label>
              </div>
            ))}
          </fieldset>
          <div className="nt-field">
            <label htmlFor={`${id}-text`}>{words.text("report.text")}</label>
            <textarea
              id={`${id}-text`}
              rows={4}
              maxLength={TEXT_LIMIT}
              value={text}
              aria-describedby={
                invalid === "report.no-text" ? `${id}-hint ${errorId}` : `${id}-hint`
              }
              onChange={(event) => {
                setText(event.target.value);
                edited();
              }}
            />
            <p id={`${id}-hint`} className="nt-hint">
              {words.text("report.text-hint")}
            </p>
          </div>
          <p className="nt-hint">{words.text("report.danger")}</p>
          {invalid === undefined ? null : (
            <p id={errorId} role="alert" className="nt-error">
              {words.text(invalid)}
            </p>
          )}
          {failure === undefined ? null : (
            <p role="alert" className="nt-error">
              {failureText(failure, words)}
            </p>
          )}
          <div className="nt-buttons">
            {/* Not disabled while it is under way: a disabled button would drop the focus. */}
            <button type="submit" aria-disabled={pending}>
              {words.text("report.send")}
            </button>
            {/* Not while it is under way, as nothing else closes it then: the report may reach api all the same. */}
            <button type="button" className="nt-secondary" aria-disabled={pending} onClick={close}>
              {words.text("common.cancel")}
            </button>
          </div>
        </form>
      )}
    </PopOver>
  );
}
