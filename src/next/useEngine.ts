// The way to what the engine chooses, for every screen that asks it (LearningService
// in the contract): `choose` asks `ChooseNext` — with a module, among its tasks alone on its task
// skill, Solve on its card, or with none, among all the modules — and `act` goes
// to what a choice gives: a lesson opens in the player by `OpenLesson`, a task begins by
// `BeginAttempt` on the task screen, and nothing stays with the screen. Both `ChooseNext` and the
// beginning of a task close the attempt open outside a lesson for good, and once closed its work on
// the device goes: the screen asks first. Each action has one idempotency key, the same with its
// repeats, and only a refusal ends it; a module other than the one asked for last is another
// action, with a key of its own. On the owner's own key both name its provider, so that api chooses by the
// key's route and not by platform AI's quota (the contract).
import { Cause, type EngineChoice } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { Code } from "@connectrpc/connect";
import { useCallback, useRef } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { ApiError, parseFailure } from "../api/failure.ts";
import { idempotencyKey } from "../api/keys.ts";
import { LESSON, navigate, TASK } from "../app/router.ts";
import { useLessons } from "../lesson/LessonContext.tsx";
import { useKeyHolder } from "../ownkey/OwnKeyContext.tsx";
import type { Device } from "../storage/device.ts";
import { attemptOver } from "../storage/profile.ts";
import { useAttempt } from "../task/AttemptContext.tsx";
import { useWorks } from "../works/useWorks.ts";
import { givenOf } from "./choice.ts";

export interface Engine {
  /**
   * Asks the engine's choice, among the tasks of a module or among all the modules — "" —, closing
   * the attempt `leaving`, which was open when the learner asked; the choice, or none when api gave
   * none.
   */
  readonly choose: (
    moduleId: string,
    leaving: string | undefined,
  ) => Promise<EngineChoice | undefined>;
  /** Goes to what a choice gives, closing the attempt `leaving` once a task of it has begun. */
  readonly act: (given: EngineChoice, leaving: string | undefined) => Promise<void>;
}

export function useEngine(profileId: string, device: Device | undefined): Engine {
  const api = useApi();
  const holder = useKeyHolder();
  const lessons = useLessons();
  const setAttempt = useAttempt()?.setAttempt;
  const works = useWorks(profileId);
  // One key for the choice in a module, or in all, and one for the beginning of a task chosen.
  const chooseKey = useRef<{ readonly moduleId: string; readonly key: string } | undefined>(
    undefined,
  );
  const beginKey = useRef<string | undefined>(undefined);

  /**
   * The attempt open outside a lesson, which api has closed: its work goes to the server while the
   * storage is on, then off the device, and it is open no more.
   */
  const left = useCallback(
    async (attemptId: string | undefined) => {
      if (attemptId === undefined) return;
      if (device !== undefined) await attemptOver(device, profileId, attemptId, { works });
      setAttempt?.(undefined);
    },
    [device, profileId, setAttempt, works],
  );

  const choose = useCallback(
    async (moduleId: string, leaving: string | undefined) => {
      if (chooseKey.current?.moduleId !== moduleId) {
        chooseKey.current = { moduleId, key: idempotencyKey() };
      }
      let answer: Awaited<ReturnType<typeof api.learning.chooseNext>>;
      try {
        answer = await api.learning.chooseNext({
          profileId,
          idempotencyKey: chooseKey.current.key,
          moduleId,
          ...holder.routeFields(profileId),
        });
      } catch (reason) {
        if (parseFailure(reason).kind === "refused") chooseKey.current = undefined;
        throw reason;
      }
      chooseKey.current = undefined;
      await left(leaving);
      return answer.choice;
    },
    [api, holder, profileId, left],
  );

  /** A task chosen begins; one begun already by this choice is the profile's open attempt. */
  const begin = useCallback(
    async (choiceId: string, leaving: string | undefined) => {
      beginKey.current ??= idempotencyKey();
      let attemptId: string | undefined;
      try {
        const answer = await api.learning.beginAttempt({
          profileId,
          idempotencyKey: beginKey.current,
          start: { case: "choiceId", value: choiceId },
          ...holder.routeFields(profileId),
        });
        beginKey.current = undefined;
        attemptId = answer.attempt?.attemptId;
      } catch (reason) {
        const found = parseFailure(reason);
        if (found.kind === "refused") beginKey.current = undefined;
        if (found.kind !== "refused" || found.cause !== Cause.ALREADY_EXISTS) throw reason;
        const account = (await api.account.getAccount({})).account;
        const held = account?.profiles.find((each) => each.profileId === profileId)?.openAttempt;
        if (held === undefined || held.segment !== undefined) throw reason;
        setAttempt?.(held.attemptId);
        navigate(TASK);
        return;
      }
      if (attemptId === undefined || attemptId === "") {
        throw new ApiError({ kind: "unknown", code: Code.Internal });
      }
      if (leaving !== attemptId) await left(leaving);
      setAttempt?.(attemptId);
      navigate(TASK);
    },
    [api, holder, profileId, setAttempt, left],
  );

  const act = useCallback(
    async (given: EngineChoice, leaving: string | undefined) => {
      const what = givenOf(given);
      if (what === "lesson") {
        lessons?.choose({ kind: "choice", choiceId: given.choiceId });
        navigate(LESSON);
      } else if (what === "task") await begin(given.choiceId, leaving);
    },
    [lessons, begin],
  );

  return { choose, act };
}
