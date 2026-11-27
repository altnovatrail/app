// The way to what the engine chose (LearningService in the contract): a lesson opens in the
// player, a task begins on the task screen, and nothing is a line of the screen, with why when the
// AI that checks the tasks is closed to the learner — useEngine goes there. The choice an answer
// gave — the end of an attempt outside a lesson, or of a lesson run — is a press away; with none,
// the press asks `ChooseNext`, among the tasks of the module the screen is of, or else among all
// the modules. The beginning of a task closes the attempt open outside a lesson for good: while
// one is open, a question says so first. With no choice in hand and an attempt open there is no
// button: what comes after the task comes with its end. The reason of the choice is never shown
// here.
import type { EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { type Failure, parseFailure } from "../api/failure.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Device } from "../storage/device.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { givenOf, NEXT_KEYS } from "./choice.ts";
import { useEngine } from "./useEngine.ts";

export interface NextStepProps {
  readonly profileId: string;
  /** The engine's choice an answer gave; none when the press is to ask for it. */
  readonly choice?: EngineChoice;
  /** The device, whose database the attempt closed goes from; none in a screen's own test. */
  readonly device?: Device;
  /** The button is a second action beside the screen's main one. */
  readonly secondary?: boolean;
  /** The module whose tasks alone a press asks among; none for all the modules. */
  readonly moduleId?: string;
}

export function NextStep({
  profileId,
  choice,
  device,
  secondary = false,
  moduleId = "",
}: NextStepProps) {
  const { words } = useLanguage();
  const open = useAttempt()?.attemptId;
  const { choose, act } = useEngine(profileId, device);
  const [known, setKnown] = useState(choice);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  // The question takes the focus, and gives it back on Cancel.
  const button = useRef<HTMLButtonElement>(null);
  const goOn = useRef<HTMLButtonElement>(null);
  const asked = useRef(false);
  useEffect(() => {
    if (confirming) goOn.current?.focus();
    else if (asked.current) button.current?.focus();
    asked.current = confirming;
  }, [confirming]);

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
        const given = await choose(moduleId, leaving);
        if (given === undefined) return;
        setKnown(given);
        await act(given, undefined);
      } catch (reason) {
        setFailure(parseFailure(reason));
      }
    })().finally(() => setPending(false));
  }, [known, open, choose, act, moduleId]);

  const nothing = known !== undefined && givenOf(known) === "nothing";
  const outcome = nothing ? outcomeOf(known.outcome) : undefined;
  // A choice an answer gave that gives nothing has no button: there is nothing to go to; nor has
  // a press to ask while an attempt is open, which the attempt's own end answers.
  const asks = known === undefined || nothing;
  const offer =
    !(nothing && choice !== undefined && known === choice) && !(asks && open !== undefined);
  // What closes the attempt open: beginning the task the engine chose.
  const closes = open !== undefined && !asks && givenOf(known) === "task";
  const label = asks ? "next.what" : NEXT_KEYS[givenOf(known) as "lesson" | "task"];

  return (
    <div className="nt-next">
      {/* The strings have no full stop of their own: two in one line are two sentences. */}
      <p role="status" className="nt-hint">
        {[nothing ? words.text("next.nothing") : "", outcome ? outcomeText(outcome, words) : ""]
          .filter((sentence) => sentence !== "")
          .join(". ")}
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
            {...(secondary ? { className: "nt-secondary" } : {})}
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
