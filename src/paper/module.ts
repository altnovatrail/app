// A module solved on the sheet: its route, `#/paper/module/<module>` by the module's ID, an ID of
// content, and the page `BeginPaperAttempts` begins of it — a task for each open view the answer
// gives, in its order, each a row of a page with no photo, its picture the statement's text drawn.
import type { BeginPaperAttemptsResponse } from "@altnovatrail/contracts/novatrail/api/v1/paper_pb.js";
import { PAPER, type Route } from "../app/hash.ts";
import type { Frame } from "./frame.ts";
import type { BegunTask, ModulePage } from "./PaperContext.tsx";
import type { PageTask } from "./page.ts";
import { statementPicture, statementText } from "./statement.ts";

/** The route of a module solved on the sheet, which `PaperScreen` begins and shows. */
export function paperModuleRoute(moduleId: string): Route {
  return { screen: PAPER.screen, parts: ["module", moduleId] };
}

/** The module a route of `#/paper` names, or none: the camera's and a page's route names none. */
export function moduleOfRoute(route: Route): string | undefined {
  return route.screen === PAPER.screen && route.parts[0] === "module" && route.parts[1] !== ""
    ? route.parts[1]
    : undefined;
}

/**
 * The frame of the n-th task, from 0: rows one under another, so that the tasks are named and
 * listed in the order the module gave them, as a page's are by their places on it.
 */
export function rowFrame(n: number): Frame {
  return { ymin: n * 50, xmin: 0, ymax: n * 50 + 40, xmax: 1000 };
}

/** The page of the module the answer began, its tasks with their pictures. */
export async function modulePageOf(
  answer: BeginPaperAttemptsResponse,
  pageId: string,
  moduleId: string,
): Promise<{ readonly page: ModulePage; readonly begun: readonly BegunTask[] }> {
  const { attemptIds, tasks: views } = answer;
  if (views.length === 0 || attemptIds.length !== views.length)
    throw new Error("api began another number of tasks than it gave");
  const pictures = await Promise.all(
    views.map((view) => statementPicture(statementText(view.json))),
  );
  const tasks: PageTask[] = views.map((_, n) => ({
    id: `module-${n + 1}`,
    frame: rowFrame(n),
    drawn: false,
    picked: true,
  }));
  const begun = tasks.map(
    (task, n): BegunTask => ({
      attemptId: attemptIds[n] as string,
      taskId: task.id,
      frame: task.frame,
      drawn: false,
      crop: pictures[n] as Blob,
      history: [],
    }),
  );
  return { page: { pageId, moduleId, tasks }, begun };
}
