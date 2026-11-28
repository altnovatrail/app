// What the screens of an attempt share: why an attempt is over, in words, by its close reason; the
// close reason a refusal `CAUSE_ATTEMPT_CLOSED` tells; and the voicing of the screen.
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useCallback, useEffect, useRef } from "react";
import type { Failure } from "../api/failure.ts";
import type { Phrase } from "../voice/texts.ts";
import { useVoicing } from "../voice/VoicingContext.tsx";

/** Why an attempt is over, in words, by its close reason. */
export const CLOSED_KEYS = {
  [CloseReason.CORRECT]: "task.closed-correct",
  [CloseReason.SOLUTION_SHOWN]: "task.closed-solution-shown",
  [CloseReason.LEFT]: "task.closed-left",
  [CloseReason.ABANDONED]: "task.closed-abandoned",
  [CloseReason.UNCHECKED]: "task.unchecked",
  [CloseReason.NOT_SUITABLE]: "task.closed-not-suitable",
  [CloseReason.DONE]: "task.closed-done",
} as const;

/** The close reason a refusal `CAUSE_ATTEMPT_CLOSED` tells, if it is one. */
export function closedBy(failure: Failure): CloseReason | undefined {
  if (failure.kind !== "refused" || failure.cause !== Cause.ATTEMPT_CLOSED) return undefined;
  return failure.data.case === "closeReason" ? failure.data.value : CloseReason.UNSPECIFIED;
}

/**
 * What a screen says by itself is its own: words that come once the learner has left are not said
 * over the next screen, and leaving the screen stops what it was saying — a segment of a lesson
 * goes with no change of the route. `hush` stops it while the screen stays: another task on it, or
 * the tutor's panel closed.
 */
export function useOwnVoicing() {
  const { auto: say, prime, speech } = useVoicing();
  const mounted = useRef(true);
  const spoken = useRef<object | undefined>(undefined);
  const auto = useCallback(
    (phrases: readonly Phrase[], after?: object) => {
      if (!mounted.current) return undefined;
      const token = say(phrases, after);
      if (token !== undefined) spoken.current = token;
      return token;
    },
    [say],
  );
  const hush = useCallback(() => {
    if (spoken.current !== undefined && speech.speaking() === spoken.current) speech.stop();
  }, [speech]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      hush();
    };
  }, [hush]);
  return { auto, prime, hush };
}
