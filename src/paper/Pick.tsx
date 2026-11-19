// The page photographed, its tasks to pick (R71), as the mockup's pick screen: the photo, each
// task's frame over it a button that is picked or left out, every one picked at first, and its
// cross removes it; a task the AI missed the learner frames by hand, by a loop drawn round it with a
// finger or a pen or by two taps, a corner and then the one opposite, and its corner resizes it.
// The top bar says how many tasks were found and framed by hand, and holds Retake; at the foot,
// the note that the photo stays on the device, and the bar of "Select all", the count and Start.
// Drawing a frame takes a pointer: a learner on the keyboard picks among the AI's frames alone.
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

/** A point of the photo in percent, where a frame's control stands. */
function at(x: number, y: number): CSSProperties {
  return { left: `${x / 10}%`, top: `${y / 10}%` };
}

export interface PickProps {
  readonly photo: Photo;
  readonly tasks: readonly PageTask[];
  readonly onTasks: (update: (tasks: readonly PageTask[]) => readonly PageTask[]) => void;
  /** The line under the top bar's: finding, none found, or what finding or Start came to. */
  readonly lines?: ReactNode;
  /** The tasks are being found: the frames wait. */
  readonly finding: boolean;
  /** Start is shut: AI is closed to the learner, and a task from paper can't be checked. */
  readonly closed: boolean;
  /** Start is under way. */
  readonly starting: boolean;
  readonly onStart: () => void;
  readonly onRetake: () => void;
  readonly onHome: () => void;
}

export function Pick({
  photo,
  tasks,
  onTasks,
  lines,
  finding,
  closed,
  starting,
  onStart,
  onRetake,
  onHome,
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
        onTasks((was) => withDrawn(was, frame));
      }
      return;
    }
    setCorner(undefined);
    const frame = loopFrame(now.points, scale);
    if (frame !== undefined) onTasks((was) => withDrawn(was, frame));
  };
  const cancel = () => {
    stroke.current = undefined;
    setLive(undefined);
  };

  const order = numbers(tasks);
  const count = counts(tasks);
  const all = count.picked === count.all && count.all > 0;
  const under = [
    words.text("paper.found", { count: count.found }),
    ...(count.drawn > 0 ? [words.text("paper.drawn", { count: count.drawn })] : []),
    words.text("paper.tap"),
  ].join(" · ");

  return (
    <Screen
      title={words.text("paper.title")}
      layout="task"
      bar={{
        back: <IconButton value="back" caption="task.home" onClick={onHome} />,
        under: <p className="nt-top-sub nt-page-sub">{under}</p>,
        end: (
          <div className="nt-top-end">
            <button type="button" className="nt-glass nt-retake" onClick={onRetake}>
              <Icon value="camera" />
              {words.text("paper.retake")}
            </button>
          </div>
        ),
      }}
    >
      <div className="nt-page-lines">
        {lines}
        {corner === undefined ? null : <p role="status">{words.text("paper.corner")}</p>}
      </div>
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
              <span className="nt-frame-control" style={at(task.frame.xmax, task.frame.ymin)}>
                <IconButton
                  value="remove-frame"
                  onClick={() => onTasks((was) => without(was, task.id))}
                />
              </span>
              {task.drawn ? (
                <span className="nt-frame-control" style={at(task.frame.xmax, task.frame.ymax)}>
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
      <div className="nt-page-bar nt-glass">
        <button
          type="button"
          className="nt-plain"
          disabled={count.all === 0}
          onClick={() => onTasks(allOrNone)}
        >
          {words.text(all ? "paper.select-none" : "paper.select-all")}
        </button>
        <span className="nt-page-count">
          {words.text("paper.picked", { count: count.picked, total: count.all })}
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
    </Screen>
  );
}
