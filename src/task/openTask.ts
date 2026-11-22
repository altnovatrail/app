// What the attempt open outside a lesson is, as Home names it in "Next up" (R79): the module of its
// task and the first paragraph of the task's statement, by `GetOpenAttempt`, which only reads; or a
// task from paper, which that call refuses, since only the device that holds its page goes on with
// it (R162 spec). No DOM.

import type * as open from "@altnovatrail/spec/formatv0/open";
import { Code, ConnectError } from "@connectrpc/connect";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";

/** The open attempt's task, by its module and the start of its statement, or a task from paper. */
export type OpenTask =
  | {
      readonly kind: "module";
      /** The module's ID, from its manifest; none when the manifest did not come. */
      readonly moduleId?: string;
      /** The module's title, from its manifest; none when the manifest did not come. */
      readonly module?: string;
      /** The explanation language of the module, the `lang` of its words. */
      readonly language?: string;
      /** The first paragraph of the statement; none for a statement of pictures alone. */
      readonly statement?: string;
    }
  | { readonly kind: "paper" };

/** The task of the attempt open; refuses as `GetOpenAttempt` does, but for a task from paper. */
export async function openTaskOf(
  api: Api,
  views: OpenViews,
  profileId: string,
  attemptId: string,
): Promise<OpenTask> {
  let attempt: Awaited<ReturnType<Api["learning"]["getOpenAttempt"]>>["attempt"];
  try {
    attempt = (await api.learning.getOpenAttempt({ profileId, attemptId })).attempt;
  } catch (reason) {
    if (reason instanceof ConnectError && reason.code === Code.InvalidArgument) {
      return { kind: "paper" };
    }
    throw reason;
  }
  const start = attempt?.start;
  const task = start?.task;
  if (start === undefined || task === undefined) {
    throw new Error("api: an open attempt without its start");
  }
  const view = views.parseView(task.json, task.moduleFormatVersion) as open.Task;
  const manifest = (await views.get(start.packageDigest, "manifest").catch(() => undefined))?.view;
  const statement = view.statement.find((part) => part.text !== undefined)?.text;
  return {
    kind: "module",
    ...(manifest === undefined
      ? {}
      : {
          moduleId: manifest.id,
          module: manifest.title,
          language: manifest.languages.explanation,
        }),
    ...(statement === undefined ? {} : { statement }),
  };
}
