// The page photographed, its tasks to pick (R71), as the mockup's pick screen: the photo, each
// task's frame over it a button that is picked or left out, every one picked at first, and its
// cross removes it; a task the AI missed the learner frames by hand, by a loop drawn round it with a
// finger or a pen or by two taps, a corner and then the one opposite, and its corner resizes it.
// The top bar's pill holds the title alone, and its end "Remove all frames", which clears the
// photo for frames of the learner's own, and Retake; while the tasks are found, its middle says
// so, by a turning ring, and a line of light runs down the photo and back; once they are, how many
// were found and framed by hand. At the foot, the note
// that the photo stays on the device, and the bar of "Select all", the count and Start, with the
// most tasks at once at its head, in a ring, once the page holds as many or more are picked.
// Drawing a frame takes a pointer: a learner on the keyboard picks among the AI's frames alone.
// The tutor's open panel lies over the page, as the debug panel does, and moves none of it; on a
// phone its sheet hides the bar (R74).
import { type CSSProperties, type PointerEvent, type ReactNode, useRef, useState } from "react";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { Screen } from "../app/Screen.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import type { Photo } from "./capture.ts";
import {
  type Frame,
  isTap,
  loopFrame,
  type Point,
  resizedFrame,
  type Scale,
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

/** A pointer moves at least this many CSS px before the loop takes another point. */
const STEP_PX = 2;

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

/** The signs of the cards: a loop drawn by hand, two opposite corners of a frame, and "!". */
const LOOP = "M4 12c0-4 3.6-7 8-7s8 3 8 6.5-3.4 6-7.5 6c-2 0-3.3-.4-4.3-1.1M8.2 16.4 5.5 19.5";
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
  /** The finding found no task: with none framed, a card above the bar says to draw round each. */
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
}: PickProps) {
  const { words } = useLanguage();
  const surface = useRef<HTMLDivElement>(null);
  const stroke = useRef<{ readonly pointer: number; readonly points: Point[] } | undefined>(
    undefined,
  );
  const resizing = useRef<{ readonly pointer: number; readonly id: string } | undefined>(undefined);
  const [live, setLive] = useState<readonly Point[] | undefined>(undefined);
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
    stroke.current = { pointer: event.pointerId, points: [where(event).point] };
    setLive(stroke.current.points);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const now = stroke.current;
    if (now === undefined || now.pointer !== event.pointerId) return;
    const { point, scale } = where(event);
    const last = now.points[now.points.length - 1];
    if (
      last !== undefined &&
      Math.hypot((point.x - last.x) * scale.x, (point.y - last.y) * scale.y) < STEP_PX
    ) {
      return;
    }
    now.points.push(point);
    setLive([...now.points]);
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const now = stroke.current;
    if (now === undefined || now.pointer !== event.pointerId) return;
    stroke.current = undefined;
    setLive(undefined);
    const { scale } = where(event);
    if (isTap(now.points, scale)) {
      const tap = now.points[0];
      if (tap === undefined) return;
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
    const frame = loopFrame(now.points, scale);
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

  return (
    <Screen
      title={words.text("paper.title")}
      layout="task"
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
          <div className="nt-top-end">
            {count.all === 0 || finding ? null : (
              <button
                type="button"
                className="nt-glass nt-retake"
                onClick={() => onTasks(() => [])}
              >
                <Icon value="close" />
                {words.text("paper.remove-all")}
              </button>
            )}
            <button type="button" className="nt-glass nt-retake" onClick={onRetake}>
              <Icon value="camera" />
              {words.text("paper.retake")}
            </button>
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
                onClick={() => onTasks((was) => toggled(was, task.id))}
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
              {task.drawn ? (
                <span
                  className="nt-frame-control"
                  style={control(task.frame.xmax, task.frame.ymax)}
                >
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
              ) : null}
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
          {live === undefined || live.length < 2 ? null : (
            <svg
              className="nt-page-live"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline points={live.map((p) => `${p.x},${p.y}`).join(" ")} />
            </svg>
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
            sign={<Drawn path={LOOP} />}
          />
        ) : null}
      </div>
      <div className="nt-page-bar nt-glass" {...besideIt}>
        <div className="nt-page-row">
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
