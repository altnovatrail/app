// The way to what the engine chose (section 3.4 of docs/architecture.md; R24 in docs/decisions.md;
// LearningService in the contract): a lesson opens in the player, a task begins on the task screen,
// and nothing is a line of the screen, with why when the AI that checks the tasks is closed to the
// learner — useEngine goes there. The choice an answer gave — the end of an attempt outside a
// lesson, or of a lesson run — is a press away; with none, the press asks `ChooseNext` with no
// skill, which gives the lead back to the engine from a skill chosen on the map (R107 in spec).
// Both `ChooseNext` and the beginning of a task close the attempt open outside a lesson for good:
// while one is open, a question says so first. With no choice in hand and an attempt open the
// button is "Something else". The reason of the choice is never shown here (concepts 12 in spec).
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
}

export function NextStep({ profileId, choice, device, secondary = false }: NextStepProps) {
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
        const given = await choose("", leaving);
        if (given === undefined) return;
        setKnown(given);
        await act(given, undefined);
      } catch (reason) {
        setFailure(parseFailure(reason));
      }
    })().finally(() => setPending(false));
  }, [known, open, choose, act]);

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
      {/* The strings have no full stop of their own: two in one line are two sentences (T57). */}
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
