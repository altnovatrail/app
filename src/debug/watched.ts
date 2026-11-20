// Each call of AI the screens of a task from paper make, as the debug mode of a local run sees it
// (R72). Under import.meta.env.DEV alone, which a release's build replaces with false, so that the
// branch and the module it loads drop out of it.
import type { Api } from "../api/client.ts";

/**
 * A Check as the debug mode keeps it for its export: what it sent, and the verdict of each task of
 * its answer, in the frame's order.
 */
export interface Check<T> {
  readonly attemptId: string;
  readonly statement: Uint8Array;
  readonly crop: Uint8Array;
  readonly verdicts: (answer: T) => readonly (string | undefined)[];
}

/**
 * A call of a task from paper: the debug mode shows it under way, and takes what its calls of AI
 * returned once it ends, however it ends, for a Check what it sent, and for a finding the learner's
 * request, which api keeps nowhere. A release's build makes the call alone.
 */
export async function watched<T>(
  api: Api,
  call: () => Promise<T>,
  check?: Check<T>,
  request?: string,
): Promise<T> {
  if (!import.meta.env.DEV || api.debug === undefined) return call();
  const debug = await import("./debug.ts");
  // The first call may come before the window asked api, or after its asking failed.
  void debug.load(api.debug);
  debug.began();
  let answer: { readonly value: T } | undefined;
  try {
    answer = { value: await call() };
    return answer.value;
  } finally {
    const sent =
      check === undefined
        ? undefined
        : {
            attemptId: check.attemptId,
            statement: check.statement,
            crop: check.crop,
            outcomes: (answer === undefined ? [] : check.verdicts(answer.value)).map(
              debug.outcomeOf,
            ),
          };
    void debug.take(api.debug, sent, request);
  }
}
