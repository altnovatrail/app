// What comes at the end of a lesson run, in its module: the next lesson, by `ListLessons` — of
// the module's lessons, the one its tile names, else the first in the author's order, other than
// the lesson that ended and not passed —, which opens in the player; and Solve, the module's tasks:
// the task of the choice the end gave, or else `ChooseNext` among the module's tasks. With no
// lesson left, Solve alone; while the lessons come, the shape of the button. A module unknown — a
// run opened by an engine's choice whose lesson the device could not name — has the engine's way
// alone, "What's next".
import type { EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  LessonState,
  type ListLessonsResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/learning_pb.js";
import { useEffect, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure } from "../api/failure.ts";
import { outcomeOf } from "../api/outcome.ts";
import { failureText, outcomeText } from "../api/words.ts";
import { LESSON, navigate } from "../app/router.ts";
import { Loading, Sk } from "../app/Skeleton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { givenOf } from "../next/choice.ts";
import { NextStep } from "../next/NextStep.tsx";
import { useEngine } from "../next/useEngine.ts";
import type { Device } from "../storage/device.ts";
import { type LessonOpen, useLessons } from "./LessonContext.tsx";

/** The lesson after `ended`, of what `ListLessons` gave: none when every other one is passed. */
export function nextLessonOf(answer: ListLessonsResponse, ended: string): string | undefined {
  const tile = answer.lessons.filter((each) => each.lesson === answer.tileLesson);
  return [...tile, ...answer.lessons].find(
    (each) => each.lesson !== ended && each.state !== LessonState.PASSED,
  )?.lesson;
}

export interface LessonNextProps {
  readonly profileId: string;
  readonly device?: Device;
  /** The module of the lesson that ended; none when it is not known. */
  readonly moduleId: string | undefined;
  /** The full ID of the lesson that ended, which is not offered again. */
  readonly lesson: string | undefined;
  /** The engine's choice the end gave: a task of the module. */
  readonly choice?: EngineChoice | undefined;
}

type Read =
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly next: string | undefined };

export function LessonNext({ profileId, device, moduleId, lesson, choice }: LessonNextProps) {
  const api = useApi();
  const lessons = useLessons();
  const { words } = useLanguage();
  const { choose, act } = useEngine(profileId, device);
  const [read, setRead] = useState<Read>({ status: "loading" });
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<Failure | undefined>(undefined);
  const [nothing, setNothing] = useState<EngineChoice | undefined>(undefined);

  useEffect(() => {
    if (moduleId === undefined) return;
    let current = true;
    api.learning.listLessons({ profileId, moduleId }).then(
      (answer) => {
        if (current) setRead({ status: "done", next: nextLessonOf(answer, lesson ?? "") });
      },
      () => {
        // The lessons did not come: Solve stands alone, and Home leads to them.
        if (current) setRead({ status: "done", next: undefined });
      },
    );
    return () => {
      current = false;
    };
  }, [api, profileId, moduleId, lesson]);

  if (moduleId === undefined) {
    return (
      <NextStep
        profileId={profileId}
        {...(device === undefined ? {} : { device })}
        {...(choice === undefined ? {} : { choice })}
      />
    );
  }

  const open = (next: string) => {
    const run = lessons?.runs.find((each) => each.lesson === next);
    const chosen: LessonOpen =
      run === undefined ? { kind: "lesson", lesson: next } : { kind: "run", run };
    lessons?.choose(chosen);
    navigate(LESSON);
  };

  const solve = () => {
    if (pending) return;
    setPending(true);
    setFailure(undefined);
    setNothing(undefined);
    void (async () => {
      try {
        const given =
          choice !== undefined && givenOf(choice) === "task"
            ? choice
            : await choose(moduleId, undefined);
        if (given === undefined) return;
        if (givenOf(given) === "nothing") setNothing(given);
        else await act(given, undefined);
      } catch (reason) {
        setFailure(parseFailure(reason));
      }
    })().finally(() => setPending(false));
  };

  const next = read.status === "done" ? read.next : undefined;
  const outcome = nothing === undefined ? undefined : outcomeOf(nothing.outcome);
  return (
    <div className="nt-next">
      {/* The strings have no full stop of their own: two in one line are two sentences. */}
      <p role="status" className="nt-hint">
        {[
          nothing === undefined ? "" : words.text("next.nothing"),
          outcome ? outcomeText(outcome, words) : "",
        ]
          .filter((sentence) => sentence !== "")
          .join(". ")}
      </p>
      {failure === undefined ? null : (
        <p role="alert" className="nt-error">
          {failureText(failure, words)}
        </p>
      )}
      <div className="nt-buttons">
        {read.status === "loading" ? (
          <Loading>
            <Sk width="9rem" height="2.75rem" radius="999px" />
          </Loading>
        ) : next === undefined ? null : (
          <button type="button" onClick={() => open(next)}>
            {words.text("next.lesson")}
          </button>
        )}
        {/* Not disabled while it is under way: a disabled button would drop the focus. */}
        <button
          type="button"
          {...(next === undefined && read.status === "done" ? {} : { className: "nt-secondary" })}
          aria-disabled={pending}
          onClick={solve}
        >
          {words.text("home.solve")}
        </button>
      </div>
    </div>
  );
}
