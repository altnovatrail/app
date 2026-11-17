// The database of one learner's profile (section 3.2 of docs/architecture.md; R04, R16 in
// docs/decisions.md): attempts with their history of writing and submissions, the work of a correct
// submission until the words after it, the state of lessons, and the essays, which outlive their
// attempts until an adult erases them (R53). History and contexts are kept as
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

/** How a submission of an essay ended (R87 in spec): feedback, unreadable or unchecked. */
export type EssayEnd = "feedback" | "unreadable" | "unchecked";

/**
 * A submission of an essay as the device keeps it (R53): when it went, how it ended, and the crop
 * of the sheet it sent, for the learner to read again — the server keeps neither the crop nor the
 * text read nor the words of the feedback (R87 in spec).
 */
export interface EssaySent {
  readonly at: number;
  readonly end: EssayEnd;
  /** The text read, as it is written; none when the essay was not read. */
  readonly text?: string;
  /** Beside "unreadable": "blank" or "illegible", or a reason the build does not know. */
  readonly reason?: string;
  /** Beside feedback: its words; none when they did not pass, "no feedback this time". */
  readonly feedback?: string;
  /** The answer was a repeat of one lost on the way: neither the text nor the words came. */
  readonly repeated?: boolean;
  /** The crop sent; none when its record holds it in a form this build does not read. */
  readonly crop: Blob | undefined;
}

/**
 * An essay: the work of a task whose answer slot is bound `sheet`, kept from the start of its
 * attempt, ended or not, until an adult erases it (R04; R53). Its history of writing lies in the
 * store `history` by its attempt ID, as an attempt's does.
 */
export interface Essay {
  readonly attemptId: string;
  readonly digest: string;
  /** The open view of its task; gone once its version was withdrawn (section 3.2). */
  readonly task?: open.Task;
  /** The module's explanation language, the `lang` of its task and its feedback. */
  readonly language?: string;
  readonly startedAt: number;
  /** Its attempt ended: by "Done", or closed by api. */
  readonly ended: boolean;
  readonly sent: readonly EssaySent[];
}

/** What a profile keeps on this device, for the page This device (R04). */
export interface Usage {
  /** The attempts kept unfinished, counted. */
  readonly unfinished: number;
  /** The essays kept, counted. */
  readonly essays: number;
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

const ESSAYS = "essays";

/**
 * An attempt's work goes: its record and its submissions, and its history of writing but for an
 * essay's, which stays with the essay (section 3.2).
 */
async function eraseAttempt(tx: Transaction, attemptId: string): Promise<void> {
  await tx.delete("attempts", attemptId);
  if ((await tx.get(ESSAYS, attemptId)) === undefined) {
    await tx.delete("history", within(attemptId));
  }
  await tx.delete("submissions", within(attemptId));
}

const ENDS: readonly unknown[] = ["feedback", "unreadable", "unchecked"] satisfies EssayEnd[];

/** A submission of an essay as this build writes it, with its crop if asked; anything else is none. */
function sentOf(kept: unknown, crops: boolean): EssaySent | undefined {
  if (typeof kept !== "object" || kept === null) return undefined;
  const one = kept as Record<string, unknown>;
  if (typeof one.at !== "number" || !ENDS.includes(one.end)) return undefined;
  const text = (key: string) => (typeof one[key] === "string" ? { [key]: one[key] } : {});
  return {
    at: one.at,
    end: one.end as EssayEnd,
    ...text("text"),
    ...text("reason"),
    ...text("feedback"),
    ...(one.repeated === true ? { repeated: true } : {}),
    crop: crops ? pictureOf(one.crop) : undefined,
  };
}

/**
 * An essay's record as this build writes it, its submissions of another form left out; anything
 * else is none. A list of essays reads no crop: only the essay opened shows them.
 */
function essayOf(kept: unknown, crops: boolean): Essay | undefined {
  if (typeof kept !== "object" || kept === null) return undefined;
  const { attemptId, digest, task, language, startedAt, ended, sent } = kept as Record<
    string,
    unknown
  >;
  if (typeof attemptId !== "string" || typeof digest !== "string") return undefined;
  if (typeof startedAt !== "number" || !Array.isArray(sent)) return undefined;
  return {
    attemptId,
    digest,
    ...(task === undefined ? {} : { task: task as open.Task }),
    ...(typeof language === "string" ? { language } : {}),
    startedAt,
    ended: ended === true,
    sent: sent.flatMap((one) => {
      const read = sentOf(one, crops);
      return read === undefined ? [] : [read];
    }),
  };
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

  /**
   * A new attempt, with no history and no submission: an essay's history of an earlier start
   * goes too, as the canvas starts again from an empty sheet.
   */
  beginAttempt(attempt: Omit<Attempt, "changedAt" | "steps">): Promise<Saved> {
    return this.save([...ATTEMPT_STORES, ESSAYS], async (tx) => {
      await eraseAttempt(tx, attempt.attemptId);
      await tx.delete("history", within(attempt.attemptId));
      await tx.put("attempts", attempt.attemptId, { ...attempt, changedAt: this.now() });
      return "saved";
    });
  }

  /**
   * The essay of an attempt, which the end of the attempt and the term leave (R53): made if the
   * device keeps none, the attempt begun by an earlier build too, and moved with its submissions
   * to the package the attempt is on now.
   */
  beginEssay(
    attempt: Pick<Attempt, "attemptId" | "digest" | "task">,
    language: string | undefined,
  ): Promise<Saved> {
    return this.save([ESSAYS], async (tx) => {
      const { attemptId, digest, task } = attempt;
      const record = (await tx.get(ESSAYS, attemptId)) as { sent?: unknown } | undefined;
      const kept = essayOf(record, false);
      if (kept?.digest !== digest) {
        await tx.put(ESSAYS, attemptId, {
          attemptId,
          digest,
          ...(task === undefined ? {} : { task }),
          ...(language === undefined ? {} : { language }),
          startedAt: kept?.startedAt ?? this.now(),
          ended: false,
          // A record essayOf reads has its submissions as an array.
          sent: kept === undefined ? [] : record?.sent,
        });
      }
      return "saved";
    });
  }

  /** The essay of an attempt; none when the device keeps none, or one this build cannot read. */
  async essay(attemptId: string): Promise<Essay | undefined> {
    return essayOf(await this.connection.read([ESSAYS], (tx) => tx.get(ESSAYS, attemptId)), true);
  }

  /** The essays the profile keeps, the newest first, without their crops: `essay` reads those. */
  async essays(): Promise<Essay[]> {
    const kept = await this.connection.read([ESSAYS], (tx) => tx.entries(ESSAYS));
    return kept
      .flatMap(({ value }) => {
        const essay = essayOf(value, false);
        return essay === undefined ? [] : [essay];
      })
      .sort((a, b) => b.startedAt - a.startedAt);
  }

  /** A submission of an essay, with the crop it sent and how it ended, after those before. */
  async addEssaySubmission(
    attemptId: string,
    crop: Blob,
    sent: Omit<EssaySent, "at" | "crop">,
  ): Promise<Saved> {
    try {
      const bytes = await bytesOf(crop);
      return await this.connection.write(["attempts", ESSAYS], async (tx) => {
        const essay = (await tx.get(ESSAYS, attemptId)) as { sent?: unknown } | undefined;
        if (!Array.isArray(essay?.sent)) return "unsaved";
        await this.touch(tx, attemptId);
        const record = { ...sent, at: this.now(), crop: bytes };
        await tx.put(ESSAYS, attemptId, { ...essay, sent: [...essay.sent, record] });
        return "saved";
      });
    } catch {
      return "unsaved";
    }
  }

  /** An essay is erased, an adult's action: with its history, and its attempt's work if open. */
  async eraseEssay(attemptId: string): Promise<void> {
    await this.connection.write([...ATTEMPT_STORES, ESSAYS], async (tx) => {
      await tx.delete(ESSAYS, attemptId);
      await eraseAttempt(tx, attemptId);
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
    await this.connection.write([...ATTEMPT_STORES, "correctWork", ESSAYS], async (tx) => {
      if (work !== undefined) await tx.put("correctWork", attemptId, work);
      // An essay stays, ended, with its history and the open view of its task.
      const essay = (await tx.get(ESSAYS, attemptId)) as object | undefined;
      if (essay !== undefined) await tx.put(ESSAYS, attemptId, { ...essay, ended: true });
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
    await this.connection.write(["attempts", "lessons", ESSAYS], async (tx) => {
      for (const digest of digests) {
        const range = { lower: digest, upper: digest };
        for (const store of ["attempts", ESSAYS]) {
          for (const { key, value } of await tx.entries(store, { index: "digest", range })) {
            const { task: _, ...kept } = value as { readonly task?: unknown };
            await tx.put(store, key, kept);
          }
        }
        for (const { key } of await tx.entries("lessons", { index: "digest", range })) {
          await tx.delete("lessons", key);
        }
      }
    });
  }

  /** The digests of the packages of the attempts and the lessons this profile keeps. */
  async digests(): Promise<string[]> {
    return this.connection.read(["attempts", "lessons", ESSAYS], async (tx) => {
      const found = new Set<string>();
      // An attempt or an essay whose task's view a withdrawal took keeps no view of its package.
      for (const store of ["attempts", ESSAYS]) {
        for (const { value } of await tx.entries(store)) {
          const kept = value as Pick<Attempt, "digest" | "task">;
          if (kept.task !== undefined) found.add(kept.digest);
        }
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

  /** How many essays the profile keeps that this build reads, and so can list and erase. */
  async essayCount(): Promise<number> {
    return (await this.essays()).length;
  }

  /** What the profile keeps on this device: its unfinished attempts, and about how much space. */
  async usage(): Promise<Usage> {
    // Counted first and on its own: a count reads no record, and so it comes even when the sizes,
    // which read every record, do not.
    const unfinished = await this.unfinished();
    const essays = await this.essayCount();
    const bytes = await this.connection
      .read(STORES, async (tx) => {
        let sum = 0;
        for (const store of STORES) {
          for (const { key, value } of await tx.entries(store)) sum += sizeOf(key) + sizeOf(value);
        }
        return sum;
      })
      .catch(() => undefined);
    return { unfinished, essays, bytes };
  }

  /** The own key kept on this device; none when it is not kept, or its record cannot be read. */
  async ownKey(): Promise<KeptKey | undefined> {
    return keptKeyOf(
      await this.connection.read([OWN_KEY_STORE], (tx) => tx.get(OWN_KEY_STORE, OWN_KEY)),
    );
  }

  /** Keeps the own key on this device, in place of the one kept before (R47). */
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
   * Attempts and lessons last changed at a time or before go, with all of an attempt's work; an
   * essay's attempt stays, as its essay does, until an adult erases it (section 3.2).
   */
  async expire(cutoff: number): Promise<void> {
    const range = { upper: cutoff };
    await this.connection.write([...ATTEMPT_STORES, "lessons", ESSAYS], async (tx) => {
      for (const { key } of await tx.entries("attempts", { index: "changedAt", range })) {
        if ((await tx.get(ESSAYS, key)) === undefined) await eraseAttempt(tx, key as string);
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
