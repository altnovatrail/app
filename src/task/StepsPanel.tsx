// The tutor's panel in the mode "by steps" (section 3.3 of docs/architecture.md; R05 in
// docs/decisions.md): the bar of steps, each with its place — passed, now or later — in a word, not
// in colour alone; the step shown, its title and its description in the module's language, the
// chips and the cards of techniques it gives, and the line of what opens "Step done". A step passed
// is a touch away; forward goes only "Step done", which reads no work. The last step has no "Step
// done": it ends with Check. "Read aloud" reads the step shown, its chips and its cards (R07).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { useEffect, useId, useRef } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { ReadAloud } from "../voice/ReadAloud.tsx";
import { stepPhrases } from "../voice/texts.ts";
import { exitMet, givesChips, givesTechniques, type StepsState } from "./steps.ts";
import { TechniqueCards } from "./TechniqueCards.tsx";

/** The line of what opens "Step done", by the exit condition; none for `none`. */
const EXIT_LINES = {
  givens_ticked: "steps.exit-givens",
  answer_slots_filled: "steps.exit-slots",
} as const;

/** The line of an exit condition, by its own entry alone: a newer format's condition has none. */
function exitLine(condition: string): "steps.exit-givens" | "steps.exit-slots" | undefined {
  return Object.hasOwn(EXIT_LINES, condition)
    ? EXIT_LINES[condition as keyof typeof EXIT_LINES]
    : undefined;
}

export interface StepsPanelProps {
  readonly task: open.Task;
  readonly steps: readonly open.Step[];
  readonly catalog: open.Techniques | undefined;
  readonly state: StepsState;
  readonly filled: readonly (readonly boolean[])[] | null;
  /** The module's explanation language, the `lang` of its texts. */
  readonly language: string | undefined;
  readonly onGoTo: (place: number) => void;
  readonly onTick: (chip: number | "unknown") => void;
  readonly onDone: () => void;
}

export function StepsPanel({
  task,
  steps,
  catalog,
  state,
  filled,
  language,
  onGoTo,
  onTick,
  onDone,
}: StepsPanelProps) {
  const { words } = useLanguage();
  const lineId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef(state.place);
  // A step that takes another's place takes the focus on its title, as a screen does (2.4.3).
  useEffect(() => {
    if (shown.current !== state.place) heading.current?.focus();
    shown.current = state.place;
  }, [state.place]);

  const step = steps[state.place - 1];
  if (step === undefined) return null;
  const lang = language === undefined ? {} : { lang: language };
  const last = state.place === steps.length;
  const met = exitMet(step, task, state, filled);
  const lineKey = exitLine(step.exit_condition);
  const techniques = givesTechniques(step) ? (state.techniques[state.place] ?? []) : [];

  return (
    <div className="nt-steps">
      <ol className="nt-step-bar" aria-label={words.text("steps.title")}>
        {steps.map((each, i) => {
          const place = i + 1;
          const mark =
            place === state.place
              ? words.text("steps.now")
              : place <= state.reached
                ? words.text("steps.passed")
                : words.text("steps.later");
          const title = <span {...lang}>{each.title}</span>;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: the steps never move, and two may share a title.
            <li key={i} {...(place === state.place ? { "aria-current": "step" } : {})}>
              {place !== state.place && place <= state.reached ? (
                <button type="button" className="nt-secondary" onClick={() => onGoTo(place)}>
                  {place}. {title} <span className="nt-step-mark">({mark})</span>
                </button>
              ) : (
                <span className="nt-step">
                  {place}. {title} <span className="nt-step-mark">({mark})</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <h2 ref={heading} tabIndex={-1} {...lang}>
        {step.title}
      </h2>
      {step.description === undefined ? null : <p {...lang}>{step.description}</p>}
      {givesChips(step, task) ? (
        <div className="nt-chips">
          {(task.givens?.length ?? 0) > 0 ? (
            <fieldset className="nt-buttons">
              <legend>{words.text("steps.givens")}</legend>
              {task.givens?.map((given, i) => (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: the givens never move, and two may say the same.
                  key={i}
                  type="button"
                  className="nt-chip"
                  aria-pressed={state.ticked.givens.includes(i)}
                  onClick={() => onTick(i)}
                  {...lang}
                >
                  {given}
                </button>
              ))}
            </fieldset>
          ) : null}
          {task.unknown === undefined ? null : (
            <fieldset className="nt-buttons">
              <legend>{words.text("steps.unknown")}</legend>
              <button
                type="button"
                className="nt-chip"
                aria-pressed={state.ticked.unknown}
                onClick={() => onTick("unknown")}
                {...lang}
              >
                {task.unknown}
              </button>
            </fieldset>
          )}
        </div>
      ) : null}
      <TechniqueCards ids={techniques} catalog={catalog} language={language} />
      <ReadAloud
        phrases={stepPhrases(
          step,
          givesChips(step, task)
            ? [...(task.givens ?? []), ...(task.unknown === undefined ? [] : [task.unknown])]
            : [],
          techniques,
          catalog,
          language,
        )}
        language={language}
      />
      {lineKey === undefined ? null : (
        <p id={lineId} className="nt-hint">
          {words.text(lineKey)}
        </p>
      )}
      {last ? null : (
        <div className="nt-buttons">
          {/* Not disabled while it is locked: a disabled button would drop the focus. */}
          <button
            type="button"
            aria-disabled={!met}
            {...(lineKey === undefined ? {} : { "aria-describedby": lineId })}
            onClick={() => {
              if (met) onDone();
            }}
          >
            {words.text("steps.done")}
          </button>
        </div>
      )}
    </div>
  );
}
