// The tasks of a photographed page as the pick screen holds them (R71): the frames `FindTasks` gave,
// each picked at first, and those the learner draws, each picked as it comes; a tap on one leaves
// it out or takes it back, and "Start" begins an attempt for each picked, in the order of the page.
// The learner may ask in words to find them anew (R165 spec): the request goes with the frames on
// the page, and the frames it gave take the place of those found, the learner's own staying. Frames
// found on the photo turned upright turn the page's photo, and the frames on it, with them (R162
// spec). No DOM.
import type { FindTasksResponse } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { type Frame, isFrame, pageOrder, turnedFrame } from "./frame.ts";
import { type Size, turnedSize } from "./photo.ts";

/** The most tasks one page begins: those of `BeginPaperAttempts` (the contract). */
export const MAX_TASKS = 20;

/** The longest request about the page, in code points (the contract's `FindTasksRequest.request`). */
export const MAX_REQUEST = 200;

/** The most frames drawn a request carries (the contract). */
const MAX_DRAWN = 40;

/** A task on the page: its frame, whether the learner drew it, and whether it is picked. */
export interface PageTask {
  /** Its key on the screen, which no request carries. */
  readonly id: string;
  readonly frame: Frame;
  /** The learner drew it round a task the AI missed. */
  readonly drawn: boolean;
  readonly picked: boolean;
}

/**
 * The tasks of an answer of `FindTasks`, each picked, in the order of the page: a frame with no box,
 * or one that is no rectangle in the photo, is none, and past MAX_TASKS none either.
 */
export function foundTasks(answer: FindTasksResponse): readonly PageTask[] {
  const frames: Frame[] = [];
  for (const { box } of answer.frames) {
    if (box === undefined) continue;
    const frame = { ymin: box.ymin, xmin: box.xmin, ymax: box.ymax, xmax: box.xmax };
    if (isFrame(frame)) frames.push(frame);
  }
  return frames
    .sort(pageOrder)
    .slice(0, MAX_TASKS)
    .map((frame, i) => ({ id: `found-${i + 1}`, frame, drawn: false, picked: true }));
}

/** A page on its photo, as `PaperContext` holds it. */
interface OnPhoto<P extends Size> {
  readonly photo: P;
  readonly tasks: readonly PageTask[];
  readonly before?: readonly PageTask[] | undefined;
}

/** The tasks with each frame turned as `turnedFrame` turns it: one with nothing left on the photo goes. */
export function turnedTasks(
  tasks: readonly PageTask[],
  degrees: number,
  from: Size,
  to: Size,
): readonly PageTask[] {
  return tasks.flatMap((task) => {
    const frame = turnedFrame(task.frame, degrees, from, to);
    return frame === undefined ? [] : [{ ...task, frame }];
  });
}

/**
 * The page on `turned`, its photo turned upright by `degrees` (R162 spec): the frames on it before —
 * those drawn, and those Undo puts back — turned with the photo, so that each stays round its task.
 * None when the page holds another photo than `photo`, the one the answer was for: it came too late.
 */
export function uprightPage<P extends Size, T extends OnPhoto<P>>(
  page: T | undefined,
  photo: P,
  turned: P,
  degrees: number,
): T | undefined {
  if (page === undefined || page.photo !== photo) return undefined;
  const from = { width: photo.width, height: photo.height };
  const to = turnedSize(photo.width, photo.height, degrees);
  return {
    ...page,
    photo: turned,
    tasks: turnedTasks(page.tasks, degrees, from, to),
    ...(page.before === undefined ? {} : { before: turnedTasks(page.before, degrees, from, to) }),
  };
}

/**
 * The tasks an answer found on the photo turned upright by `degrees`, on the photo of `size` as it
 * is, each the rectangle that holds its frame turned back: for a page whose photo stays, as its
 * tasks begun and the history hold it, or as it could not be turned.
 */
export function unturned(
  tasks: readonly PageTask[],
  degrees: number,
  size: Size,
): readonly PageTask[] {
  return turnedTasks(tasks, -degrees, turnedSize(size.width, size.height, degrees), size);
}

/**
 * A request as it goes: trimmed, its control characters spaces, cut to MAX_REQUEST code points; none
 * when nothing is left of it.
 */
export function requestOf(text: string): string | undefined {
  // The contract refuses a control character: C0, DEL and C1.
  const plain = [...text].map((c) => {
    const n = c.codePointAt(0) ?? 0;
    return n < 0x20 || (n >= 0x7f && n <= 0x9f) ? " " : c;
  });
  const kept = plain.join("").trim();
  const cut = [...kept].slice(0, MAX_REQUEST).join("").trim();
  return cut === "" ? undefined : cut;
}

/**
 * The frames a request carries, each in the order of the page as the screen numbers them: those the
 * AI found and those the learner drew, at most as many as the contract takes.
 */
export function framesOf(tasks: readonly PageTask[]): {
  readonly found: readonly Frame[];
  readonly drawn: readonly Frame[];
} {
  const ordered = [...tasks].sort((a, b) => pageOrder(a.frame, b.frame));
  return {
    found: ordered
      .filter((task) => !task.drawn)
      .map((task) => task.frame)
      .slice(0, MAX_TASKS),
    drawn: ordered
      .filter((task) => task.drawn)
      .map((task) => task.frame)
      .slice(0, MAX_DRAWN),
  };
}

/**
 * The tasks once a request gave frames: those found take the place of the AI's before, each its key
 * of this request's own, `stamp`, so that none takes the key of a task begun before; the learner's
 * own stay, as they are. None found, the tasks as they were.
 */
export function asked(
  tasks: readonly PageTask[],
  found: readonly PageTask[],
  stamp: string,
): readonly PageTask[] {
  if (found.length === 0) return tasks;
  return [
    ...found.map((task, i) => ({ ...task, id: `asked-${stamp}-${i + 1}` })),
    ...tasks.filter((task) => task.drawn),
  ];
}

/**
 * The tasks of a page of the history: its frames as its last Start left them, each picked whose task
 * was begun, and the frame of each task begun whose frame the learner removed before that Start, so
 * that every task the history keeps is on the list again (R77).
 */
export function keptTasks(
  frames: readonly Pick<PageTask, "id" | "frame" | "drawn">[],
  begun: readonly { readonly taskId: string; readonly frame: Frame; readonly drawn: boolean }[],
): readonly PageTask[] {
  const ids = new Set(begun.map((task) => task.taskId));
  const onPage = new Set(frames.map((each) => each.id));
  return [
    ...frames.map(({ id, frame, drawn }) => ({ id, frame, drawn, picked: ids.has(id) })),
    ...begun
      .filter((task) => !onPage.has(task.taskId))
      .map(({ taskId, frame, drawn }) => ({ id: taskId, frame, drawn, picked: true })),
  ];
}

/** A tap on a task: picked, it is left out; left out, picked again. */
export function toggled(tasks: readonly PageTask[], id: string): readonly PageTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, picked: !task.picked } : task));
}

/** "Select all", or with every task picked "Select none". */
export function allOrNone(tasks: readonly PageTask[]): readonly PageTask[] {
  const all = tasks.every((task) => task.picked);
  return tasks.map((task) => ({ ...task, picked: !all }));
}

/**
 * A frame the learner drew, picked: its key the next one free of those of the page's frames and of
 * its tasks begun, `begun`, whose frames may be gone. A begun task's key taken again would begin the
 * new frame in that task's place, and its work would go.
 */
export function withDrawn(
  tasks: readonly PageTask[],
  frame: Frame,
  begun: readonly string[] = [],
): readonly PageTask[] {
  const ids = [...tasks.map((task) => task.id), ...begun];
  const last = Math.max(0, ...ids.map((id) => Number(/^drawn-(\d+)$/.exec(id)?.[1] ?? 0)));
  return [...tasks, { id: `drawn-${last + 1}`, frame, drawn: true, picked: true }];
}

/** A frame moved or resized by the learner, the AI's or their own. */
export function withFrame(
  tasks: readonly PageTask[],
  id: string,
  frame: Frame,
): readonly PageTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, frame } : task));
}

/** A frame removed by its cross, the AI's or the learner's. */
export function without(tasks: readonly PageTask[], id: string): readonly PageTask[] {
  return tasks.filter((task) => task.id !== id);
}

/** The tasks picked, in the order of the page: those whose attempts "Start" begins. */
export function picked(tasks: readonly PageTask[]): readonly PageTask[] {
  return tasks.filter((task) => task.picked).sort((a, b) => pageOrder(a.frame, b.frame));
}

/** What the screen counts: the tasks the AI found, those the learner drew, and those picked. */
export function counts(tasks: readonly PageTask[]): {
  readonly found: number;
  readonly drawn: number;
  readonly picked: number;
  readonly all: number;
} {
  const drawn = tasks.filter((task) => task.drawn).length;
  return {
    found: tasks.length - drawn,
    drawn,
    picked: tasks.filter((task) => task.picked).length,
    all: tasks.length,
  };
}

/** Whether "Start" can begin the picked tasks: from 1 to MAX_TASKS of them. */
export function canStart(tasks: readonly PageTask[]): boolean {
  const n = picked(tasks).length;
  return n >= 1 && n <= MAX_TASKS;
}

/**
 * What the screen says of MAX_TASKS: "too-many" with more of them picked, which "Start" cannot
 * begin, "at-most" with as many found, for the page may hold more than the AI gave.
 */
export function limit(tasks: readonly PageTask[]): "too-many" | "at-most" | undefined {
  const count = counts(tasks);
  if (count.picked > MAX_TASKS) return "too-many";
  return count.found >= MAX_TASKS ? "at-most" : undefined;
}

/**
 * The number of a task on the screen, its place in the order of the page among every task,
 * picked or not, from 1: the name "Select task 3" says.
 */
export function numbers(tasks: readonly PageTask[]): ReadonlyMap<string, number> {
  const ordered = [...tasks].sort((a, b) => pageOrder(a.frame, b.frame));
  return new Map(ordered.map((task, i) => [task.id, i + 1]));
}
