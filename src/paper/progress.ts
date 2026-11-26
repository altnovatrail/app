// How far a Check of a task from paper still going has got: api's GetCheckProgress, asked a few
// seconds after the work is sent and every few seconds after, while SubmitWork goes. Once the
// Check has gone on to a later model the card says the work is being read more closely, with the
// track of the models: dots for everyone, and the models' names only for an account with the right
// of the debug mode, from the list GetDebug gives, which no other account has.
import type { GetCheckProgressResponse } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { DebugCallKind } from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import * as gate from "../debug/gate.ts";

/** The first question of the progress after the work is sent, ms: a Check its first model does
 * answers before it. */
export const PROGRESS_FIRST_MS = 2000;
/** Each next question after the one before answered, ms. */
export const PROGRESS_EVERY_MS = 2000;

/** A Check gone on to a later model: the place of the model that now reads, from 0, of models. */
export interface Closer {
  readonly model: number;
  readonly models: number;
}

/** What asks api for the progress of the profile's attempt. */
export type AskProgress = (
  request: { readonly profileId: string; readonly attemptId: string },
  options: { readonly timeoutMs: number },
) => Promise<Pick<GetCheckProgressResponse, "going" | "model" | "models">>;

/** The timers it runs by: the window's, or a test's. */
export interface Timers {
  readonly set: (run: () => void, ms: number) => unknown;
  readonly clear: (timer: unknown) => void;
}

const windowTimers: Timers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

/**
 * Asks the progress of the Check on `on()`'s attempt from PROGRESS_FIRST_MS after it is called,
 * and again PROGRESS_EVERY_MS after each answer, one question at a time, and tells `onCloser` each
 * answer of a later model. A failed question is no failure of the Check: the card stays as it was,
 * and the next question asks again. The function it gives stops it: a question under way is let
 * finish, its answer unheard, since one cut short is a cancelled request in api's log.
 */
export function watchProgress(
  ask: AskProgress,
  on: () => { readonly profileId: string; readonly attemptId: string } | undefined,
  onCloser: (closer: Closer) => void,
  timers: Timers = windowTimers,
): () => void {
  let stopped = false;
  let timer: unknown;
  const tick = async () => {
    const request = on();
    if (request !== undefined) {
      try {
        const p = await ask(request, { timeoutMs: PROGRESS_EVERY_MS * 2 });
        if (!stopped && p.going && p.model > 0 && p.model < p.models)
          onCloser({ model: p.model, models: p.models });
      } catch {
        // The next question asks again.
      }
    }
    if (!stopped) timer = timers.set(() => void tick(), PROGRESS_EVERY_MS);
  };
  timer = timers.set(() => void tick(), PROGRESS_FIRST_MS);
  return () => {
    stopped = true;
    timers.clear(timer);
  };
}

/**
 * The names of the models of the Check, in the order they are asked, for an account with the
 * debug mode whose Check goes by the list as admitted, as many as api counts; none otherwise, and
 * the track has dots. On a narrow screen a name drops its version: "Haiku" of "Haiku 5.5".
 */
export async function trackNames(
  models: number,
  narrow: boolean,
): Promise<readonly string[] | undefined> {
  if (gate.snapshot().status !== "on") return undefined;
  const debug = await import("../debug/debug.ts");
  const state = debug.snapshot();
  if (state.status !== "on" || state.first !== undefined) return undefined;
  const names = state.admitted.flatMap((a) =>
    a.kind === DebugCallKind.TASK_CHECKING && a.model !== undefined
      ? [debug.modelName(state.models, a.model.model)]
      : [],
  );
  if (names.length !== models) return undefined;
  return narrow ? names.map((name) => name.replace(/\s+[\d.]+$/, "")) : names;
}
