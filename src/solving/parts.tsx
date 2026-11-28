// The parts of a screen of solving that the sheet of a task from paper and the task screen share:
// the verdict's card above the row and its line in the open panel, a reading's track of models,
// "Hint" and the line of the row.
import { Fragment, type ReactNode } from "react";
import { Icon } from "../app/Icon.tsx";
import type { IconValue } from "../app/icons.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/** What "Hint" needs: whether an action is under way, and what it does. */
export interface HintParts {
  readonly pending: boolean;
  readonly onHint: () => void;
}

/** "Hint", in the row beside Check always, a bulb before its word: it does not send the work. */
export function HintButton({
  parts,
  className = "nt-row-button",
}: {
  readonly parts: HintParts;
  /**
   * Its look: a button of the row, or `nt-act nt-act-hint` at the foot of the tutor's panel, which
   * stands there on a phone alone.
   */
  readonly className?: string;
}) {
  const { words } = useLanguage();
  return (
    <button
      type="button"
      className={`nt-icon-button ${className}`}
      aria-disabled={parts.pending}
      onClick={() => {
        if (!parts.pending) parts.onHint();
      }}
    >
      <Icon value="hint" />
      {words.text("task.hint")}
    </button>
  );
}

/** The line between the row's other buttons and Check, as the mockup's. */
export function RowLine() {
  return <span className="nt-row-line" aria-hidden="true" />;
}

/** What the verdict's card tells: its sign, which `IconValue` draws, or the turning of a reading; an essay's feedback has a card of the same kind, and a task from paper with no key one of its own. */
export type CardKind =
  | "correct"
  | "not-yet"
  | "so-far"
  | "write"
  | "reading"
  | "shown"
  | "feedback"
  | "nokey"
  | "grown";

const CARD_SIGNS: Readonly<Record<Exclude<CardKind, "reading">, IconValue>> = {
  correct: "ticked",
  "not-yet": "not-yet",
  // A task from paper with no answer yet and no mistake: the tick, quiet on its tint.
  "so-far": "ticked",
  write: "write",
  shown: "shown",
  feedback: "feedback",
  // A task from paper with no key: a question of its own, as the mockup draws it.
  nokey: "help",
  // Grown-up mode turned on or off, a line of the conversation: its key.
  grown: "grown-up",
};

/** A reading gone on to a later model: the place of the one that now reads, from 0, of models, and their names for an account with the debug mode. */
export interface CardTrack {
  readonly model: number;
  readonly models: number;
  readonly names?: readonly string[] | undefined;
}

/**
 * The track of the models of a reading, the mockup's: one mark a model, a chevron between — a dot,
 * or a pill with the model's name where the card has names —, those done grey, the one that reads
 * the accent with its ring pulsing, those ahead an outline; each steps in after the one before.
 */
function ModelTrack({ model, models, names }: CardTrack) {
  return (
    <span className="nt-track" aria-hidden="true">
      {Array.from({ length: models }, (_, place) => ({ place, name: names?.[place] })).map(
        ({ place, name }) => {
          const at = place < model ? "done" : place === model ? "now" : "ahead";
          return (
            <Fragment key={place}>
              {place === 0 ? null : (
                <span className="nt-track-sep" data-at={at}>
                  <Icon value="more" />
                </span>
              )}
              {name === undefined ? (
                <span className="nt-track-dot" data-at={at} />
              ) : (
                <span className="nt-track-pill" data-at={at}>
                  {at === "done" ? (
                    <span className="nt-track-tick">
                      <Icon value="ticked" />
                    </span>
                  ) : null}
                  {name}
                </span>
              )}
            </Fragment>
          );
        },
      )}
    </span>
  );
}

/**
 * The verdict's card above the row, the mockup's: its sign in a circle of 36, its title and a line
 * under it, and its buttons at its end. A reading gone on to a later model has its turning ring on
 * a tinted disc whose ring pulses, and the track of the models under its line. It is drawn alone:
 * what a screen reader is told of the verdict is the screen's status line, so that nothing is told
 * twice.
 */
export function VerdictCard({
  kind,
  title,
  line,
  track,
  children,
}: {
  readonly kind: CardKind;
  readonly title: string;
  readonly line?: string | undefined;
  /** A reading's track, once it went on to a later model. */
  readonly track?: CardTrack | undefined;
  /** Its buttons. */
  readonly children?: ReactNode;
}) {
  const closer = kind === "reading" && track !== undefined;
  return (
    <div className="nt-card-verdict nt-glass" data-kind={kind} data-closer={closer || undefined}>
      <span className="nt-card-sign" aria-hidden="true">
        {kind === "reading" ? <span className="nt-spin" /> : <Icon value={CARD_SIGNS[kind]} />}
      </span>
      <div className="nt-card-words">
        <span className="nt-card-title">{title}</span>
        {line === undefined || line === "" ? null : <span className="nt-card-line">{line}</span>}
        {kind === "reading" && track !== undefined ? <ModelTrack {...track} /> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * The verdict as a line of the open panel, the mockup's `task-rung`: its sign in a circle of 22, its
 * title and the line under it. Like the card, drawn alone: the screen's status line tells it.
 */
export function VerdictLine({
  kind,
  title,
  line,
}: {
  readonly kind: CardKind;
  readonly title: string;
  readonly line?: string | undefined;
}) {
  return (
    <div className="nt-verdict-line" data-kind={kind}>
      <span className="nt-card-sign" aria-hidden="true">
        {kind === "reading" ? <span className="nt-spin" /> : <Icon value={CARD_SIGNS[kind]} />}
      </span>
      <span className="nt-card-words">
        <span className="nt-card-title">{title}</span>
        {line === undefined || line === "" ? null : <span className="nt-card-line">{line}</span>}
      </span>
    </div>
  );
}
