// The screen `#/task`: the attempt the learner has open, from memory. It shows the last
// attempt open until the learner leaves it — an attempt ended stays on the screen with its result,
// while Home no longer offers to continue it — and a new one once "Try it again" or the
// engine's next task has begun it; one begun anew on the sheet of a module's task stays on that
// sheet. A task of a module is solved on the sheet of a task from paper. With no attempt open it
// goes home in place of itself, so that "back" does not come here again.
import type { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useCallback, useEffect, useRef, useState } from "react";
import { HOME, redirect } from "../app/router.ts";
import { useStorage } from "../boot/Boot.tsx";
import { useAttempt } from "./AttemptContext.tsx";
import { Task } from "./Task.tsx";

export function TaskRoute({
  profileId,
  defaultMode,
  adult,
}: {
  readonly profileId: string;
  readonly defaultMode: Mode;
  /** Whether the learner is of the category `adult`: the solution is theirs to ask from the start. */
  readonly adult: boolean;
}) {
  const { device } = useStorage();
  const held = useAttempt();
  const [shown, setShown] = useState(held?.attemptId);
  const setAttempt = held?.setAttempt;
  // The attempt a sheet began anew in its place: the sheet goes on with it.
  const inPlace = useRef<string | undefined>(undefined);
  const onAttempt = useCallback(
    (attemptId: string | undefined, here?: true) => {
      if (here === true) inPlace.current = attemptId;
      setAttempt?.(attemptId);
    },
    [setAttempt],
  );
  // The attempt shown is the last one open: one begun on this screen takes the place of the one
  // that ended, which stays while none is.
  const open = held?.attemptId;
  useEffect(() => {
    if (open !== undefined && open !== inPlace.current) setShown(open);
  }, [open]);
  useEffect(() => {
    if (shown === undefined) redirect(HOME);
  }, [shown]);
  if (shown === undefined) return null;
  return (
    <Task
      key={shown}
      profileId={profileId}
      attemptId={shown}
      defaultMode={defaultMode}
      adult={adult}
      device={device}
      onAttempt={onAttempt}
      sheet
    />
  );
}
