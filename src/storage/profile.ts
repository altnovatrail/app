// The database of one learner's profile: attempts with their history of writing and
// submissions, an essay's among them, the work of a correct submission until the words after
// it, and the state of lessons. History and contexts are kept as the canvas gave them, unchanged;
// the pictures of the work as bytes with their type, not Blobs, which WebKit does not write in an
// ephemeral session, and a Blob that schema version 1 kept before is read as it is. Every
// write says whether it was saved, so that the task screen can tell the learner the work is not
// saved on this device. Each attempt holds the mark of its work on the server: how long a history
// and how many submissions the last `PutWork` that went through carried. The pages from
// paper are the profile's history, apart from its attempts: neither an attempt's end nor the 30
// days take them; a page kept beyond the MAX_PAGES newest takes the oldest, and the profile's
// erasure takes them all.
import type {
  CellPlace,
  DemoState,
  ExportedCell,
  ExportedSheet,
  ExportedWorkbook,
  HistoryChange,
  HistoryEvent,
  PaperSubmission,
  Submission,
  TracingState,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type Frame, isFrame } from "../paper/frame.ts";
import { type Connection, type Key, type Transaction, within } from "./backend.ts";
import type { Device } from "./device.ts";
import { addDatabase, readRegistry } from "./registry.ts";
import { PROFILE_SCHEMA, profileDatabase } from "./schema.ts";

/** Whether a write reached the database. */
export type Saved = "saved" | "unsaved";

/**
 * How much of a work the server keeps: the length of the history and the number of submissions the
 * last `PutWork` that went through carried. A work the device holds no more of is on the server.
 */
export interface Stored {
  readonly history: number;
  readonly submissions: number;
}

/** An attempt: its package, the open view of its task, the state of its steps. */
export interface Attempt {
  readonly attemptId: string;
  /** The digest of the attempt's package. */
  readonly digest: string;
  /** The open view of the task or of the instance; gone once its version was withdrawn. */
  readonly task?: open.Task;
  /** The state of the steps — mode, place, chips, techniques — as the task screen keeps it. */
  readonly steps?: unknown;
  /** How much of its work the server keeps; none before the first `PutWork` that went through. */
  readonly stored?: Stored;
  readonly changedAt: number;
}

/** The work for checking without its context: the crop of a sheet, or a workbook's boxes. */
export type Work = { readonly png: Blob } | { readonly cells: readonly ExportedCell[] };

/** A picture as the database keeps it: its bytes, and its media type beside them. */
export interface Bytes {
  readonly bytes: ArrayBuffer;
  readonly type: string;
}

/** The work as the database keeps it: each picture in bytes. */
export type KeptWork =
  | { readonly png: Bytes }
  | { readonly cells: readonly (CellPlace & { readonly png: Bytes })[] };

/**
 * A submission: its context as the canvas gave it, the history's length then, and its work — none
 * of an essay's, and none when its record holds it in a form this build does not read. Such a
 * record stays where it is, and goes by the rules all work goes by: the end of its attempt, the
 * term, an erasure.
 */
export interface SubmissionRecord {
  readonly context: Submission;
  readonly historyLength: number;
  readonly work: Work | undefined;
}

/**
 * An attempt with its history and its submissions, in their order. The submissions are read on
 * their own, after the rest: when the browser cannot give them back, they are `undefined`, and the
 * attempt and its history still come. Two reads are not one snapshot: a write of another tab may
 * come between them, and a reader of the submissions takes a submission's history length as it is.
 */
export interface StoredAttempt {
  readonly attempt: Attempt;
  readonly history: readonly HistoryEvent[];
  readonly submissions: readonly SubmissionRecord[] | undefined;
}

/** A work as the device holds it, for `PutWork`: its history and the submissions it keeps. */
export interface DeviceWork {
  readonly attemptId: string;
  readonly history: readonly HistoryEvent[];
  readonly submissions: readonly {
    readonly context: Submission;
    readonly historyLength: number;
  }[];
}

/** What a profile keeps on this device, for the page This device. */
export interface Usage {
  /** The attempts kept unfinished, counted. */
  readonly unfinished: number;
  /**
   * About how many bytes its records take — the browser does not tell it of one database —; none
   * when a record of it could not be read.
   */
  readonly bytes: number | undefined;
  /**
   * The server keeps each of its works as the device holds it: the mark of every attempt says as
   * much of it as there is here. False when a record of it could not be read.
   */
  readonly stored: boolean;
}

/** A task frame of a page from paper: its task's key on the screen, the frame, and who drew it. */
export interface KeptFrame {
  readonly id: string;
  readonly frame: Frame;
  /** The learner drew it round a task the AI missed. */
  readonly drawn: boolean;
}

/**
 * A page from paper of the profile's history: when the photo was taken, and the frames on it
 * in the order of the page. Its photo is a record of its own, so that the list of pages reads none.
 */
export interface KeptPage {
  readonly pageId: string;
  readonly takenAt: number;
  readonly frames: readonly KeptFrame[];
}

/** The photo of a page: its JPEG and its size in px. */
export interface KeptPhoto {
  readonly bytes: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** A submission of a task from paper: its context, as the canvas gave it, and the history's length then. */
export interface PaperSent {
  readonly context: PaperSubmission;
  readonly historyLength: number;
}

/** The work on a task from paper, which changes as the learner writes. */
export interface PaperWork {
  readonly history: readonly HistoryEvent[];
  /** Where its tracing paper lies; none till the screen knows it. */
  readonly tracing?: TracingState | undefined;
  readonly sent: readonly PaperSent[];
  /** Its attempt is over: solved, or closed by api, so that the page shows it and takes no work. */
  readonly over: boolean;
  /** Its Check came to Correct: the list of the page's tasks marks it, once the verdict is put away. */
  readonly solved?: true;
}

/** A task begun on a page: its attempt, the page's task it began from, its frame, crop and work. */
export interface KeptPaperTask extends PaperWork {
  readonly pageId: string;
  readonly attemptId: string;
  readonly taskId: string;
  readonly frame: Frame;
  readonly drawn: boolean;
  readonly crop: Blob;
  /** Its place among the page's attempts, in the order Start began them. */
  readonly n: number;
}

/** A page of the history as its list names it: when it was taken, and how many tasks it began. */
export interface PageSummary {
  readonly pageId: string;
  readonly takenAt: number;
  readonly tasks: number;
}

/** The most pages from paper a profile keeps on the device: a new one past them takes the oldest. */
export const MAX_PAGES = 5;

const PAGES = "pages";
const PHOTOS = "photos";
const PAPER_TASKS = "paperTasks";

/** A page goes: its record, its photo and the tasks begun on it. */
async function erasePage(tx: Transaction, pageId: string): Promise<void> {
  const range = { lower: pageId, upper: pageId };
  for (const key of await tx.keys(PAPER_TASKS, { index: "page", range }))
    await tx.delete(PAPER_TASKS, key);
  await tx.delete(PHOTOS, pageId);
  await tx.delete(PAGES, pageId);
}

/** A page's record as this build writes it; anything else is none. */
function pageOf(kept: unknown): KeptPage | undefined {
  const page = kept as Partial<KeptPage> | null | undefined;
  if (typeof page?.pageId !== "string" || typeof page.takenAt !== "number") return undefined;
  if (!Array.isArray(page.frames)) return undefined;
  const frames = page.frames.filter(
    (each: Partial<KeptFrame> | null | undefined): each is KeptFrame =>
      typeof each?.id === "string" && isFrame(each.frame) && typeof each.drawn === "boolean",
  );
  return { pageId: page.pageId, takenAt: page.takenAt, frames };
}

/** A photo's record as this build writes it; anything else is none. */
function photoOf(kept: unknown): KeptPhoto | undefined {
  const photo = kept as
    | (Partial<Bytes> & { readonly width?: unknown; readonly height?: unknown })
    | null
    | undefined;
  if (!(photo?.bytes instanceof ArrayBuffer)) return undefined;
  if (typeof photo.width !== "number" || typeof photo.height !== "number") return undefined;
  return { bytes: new Uint8Array(photo.bytes), width: photo.width, height: photo.height };
}

/** A task's record with its crop again as a Blob; one this build cannot read is none. */
function paperTaskOf(kept: unknown): KeptPaperTask | undefined {
  const { crop, ...task } = (kept ?? {}) as Partial<Omit<KeptPaperTask, "crop">> & {
    readonly crop?: unknown;
  };
  const picture = pictureOf(crop);
  if (picture === undefined || typeof task.attemptId !== "string") return undefined;
  if (typeof task.pageId !== "string" || typeof task.taskId !== "string") return undefined;
  if (!isFrame(task.frame) || !Array.isArray(task.history) || !Array.isArray(task.sent))
    return undefined;
  return {
    pageId: task.pageId,
    attemptId: task.attemptId,
    taskId: task.taskId,
    frame: task.frame,
    drawn: task.drawn === true,
    crop: picture,
    n: typeof task.n === "number" ? task.n : 0,
    history: task.history,
    ...(task.tracing === undefined ? {} : { tracing: task.tracing }),
    sent: task.sent,
    over: task.over === true,
    ...(task.solved === true ? { solved: true } : {}),
  };
}

async function bytesOf(picture: Blob): Promise<Bytes> {
  return { bytes: await picture.arrayBuffer(), type: picture.type };
}

/** The work as the database keeps it; its bytes are read before the transaction, not in it. */
async function keptWork(work: ExportedSheet | ExportedWorkbook): Promise<KeptWork> {
  if ("png" in work) return { png: await bytesOf(work.png) };
  return {
    cells: await Promise.all(
      work.cells.map(async ({ png, ...place }) => ({ ...place, png: await bytesOf(png) })),
    ),
  };
}

/** A picture kept: bytes, or a Blob that schema version 1 kept before them; anything else is none. */
function pictureOf(kept: unknown): Blob | undefined {
  if (kept instanceof Blob) return kept;
  const bytes = kept as Partial<Bytes> | null | undefined;
  if (!(bytes?.bytes instanceof ArrayBuffer) || typeof bytes.type !== "string") return undefined;
  return new Blob([bytes.bytes], { type: bytes.type });
}

/** The work a record keeps, in either form, with Blobs again; a form this build cannot read is none. */
export function workOf(kept: unknown): Work | undefined {
  if (typeof kept !== "object" || kept === null) return undefined;
  if ("png" in kept) {
    const png = pictureOf(kept.png);
    return png === undefined ? undefined : { png };
  }
  if (!("cells" in kept) || !Array.isArray(kept.cells)) return undefined;
  const cells: ExportedCell[] = [];
  for (const cell of kept.cells as readonly (CellPlace & { readonly png?: unknown })[]) {
    const png = pictureOf(cell?.png);
    if (png === undefined) return undefined;
    cells.push({ ...cell, png });
  }
  return { cells };
}

const encoder = new TextEncoder();

/**
 * About how many bytes a record takes: its strings in UTF-8, eight bytes a number, its pictures by
 * their size, a byte anything else. The browser keeps it in a form of its own: the page says "about".
 */
export function sizeOf(value: unknown): number {
  if (typeof value === "string") return encoder.encode(value).length;
  if (typeof value === "number") return 8;
  if (value instanceof ArrayBuffer) return value.byteLength;
  if (value instanceof Blob) return value.size;
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + sizeOf(item), 0);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).reduce((sum, [key, item]) => sum + sizeOf(key) + sizeOf(item), 0);
  }
  return 1;
}

/** The state of a lesson on one package, in one passage. */
export interface LessonState {
  readonly lessonId: string;
  readonly digest: string;
  readonly passageId: string;
  readonly view: open.Lesson;
  /** The segment the learner has got to, from 1. */
  readonly place: number;
  /** How far each worked example's demo is open, by its segment. */
  readonly demo: Readonly<Record<number, DemoState>>;
  readonly changedAt: number;
}

const ATTEMPT_STORES = ["attempts", "history", "submissions"];
const OWN_KEY_STORE = "ownKey";
const OWN_KEY = "key";
/** The stores of the learner's work, whose size the page This device tells: not the own key. */
const STORES = Object.keys(PROFILE_SCHEMA.stores).filter((store) => store !== OWN_KEY_STORE);

/** The own key kept on this device: its provider by code and name, the key and its last four. */
export interface KeptKey {
  readonly provider: string;
  readonly name: string;
  readonly key: string;
  readonly last4: string;
}

/** A kept key in the form this build writes; anything else is none. */
function keptKeyOf(kept: unknown): KeptKey | undefined {
  if (typeof kept !== "object" || kept === null) return undefined;
  const { provider, name, key, last4 } = kept as Partial<Record<keyof KeptKey, unknown>>;
  if (typeof provider !== "string" || typeof key !== "string" || key === "") return undefined;
  return {
    provider,
    name: typeof name === "string" ? name : provider,
    key,
    last4: typeof last4 === "string" ? last4 : key.slice(-4),
  };
}

/** An attempt's work goes: its record, its history of writing and its submissions. */
async function eraseAttempt(tx: Transaction, attemptId: string): Promise<void> {
  await tx.delete("attempts", attemptId);
  await tx.delete("history", within(attemptId));
  await tx.delete("submissions", within(attemptId));
}

/** A mark of a work on the server as this build writes it; anything else is none. */
function storedOf(kept: unknown): Stored | undefined {
  const mark = kept as Partial<Record<keyof Stored, unknown>> | null | undefined;
  if (typeof mark?.history !== "number" || typeof mark.submissions !== "number") return undefined;
  return { history: mark.history, submissions: mark.submissions };
}

export class Profile {
  private readonly connection: Connection;
  private readonly now: () => number;

  constructor(connection: Connection, now: () => number) {
    this.connection = connection;
    this.now = now;
  }

  /** A write that tells, rather than throws, that it did not reach the database. */
  private async save<T extends string>(
    stores: readonly string[],
    work: (tx: Transaction) => Promise<T>,
  ): Promise<T | "unsaved"> {
    try {
      return await this.connection.write(stores, work);
    } catch {
      return "unsaved";
    }
  }

  /** A new attempt, with no history and no submission. */
  beginAttempt(attempt: Omit<Attempt, "changedAt" | "steps">): Promise<Saved> {
    return this.save(ATTEMPT_STORES, async (tx) => {
      await eraseAttempt(tx, attempt.attemptId);
      await tx.put("attempts", attempt.attemptId, { ...attempt, changedAt: this.now() });
      return "saved";
    });
  }

  async readAttempt(attemptId: string): Promise<StoredAttempt | undefined> {
    const found = await this.connection.read(["attempts", "history"], async (tx) => {
      const attempt = (await tx.get("attempts", attemptId)) as Attempt | undefined;
      if (attempt === undefined) return undefined;
      const history = await tx.entries("history", { range: within(attemptId) });
      return { attempt, history: history.map((entry) => entry.value as HistoryEvent) };
    });
    if (found === undefined) return undefined;
    // A read of their own: a record the browser cannot give back takes neither the attempt nor its
    // history with it, and nothing is erased for it.
    const submissions = await this.connection
      .read(["submissions"], (tx) => tx.entries("submissions", { range: within(attemptId) }))
      .then(
        (entries) =>
          entries.map(({ value }): SubmissionRecord => {
            const { work, ...rest } = value as Omit<SubmissionRecord, "work"> & { work: unknown };
            return { ...rest, work: workOf(work) };
          }),
        () => undefined,
      );
    return { ...found, submissions };
  }

  /** Marks the attempt changed now, in the transaction; false when there is no such attempt. */
  private async touch(tx: Transaction, attemptId: string, change: Partial<Attempt> = {}) {
    const attempt = (await tx.get("attempts", attemptId)) as Attempt | undefined;
    if (attempt === undefined) return false;
    await tx.put("attempts", attemptId, { ...attempt, ...change, changedAt: this.now() });
    return true;
  }

  saveSteps(attemptId: string, steps: unknown): Promise<Saved> {
    return this.save(["attempts"], async (tx) =>
      (await this.touch(tx, attemptId, { steps })) ? "saved" : "unsaved",
    );
  }

  /**
   * Adds what a `historychange` tells. A history whose length is not `from` has missed events:
   * `"missed"`, and the caller gives the element's whole `history` to `replaceHistory`.
   */
  appendHistory(attemptId: string, change: HistoryChange): Promise<Saved | "missed"> {
    return this.save(["attempts", "history"], async (tx): Promise<Saved | "missed"> => {
      if ((await tx.count("history", { range: within(attemptId) })) !== change.from) {
        return "missed";
      }
      if (!(await this.touch(tx, attemptId))) return "unsaved";
      for (const [i, event] of change.events.entries()) {
        await tx.put("history", [attemptId, change.from + i], event);
      }
      return "saved";
    });
  }

  /**
   * The whole history in place of what is kept. The mark of the work on the server goes: a history
   * of the same length may be another one.
   */
  replaceHistory(attemptId: string, history: readonly HistoryEvent[]): Promise<Saved> {
    return this.save(["attempts", "history"], async (tx) => {
      if (!(await this.touch(tx, attemptId, { stored: undefined }))) return "unsaved";
      await tx.delete("history", within(attemptId));
      for (const [i, event] of history.entries()) await tx.put("history", [attemptId, i], event);
      return "saved";
    });
  }

  /**
   * A submission, with its context and work from `exportWork()` and the history's length: its
   * number among the attempt's submissions, from 0, which `attemptEnded` takes for the correct one.
   * A task from paper's work is none of an attempt's here: the device keeps it apart.
   */
  async addSubmission(
    attemptId: string,
    work: ExportedSheet | ExportedWorkbook,
    historyLength: number,
  ): Promise<number | "unsaved"> {
    try {
      const record = { context: work.submission, historyLength, work: await keptWork(work) };
      return await this.connection.write(["attempts", "submissions"], async (tx) => {
        if (!(await this.touch(tx, attemptId))) return "unsaved" as const;
        const n = await tx.count("submissions", { range: within(attemptId) });
        await tx.put("submissions", [attemptId, n], record);
        return n;
      });
    } catch {
      return "unsaved";
    }
  }

  /**
   * A submission of an essay: its context and the history's length, for the work on the server,
   * without its crop, which nothing on the device reads again.
   */
  addEssaySubmission(
    attemptId: string,
    context: Submission,
    historyLength: number,
  ): Promise<Saved> {
    return this.save(["attempts", "submissions"], async (tx) => {
      if (!(await this.touch(tx, attemptId))) return "unsaved";
      const n = await tx.count("submissions", { range: within(attemptId) });
      await tx.put("submissions", [attemptId, n], { context, historyLength });
      return "saved";
    });
  }

  /**
   * The attempt ended: its history, submissions, steps and the open view of its task go. The
   * work of a correct submission, by its number from 0, stays until the words after it.
   */
  async attemptEnded(attemptId: string, correct?: number): Promise<void> {
    // Read first, on its own: a record the browser cannot give back would abort the erasure with it.
    const work =
      correct === undefined
        ? undefined
        : await this.connection
            .read(["submissions"], (tx) => tx.get("submissions", [attemptId, correct]))
            .then(
              (record) => (record as { readonly work?: unknown } | undefined)?.work,
              () => undefined,
            );
    await this.connection.write([...ATTEMPT_STORES, "correctWork"], async (tx) => {
      if (work !== undefined) await tx.put("correctWork", attemptId, work);
      await eraseAttempt(tx, attemptId);
    });
  }

  /** The work of an ended attempt's correct submission, for the words after it. */
  async correctWork(attemptId: string): Promise<Work | undefined> {
    return workOf(
      await this.connection.read(["correctWork"], (tx) => tx.get("correctWork", attemptId)),
    );
  }

  /** The words after the correct answer came, or their request ended: its work goes. */
  async wordsCame(attemptId: string): Promise<void> {
    await this.connection.write(["correctWork"], (tx) => tx.delete("correctWork", attemptId));
  }

  /** At the start: the work of every correct submission whose words app was closed before. */
  async clearCorrectWork(): Promise<void> {
    await this.connection.write(["correctWork"], (tx) => tx.delete("correctWork", {}));
  }

  /** The state of a lesson; a new passage or another package takes the place of the one kept. */
  saveLesson(state: Omit<LessonState, "changedAt">): Promise<Saved> {
    return this.save(["lessons"], async (tx) => {
      await tx.put("lessons", state.lessonId, { ...state, changedAt: this.now() });
      return "saved";
    });
  }

  /**
   * The state of a lesson on this package and in this passage. One kept on another package or of
   * another passage is over, and goes.
   */
  async readLesson(
    lessonId: string,
    digest: string,
    passageId: string,
  ): Promise<LessonState | undefined> {
    return this.connection.write(["lessons"], async (tx) => {
      const state = (await tx.get("lessons", lessonId)) as LessonState | undefined;
      if (state === undefined) return undefined;
      if (state.digest === digest && state.passageId === passageId) return state;
      await tx.delete("lessons", lessonId);
      return undefined;
    });
  }

  /** The lesson ended — passed, unchecked, not fitting or abandoned: its state goes. */
  async lessonEnded(lessonId: string): Promise<void> {
    await this.connection.write(["lessons"], (tx) => tx.delete("lessons", lessonId));
  }

  /** Versions withdrawn: the open views of their tasks, and the lessons on them, go. */
  async withdraw(digests: readonly string[]): Promise<void> {
    await this.connection.write(["attempts", "lessons"], async (tx) => {
      for (const digest of digests) {
        const range = { lower: digest, upper: digest };
        for (const { key, value } of await tx.entries("attempts", { index: "digest", range })) {
          const { task: _, ...kept } = value as { readonly task?: unknown };
          await tx.put("attempts", key, kept);
        }
        for (const { key } of await tx.entries("lessons", { index: "digest", range })) {
          await tx.delete("lessons", key);
        }
      }
    });
  }

  /** The digests of the packages of the attempts and the lessons this profile keeps. */
  async digests(): Promise<string[]> {
    return this.connection.read(["attempts", "lessons"], async (tx) => {
      const found = new Set<string>();
      // An attempt whose task's view a withdrawal took keeps no view of its package.
      for (const { value } of await tx.entries("attempts")) {
        const kept = value as Pick<Attempt, "digest" | "task">;
        if (kept.task !== undefined) found.add(kept.digest);
      }
      for (const { value } of await tx.entries("lessons")) found.add((value as LessonState).digest);
      return [...found];
    });
  }

  /**
   * How many attempts the profile keeps unfinished: each one ended is erased, so every attempt kept
   * is unfinished. They are counted, not read.
   */
  async unfinished(): Promise<number> {
    return this.connection.read(["attempts"], (tx) => tx.count("attempts"));
  }

  /** What the profile keeps on this device: its unfinished attempts, and about how much space. */
  async usage(): Promise<Usage> {
    // Counted first and on its own: a count reads no record, and so it comes even when the sizes,
    // which read every record, do not.
    const unfinished = await this.unfinished();
    const bytes = await this.connection
      .read(STORES, async (tx) => {
        let sum = 0;
        for (const store of STORES) {
          for (const { key, value } of await tx.entries(store)) sum += sizeOf(key) + sizeOf(value);
        }
        return sum;
      })
      .catch(() => undefined);
    return { unfinished, bytes, stored: await this.allStored() };
  }

  /**
   * The work of an attempt as the device holds it now, for `PutWork`: its history, and its
   * submissions with their contexts. None when the device keeps no such attempt, or a record of it
   * could not be read.
   */
  async work(attemptId: string): Promise<DeviceWork | undefined> {
    return this.connection
      .read(ATTEMPT_STORES, async (tx): Promise<DeviceWork | undefined> => {
        if ((await tx.get("attempts", attemptId)) === undefined) return undefined;
        const history = await tx.entries("history", { range: within(attemptId) });
        const submissions = await tx.entries("submissions", { range: within(attemptId) });
        return {
          attemptId,
          history: history.map(({ value }) => value as HistoryEvent),
          submissions: submissions.map(({ value }) => {
            const { context, historyLength } = value as SubmissionRecord;
            return { context, historyLength };
          }),
        };
      })
      .catch(() => undefined);
  }

  /** The attempts the profile keeps the work of: every work it may put. */
  async works(): Promise<string[]> {
    return this.connection.read(["attempts"], async (tx) =>
      (await tx.keys("attempts")).map((key) => key as string),
    );
  }

  /** The server keeps the work of the attempt as far as the mark says. */
  async markStored(attemptId: string, stored: Stored): Promise<void> {
    await this.connection.write(["attempts"], async (tx) => {
      const kept = (await tx.get("attempts", attemptId)) as object | undefined;
      if (kept !== undefined)
        await tx.put("attempts", attemptId, { ...kept, stored: { ...stored } });
    });
  }

  /** The storage switched off: the server erased its copies, and no mark of them holds. */
  async clearStored(): Promise<void> {
    await this.connection.write(["attempts"], async (tx) => {
      for (const { key, value } of await tx.entries("attempts")) {
        const { stored, ...kept } = value as { readonly stored?: unknown };
        if (stored !== undefined) await tx.put("attempts", key, kept);
      }
    });
  }

  /**
   * Whether the server keeps every work of the profile as far as the device holds it: each
   * attempt's mark names the history's length and the submissions the device has, an attempt with
   * none of either needing none.
   */
  private async allStored(): Promise<boolean> {
    return this.connection
      .read(ATTEMPT_STORES, async (tx) => {
        for (const { key, value } of await tx.entries("attempts")) {
          const range = within(key);
          const mark = storedOf((value as Attempt).stored);
          if ((mark?.history ?? 0) !== (await tx.count("history", { range }))) return false;
          if ((mark?.submissions ?? 0) !== (await tx.count("submissions", { range }))) return false;
        }
        return true;
      })
      .catch(() => false);
  }

  /** The own key kept on this device; none when it is not kept, or its record cannot be read. */
  async ownKey(): Promise<KeptKey | undefined> {
    return keptKeyOf(
      await this.connection.read([OWN_KEY_STORE], (tx) => tx.get(OWN_KEY_STORE, OWN_KEY)),
    );
  }

  /** Keeps the own key on this device, in place of the one kept before. */
  keepOwnKey(kept: KeptKey): Promise<Saved> {
    return this.save([OWN_KEY_STORE], async (tx) => {
      await tx.put(OWN_KEY_STORE, OWN_KEY, { ...kept });
      return "saved";
    });
  }

  /** The own key is no more kept on this device. */
  async dropOwnKey(): Promise<void> {
    await this.connection.write([OWN_KEY_STORE], (tx) => tx.delete(OWN_KEY_STORE, OWN_KEY));
  }

  /**
   * Attempts and lessons last changed at a time or before go, with all of an attempt's work, and
   * so does a history whose attempt the device keeps no more: an essay's, which the store `essays`
   * of schema versions 3 and 4 kept past its attempt.
   */
  async expire(cutoff: number): Promise<void> {
    const range = { upper: cutoff };
    await this.connection.write([...ATTEMPT_STORES, "lessons"], async (tx) => {
      for (const { key } of await tx.entries("attempts", { index: "changedAt", range })) {
        await eraseAttempt(tx, key as string);
      }
      for (const { key } of await tx.entries("lessons", { index: "changedAt", range })) {
        await tx.delete("lessons", key as Key);
      }
      // The keys of `history` are `[attemptId, n]`: what lies before the first attempt kept,
      // between two of them and after the last belongs to none, and goes with no record read.
      let lower: Key | undefined;
      for (const key of await tx.keys("attempts")) {
        await tx.delete("history", { ...(lower === undefined ? {} : { lower }), upper: [key] });
        lower = within(key).upper;
      }
      await tx.delete("history", lower === undefined ? {} : { lower });
    });
  }

  /**
   * A page from paper and the tasks Start began on it now: the page with its frames as they
   * are, its photo the first time, and each task with its crop, after those begun on it before. A
   * task begun anew, its frame resized, takes the place of its earlier attempt. A new page past
   * MAX_PAGES takes the oldest with its photo and its tasks, never the page kept now.
   */
  async keepPage(
    page: KeptPage,
    photo: KeptPhoto,
    begun: readonly Omit<KeptPaperTask, "pageId" | "n">[],
  ): Promise<Saved> {
    try {
      // Read before the transaction, which awaits nothing else.
      const crops = await Promise.all(begun.map((task) => bytesOf(task.crop)));
      const bytes = photo.bytes.slice().buffer;
      return await this.connection.write(
        [PAGES, PHOTOS, PAPER_TASKS],
        async (tx): Promise<Saved> => {
          const { pageId } = page;
          await tx.put(PAGES, pageId, { pageId, takenAt: page.takenAt, frames: page.frames });
          if ((await tx.get(PHOTOS, pageId)) === undefined) {
            const { width, height } = photo;
            await tx.put(PHOTOS, pageId, { bytes, type: "image/jpeg", width, height });
          }
          const range = { lower: pageId, upper: pageId };
          const before = await tx.entries(PAPER_TASKS, { index: "page", range });
          const anew = new Set(begun.map((task) => task.taskId));
          for (const { key, value } of before) {
            if (anew.has((value as Partial<KeptPaperTask>).taskId ?? ""))
              await tx.delete(PAPER_TASKS, key);
          }
          const n = before.reduce((most, { value }) => {
            const at = (value as Partial<KeptPaperTask>).n;
            return typeof at === "number" ? Math.max(most, at + 1) : most;
          }, 0);
          for (const [i, task] of begun.entries()) {
            await tx.put(PAPER_TASKS, task.attemptId, {
              ...task,
              pageId,
              n: n + i,
              crop: crops[i],
            });
          }
          // The oldest first: each past the MAX_PAGES - 1 newest beside this one goes.
          const others = (await tx.keys(PAGES, { index: "takenAt" })).filter(
            (key) => key !== pageId,
          );
          for (const key of others.slice(0, Math.max(0, others.length - (MAX_PAGES - 1))))
            await erasePage(tx, key as string);
          return "saved";
        },
      );
    } catch {
      return "unsaved";
    }
  }

  /** The work on a task from paper as it is now, in place of what is kept; none for a task not kept. */
  keepPaperWork(attemptId: string, work: PaperWork): Promise<Saved> {
    return this.save([PAPER_TASKS], async (tx) => {
      const kept = (await tx.get(PAPER_TASKS, attemptId)) as object | undefined;
      if (kept === undefined) return "unsaved";
      const { history, tracing, sent, over, solved } = work;
      await tx.put(PAPER_TASKS, attemptId, {
        ...kept,
        history,
        ...(tracing === undefined ? {} : { tracing }),
        sent,
        over,
        ...(solved === true ? { solved } : {}),
      });
      return "saved";
    });
  }

  /**
   * A task from paper whose attempt closed, under the new attempt api began of it: its record, its
   * work and its place on the page, open again; none for a task not kept.
   */
  renewPaperTask(was: string, attemptId: string): Promise<Saved> {
    return this.save([PAPER_TASKS], async (tx) => {
      const kept = (await tx.get(PAPER_TASKS, was)) as object | undefined;
      if (kept === undefined) return "unsaved";
      await tx.delete(PAPER_TASKS, was);
      await tx.put(PAPER_TASKS, attemptId, { ...kept, attemptId, over: false });
      return "saved";
    });
  }

  /** The pages of the history, the newest first, with how many tasks each began: no photo is read. */
  async pages(): Promise<PageSummary[]> {
    return this.connection.read([PAGES, PAPER_TASKS], async (tx) => {
      const found: PageSummary[] = [];
      for (const { value } of await tx.entries(PAGES, { index: "takenAt" })) {
        const page = pageOf(value);
        if (page === undefined) continue;
        const range = { lower: page.pageId, upper: page.pageId };
        const tasks = await tx.count(PAPER_TASKS, { index: "page", range });
        found.push({ pageId: page.pageId, takenAt: page.takenAt, tasks });
      }
      return found.reverse();
    });
  }

  /**
   * A page of the history with its photo and its tasks, in the order Start began them; none when it
   * is not kept, or its photo is in a form this build does not read. A task that cannot be read is
   * left out.
   */
  async page(pageId: string): Promise<
    | {
        readonly page: KeptPage;
        readonly photo: KeptPhoto;
        readonly tasks: readonly KeptPaperTask[];
      }
    | undefined
  > {
    return this.connection.read([PAGES, PHOTOS, PAPER_TASKS], async (tx) => {
      const page = pageOf(await tx.get(PAGES, pageId));
      const photo = photoOf(await tx.get(PHOTOS, pageId));
      if (page === undefined || photo === undefined) return undefined;
      const range = { lower: pageId, upper: pageId };
      const tasks = (await tx.entries(PAPER_TASKS, { index: "page", range }))
        .flatMap(({ value }) => {
          const task = paperTaskOf(value);
          return task === undefined ? [] : [task];
        })
        .sort((a, b) => a.n - b.n);
      return { page, photo, tasks };
    });
  }

  /**
   * The photo of a page alone, for its thumbnail in the list of pages, which reads none; none when
   * it is not kept or is in a form this build does not read.
   */
  async photo(pageId: string): Promise<KeptPhoto | undefined> {
    return this.connection.read([PHOTOS], async (tx) => photoOf(await tx.get(PHOTOS, pageId)));
  }
}

/** Names a new profile's database in the registry, then opens it. */
export async function addProfile(device: Device, profileId: string): Promise<Profile | undefined> {
  await addDatabase(device, profileDatabase(profileId), { kind: "profile", profileId });
  return openProfile(device, profileId);
}

/**
 * The database of a profile, only if the registry names it and it is not to be erased: one another
 * tab erased is not made again.
 */
export async function openProfile(device: Device, profileId: string): Promise<Profile | undefined> {
  const name = profileDatabase(profileId);
  if ((await registered(device, name)) !== "live") return undefined;
  const connection = await device.connect(name, PROFILE_SCHEMA, true);
  return connection === undefined ? undefined : new Profile(connection, device.now);
}

/** Whether the registry names a database, and whether it is to be erased. */
async function registered(device: Device, name: string): Promise<"live" | "erasing" | undefined> {
  const entry = (await readRegistry(device))?.databases.get(name);
  if (entry === undefined) return undefined;
  return entry.erase ? "erasing" : "live";
}

/**
 * What a profile keeps on this device, for the page This device: `undefined` when the registry
 * names no database of it, and `"erasing"` while its erasure waits for the browser.
 */
export async function profileUsage(
  device: Device,
  profileId: string,
): Promise<Usage | "erasing" | undefined> {
  const name = profileDatabase(profileId);
  const found = await registered(device, name);
  if (found !== "live") return found;
  return (await openProfileDatabase(device, name))?.usage();
}

/** A profile's database by its name in the registry, for the start and for erasure. */
export async function openProfileDatabase(
  device: Device,
  name: string,
): Promise<Profile | undefined> {
  const connection = await device.connect(name, PROFILE_SCHEMA, false);
  return connection === undefined ? undefined : new Profile(connection, device.now);
}

/** What puts the work of an attempt on the server as it closes: read before it goes, sent after. */
export interface Closing {
  readonly read: (profile: Profile, attemptId: string) => Promise<DeviceWork | undefined>;
  readonly send: (profile: Profile, work: DeviceWork) => Promise<unknown>;
}

/**
 * An attempt is over, by whatever way it closed: its work on this device goes, in the
 * database the screen holds or else in the profile's, opened for it, and with `works` it goes to
 * the server first, as it was at the end — read before the erasure, sent after it, so that the
 * screen waits for no network. A database that does not open or a write that fails leaves the work
 * to the 30 days' term.
 */
export async function attemptOver(
  device: Device,
  profileId: string,
  attemptId: string,
  {
    held,
    correct,
    works,
  }: { readonly held?: Profile; readonly correct?: number; readonly works?: Closing } = {},
): Promise<void> {
  const profile = held ?? (await openProfile(device, profileId).catch(() => undefined));
  if (profile === undefined) return;
  const work = await works?.read(profile, attemptId).catch(() => undefined);
  await profile.attemptEnded(attemptId, correct).catch(() => {});
  if (work !== undefined) void works?.send(profile, work);
}
