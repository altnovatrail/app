// The items of a task on a handwriting sheet, beside the sheet (section 3.10 of docs/architecture.md;
// section 14 of the text of the format): what each asks, and the options of each answer slot bound
// `choice`, which the sheet does not show, in the pop-over of "Choose an answer" (R65). A tap only
// chooses; Check sends (section 3.3). The verdict stands beside the option tapped and beside the
// item, in a word and a sign, not in colour alone (section 3.9), and below an item answered on the
// sheet what was read, "Read: 6", or why it could not be (R21). A workbook's lines the canvas shows: once checked, a list below the canvas
// gives each line's verdict and what was read in its boxes, and each box's verdict (R54).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type ReactNode, useId } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Words } from "../i18n/words.ts";
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
export function readingText(reading: Reading, words: Words): string {
  return "value" in reading
    ? words.text("task.read", { text: reading.value })
    : words.text(reasonKey(reading.reason));
}

/** What was read in a slot, or why it could not be, as a line. */
export function ReadingLine({ reading }: { readonly reading: Reading }) {
  const { words } = useLanguage();
  return <p className="nt-reading">{readingText(reading, words)}</p>;
}

/** The readings of an item's slots that are no choice, in their order. */
export function readingsOf(verdicts: Verdicts, item: number, slots: number): Reading[] {
  const found: Reading[] = [];
  for (let s = 1; s <= slots; s++) {
    const reading = verdicts.readings.get(slotKey(item, s));
    if (reading !== undefined) found.push(reading);
  }
  return found;
}

/**
 * A workbook's lines once checked: each line's verdict, which its boxes' make up, and what was read
 * in its boxes; a line of more boxes than one gives each box's verdict too (R56 in spec; R54).
 */
function Lines({ task, verdicts }: { readonly task: open.Task; readonly verdicts: Verdicts }) {
  const { words } = useLanguage();
  if (verdicts.items.size === 0) return null;
  return (
    <ul className="nt-lines">
      {task.items.map((item, i) => {
        const verdict = verdicts.items.get(i + 1);
        if (verdict === undefined) return null;
        const boxes = slotsOf(item).length;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: the lines of a task never move.
          <li key={i}>
            {words.text("task.line", { n: i + 1 })} <Verdict verdict={verdict} />
            {boxes > 1 ? (
              <Boxes verdicts={verdicts} item={i + 1} boxes={boxes} />
            ) : (
              readingsOf(verdicts, i + 1, boxes).map((reading, r) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: the boxes of a line never move.
                <ReadingLine key={r} reading={reading} />
              ))
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The boxes of one line, each with its verdict and what was read in it, or why not. */
function Boxes(props: {
  readonly verdicts: Verdicts;
  readonly item: number;
  readonly boxes: number;
}) {
  const { words } = useLanguage();
  const { verdicts, item } = props;
  // The boxes api gave a verdict, in their order: none, and no empty list stands under the line.
  const judged = Array.from({ length: props.boxes }, (_, b) => slotKey(item, b + 1)).flatMap(
    (key, b) => {
      const verdict = verdicts.slots.get(key);
      return verdict === undefined
        ? []
        : [{ box: b + 1, verdict, reading: verdicts.readings.get(key) }];
    },
  );
  if (judged.length === 0) return null;
  return (
    <ul className="nt-boxes">
      {judged.map(({ box, verdict, reading }) => (
        <li key={box}>
          {words.text("task.box", { n: box })} <Verdict verdict={verdict} />
          {reading === undefined ? null : <ReadingLine reading={reading} />}
        </li>
      ))}
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
  /** An option picked by a tap or by Enter, not by the arrows that walk the group. */
  readonly onPicked?: (() => void) | undefined;
}

/**
 * The options of one answer slot: a group of radio buttons, the keyboard's own. The verdict stands
 * beside the option tapped, out of its label, which names the option alone, and describes it.
 */
function Choices(props: ChoicesProps) {
  const { name, legend, options, chosen, verdict, lang, locked, onChoose, onPicked } = props;
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
                // A click of the pointer, not the one an arrow key or Space gives, which has none.
                onClick={(event) => {
                  if (event.detail > 0) onPicked?.();
                }}
                onKeyDown={(event) => {
                  // Its keypress would press the button the focus goes back to, and open it again.
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  onPicked?.();
                }}
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
  /** The attempt is over, or a check is under way: the options take no tap. */
  readonly locked: boolean;
  readonly onChoose: (key: string, option: string) => void;
}

/** What an item asks, or its place, and its verdict once it has one. */
function ItemHeading({
  item,
  place,
  verdict,
  lang,
}: {
  readonly item: open.Item;
  readonly place: number;
  readonly verdict: string | undefined;
  readonly lang: { readonly lang?: string };
}) {
  const { words } = useLanguage();
  return (
    <>
      {item.text === undefined ? (
        words.text("task.item", { n: place })
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
}

/** The places of an item's answer slots bound choice, from 0. */
function choiceSlots(item: open.Item): number[] {
  return slotsOf(item).flatMap((slot, s) => (slot === "choice" ? [s] : []));
}

/** Whether the task has an answer slot bound choice, whose options stand behind "Choose an answer". */
export function hasChoices(task: open.Task): boolean {
  return (
    task.canvas.kind === "handwriting_sheet" &&
    task.items.some((item) => choiceSlots(item).length > 0)
  );
}

/**
 * Whether the verdict's card holds what was read in the task: a sheet's task of one item, with one
 * answer slot on the sheet (R65).
 */
export function readInCard(task: open.Task): boolean {
  const [item] = task.items;
  return (
    task.canvas.kind === "handwriting_sheet" &&
    task.items.length === 1 &&
    item !== undefined &&
    slotsOf(item).filter((slot) => slot !== "choice").length === 1
  );
}

/** The key of the task's one answer slot bound choice, where it has one alone. */
export function onlyChoice(task: open.Task): string | undefined {
  const found = task.items.flatMap((item, i) =>
    choiceSlots(item).map((s) => slotKey(i + 1, s + 1)),
  );
  return found.length === 1 ? found[0] : undefined;
}

/**
 * Under the canvas: what each item answered on the sheet asks, and what was read in it; a
 * workbook's lines once checked. The options of a choice stand in the pop-over of "Choose an answer"
 * (`ChoiceGroups`), and what the one item of a task asks with no text of its own, and what was read
 * in it, in the verdict's card (R65).
 */
export function Items({
  task,
  verdicts,
  language,
}: Omit<ItemsProps, "choices" | "locked" | "onChoose">) {
  if (task.canvas.kind !== "handwriting_sheet") return <Lines task={task} verdicts={verdicts} />;
  const lang = language === undefined ? {} : { lang: language };
  const shown = task.items.flatMap((item, i): { i: number; node: ReactNode }[] => {
    const verdict = verdicts.items.get(i + 1);
    // The slots of an item never move: each reading is its place. What the card holds is not here.
    const read = readInCard(task) ? [] : readingsOf(verdicts, i + 1, slotsOf(item).length);
    const readings = read.map((reading, r) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: the slots of an item never move.
      <ReadingLine key={r} reading={reading} />
    ));
    if (choiceSlots(item).length > 0) {
      // Its options and its words stand in the pop-over; what was read in its other slots, here.
      return readings.length === 0 ? [] : [{ i, node: <>{readings}</> }];
    }
    // An item answered on the sheet: what it asks stands beside it, and then what was read. The one
    // item of a task, with no text of its own, has its verdict and its reading in the card.
    if (item.text === undefined && (verdict === undefined || task.items.length === 1)) return [];
    return [
      {
        i,
        node: (
          <>
            <p className="nt-item-text">
              <ItemHeading item={item} place={i + 1} verdict={verdict} lang={lang} />
            </p>
            {readings}
          </>
        ),
      },
    ];
  });
  if (shown.length === 0) return null;
  return (
    <div className="nt-items">
      {shown.map(({ i, node }) => (
        <div key={i} className="nt-item">
          {node}
        </div>
      ))}
    </div>
  );
}

/**
 * The options of the task's answer slots bound choice, in the pop-over of "Choose an answer": a
 * group for each such slot, by its item, each option a radio button of the keyboard's own, the
 * verdict beside the option tapped. `onChosen` follows an option picked by a tap or by Enter, not by
 * the arrows that walk the group: the pop-over closes on the task's one slot.
 */
export function ChoiceGroups({
  task,
  choices,
  verdicts,
  language,
  locked,
  onChoose,
  onChosen,
}: ItemsProps & { readonly onChosen?: () => void }) {
  const { words } = useLanguage();
  const name = useId();
  const lang = language === undefined ? {} : { lang: language };
  return (
    <div className="nt-choice-groups">
      {task.items.map((item, i) => {
        const at = choiceSlots(item);
        if (at.length === 0) return null;
        const heading = (
          <ItemHeading item={item} place={i + 1} verdict={verdicts.items.get(i + 1)} lang={lang} />
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
              onPicked={onChosen}
            />
          );
        };
        // biome-ignore-start lint/suspicious/noArrayIndexKey: the items of a task never move.
        if (at.length === 1 && item.answer_slots?.length === 1) {
          return (
            <div key={i} className="nt-item">
              {choicesOf(at[0] as number, heading)}
            </div>
          );
        }
        return (
          <fieldset key={i} className="nt-item">
            <legend>{heading}</legend>
            {at.map((s) => choicesOf(s, words.text("task.slot", { n: s + 1 })))}
          </fieldset>
        );
        // biome-ignore-end lint/suspicious/noArrayIndexKey: the items of a task never move.
      })}
    </div>
  );
}
