// The database of one learner's profile (section 3.2 of docs/architecture.md; R04, R16 in
// docs/decisions.md): attempts with their history of writing and submissions, the work of a correct
// submission until the words after it, and the state of lessons. History and contexts are kept as
// the canvas gave them, unchanged; the pictures of the work as bytes with their type, not Blobs,
// which WebKit does not write in an ephemeral session (the 2026-11-12 amendment to R16), and a Blob
// that schema version 1 kept before is read as it is. Every write says whether it was saved, so
// that the task screen can tell the learner the work is not saved on this device.
import type {
  CellPlace,
  DemoState,
  ExportedCell,
  ExportedWork,
  HistoryChange,
  HistoryEvent,
  Submission,
} from "@altnovatrail/spec/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { type Connection, type Key, type Transaction, within } from "./backend.ts";
import type { Device } from "./device.ts";
import { addDatabase, readRegistry } from "./registry.ts";
import { PROFILE_SCHEMA, profileDatabase } from "./schema.ts";

/** Whether a write reached the database. */
export type Saved = "saved" | "unsaved";

/** An attempt: its package, the open view of its task, the state of its steps (section 3.3). */
export interface Attempt {
  readonly attemptId: string;
  /** The digest of the attempt's package. */
  readonly digest: string;
  /** The open view of the task or of the instance; gone once its version was withdrawn. */
  readonly task?: open.Task;
  /** The state of the steps — mode, place, chips, techniques — as the task screen keeps it. */
  readonly steps?: unknown;
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
 * when its record holds it in a form this build does not read. Such a record stays where it is,
 * and goes by the rules all work goes by: the end of its attempt, the term, an erasure.
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

/** What a profile keeps on this device, for the page This device (R04). */
export interface Usage {
  /** The attempts kept unfinished, counted. */
  readonly unfinished: number;
  /**
   * About how many bytes its records take — the browser does not tell it of one database —; none
   * when a record of it could not be read.
   */
  readonly bytes: number | undefined;
}

async function bytesOf(picture: Blob): Promise<Bytes> {
  return { bytes: await picture.arrayBuffer(), type: picture.type };
}

/** The work as the database keeps it; its bytes are read before the transaction, not in it. */
async function keptWork(work: ExportedWork): Promise<KeptWork> {
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

/** The state of a lesson on one package, in one passage (section 3.4). */
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
const STORES = Object.keys(PROFILE_SCHEMA.stores);

async function eraseAttempt(tx: Transaction, attemptId: string): Promise<void> {
  await tx.delete("attempts", attemptId);
  await tx.delete("history", within(attemptId));
  await tx.delete("submissions", within(attemptId));
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

  /** The whole history in place of what is kept. */
  replaceHistory(attemptId: string, history: readonly HistoryEvent[]): Promise<Saved> {
    return this.save(["attempts", "history"], async (tx) => {
      if (!(await this.touch(tx, attemptId))) return "unsaved";
      await tx.delete("history", within(attemptId));
      for (const [i, event] of history.entries()) await tx.put("history", [attemptId, i], event);
      return "saved";
    });
  }

  /**
   * A submission, with its context and work from `exportWork()` and the history's length: its
   * number among the attempt's submissions, from 0, which `attemptEnded` takes for the correct one.
   */
  async addSubmission(
    attemptId: string,
    work: ExportedWork,
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
   * The attempt ended (section 3.2): its history, submissions, steps and the open view of its task
   * go. The work of a correct submission, by its number from 0, stays until the words after it.
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
   * another passage is over, and goes (section 3.4).
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
          const { task: _, ...attempt } = value as Attempt;
          await tx.put("attempts", key, attempt);
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
        const attempt = value as Attempt;
        if (attempt.task !== undefined) found.add(attempt.digest);
      }
      for (const { value } of await tx.entries("lessons")) found.add((value as LessonState).digest);
      return [...found];
    });
  }

  /**
   * How many attempts the profile keeps unfinished: each one ended is erased, so every attempt kept
   * is one the sign-out would take (section 3.2). They are counted, not read.
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
    return { unfinished, bytes };
  }

  /** Attempts and lessons last changed at a time or before go, with all of an attempt's work. */
  async expire(cutoff: number): Promise<void> {
    const range = { upper: cutoff };
    await this.connection.write([...ATTEMPT_STORES, "lessons"], async (tx) => {
      for (const { key } of await tx.entries("attempts", { index: "changedAt", range })) {
        await eraseAttempt(tx, key as string);
      }
      for (const { key } of await tx.entries("lessons", { index: "changedAt", range })) {
        await tx.delete("lessons", key as Key);
      }
    });
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

/**
 * An attempt is over, by whatever way it closed: its work on this device goes (section 3.2), in the
 * database the screen holds or else in the profile's, opened for it. A database that does not open
 * or a write that fails leaves the work to the 30 days' term.
 */
export async function attemptOver(
  device: Device,
  profileId: string,
  attemptId: string,
  { held, correct }: { readonly held?: Profile; readonly correct?: number } = {},
): Promise<void> {
  const profile = held ?? (await openProfile(device, profileId).catch(() => undefined));
  await profile?.attemptEnded(attemptId, correct).catch(() => {});
}
