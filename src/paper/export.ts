// The file of a page from paper in the profile's export, `paper/<profile>/<page>.json` (R77): the
// page of the history as the device keeps it — its photo, its frames in the order of the page, and
// each task begun on it with its crop, its history, where its tracing paper lay and the context of
// each Check answered —, by `@altnovatrail/spec/exportv4`. Of the export, only this file is written
// here: not its manifest or the device's other files. No DOM.
import type { Paper, Task, TaskFrame } from "@altnovatrail/spec/exportv4";
import type { KeptFrame, KeptPage, KeptPaperTask, KeptPhoto } from "../storage/profile.ts";
import { pageOrder, sameFrame } from "./frame.ts";

/** The version of the part export/ this file is of. */
export const PAPER_FORMAT = 4;

/** Where canvas starts the tracing paper, shown, when the learner has not moved it (R87 canvas). */
const TRACING_START = { at: [180, 60], hidden: false } as const;

/** Bytes in base64 (RFC 4648), a chunk at a time, so that no call takes too many arguments. */
export function base64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(text);
}

function frameOf({ frame, drawn }: Pick<KeptFrame, "frame" | "drawn">): TaskFrame {
  return { box: [frame.ymin, frame.xmin, frame.ymax, frame.xmax], by: drawn ? "learner" : "ai" };
}

/**
 * A page of the history as its file: the frames of the page, in its order, and after them the
 * frame of a task begun before the learner resized it or removed it, so that each task names its
 * own; the tasks in the order of their attempts.
 */
export async function paperFile(
  profileId: string,
  kept: {
    readonly page: KeptPage;
    readonly photo: KeptPhoto;
    readonly tasks: readonly KeptPaperTask[];
  },
): Promise<Paper> {
  const { page, photo, tasks } = kept;
  const frames: KeptFrame[] = [...page.frames].sort((a, b) => pageOrder(a.frame, b.frame));
  const placeOf = (task: KeptPaperTask): number => {
    const at = frames.findIndex(
      (each) => each.id === task.taskId && sameFrame(each.frame, task.frame),
    );
    if (at >= 0) return at + 1;
    frames.push({ id: task.taskId, frame: task.frame, drawn: task.drawn });
    return frames.length;
  };
  const written: Task[] = [];
  for (const task of tasks) {
    const crop = new Uint8Array(await task.crop.arrayBuffer());
    written.push({
      attempt_id: task.attemptId,
      frame: placeOf(task),
      statement: { media_type: "image/png", data: base64(crop) },
      history: task.history,
      tracing: task.tracing ?? TRACING_START,
      submissions: task.sent.map(({ context, historyLength }) => ({
        context,
        history_length: historyLength,
      })),
    });
  }
  return {
    format: PAPER_FORMAT,
    profile_id: profileId,
    page_id: page.pageId,
    taken_at: new Date(page.takenAt).toISOString(),
    photo: { media_type: "image/jpeg", data: base64(photo.bytes) },
    frames: frames.map(frameOf),
    tasks: written,
  };
}
