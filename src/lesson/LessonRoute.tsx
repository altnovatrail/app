// The screen `#/lesson`: the lesson run the learner chose, from memory. It shows the run
// until the learner leaves it or chooses another — a run ended stays on the screen with its end,
// while Home no longer offers to continue it. With no run chosen it goes home in place of
// itself, so that "back" does not come here again.
import { useCallback, useEffect } from "react";
import { HOME, redirect } from "../app/router.ts";
import { useStorage } from "../boot/Boot.tsx";
import { Lesson } from "./Lesson.tsx";
import { useLessons } from "./LessonContext.tsx";

export function LessonRoute({ profileId }: { readonly profileId: string }) {
  const { device } = useStorage();
  const lessons = useLessons();
  // The run the learner chose, until they choose another — the module's next lesson, from the end
  // of this one —, which is a new player.
  const shown = lessons?.chosen;
  const noop = useCallback(() => {}, []);
  useEffect(() => {
    if (shown === undefined) redirect(HOME);
  }, [shown]);
  if (shown === undefined) return null;
  return (
    <Lesson
      key={
        shown.kind === "run"
          ? `run ${shown.run.lessonRunId}`
          : shown.kind === "choice"
            ? `choice ${shown.choiceId}`
            : `lesson ${shown.lesson}`
      }
      profileId={profileId}
      open={shown}
      device={device}
      onBegan={lessons?.began ?? noop}
      onEnded={lessons?.ended ?? noop}
    />
  );
}
