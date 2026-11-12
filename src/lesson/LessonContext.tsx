// The lessons the learner chosen has open, and the one the player shows, in memory alone (section
// 3.4 of docs/architecture.md; R23 in docs/decisions.md): no address names a lesson run, so the
// player `#/lesson` takes it from here. The runs start as `open_lesson_runs` of GetAccount — one at
// most for each lesson — and change when a run begins or ends in the player. What changed is kept by
// the learner's profile as GetAccount gave it, as the open attempt is (AttemptContext.tsx), so that
// switching the learner and back does not bring an ended run back.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { asGiven } from "../account/settings.ts";

/** An open lesson run, as `LessonRunRef` names it. */
export interface RunRef {
  readonly lessonRunId: string;
  /** The lesson's full ID, "novatrail/olympiad-math/lesson/counting-gaps-1". */
  readonly lesson: string;
  readonly packageDigest: string;
}

/** What the player opens: an open run again, or a new one by an engine's choice of a lesson (T28). */
export type LessonOpen =
  | { readonly kind: "run"; readonly run: RunRef }
  | { readonly kind: "choice"; readonly choiceId: string };

export interface Lessons {
  /** The learner's open lesson runs. */
  readonly runs: readonly RunRef[];
  /** What the player shows; none until the learner chose. */
  readonly chosen: LessonOpen | undefined;
  readonly choose: (open: LessonOpen) => void;
  /** api gave a run: it is open, once in the list. */
  readonly began: (run: RunRef) => void;
  /** A run ended: it leaves the list. */
  readonly ended: (lessonRunId: string) => void;
}

const LessonContext = createContext<Lessons | undefined>(undefined);

/** What this tab learnt of each profile's open runs since GetAccount gave them. */
const learnt = new WeakMap<Profile, readonly RunRef[]>();

function runsOf(learner: Profile): readonly RunRef[] {
  return (
    learnt.get(asGiven(learner)) ??
    learner.openLessonRuns.map(({ lessonRunId, lesson, packageDigest }) => ({
      lessonRunId,
      lesson,
      packageDigest,
    }))
  );
}

export function LessonProvider({
  learner,
  children,
}: {
  readonly learner: Profile;
  readonly children: ReactNode;
}) {
  const [runs, setRuns] = useState(() => runsOf(learner));
  const [chosen, setChosen] = useState<LessonOpen | undefined>(undefined);
  const change = useCallback(
    (next: (held: readonly RunRef[]) => readonly RunRef[]) => {
      setRuns((held) => {
        const made = next(held);
        learnt.set(asGiven(learner), made);
        return made;
      });
    },
    [learner],
  );
  const began = useCallback(
    (run: RunRef) =>
      change((held) => [
        // One run at most for each lesson: a new one takes the place of the one before.
        ...held.filter(
          (each) =>
            each.lessonRunId !== run.lessonRunId &&
            (run.lesson === "" || each.lesson !== run.lesson),
        ),
        run,
      ]),
    [change],
  );
  const ended = useCallback(
    (lessonRunId: string) =>
      change((held) => held.filter((run) => run.lessonRunId !== lessonRunId)),
    [change],
  );
  const value = useMemo(
    () => ({ runs, chosen, choose: setChosen, began, ended }),
    [runs, chosen, began, ended],
  );
  return <LessonContext.Provider value={value}>{children}</LessonContext.Provider>;
}

/** The learner's lessons; none outside a provider, as in a screen's own test. */
export function useLessons(): Lessons | undefined {
  return useContext(LessonContext);
}
