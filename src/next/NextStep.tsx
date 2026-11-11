// The way to what the engine chose (section 3.4 of docs/architecture.md; R24 in docs/decisions.md;
// LearningService in the contract): a lesson opens in the player by `OpenLesson`, a task begins by
// `BeginAttempt` on the task screen, and nothing is a line of the screen, with why when the AI that
// checks the tasks is closed to the learner. The choice an answer gave — the end of an attempt
// outside a lesson, or of a lesson run — is a press away; with none, the press asks `ChooseNext`.
// Both `ChooseNext` and the beginning of a task close the attempt open outside a lesson for good:
// while one is open, a question says so first, and once closed its work on the device goes. With
// no choice in hand and an attempt open the button is "Something else". Each action has one
// idempotency key, the same with its repeats, and only a refusal ends it. The reason of the choice
// is never shown here (concepts 12 in spec).
import { Cause, type EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { Code } from "@connectrpc/connect";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { LESSON, navigate, TASK } from "../app/router.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useLessons } from "../lesson/LessonContext.tsx";
import type { Device } from "../storage/device.ts";
import { attemptOver } from "../storage/profile.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { givenOf, NEXT_KEYS } from "./choice.ts";

export interface NextStepProps {
  readonly profileId: string;
  /** The engine's choice an answer gave; none when the press is to ask for it. */
  readonly choice?: EngineChoice;
  /** The device, whose database the attempt closed goes from; none in a screen's own test. */
  readonly device?: Device;
  /** The button is a second action beside the screen's main one. */
  readonly secondary?: boolean;
}

export function NextStep({ profileId, choice, device, secondary = false }: NextStepProps) {
  const api = useApi();
  const { words } = useLanguage();
  const lessons = useLessons();
  const attempt = useAttempt();
  const open = attempt?.attemptId;
  const setAttempt = attempt?.setAttempt;
  const [known, setKnown] = useState(choice);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  // One key for "Something else" or "What's next", and one for the beginning of a task chosen.
  const chooseKey = useRef<string | undefined>(undefined);
  const beginKey = useRef<string | undefined>(undefined);
  // The question takes the focus, and gives it back on Cancel.
  const button = useRef<HTMLButtonElement>(null);
  const goOn = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) goOn.current?.focus();
    else if (asked.current) button.current?.focus();
    asked.current = confirming;
  }, [confirming]);

  /** The attempt open outside a lesson, which api has closed: its work goes, and it is open no more. */
  const left = useCallback(
    async (attemptId: string | undefined) => {
      if (attemptId === undefined) return;
      if (device !== undefined) await attemptOver(device, profileId, attemptId);
      setAttempt?.(undefined);
    },
    [device, profileId, setAttempt],
  );

  /** A task chosen begins; one begun already by this choice is the profile's open attempt. */
  const begin = useCallback(
    async (choiceId: string, leaving: string | undefined) => {
      beginKey.current ??= idempotencyKey();
      try {
        const answer = await api.learning.beginAttempt({
          profileId,
          idempotencyKey: beginKey.current,
          start: { case: "choiceId", value: choiceId },
        });
        beginKey.current = undefined;
        const attemptId = answer.attempt?.attemptId;
        if (attemptId === undefined || attemptId === "") {
          setFailure({ kind: "unknown", code: Code.Internal });
          return;
        }
        if (leaving !== attemptId) await left(leaving);
        setAttempt?.(attemptId);
        navigate(TASK);
      } catch (reason) {
        const found = parseFailure(reason);
        if (found.kind === "refused") beginKey.current = undefined;
        if (found.kind !== "refused" || found.cause !== Cause.ALREADY_EXISTS) throw reason;
        const account = (await api.account.getAccount({})).account;
        const held = account?.profiles.find((each) => each.profileId === profileId)?.openAttempt;
        if (held === undefined || held.segment !== undefined) throw reason;
        setAttempt?.(held.attemptId);
        navigate(TASK);
      }
    },
    [api, profileId, setAttempt, left],
  );

  /** Goes to what a choice gives: the lesson's player, or the task begun; nothing stays a line. */
  const act = useCallback(
    async (given: EngineChoice, leaving: string | undefined) => {
      const what = givenOf(given);
      if (what === "lesson") {
        lessons?.choose({ kind: "choice", choiceId: given.choiceId });
        navigate(LESSON);
      } else if (what === "task") await begin(given.choiceId, leaving);
    },
    [lessons, begin],
  );

  const press = useCallback(() => {
    setPending(true);
    setFailure(undefined);
    // The attempt open now is the one the press closes, whatever happens to the screen meanwhile.
    const leaving = open;
    void (async () => {
      try {
        if (known !== undefined && givenOf(known) !== "nothing") {
          await act(known, leaving);
          return;
        }
        chooseKey.current ??= idempotencyKey();
        const answer = await api.learning.chooseNext({
          profileId,
          idempotencyKey: chooseKey.current,
          skill: "",
        });
        chooseKey.current = undefined;
        await left(leaving);
        const given = answer.choice;
        if (given === undefined) return;
        setKnown(given);
        await act(given, undefined);
      } catch (reason) {
        const found = parseFailure(reason);
        if (found.kind === "refused") chooseKey.current = undefined;
        setFailure(found);
      }
    })().finally(() => setPending(false));
  }, [api, profileId, known, open, act, left]);

  const nothing = known !== undefined && givenOf(known) === "nothing";
  const outcome = nothing ? outcomeOf(known.outcome) : undefined;
  // A choice an answer gave that gives nothing has no button: there is nothing to go to.
  const offer = !(nothing && choice !== undefined && known === choice);
  // What closes the attempt open: asking the engine, or beginning the task it chose.
  const closes =
    open !== undefined && (known === undefined || nothing || givenOf(known) === "task");
  const label =
    known === undefined || nothing
      ? open === undefined
        ? "next.what"
        : "next.else"
      : NEXT_KEYS[givenOf(known) as "lesson" | "task"];

  return (
    <div className="nt-next">
      <p role="status" className="nt-hint">
        {nothing ? words.text("next.nothing") : ""}
        {outcome === undefined ? "" : ` ${outcomeText(outcome, words)}`}
      </p>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      {!offer || confirming ? null : (
        <div className="nt-buttons">
          {/* Not disabled while it is under way: a disabled button would drop the focus. */}
          <button
            ref={button}
            type="button"
            {...(secondary || label === "next.else" ? { className: "nt-secondary" } : {})}
            aria-disabled={pending}
            onClick={() => {
              if (pending) return;
              if (closes) setConfirming(true);
              else press();
            }}
          >
            {words.text(label)}
          </button>
        </div>
      )}
      {confirming ? (
        <fieldset className="nt-buttons">
          <legend>{words.text("next.else-confirm")}</legend>
          <button
            ref={goOn}
            type="button"
            onClick={() => {
              setConfirming(false);
              press();
            }}
          >
            {words.text("next.else-go")}
          </button>
          <button type="button" className="nt-secondary" onClick={() => setConfirming(false)}>
            {words.text("common.cancel")}
          </button>
        </fieldset>
      ) : null}
    </div>
  );
}
