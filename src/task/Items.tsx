// The items of a task on a handwriting sheet, beside the sheet (section 3.10 of docs/architecture.md;
// section 14 of the text of the format): what each asks, and the options of each answer slot bound
// `choice`, which the sheet does not show. A tap only chooses; Check sends (section 3.3). The
// verdict stands beside the option tapped and beside the item, in a word and a sign, not in colour
// alone (section 3.9), and below an item answered on the sheet what was read, "Read: 6", or why it
// could not be (R21). A workbook's lines the canvas shows: once checked, a list below the canvas
// gives each line's verdict and what was read in its boxes.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { type Reading, reasonKey, type Verdicts, verdictKey } from "./attempt.ts";
import { slotKey, slotsOf } from "./steps.ts";

/** A verdict in a word, with a sign that does not lean on colour. */
export function Verdict({ verdict, id }: { readonly verdict: string; readonly id?: string }) {
  const { words } = useLanguage();
  const correct = verdict === "correct";
  return (
    <span id={id} className={`nt-verdict ${correct ? "nt-verdict-correct" : "nt-verdict-other"}`}>
      <span aria-hidden="true">{correct ? "✓ " : "• "}</span>
      {words.text(verdictKey(verdict))}
    </span>
  );
}

/** What was read in a slot, or why it could not be, in the screen's words. */
export function ReadingLine({ reading }: { readonly reading: Reading }) {
  const { words } = useLanguage();
  return (
    <p className="nt-reading">
      {"value" in reading
        ? words.text("task.read", { text: reading.value })
        : words.text(reasonKey(reading.reason))}
    </p>
  );
}

/** The readings of an item's slots that are no choice, in their order. */
function readingsOf(verdicts: Verdicts, item: number, slots: number): Reading[] {
  const found: Reading[] = [];
  for (let s = 1; s <= slots; s++) {
    const reading = verdicts.readings.get(slotKey(item, s));
    if (reading !== undefined) found.push(reading);
  }
  return found;
}

/** A workbook's lines once checked: each line's verdict and what was read in its boxes. */
function Lines({ task, verdicts }: { readonly task: open.Task; readonly verdicts: Verdicts }) {
  const { words } = useLanguage();
  if (verdicts.items.size === 0) return null;
  return (
    <ul className="nt-lines">
      {task.items.map((item, i) => {
        const verdict = verdicts.items.get(i + 1);
        if (verdict === undefined) return null;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the lines of a task never move.
          <li key={i}>
            {words.text("task.line", { n: i + 1 })} <Verdict verdict={verdict} />
            {readingsOf(verdicts, i + 1, slotsOf(item).length).map((reading, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the boxes of a line never move.
              <ReadingLine key={r} reading={reading} />
            ))}
          </li>
        );
      })}
    </ul>
  );
}

interface ChoicesProps {
  readonly name: string;
  readonly legend: ReactNode;
  readonly options: readonly string[];
  readonly chosen: string | undefined;
  readonly verdict: string | undefined;
  readonly lang: { readonly lang?: string };
  readonly locked: boolean;
  readonly onChoose: (option: string) => void;
}

/**
 * The options of one answer slot: a group of radio buttons, the keyboard's own. The verdict stands
 * beside the option tapped, out of its label, which names the option alone, and describes it.
 */
function Choices({ name, legend, options, chosen, verdict, lang, locked, onChoose }: ChoicesProps) {
  const verdictId = useId();
  return (
    <fieldset className="nt-choices">
      <legend>{legend}</legend>
      {options.map((option) => {
        const judged = chosen === option && verdict !== undefined;
        return (
          // Options are all different, as the format has it: an option is its own key.
          <div key={option} className="nt-option">
            <label>
              <input
                type="radio"
                name={name}
                value={option}
                checked={chosen === option}
                disabled={locked}
                {...(judged ? { "aria-describedby": verdictId } : {})}
                onChange={() => onChoose(option)}
              />
              <span {...lang}>{option}</span>
            </label>
            {judged ? <Verdict verdict={verdict} id={verdictId} /> : null}
          </div>
        );
      })}
    </fieldset>
  );
}

export interface ItemsProps {
  readonly task: open.Task;
  readonly choices: Readonly<Record<string, string>>;
  readonly verdicts: Verdicts;
  /** The module's explanation language, the `lang` of its texts. */
  readonly language: string | undefined;
  /** The attempt is over: the options take no tap. */
  readonly locked: boolean;
  readonly onChoose: (key: string, option: string) => void;
}

export function Items({ task, choices, verdicts, language, locked, onChoose }: ItemsProps) {
  const { words } = useLanguage();
  const name = useId();
  if (task.canvas.kind !== "handwriting_sheet") return <Lines task={task} verdicts={verdicts} />;
  const lang = language === undefined ? {} : { lang: language };
  return (
    <div className="nt-items">
      {task.items.map((item, i) => {
        const at = slotsOf(item).flatMap((slot, s) => (slot === "choice" ? [s] : []));
        const verdict = verdicts.items.get(i + 1);
        const heading = (
          <>
            {item.text === undefined ? (
              words.text("task.item", { n: i + 1 })
            ) : (
              <span {...lang}>{item.text}</span>
            )}
            {verdict === undefined ? null : (
              <>
                {" "}
                <Verdict verdict={verdict} />
              </>
            )}
          </>
        );
        const choicesOf = (s: number, legend: ReactNode) => {
          const key = slotKey(i + 1, s + 1);
          return (
            <Choices
              key={key}
              name={`${name}-${key}`}
              legend={legend}
              options={item.answer_slots?.[s]?.options ?? []}
              chosen={choices[key]}
              verdict={verdicts.slots.get(key)}
              lang={lang}
              locked={locked}
              onChoose={(option) => onChoose(key, option)}
            />
          );
        };
        // biome-ignore-start lint/suspicious/noArrayIndexKey: the items of a task never move.
        // The slots of an item never move: each reading is its place.
        const readings = readingsOf(verdicts, i + 1, slotsOf(item).length).map((reading, r) => (
          <ReadingLine key={r} reading={reading} />
        ));
        if (at.length === 0) {
          // An item answered on the sheet: what it asks stands beside it, and then what was read.
          if (item.text === undefined && verdict === undefined) return null;
          return (
            <div key={i} className="nt-item">
              <p className="nt-item-text">{heading}</p>
              {readings}
            </div>
          );
        }
        if (at.length === 1 && item.answer_slots?.length === 1) {
          return (
            <div key={i} className="nt-item">
              {choicesOf(at[0] as number, heading)}
              {readings}
            </div>
          );
        }
        return (
          <fieldset key={i} className="nt-item">
            <legend>{heading}</legend>
            {at.map((s) => choicesOf(s, words.text("task.slot", { n: s + 1 })))}
            {readings}
          </fieldset>
        );
        // biome-ignore-end lint/suspicious/noArrayIndexKey: the items of a task never move.
      })}
    </div>
  );
}
