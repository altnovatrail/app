// The attempt the learner chosen has open, in memory alone (section 3.3 of docs/architecture.md; R14
// in docs/decisions.md): no address names an attempt, so the task screen `#/task` takes it from
// here. It starts as the open attempt `GetAccount` named — one outside a lesson: a lesson's is the
// lesson player's (T27) — and changes when an attempt begins or ends on this screen. What changed
// is kept by the learner's profile as GetAccount gave it, so that switching the learner and back
// does not bring an ended attempt back; a new GetAccount gives a new profile, and its own word.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";

export interface CurrentAttempt {
  /** The open attempt's ID; none when the learner has none open. */
  readonly attemptId: string | undefined;
  readonly setAttempt: (attemptId: string | undefined) => void;
}

const AttemptContext = createContext<CurrentAttempt | undefined>(undefined);

/** What this tab learnt of each profile's open attempt since GetAccount gave it. */
const learnt = new WeakMap<Profile, { readonly attemptId: string | undefined }>();

/** The open attempt GetAccount named outside a lesson, or what this tab learnt since. */
function openAttemptOf(learner: Profile): string | undefined {
  const held = learnt.get(learner);
  if (held !== undefined) return held.attemptId;
  return learner.openAttempt?.segment === undefined ? learner.openAttempt?.attemptId : undefined;
}

export function AttemptProvider({
  learner,
  children,
}: {
  readonly learner: Profile;
  readonly children: ReactNode;
}) {
  const [attemptId, setHeld] = useState(() => openAttemptOf(learner));
  const setAttempt = useCallback(
    (next: string | undefined) => {
      learnt.set(learner, { attemptId: next });
      setHeld(next);
    },
    [learner],
  );
  const value = useMemo(() => ({ attemptId, setAttempt }), [attemptId, setAttempt]);
  return <AttemptContext.Provider value={value}>{children}</AttemptContext.Provider>;
}

/** The open attempt; none outside a provider, as in a screen's own test. */
export function useAttempt(): CurrentAttempt | undefined {
  return useContext(AttemptContext);
}
