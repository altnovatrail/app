// The page the learner photographed, in the tab's memory alone (R71): the photo, the tasks found on
// it and those drawn, what finding them came to, and once Start has begun them the attempts, the
// crops and the work on each, and whether the screen of solving is shown or the page, by "Add". The
// address names none of them (R14): `#/paper` takes them from here, and they go with the learner
// chosen, on a new photo, or at a reload. So does the conversation with the tutor about the page, the
// learner's requests among it (R74). Each photo replaced has its URLs revoked.
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Failure } from "../api/failure.ts";
import type { ReadOutcome } from "../api/outcome.ts";
import { type Photo, release } from "./capture.ts";
import type { PageTask } from "./page.ts";
import { type BegunTask, changed, withBegun } from "./solve.ts";

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
  | { readonly kind: "request"; readonly text: string }
  /** The request gave this many frames, which took the place of those found. */
  | { readonly kind: "found"; readonly count: number }
  /** It gave none: the frames stay. */
  | { readonly kind: "none" }
  /** Undo put the frames before it back. */
  | { readonly kind: "undone" };

export interface PaperPage {
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
  /** Tasks begun on the page of this photo, beside those begun before, or none: solving goes on. */
  readonly begin: (photo: Photo, begun: readonly BegunTask[]) => void;
  /** "Add": the page again, to pick more of its tasks; the tasks begun stay. */
  readonly add: () => void;
  /** A task begun, changed: its history, or its tracing paper's place. */
  readonly keep: (attemptId: string, change: (task: BegunTask) => BegunTask) => void;
  /** The page and its tasks forgotten: Close, or Retake. */
  readonly clear: () => void;
}

const PaperContext = createContext<Paper | undefined>(undefined);

export function PaperProvider({ children }: { readonly children: ReactNode }) {
  const [held, setHeld] = useState<{
    readonly page: PaperPage | undefined;
    readonly begun: readonly BegunTask[] | undefined;
    readonly solving: boolean;
  }>({ page: undefined, begun: undefined, solving: false });

  const takePhoto = useCallback((photo: Photo) => {
    setHeld((now) => {
      if (now.page?.photo !== photo) release(now.page?.photo);
      return {
        page: { photo, finding: { status: "finding" }, tasks: [], talk: [] },
        begun: undefined,
        solving: false,
      };
    });
  }, []);
  const change = useCallback((photo: Photo, update: (page: PaperPage) => PaperPage) => {
    setHeld((now) => (now.page?.photo === photo ? { ...now, page: update(now.page) } : now));
  }, []);
  const begin = useCallback((photo: Photo, begun: readonly BegunTask[]) => {
    setHeld((now) =>
      now.page?.photo === photo
        ? { ...now, begun: withBegun(now.begun, begun), solving: true }
        : now,
    );
  }, []);
  const add = useCallback(() => {
    setHeld((now) => ({ ...now, solving: false }));
  }, []);
  const keep = useCallback((attemptId: string, change: (task: BegunTask) => BegunTask) => {
    setHeld((now) =>
      now.begun === undefined ? now : { ...now, begun: changed(now.begun, attemptId, change) },
    );
  }, []);
  const clear = useCallback(() => {
    setHeld((now) => {
      release(now.page?.photo);
      return { page: undefined, begun: undefined, solving: false };
    });
  }, []);

  const value = useMemo(
    () => ({
      page: held.page,
      begun: held.begun,
      solving: held.solving,
      takePhoto,
      change,
      begin,
      add,
      keep,
      clear,
    }),
    [held, takePhoto, change, begin, add, keep, clear],
  );
  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

/** The page photographed; none outside a provider, as in a screen's own test. */
export function usePaper(): Paper | undefined {
  return useContext(PaperContext);
}
