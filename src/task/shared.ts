// What the screen of an attempt shares, a task with a verdict and an essay alike (R20, R53): why an
// attempt is over, in words, by its close reason; the close reason a refusal `CAUSE_ATTEMPT_CLOSED`
// tells; the techniques a solving step asks api for once, in the mode "by steps" (R05); the voicing
// of the screen; and the work the device keeps of the attempt.
import { Cause, CloseReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { CanvasElement, HistoryChangeEvent } from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import type { Api } from "../api/client.ts";
import { type Failure, parseFailure } from "../api/failure.ts";
import type { Profile } from "../storage/profile.ts";
import type { Phrase } from "../voice/texts.ts";
import { useVoicing } from "../voice/VoicingContext.tsx";
import type { StepsState } from "./steps.ts";

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

/** A failure to show, or none when api closed the attempt: `close` then ends the screen. */
export function unlessClosed(
  reason: unknown,
  close: (reason: CloseReason) => void,
): Failure | undefined {
  const found = parseFailure(reason);
  const by = closedBy(found);
  if (by === undefined) return found;
  close(by);
  return undefined;
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

/**
 * The attempt's work on the device: the canvas's `filled`, read after its task and each change; the
 * step state and the history written, the whole history again when events were missed; and whether
 * a write did not reach the database. Once the attempt is over, `over`, nothing more is written.
 */
export function useKeptWork({
  profile,
  attemptId,
  unsaved,
  task,
  element,
  over,
}: {
  readonly profile: Profile | undefined;
  readonly attemptId: string;
  /** The attempt's start was not written. */
  readonly unsaved: boolean;
  readonly task: open.Task;
  readonly element: RefObject<CanvasElement | null>;
  readonly over: RefObject<boolean>;
}) {
  const [filled, setFilled] = useState<readonly (readonly boolean[])[] | null>(null);
  const [notSaved, setNotSaved] = useState(unsaved);
  // How many changes the sheet has had: a stroke during an export makes the work exported older.
  const drawn = useRef(0);
  // `filled` changes with no event when the task and the history are given: read it after them.
  // biome-ignore lint/correctness/useExhaustiveDependencies: read once the element has its task.
  useEffect(() => {
    setFilled(element.current?.filled ?? null);
  }, [task]);
  const keepSteps = useCallback(
    (next: StepsState) => {
      if (over.current) return;
      if (profile === undefined) setNotSaved(true);
      void profile?.saveSteps(attemptId, next).then((saved) => {
        if (saved === "unsaved") setNotSaved(true);
      });
    },
    [profile, attemptId, over],
  );
  const keepHistory = useCallback(
    (event: HistoryChangeEvent) => {
      setFilled(element.current?.filled ?? null);
      drawn.current += 1;
      if (profile === undefined || over.current) return;
      void profile.appendHistory(attemptId, event.detail).then(async (saved) => {
        // Events were missed: the element's whole history takes the place of what was kept.
        const result =
          saved === "missed"
            ? await profile.replaceHistory(attemptId, element.current?.history ?? [])
            : saved;
        if (result === "unsaved") setNotSaved(true);
      });
    },
    [profile, attemptId, element, over],
  );
  const unsavedNow = useCallback(() => setNotSaved(true), []);
  return { filled, notSaved, unsavedNow, drawn, keepSteps, keepHistory };
}
