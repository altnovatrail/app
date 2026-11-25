// The page the learner photographed: the photo, the tasks found on it and those drawn, what
// finding them came to, and once Start has begun them the attempts, the crops and the work on each,
// and whether the screen of solving is shown or the page, by "Add". The address names none of them:
// `#/paper` takes them from here, and they go with the learner chosen, on a new photo, or at
// a reload. So does the conversation with the tutor about the page, the learner's requests among it.
// Each photo replaced has its URLs revoked; so is the photo before once the tasks found on it
// turned upright turn the page's photo too. From Start on, the page is the profile's history
// too, in its database: the photo and the frames, and each task begun with its crop and its
// work — the history, the tracing paper's place, the contexts of its submissions and whether it is
// over —, the work written a moment after it changes, not on every stroke, and at once when the
// page goes or the tab is hidden. A page of the history opens again on the screen of solving with
// its work, but no verdict, which the device does not keep. A task whose attempt closed is kept,
// once api began it anew, under its new attempt.
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Failure } from "../api/failure.ts";
import type { ReadOutcome } from "../api/outcome.ts";
import type { Device } from "../storage/device.ts";
import { openProfile, type PaperWork, type Profile } from "../storage/profile.ts";
import { type Photo, release } from "./capture.ts";
import { keptTasks, type PageTask, uprightPage } from "./page.ts";
import { type BegunTask, changed, renewed, withBegun } from "./solve.ts";

export type { BegunTask } from "./solve.ts";

/** What finding the tasks came to. */
export type Finding =
  /** `FindTasks` is under way. */
  | { readonly status: "finding" }
  /** It gave frames, or none: the learner frames the tasks by hand either way. */
  | { readonly status: "found" }
  /** A call of AI gave no frames: its outcome. */
  | { readonly status: "outcome"; readonly outcome: ReadOutcome }
  /** It did not answer: a refusal or no connection; a try again asks the same request. */
  | { readonly status: "failed"; readonly failure: Failure; readonly request?: string | undefined };

/** A line of the conversation about the page: the learner's request, or what came of it. */
export type Said =
  | { readonly kind: "request"; readonly text: string; readonly voice?: boolean }
  /** The request gave this many frames, which took the place of those found. */
  | { readonly kind: "found"; readonly count: number }
  /** It gave none: the frames stay. */
  | { readonly kind: "none" }
  /** Undo put the frames before it back. */
  | { readonly kind: "undone" };

export interface PaperPage {
  /** The page's ID in the profile's history, which its file of the export is named by. */
  readonly pageId: string;
  /** When the photo was taken or picked, ms since the epoch. */
  readonly takenAt: number;
  readonly photo: Photo;
  readonly finding: Finding;
  readonly tasks: readonly PageTask[];
  /** The conversation with the tutor about the page, oldest first. */
  readonly talk: readonly Said[];
  /** The tasks before the last request gave frames: Undo puts them back, until the learner changes any. */
  readonly before?: readonly PageTask[] | undefined;
}

export interface Paper {
  /** The page photographed, if any. */
  readonly page: PaperPage | undefined;
  /** The tasks Start began on it, in the order of the page. */
  readonly begun: readonly BegunTask[] | undefined;
  /** The screen of solving is shown, not the page: Start shows it, "Add" the page again. */
  readonly solving: boolean;
  /** A new photo, finding its tasks: the former page goes, and its tasks begun. */
  readonly takePhoto: (photo: Photo) => void;
  /** A change to the page of this photo; none once another has taken its place. */
  readonly change: (photo: Photo, update: (page: PaperPage) => PaperPage) => void;
  /**
   * The page of this photo on `turned`, the photo turned upright by `degrees`, the frames on it
   * turned with it, and then changed; none once another has taken its place, and `turned` released.
   */
  readonly turn: (
    photo: Photo,
    turned: Photo,
    degrees: number,
    update: (page: PaperPage) => PaperPage,
  ) => void;
  /** Tasks begun on the page of this photo, beside those begun before, or none: solving goes on. */
  readonly begin: (photo: Photo, begun: readonly BegunTask[]) => void;
  /** "Add": the page again, to pick more of its tasks; the tasks begun stay. */
  readonly add: () => void;
  /** A task begun, changed, by its page's task: its history, or its tracing paper's place. */
  readonly keep: (taskId: string, change: (task: BegunTask) => BegunTask) => void;
  /** A task whose attempt closed, in the new attempt api began of it, its work as it was. */
  readonly renew: (taskId: string, attemptId: string) => void;
  /** The page and its tasks forgotten: Close, or Retake. The history keeps those begun. */
  readonly clear: () => void;
  /**
   * A page of the history, on the screen of solving with its tasks begun and their work: false when
   * the device keeps it no more.
   */
  readonly open: (pageId: string) => Promise<boolean>;
}

/** How long the work of a task waits after a change before it is written, ms. */
const SETTLE_MS = 500;

/** Whether two states of a task hold the same work: its verdict is none of the history's. */
function sameWork(a: BegunTask | undefined, b: BegunTask): boolean {
  return (
    a !== undefined &&
    a.history === b.history &&
    a.tracing === b.tracing &&
    a.sent === b.sent &&
    a.over === b.over &&
    a.solved === b.solved
  );
}

/** A task's work as the history keeps it. */
function workOf(task: BegunTask): PaperWork {
  return {
    history: task.history,
    tracing: task.tracing,
    sent: task.sent ?? [],
    over: task.over === true,
    ...(task.solved === true ? { solved: true } : {}),
  };
}

const PaperContext = createContext<Paper | undefined>(undefined);

interface Held {
  readonly page: PaperPage | undefined;
  readonly begun: readonly BegunTask[] | undefined;
  readonly solving: boolean;
}

/**
 * The page and its tasks for the learner's screens; with the device and the profile, the history
 * too. Without them — a screen's own test — nothing is kept.
 */
export function PaperProvider({
  profileId,
  device,
  children,
}: {
  readonly profileId?: string;
  readonly device?: Device;
  readonly children: ReactNode;
}) {
  const [held, setHeld] = useState<Held>({ page: undefined, begun: undefined, solving: false });
  const shown = useRef(held);
  shown.current = held;
  // The profile's database, opened once; its writes one after another, so that a task's work
  // never comes before the task.
  const database = useRef<
    { readonly of: string; readonly profile: Promise<Profile | undefined> } | undefined
  >(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());
  // The work of each task as written, or as being written, and the tasks changed since, by the
  // page's task.
  const written = useRef(new Map<string, BegunTask>());
  const dirty = useRef(new Map<string, BegunTask>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Each new photo, Close and page opened: a page whose reading ends after another is none.
  const era = useRef(0);

  const profileOf = useCallback((): Promise<Profile | undefined> | undefined => {
    if (device === undefined || profileId === undefined) return undefined;
    if (database.current?.of !== profileId) {
      const profile = openProfile(device, profileId).catch(() => undefined);
      const opened = { of: profileId, profile };
      database.current = opened;
      // A database that did not open is asked for again by the next write.
      void profile.then((found) => {
        if (found === undefined && database.current === opened) database.current = undefined;
      });
    }
    return database.current.profile;
  }, [device, profileId]);
  const run = useCallback(
    (work: (profile: Profile) => Promise<unknown>) => {
      const profile = profileOf();
      if (profile === undefined) return;
      // A write that fails leaves the history as it was: the page is still in the tab's memory.
      queue.current = queue.current
        .then(async () => {
          const opened = await profile;
          if (opened !== undefined) await work(opened);
        })
        .catch(() => {});
    },
    [profileOf],
  );
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    const changed = [...dirty.current.values()];
    dirty.current.clear();
    for (const task of changed)
      run((profile) => profile.keepPaperWork(task.attemptId, workOf(task)));
  }, [run]);

  // Each task changed since it was written is written a moment later, with whatever came meanwhile.
  useEffect(() => {
    for (const task of held.begun ?? []) {
      if (sameWork(written.current.get(task.taskId), task)) continue;
      written.current.set(task.taskId, task);
      dirty.current.set(task.taskId, task);
    }
    if (dirty.current.size > 0 && timer.current === undefined)
      timer.current = setTimeout(flush, SETTLE_MS);
  }, [held.begun, flush]);
  useEffect(() => {
    const hidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", hidden);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      flush();
    };
  }, [flush]);

  const takePhoto = useCallback(
    (photo: Photo) => {
      flush();
      era.current += 1;
      setHeld((now) => {
        if (now.page?.photo !== photo) release(now.page?.photo);
        return {
          page: {
            pageId: crypto.randomUUID(),
            takenAt: Date.now(),
            photo,
            finding: { status: "finding" },
            tasks: [],
            talk: [],
          },
          begun: undefined,
          solving: false,
        };
      });
    },
    [flush],
  );
  const change = useCallback((photo: Photo, update: (page: PaperPage) => PaperPage) => {
    setHeld((now) => (now.page?.photo === photo ? { ...now, page: update(now.page) } : now));
  }, []);
  const turn = useCallback(
    (photo: Photo, turned: Photo, degrees: number, update: (page: PaperPage) => PaperPage) => {
      setHeld((now) => {
        const upright = uprightPage(now.page, photo, turned, degrees);
        if (upright === undefined) {
          release(turned);
          return now;
        }
        release(photo);
        return { ...now, page: update(upright) };
      });
    },
    [],
  );
  const begin = useCallback(
    (photo: Photo, begun: readonly BegunTask[]) => {
      const page = shown.current.page;
      setHeld((now) =>
        now.page?.photo === photo
          ? { ...now, begun: withBegun(now.begun, begun), solving: true }
          : now,
      );
      if (page?.photo !== photo || begun.length === 0) return;
      // Written with the page, as they are: the work's own writes come after.
      for (const task of begun) written.current.set(task.taskId, task);
      const frames = page.tasks.map(({ id, frame, drawn }) => ({ id, frame, drawn }));
      const { pageId, takenAt } = page;
      const { bytes, width, height } = photo;
      run((profile) =>
        profile.keepPage(
          { pageId, takenAt, frames },
          { bytes, width, height },
          begun.map((task) => ({
            attemptId: task.attemptId,
            taskId: task.taskId,
            frame: task.frame,
            drawn: task.drawn,
            crop: task.crop,
            ...workOf(task),
          })),
        ),
      );
    },
    [run],
  );
  const add = useCallback(() => {
    setHeld((now) => ({ ...now, solving: false }));
  }, []);
  const keep = useCallback((taskId: string, change: (task: BegunTask) => BegunTask) => {
    setHeld((now) =>
      now.begun === undefined ? now : { ...now, begun: changed(now.begun, taskId, change) },
    );
  }, []);
  const renew = useCallback(
    (taskId: string, attemptId: string) => {
      const was = shown.current.begun?.find((task) => task.taskId === taskId);
      if (was === undefined || was.attemptId === attemptId) return;
      // The work waiting to be written goes under the attempt it is kept by, before it moves.
      flush();
      setHeld((now) =>
        now.begun === undefined
          ? now
          : { ...now, begun: changed(now.begun, taskId, (task) => renewed(task, attemptId)) },
      );
      run((profile) => profile.renewPaperTask(was.attemptId, attemptId));
    },
    [flush, run],
  );
  const clear = useCallback(() => {
    flush();
    era.current += 1;
    setHeld((now) => {
      release(now.page?.photo);
      return { page: undefined, begun: undefined, solving: false };
    });
  }, [flush]);
  const open = useCallback(
    async (pageId: string) => {
      flush();
      era.current += 1;
      const asked = era.current;
      const profile = profileOf();
      // After the writes before it, so that it reads the work as it was left.
      await queue.current;
      const kept = await (await profile)?.page(pageId).catch(() => undefined);
      if (kept === undefined) return false;
      // Another page, a new photo or Close came meanwhile: theirs is the screen.
      if (asked !== era.current) return true;
      const { page, photo, tasks } = kept;
      const begun: BegunTask[] = tasks.map((task) => ({
        attemptId: task.attemptId,
        taskId: task.taskId,
        frame: task.frame,
        drawn: task.drawn,
        crop: task.crop,
        history: task.history,
        ...(task.tracing === undefined ? {} : { tracing: task.tracing }),
        sent: task.sent,
        over: task.over,
        ...(task.solved === true ? { solved: true } : {}),
      }));
      for (const task of begun) written.current.set(task.taskId, task);
      const url = URL.createObjectURL(new Blob([photo.bytes.slice()], { type: "image/jpeg" }));
      setHeld((now) => {
        release(now.page?.photo);
        return {
          page: {
            pageId: page.pageId,
            takenAt: page.takenAt,
            photo: { ...photo, url },
            finding: { status: "found" },
            tasks: keptTasks(page.frames, tasks),
            talk: [],
          },
          begun: withBegun(undefined, begun),
          solving: true,
        };
      });
      return true;
    },
    [flush, profileOf],
  );

  const value = useMemo(
    () => ({
      page: held.page,
      begun: held.begun,
      solving: held.solving,
      takePhoto,
      change,
      turn,
      begin,
      add,
      keep,
      renew,
      clear,
      open,
    }),
    [held, takePhoto, change, turn, begin, add, keep, renew, clear, open],
  );
  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

/** The page photographed; none outside a provider, as in a screen's own test. */
export function usePaper(): Paper | undefined {
  return useContext(PaperContext);
}
