// What the screen of an attempt shares, a task with a verdict and an essay alike (section 3.3 of
// docs/architecture.md; R20, R53 in docs/decisions.md): why an attempt is over, in words, by its
// close reason; the close reason a refusal `CAUSE_ATTEMPT_CLOSED` tells; and the techniques a
// solving step asks api for once, in the mode "by steps" (R05).
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { useEffect, useRef } from "react";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";

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
 * A step that gives techniques asks api for them once, while `want` holds of its place, and the
 * screen keeps what api gave; a closed attempt says so, and any other failure asks again when the
 * learner comes back to the step.
 */
export function useStepTechniques({
  api,
  profileId,
  attemptId,
  want,
  place,
  onTechniques,
  onClosed,
}: {
  readonly api: Api;
  readonly profileId: string;
  readonly attemptId: string;
  readonly want: boolean;
  readonly place: number;
  readonly onTechniques: (place: number, techniqueIds: readonly string[]) => void;
  readonly onClosed: (reason: CloseReason) => void;
}): void {
  const asked = useRef(new Set<number>());
  useEffect(() => {
    if (!want || asked.current.has(place)) return;
    asked.current.add(place);
    void api.attempt.beginStep({ profileId, attemptId, step: place }).then(
      (answer) => onTechniques(place, answer.techniques?.techniqueIds ?? []),
      (reason: unknown) => {
        const closed = closedBy(parseFailure(reason));
        if (closed !== undefined) onClosed(closed);
        else asked.current.delete(place);
      },
    );
  }, [want, place, api, profileId, attemptId, onTechniques, onClosed]);
}
