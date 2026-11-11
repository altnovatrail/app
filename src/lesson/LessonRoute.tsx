// The screen `#/lesson` (R23 in docs/decisions.md): the lesson run the learner chose, from memory.
// It shows the run until the learner leaves it or chooses another — a run ended stays on the screen
// with its end, while "My subjects" no longer offers to continue it. With no run chosen it goes home in
// place of itself, so that "back" does not come here again.
import type { Mode } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { useCallback, useEffect } from "react";
import { HOME, redirect } from "../app/router.ts";
import { useStorage } from "../boot/Boot.tsx";
import { useAttempt } from "../task/AttemptContext.tsx";
import { Lesson } from "./Lesson.tsx";
import { useLessons } from "./LessonContext.tsx";

export function LessonRoute({
  profileId,
  defaultMode,
  adult,
}: {
  readonly profileId: string;
  readonly defaultMode: Mode;
  /** Whether the learner is of the category `adult`. */
  readonly adult: boolean;
}) {
  const { device } = useStorage();
  const lessons = useLessons();
  const setAttempt = useAttempt()?.setAttempt;
  // The run the learner chose, until they choose another — the engine's next lesson, from the end
  // of this one —, which is a new player.
  const shown = lessons?.chosen;
  // A task of the lesson closes the attempt the learner had open outside it.
  const onAttempt = useCallback(() => setAttempt?.(undefined), [setAttempt]);
  const noop = useCallback(() => {}, []);
  useEffect(() => {
    if (shown === undefined) redirect(HOME);
  }, [shown]);
  if (shown === undefined) return null;
  return (
    <Lesson
      key={shown.kind === "run" ? `run ${shown.run.lessonRunId}` : `choice ${shown.choiceId}`}
      profileId={profileId}
      open={shown}
      device={device}
      defaultMode={defaultMode}
      adult={adult}
      onBegan={lessons?.began ?? noop}
      onEnded={lessons?.ended ?? noop}
      onAttempt={onAttempt}
    />
  );
}
