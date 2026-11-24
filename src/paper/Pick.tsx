// The page photographed, its tasks to pick, as the mockup's pick screen: the photo, each
// task's frame over it a button that is picked or left out, every one picked at first, and its
// cross removes it; a task the AI missed the learner frames by hand, by a rectangle dragged from one
// corner of it to the opposite with a finger or a pen, which follows the pointer and looks as the
// frame it becomes, or by two taps, a corner and then the one opposite. Every frame, the AI's too,
// moves when dragged by its middle and resizes by its corner; a press that moved it picks nothing.
// The top bar's pill holds Back alone, the title the screen's heading unseen, and its end "Remove
// all frames", which clears the photo for frames of the learner's own, and Retake, the bar kept to
// one row by BarFit.tsx; while the tasks are found, its middle says so, by a turning ring, and a line of light runs down the photo and back; once they are, how many
// were found and framed by hand. At the foot, the note
// that the photo stays on the device, and the bar of "Select all", the count and Start, with the
// most tasks at once at its head, in a ring, once the page holds as many or more are picked; at the
// bar's start, before a line, the round buttons of the tutor and of debug, which the screen gives.
// Drawing a frame takes a pointer: a learner on the keyboard picks among the AI's frames alone.
// The tutor's open panel lies over the page, as the debug panel does, and moves none of it; on a
// phone its sheet hides the bar.
import { type CSSProperties, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { RowLine } from "../task/TaskLayout.tsx";
import { BarButton, useBarFit } from "./BarFit.tsx";
import type { Photo } from "./capture.ts";
import {
  dragFrame,
  type Frame,
  isMove,
  isTap,
  movedFrame,
  type Point,
  resizedFrame,
  type Scale,
  spanned,
  tapsFrame,
} from "./frame.ts";
import {
  allOrNone,
  canStart,
  counts,
  limit,
  MAX_TASKS,
  numbers,
  type PageTask,
  toggled,
  withDrawn,
  withFrame,
  without,
} from "./page.ts";

/** Where a frame stands over the photo, in percent of it. */
function placed(frame: Frame): CSSProperties {
  return {
    left: `${frame.xmin / 10}%`,
    top: `${frame.ymin / 10}%`,
    width: `${(frame.xmax - frame.xmin) / 10}%`,
    height: `${(frame.ymax - frame.ymin) / 10}%`,
  };
}

/** A point of the photo in percent, where the tap of a frame's first corner stands. */
function at(x: number, y: number): CSSProperties {
  return { left: `${x / 10}%`, top: `${y / 10}%` };
}

/**
 * What the page to pick from says: a card of its own just above the bar, which keeps its size — a
 * hint in cool white, a warning in warm white, a failure in a red tint with its way on at its end
 * (the mockup's `pick-none`, `pick-corner`, `pick-failed`, `pick-outcome` and `pick-closed`).
 */
export interface PageSay {
  readonly kind: "hint" | "warn" | "fail";
  readonly title: string;
  readonly line?: string | undefined;
  readonly action?: { readonly label: string; readonly onClick: () => void } | undefined;
}

/** The signs of the cards: a frame dragged from its corner, two opposite corners of one, and "!". */
const DRAG = "M4 5h12v10H4zM16 15l4.5 4.5";
const CORNERS = "M4 10V4h6M20 14v6h-6";
const BANG = "M12 7v6M12 17h.01";

function Drawn({ path, bold = false }: { readonly path: string; readonly bold?: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={bold ? 2.8 : 2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** A sentence ends with its stop: the title is in bold, and the line, when there is one, after it. */
function stopped(title: string): string {
  return /[.!?…]$/.test(title) ? title : `${title}.`;
}

function Say({ kind, title, line, action, sign }: PageSay & { readonly sign: ReactNode }) {
  return (
    <div className="nt-page-say" data-kind={kind} role={kind === "fail" ? "alert" : "status"}>
      <span className="nt-say-sign" aria-hidden="true">
        {sign}
      </span>
      <p className="nt-say-words">
        <strong>{stopped(title)}</strong>
        {line === undefined ? null : ` ${line}`}
      </p>
      {action === undefined ? null : (
        <button type="button" className="nt-say-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Where a frame's control stands: on the frame's corner, kept inside the photo by half of the
 * target, so that a frame at the photo's edge never puts its cross or corner past the screen's.
 */
function control(x: number, y: number): CSSProperties {
  const kept = (percent: number) =>
    `clamp(calc(var(--nt-target) / 2), ${percent}%, calc(100% - var(--nt-target) / 2))`;
  return { left: kept(x / 10), top: kept(y / 10) };
}

export interface PickProps {
  readonly photo: Photo;
  readonly tasks: readonly PageTask[];
  readonly onTasks: (update: (tasks: readonly PageTask[]) => readonly PageTask[]) => void;
  /** The keys of the tasks begun on the page, their frames on it or gone: a frame drawn takes none. */
  readonly begun?: readonly string[] | undefined;
  /** What finding or Start came to, and whether Start is shut, each a card above the bar. */
  readonly says?: readonly PageSay[];
  /** The finding found no task: with none framed, a card above the bar says to drag a frame round each. */
  readonly none?: boolean;
  /** The tasks are being found: the frames wait. */
  readonly finding: boolean;
  /** Start is shut: AI is closed to the learner, and a task from paper can't be checked. */
  readonly closed: boolean;
  /** Start is under way. */
  readonly starting: boolean;
  readonly onStart: () => void;
  readonly onRetake: () => void;
  readonly onHome: () => void;
  /** The tutor's panel is open. */
  readonly beside?: boolean;
  /** The round buttons at the bottom bar's start, before a line: none, and no line. */
  readonly calls?: ReactNode;
}

export function Pick({
  photo,
  tasks,
  onTasks,
  begun,
  says = [],
  none = false,
  finding,
  closed,
  starting,
  onStart,
  onRetake,
  onHome,
  beside = false,
  calls,
}: PickProps) {
  const { language, words } = useLanguage();
  const surface = useRef<HTMLDivElement>(null);
  const barEnd = useRef<HTMLDivElement>(null);
  // A press on the photo: where it began, where the pointer is, and the farthest corners it reached,
  // by which a press that never left the size of a tap is a tap.
  const stroke = useRef<
    | {
        readonly pointer: number;
        readonly from: Point;
        to: Point;
        low: Point;
        high: Point;
      }
    | undefined
  >(undefined);
  const resizing = useRef<{ readonly pointer: number; readonly id: string } | undefined>(undefined);
  // A press on a frame: the frame as it was, where the press began, and whether it moved the frame,
  // so that the click after a move picks nothing.
  const moving = useRef<
    | {
        readonly pointer: number;
        readonly id: string;
        readonly frame: Frame;
        readonly from: Point;
        moved: boolean;
      }
    | undefined
  >(undefined);
  const movedId = useRef<string | undefined>(undefined);
  const [live, setLive] = useState<Frame | undefined>(undefined);
  const [corner, setCorner] = useState<Point | undefined>(undefined);

  /** A pointer's place on the photo, in thousandths, and the scale the photo is drawn at. */
  const where = (event: PointerEvent): { readonly point: Point; readonly scale: Scale } => {
    const box = surface.current?.getBoundingClientRect();
    const width = box?.width || 1;
    const height = box?.height || 1;
    return {
      point: {
        x: ((event.clientX - (box?.left ?? 0)) / width) * 1000,
        y: ((event.clientY - (box?.top ?? 0)) / height) * 1000,
      },
      scale: { x: width / 1000, y: height / 1000 },
    };
  };

  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (finding || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const { point } = where(event);
    stroke.current = { pointer: event.pointerId, from: point, to: point, low: point, high: point };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const now = stroke.current;
    if (now === undefined || now.pointer !== event.pointerId) return;
    const { point, scale } = where(event);
    now.to = point;
    now.low = { x: Math.min(now.low.x, point.x), y: Math.min(now.low.y, point.y) };
    now.high = { x: Math.max(now.high.x, point.x), y: Math.max(now.high.y, point.y) };
    // A press still the size of a tap draws nothing, so that a tap shows no rectangle.
    if (!isTap([now.low, now.high], scale)) setLive(spanned(now.from, now.to));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const now = stroke.current;
    if (now === undefined || now.pointer !== event.pointerId) return;
    stroke.current = undefined;
    setLive(undefined);
    const { scale } = where(event);
    if (isTap([now.low, now.high], scale)) {
      const tap = now.from;
      // The first tap is a corner; the second makes the frame.
      if (corner === undefined) setCorner(tap);
      else {
        const frame = tapsFrame(corner, tap, scale);
        setCorner(undefined);
        onTasks((was) => withDrawn(was, frame, begun));
      }
      return;
    }
    setCorner(undefined);
    const frame = dragFrame(now.from, now.to, scale);
    if (frame !== undefined) onTasks((was) => withDrawn(was, frame, begun));
  };
  const cancel = () => {
    stroke.current = undefined;
    setLive(undefined);
  };

  const besideIt = beside ? { "data-beside": "panel" } : {};
  const order = numbers(tasks);
  const count = counts(tasks);
  const all = count.picked === count.all && count.all > 0;
  const over = limit(tasks);
  // The numbers of "{count} of {total}" in bold, the words around them not.
  const picks = words.pattern("paper.picked");
  const from = picks.indexOf("{count}");
  const to = picks.indexOf("{total}") + "{total}".length;
  const fill = (part: string) =>
    part.replace("{count}", String(count.picked)).replace("{total}", String(count.all));
  const clearable = count.all > 0 && !finding;
  useBarFit(barEnd, [language, finding, clearable, count.found, count.drawn].join(" "));

  return (
    <Screen
      title={words.text("paper.title")}
      layout="task"
      unseen
      bar={{
        back: (
          <IconButton value="back" caption="task.home" className="nt-page-back" onClick={onHome} />
        ),
        ...(finding
          ? {
              middle: (
                <p role="status" className="nt-finding nt-glass">
                  <span className="nt-spin" aria-hidden="true" />
                  <span className="nt-finding-words">{words.text("paper.finding")}</span>
                </p>
              ),
            }
          : tasks.length > 0
            ? {
                middle: (
                  <p role="status" className="nt-finding nt-found nt-glass">
                    <span className="nt-found-sign" aria-hidden="true">
                      <Icon value="ticked" />
                    </span>
                    {[
                      words.text("paper.found-head", { count: count.found }),
                      ...(count.drawn > 0
                        ? [words.text("paper.drawn", { count: count.drawn })]
                        : []),
                    ].join(" · ")}
                  </p>
                ),
              }
            : {}),
        end: (
          <div ref={barEnd} className="nt-top-end">
            {clearable ? (
              <BarButton
                icon="close"
                caption={words.text("paper.remove-all")}
                onClick={() => onTasks(() => [])}
              />
            ) : null}
            <BarButton icon="camera" caption={words.text("paper.retake")} onClick={onRetake} />
          </div>
        ),
      }}
    >
      <div className="nt-page-stage">
        <div
          ref={surface}
          className="nt-page-photo"
          data-finding={finding || undefined}
          style={{ "--nt-ratio": photo.width / photo.height } as CSSProperties}
        >
          <img src={photo.url} alt="" draggable={false} />
          <div
            className="nt-page-draw"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={cancel}
          />
          {tasks.map((task) => {
            const n = order.get(task.id) ?? 0;
            const key = task.drawn
              ? task.picked
                ? "paper.deselect-drawn"
                : "paper.select-drawn"
              : task.picked
                ? "paper.deselect"
                : "paper.select";
            return (
              <button
                key={task.id}
                type="button"
                className="nt-page-frame"
                data-drawn={task.drawn || undefined}
                aria-pressed={task.picked}
                aria-label={words.text(key, { n })}
                style={placed(task.frame)}
                onClick={() => {
                  if (movedId.current === task.id) {
                    movedId.current = undefined;
                    return;
                  }
                  onTasks((was) => toggled(was, task.id));
                }}
                onPointerDown={(event) => {
                  if (finding || event.button !== 0) return;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  const { point } = where(event);
                  movedId.current = undefined;
                  moving.current = {
                    pointer: event.pointerId,
                    id: task.id,
                    frame: task.frame,
                    from: point,
                    moved: false,
                  };
                }}
                onPointerMove={(event) => {
                  const now = moving.current;
                  if (now === undefined || now.pointer !== event.pointerId) return;
                  const { point, scale } = where(event);
                  if (!now.moved && !isMove(now.from, point, scale)) return;
                  now.moved = true;
                  const by = { x: point.x - now.from.x, y: point.y - now.from.y };
                  onTasks((was) => withFrame(was, now.id, movedFrame(now.frame, by)));
                }}
                onPointerUp={(event) => {
                  const now = moving.current;
                  if (now === undefined || now.pointer !== event.pointerId) return;
                  moving.current = undefined;
                  if (now.moved) movedId.current = now.id;
                }}
                onPointerCancel={() => {
                  moving.current = undefined;
                }}
              >
                <span className="nt-page-mark" aria-hidden="true">
                  {task.picked ? <Icon value="ticked" /> : n}
                </span>
              </button>
            );
          })}
          {tasks.map((task) => (
            <span key={`${task.id}-controls`}>
              <span className="nt-frame-control" style={control(task.frame.xmax, task.frame.ymin)}>
                <IconButton
                  value="remove-frame"
                  onClick={() => onTasks((was) => without(was, task.id))}
                />
              </span>
              <span className="nt-frame-control" style={control(task.frame.xmax, task.frame.ymax)}>
                <IconButton
                  value="resize-frame"
                  className="nt-frame-corner"
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    resizing.current = { pointer: event.pointerId, id: task.id };
                  }}
                  onPointerMove={(event) => {
                    const now = resizing.current;
                    if (now === undefined || now.pointer !== event.pointerId) return;
                    const { point, scale } = where(event);
                    onTasks((was) => {
                      const frame = was.find((t) => t.id === now.id)?.frame;
                      return frame === undefined
                        ? was
                        : withFrame(was, now.id, resizedFrame(frame, point, scale));
                    });
                  }}
                  onPointerUp={() => {
                    resizing.current = undefined;
                  }}
                  onPointerCancel={() => {
                    resizing.current = undefined;
                  }}
                />
              </span>
            </span>
          ))}
          {corner === undefined ? null : (
            <span className="nt-page-corner" style={at(corner.x, corner.y)} aria-hidden="true" />
          )}
          {finding ? (
            <span className="nt-page-scan" aria-hidden="true">
              <span />
            </span>
          ) : null}
          {live === undefined ? null : (
            <span className="nt-page-live" style={placed(live)} aria-hidden="true" />
          )}
        </div>
      </div>
      <p className="nt-page-note">
        <Icon value="state-locked" />
        {words.text("paper.note")}
      </p>
      <div className="nt-page-says" {...besideIt}>
        {says.map((say) => (
          <Say key={`${say.kind}-${say.title}`} {...say} sign={<Drawn path={BANG} bold />} />
        ))}
        {over === undefined ? null : (
          <Say
            kind="warn"
            title={words.text(`paper.${over}`, { max: MAX_TASKS })}
            line={words.text(`paper.${over}-how`)}
            sign={MAX_TASKS}
          />
        )}
        {corner !== undefined ? (
          <Say kind="hint" title={words.text("paper.corner")} sign={<Drawn path={CORNERS} />} />
        ) : none && tasks.length === 0 ? (
          <Say
            kind="hint"
            title={words.text("paper.none-found")}
            line={words.text("paper.none-found-how")}
            sign={<Drawn path={DRAG} />}
          />
        ) : null}
      </div>
      <div className="nt-page-bar nt-glass" {...besideIt}>
        <div className="nt-page-row">
          {calls === undefined ? null : (
            <>
              <span className="nt-page-calls">{calls}</span>
              <RowLine />
            </>
          )}
          <button
            type="button"
            className="nt-plain"
            disabled={count.all === 0}
            onClick={() => onTasks(allOrNone)}
          >
            {words.text(all ? "paper.select-none" : "paper.select-all")}
          </button>
          <span className="nt-page-count">
            {from < 0 || to < from ? (
              words.text("paper.picked", { count: count.picked, total: count.all })
            ) : (
              <>
                {picks.slice(0, from)}
                <strong>{fill(picks.slice(from, to))}</strong>
                {picks.slice(to)}
              </>
            )}
          </span>
          <button
            type="button"
            className="nt-start"
            disabled={!canStart(tasks) || closed || finding}
            {...(starting ? { "aria-disabled": true } : {})}
            onClick={() => {
              if (!starting) onStart();
            }}
          >
            {words.text("paper.start")}
            <Icon value="more" />
          </button>
        </div>
      </div>
    </Screen>
  );
}
