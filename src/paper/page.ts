// The tasks of a photographed page as the pick screen holds them (R71): the frames `FindTasks` gave,
// each picked at first, and those the learner draws, each picked as it comes; a tap on one leaves
// it out or takes it back, and "Start" begins an attempt for each picked, in the order of the page.
// No DOM.
import type { FindTasksResponse } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { type Frame, pageOrder } from "./frame.ts";

/** The most tasks one page begins: those of `BeginPaperAttempts` (the contract). */
export const MAX_TASKS = 20;

/** A task on the page: its frame, whether the learner drew it, and whether it is picked. */
export interface PageTask {
  /** Its key on the screen, which no request carries. */
  readonly id: string;
  readonly frame: Frame;
  /** The learner drew it round a task the AI missed. */
  readonly drawn: boolean;
  readonly picked: boolean;
}

/** A frame that is a rectangle in the photo: its edges in order and within it. */
function isFrame(frame: Frame): boolean {
  return (
    frame.xmin >= 0 &&
    frame.ymin >= 0 &&
    frame.xmax <= 1000 &&
    frame.ymax <= 1000 &&
    frame.xmin < frame.xmax &&
    frame.ymin < frame.ymax
  );
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

/** A tap on a task: picked, it is left out; left out, picked again. */
export function toggled(tasks: readonly PageTask[], id: string): readonly PageTask[] {
  return tasks.map((task) => (task.id === id ? { ...task, picked: !task.picked } : task));
}

/** "Select all", or with every task picked "Select none". */
export function allOrNone(tasks: readonly PageTask[]): readonly PageTask[] {
  const all = tasks.every((task) => task.picked);
  return tasks.map((task) => ({ ...task, picked: !all }));
}

/** A frame the learner drew, picked: its key the next one free. */
export function withDrawn(tasks: readonly PageTask[], frame: Frame): readonly PageTask[] {
  const last = Math.max(0, ...tasks.map((task) => Number(/^drawn-(\d+)$/.exec(task.id)?.[1] ?? 0)));
  return [...tasks, { id: `drawn-${last + 1}`, frame, drawn: true, picked: true }];
}

/** A frame the learner drew, its corner moved. */
export function withFrame(
  tasks: readonly PageTask[],
  id: string,
  frame: Frame,
): readonly PageTask[] {
  return tasks.map((task) => (task.id === id && task.drawn ? { ...task, frame } : task));
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
 * The number of a task on the screen, its place in the order of the page among every task,
 * picked or not, from 1: the name "Select task 3" says.
 */
export function numbers(tasks: readonly PageTask[]): ReadonlyMap<string, number> {
  const ordered = [...tasks].sort((a, b) => pageOrder(a.frame, b.frame));
  return new Map(ordered.map((task, i) => [task.id, i + 1]));
}
