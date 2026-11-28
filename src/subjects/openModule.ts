// The module of the attempt open outside a lesson, by which Solve on its card on Home goes on with
// it: the module's ID from its package's manifest, by `GetOpenAttempt`, which only reads. A task
// from paper, which that call refuses, since only the device that holds its page goes on with it,
// has none, nor has an attempt whose manifest did not come. No DOM.
import { Code, ConnectError } from "@connectrpc/connect";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";

/** The module of the attempt open; refuses as `GetOpenAttempt` does, but for a task from paper. */
export async function openModuleOf(
  api: Api,
  views: OpenViews,
  profileId: string,
  attemptId: string,
): Promise<string | undefined> {
  let attempt: Awaited<ReturnType<Api["learning"]["getOpenAttempt"]>>["attempt"];
  try {
    attempt = (await api.learning.getOpenAttempt({ profileId, attemptId })).attempt;
  } catch (reason) {
    if (reason instanceof ConnectError && reason.code === Code.InvalidArgument) return undefined;
    throw reason;
  }
  const start = attempt?.start;
  if (start === undefined || start.task === undefined) {
    throw new Error("api: an open attempt without its start");
  }
  return (await views.get(start.packageDigest, "manifest").catch(() => undefined))?.view.id;
}
