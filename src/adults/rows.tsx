// The parts of Settings, drawn as a device's settings: a group of rows on the page's grey, white
// with its corners rounded, its caption above it and its note under it; and its rows, each a
// target of the group's width — one that leads further, with its value and a chevron; one of a
// choice, a radio button drawn as a tick; one on or off, a checkbox drawn as a switch; a choice of
// two or three short words, segments in one row; one that says, with its tile and the line under
// its words; and one that acts, its words in the middle. The inputs stay native, so that a screen
// reader and the keyboard take them as they take any form.
import { type ReactNode, type RefObject, useId } from "react";
import { Icon } from "../app/Icon.tsx";
import type { IconValue } from "../app/icons.ts";
import { PopOver } from "../app/PopOver.tsx";

/** The colours of the tiles, by what they stand for, as a device's settings colour its own. */
export type Tile = "grey" | "blue" | "orange" | "green" | "purple";

/** A group: its caption, its rows, and its note; named by its caption, else by what it holds. */
export function Group({
  title,
  note,
  label,
  className,
  children,
}: {
  readonly title?: string;
  readonly note?: ReactNode;
  /** The group's name where it shows no caption. */
  readonly label?: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const id = useId();
  return (
    <section
      className={className === undefined ? "nt-set-sec" : `nt-set-sec ${className}`}
      aria-labelledby={title === undefined ? undefined : `${id}-title`}
      aria-label={title === undefined ? label : undefined}
    >
      {title === undefined ? null : (
        <h2 id={`${id}-title`} className="nt-set-head">
          {title}
        </h2>
      )}
      <div className="nt-set-group">{children}</div>
      {note === undefined ? null : <div className="nt-set-note">{note}</div>}
    </section>
  );
}

/** A tile: the icon of a row, white on its colour. */
export function TileIcon({ icon, tile }: { readonly icon: IconValue; readonly tile: Tile }) {
  return (
    <span className="nt-set-tile" data-tile={tile}>
      <Icon value={icon} chosen />
    </span>
  );
}

/**
 * A row that leads further: its picture, its words and the line under them, its value and a
 * chevron; named by what it shows, a space between each, which a box of flex does not draw.
 */
export function LinkRow({
  label,
  value,
  lead,
  sub,
  current = false,
  onPress,
}: {
  readonly label: string;
  readonly value?: string;
  /** What stands before the words: a tile, or an avatar. */
  readonly lead?: ReactNode;
  /** A line under the words. */
  readonly sub?: string;
  /** The row is the page shown beside the list. */
  readonly current?: boolean;
  readonly onPress: () => void;
}) {
  return (
    <button
      type="button"
      className="nt-set-row"
      aria-current={current ? "page" : undefined}
      onClick={onPress}
    >
      {lead}
      <span className="nt-set-text">
        <span className="nt-set-label">{label}</span>
        {sub === undefined ? null : (
          <>
            {" "}
            <span className="nt-set-sub">{sub}</span>
          </>
        )}
      </span>
      {value === undefined ? null : (
        <>
          {" "}
          <span className="nt-set-value">{value}</span>
        </>
      )}
      <span className="nt-set-chevron">
        <Icon value="more" />
      </span>
    </button>
  );
}

/**
 * A row of a choice: a radio button, unseen, and the tick at the row's end while it is checked, and
 * its line under it, which describes it.
 */
export function TickRow({
  name,
  label,
  sub,
  checked,
  lang,
  onChange,
}: {
  readonly name: string;
  readonly label: string;
  readonly sub?: string;
  readonly checked: boolean;
  readonly lang?: string;
  readonly onChange: () => void;
}) {
  const id = useId();
  return (
    <label className="nt-set-row" lang={lang}>
      <span className="nt-set-text">
        <span id={`${id}-label`} className="nt-set-label">
          {label}
        </span>
        {sub === undefined ? null : (
          <span id={`${id}-sub`} className="nt-set-sub">
            {sub}
          </span>
        )}
      </span>
      <input
        type="radio"
        className="nt-set-input"
        name={name}
        checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={sub === undefined ? undefined : `${id}-sub`}
        onChange={onChange}
      />
      <span className="nt-set-ticked">
        <Icon value="ticked" />
      </span>
    </label>
  );
}

/** A row on or off: a checkbox with the role of a switch, unseen, and the switch drawn after it. */
export function SwitchRow({
  label,
  checked,
  describedBy,
  busy = false,
  onChange,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly describedBy?: string;
  /** What it started is under way: it stays in the keyboard's order, and changes nothing. */
  readonly busy?: boolean;
  readonly onChange: (on: boolean) => void;
}) {
  return (
    <label className="nt-set-row">
      <span className="nt-set-text">
        <span className="nt-set-label">{label}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        className="nt-set-input"
        checked={checked}
        aria-checked={checked}
        aria-describedby={describedBy}
        aria-disabled={busy || undefined}
        onChange={(event) => {
          if (!busy) onChange(event.target.checked);
        }}
      />
      <span className="nt-set-switch" />
    </label>
  );
}

/**
 * A row of a share: its words and how much at its end, and under them a bar that fills as much, a
 * meter named by its words; it turns red once a cap is reached, orange from four fifths.
 */
export function MeterRow({
  label,
  value,
  percent,
  full,
}: {
  readonly label: string;
  /** How much, in words: the meter's text too. */
  readonly value: string;
  readonly percent: number;
  /** A cap is reached. */
  readonly full: boolean;
}) {
  const id = useId();
  const now = Math.min(100, Math.max(0, percent));
  return (
    <div className="nt-set-row nt-set-meter-row">
      <span className="nt-set-meter-line">
        <span id={`${id}-label`} className="nt-set-label">
          {label}
        </span>{" "}
        <span className="nt-set-value">{value}</span>
      </span>
      {/* biome-ignore lint/a11y/useSemanticElements: each engine draws a native meter its own way; this bar is drawn as the mockup has it. */}
      <span
        role="meter"
        className="nt-set-meter"
        aria-labelledby={`${id}-label`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={now}
        aria-valuetext={value}
        data-level={full ? "full" : now >= 80 ? "high" : undefined}
      >
        <span className="nt-set-meter-fill" style={{ inlineSize: `${now}%` }} />
      </span>
    </div>
  );
}

/** A choice of a few short words in one row: radio buttons drawn as segments. */
export function SegmentsRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly (readonly [T, string])[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div className="nt-set-row" role="radiogroup" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="nt-set-label">
        {label}
      </span>
      <span className="nt-set-segments">
        {options.map(([each, words]) => (
          <label key={String(each)} className="nt-set-segment">
            <input
              type="radio"
              className="nt-set-input"
              name={id}
              checked={each === value}
              onChange={() => onChange(each)}
            />
            <span className="nt-set-segment-words">{words}</span>
          </label>
        ))}
      </span>
    </div>
  );
}

/**
 * A row whose value is one of a few: its words and the value chosen, a space between them, which name its button, and the
 * choices in a pop-over of it, each a tick. A choice closes the pop-over and changes the form, not
 * more.
 */
export function ChoiceRow<T extends string | number>({
  label,
  options,
  value,
  shown,
  describedBy,
  buttonRef,
  onChange,
}: {
  readonly label: string;
  readonly options: readonly (readonly [T, string, string?])[];
  readonly value: T | undefined;
  /** The value's words in the row, where it is none of the options. */
  readonly shown?: string;
  /** The ID of what describes the row: the note of its group. */
  readonly describedBy?: string;
  /** The row's button, for the form to bring the focus to it. */
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
  readonly onChange: (value: T) => void;
}) {
  const id = useId();
  const chosen = options.find(([each]) => each === value);
  const words = chosen?.[1] ?? shown ?? "";
  return (
    <PopOver
      label={label}
      describedBy={describedBy}
      {...(buttonRef === undefined ? {} : { buttonRef })}
      className="nt-set-row"
      popClassName="nt-pop-menu nt-pop-choice"
      caption={
        <>
          <span className="nt-set-text">
            <span className="nt-set-label">{label}</span>
          </span>
          {words === "" ? null : (
            <>
              {" "}
              <span className="nt-set-value" lang={chosen?.[2]}>
                {words}
              </span>
            </>
          )}
          <span className="nt-set-chevron">
            <Icon value="menu-open" />
          </span>
        </>
      }
    >
      {(close) => (
        <fieldset className="nt-set-choices">
          <legend className="nt-hidden-label">{label}</legend>
          {options.map(([each, words, lang]) => (
            <TickRow
              key={String(each)}
              name={id}
              label={words}
              checked={each === value}
              {...(lang === undefined ? {} : { lang })}
              onChange={() => {
                onChange(each);
                close();
              }}
            />
          ))}
        </fieldset>
      )}
    </PopOver>
  );
}

/** A row that says and leads nowhere: its tile, its words and the line under them. */
export function InfoRow({
  icon,
  tile,
  label,
  sub,
  status = false,
}: {
  readonly icon: IconValue;
  readonly tile: Tile;
  readonly label: string;
  readonly sub?: string;
  /** What it says came of an action: a screen reader reads it as it comes. */
  readonly status?: boolean;
}) {
  return (
    <div className="nt-set-row" role={status ? "status" : undefined}>
      <TileIcon icon={icon} tile={tile} />
      <span className="nt-set-text">
        <span className="nt-set-label">{label}</span>
        {sub === undefined ? null : (
          <>
            {" "}
            <span className="nt-set-sub">{sub}</span>
          </>
        )}
      </span>
    </div>
  );
}

/**
 * A row that acts: its words in the middle, the accent's, or the error's for one that erases. A row
 * not ready yet is grey and stays in the keyboard's order: its form says why when it is pressed.
 */
export function ActionRow({
  label,
  danger = false,
  submit = false,
  off = false,
  describedBy,
  buttonRef,
  onPress,
}: {
  readonly label: string;
  readonly danger?: boolean;
  /** It sends its form. */
  readonly submit?: boolean;
  readonly off?: boolean;
  readonly describedBy?: string;
  readonly buttonRef?: RefObject<HTMLButtonElement | null>;
  readonly onPress?: () => void;
}) {
  return (
    <button
      ref={buttonRef}
      type={submit ? "submit" : "button"}
      className="nt-set-row nt-set-action"
      data-tone={danger ? "danger" : undefined}
      aria-disabled={off || undefined}
      aria-describedby={describedBy}
      onClick={onPress}
    >
      {label}
    </button>
  );
}
