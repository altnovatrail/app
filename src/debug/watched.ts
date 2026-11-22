// Each call of AI the screens of a task from paper make, as the debug mode sees it (R72): only for
// an account whose `GetDebug` answered, which alone loads the module of the mode.
import type { Api } from "../api/client.ts";
import * as gate from "./gate.ts";

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
 * request, which api keeps nowhere. Without the mode, the call alone.
 */
export async function watched<T>(
  api: Api,
  call: () => Promise<T>,
  check?: Check<T>,
  request?: string,
): Promise<T> {
  // The first call may come before the slot asked GetDebug — the photo is sent as the page with the
  // slot opens —, so it asks, or joins the asking, before the call: once an account.
  if (gate.snapshot().status !== "on") await gate.ask(api.debug);
  if (gate.snapshot().status !== "on") return call();
  const debug = await import("./debug.ts");
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
