// The screen `#/task` (R14 in docs/decisions.md): the attempt the learner has open, from memory. It
// shows the attempt it opened on until the learner leaves it — an attempt ended stays on the screen
// with its result, while "My subjects" no longer offers to continue it — and a new one once "Try it
// again" has begun it. With no attempt open it goes home in place of itself, so that "back" does not
// come here again.
import type { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useCallback, useEffect, useState } from "react";
import { HOME, redirect } from "../app/router.ts";
import { useStorage } from "../boot/Boot.tsx";
import { useAttempt } from "./AttemptContext.tsx";
import { Task } from "./Task.tsx";

export function TaskRoute({
  profileId,
  defaultMode,
}: {
  readonly profileId: string;
  readonly defaultMode: Mode;
}) {
  const { device } = useStorage();
  const held = useAttempt();
  const [shown, setShown] = useState(held?.attemptId);
  const setAttempt = held?.setAttempt;
  const onAttempt = useCallback(
    (attemptId: string | undefined) => {
      setAttempt?.(attemptId);
      if (attemptId !== undefined) setShown(attemptId);
    },
    [setAttempt],
  );
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
      device={device}
      onAttempt={onAttempt}
    />
  );
}
