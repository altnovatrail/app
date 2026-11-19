// The page the learner photographed, in the tab's memory alone (R71): the photo, the tasks found on
// it and those drawn, what finding them came to, and once Start has begun them the attempts and the
// crops. The address names none of them (R14): `#/paper` takes them from here, and they go with the
// learner chosen, on a new photo, or at a reload. Each photo replaced has its URLs revoked.
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Failure } from "../api/failure.ts";
import type { ReadOutcome } from "../api/outcome.ts";
import { type Photo, release } from "./capture.ts";
import type { Frame } from "./frame.ts";
import type { PageTask } from "./page.ts";

/** What finding the tasks came to. */
export type Finding =
  /** `FindTasks` is under way. */
  | { readonly status: "finding" }
  /** It gave frames, or none: the learner frames the tasks by hand either way. */
  | { readonly status: "found" }
  /** A call of AI gave no frames: its outcome. */
  | { readonly status: "outcome"; readonly outcome: ReadOutcome }
  /** It did not answer: a refusal or no connection. */
  | { readonly status: "failed"; readonly failure: Failure };

export interface PaperPage {
  readonly photo: Photo;
  readonly finding: Finding;
  readonly tasks: readonly PageTask[];
}

/** A task begun: its attempt, its frame, and its crop. */
export interface BegunTask {
  readonly attemptId: string;
  readonly frame: Frame;
  readonly crop: Blob;
}

export interface Paper {
  /** The page photographed, if any. */
  readonly page: PaperPage | undefined;
  /** The tasks Start began on it, in the order of the page. */
  readonly begun: readonly BegunTask[] | undefined;
  /** A new photo, finding its tasks: the former page goes, and its tasks begun. */
  readonly takePhoto: (photo: Photo) => void;
  /** A change to the page of this photo; none once another has taken its place. */
  readonly change: (photo: Photo, update: (page: PaperPage) => PaperPage) => void;
  readonly begin: (photo: Photo, begun: readonly BegunTask[]) => void;
  /** The page and its tasks forgotten: Close, or Retake. */
  readonly clear: () => void;
}

const PaperContext = createContext<Paper | undefined>(undefined);

export function PaperProvider({ children }: { readonly children: ReactNode }) {
  const [held, setHeld] = useState<{
    readonly page: PaperPage | undefined;
    readonly begun: readonly BegunTask[] | undefined;
  }>({ page: undefined, begun: undefined });

  const takePhoto = useCallback((photo: Photo) => {
    setHeld((now) => {
      if (now.page?.photo !== photo) release(now.page?.photo);
      return { page: { photo, finding: { status: "finding" }, tasks: [] }, begun: undefined };
    });
  }, []);
  const change = useCallback((photo: Photo, update: (page: PaperPage) => PaperPage) => {
    setHeld((now) => (now.page?.photo === photo ? { ...now, page: update(now.page) } : now));
  }, []);
  const begin = useCallback((photo: Photo, begun: readonly BegunTask[]) => {
    setHeld((now) => (now.page?.photo === photo ? { ...now, begun } : now));
  }, []);
  const clear = useCallback(() => {
    setHeld((now) => {
      release(now.page?.photo);
      return { page: undefined, begun: undefined };
    });
  }, []);

  const value = useMemo(
    () => ({ page: held.page, begun: held.begun, takePhoto, change, begin, clear }),
    [held, takePhoto, change, begin, clear],
  );
  return <PaperContext.Provider value={value}>{children}</PaperContext.Provider>;
}

/** The page photographed; none outside a provider, as in a screen's own test. */
export function usePaper(): Paper | undefined {
  return useContext(PaperContext);
}
