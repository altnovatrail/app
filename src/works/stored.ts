// The works of a profile on the server (R30; `WorkService` of the contract), with
// no DOM: while the profile's storage of works is on, `PutWork` keeps each work as the device holds
// it — the history of writing, the contexts of its submissions and the picture the canvas draws of
// it — at each submission, when its attempt closes, and when the storage is switched on. A work
// over 4 MiB goes nowhere, and one that did not go through stays on the device alone: only a
// `PutWork` that went through marks how much of the work the server keeps, and the page This device
// warns of the loss of every work no mark covers. The works go one after another, in the order they
// were read, so that the last one read stands, and one the tab put already, the same history and
// contexts, does not go again.
import type { Profile as Learner } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { StoredWorkSchema } from "@altnovatrail/contracts/novatrail/api/v1/work_pb.js";
import type { HistoryEvent } from "@altnovatrail/spec/canvas";
import type { MessageInitShape } from "@bufbuild/protobuf";
import { Code } from "@connectrpc/connect";
import type { Api } from "../api/client.ts";
import { parseFailure, refusedWith } from "../api/failure.ts";
import type { DeviceWork, Profile } from "../storage/profile.ts";

/** The largest work the server keeps, as `StoredWork` counts it: 4 MiB. */
export const MAX_WORK = 4_194_304;

/**
 * What came of a work: kept; over 4 MiB, by app's count or api's; the storage is off; api has no
 * `WorkService`; or another refusal, or no answer. Only "kept" leaves a mark.
 */
export type Put = "kept" | "too-large" | "storage-off" | "absent" | "failed";

/** The picture of a history: the PNG the canvas draws of the strokes it holds. */
export type Draw = (history: readonly HistoryEvent[]) => Promise<Blob>;

const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(JSON.stringify(value));

/**
 * The work as `PutWork` carries it, without `kind` and `stored_at`, which api sets: the history the
 * JSON array of it and each context the JSON object of it, in UTF-8, as the canvas gave them, and
 * the picture. None when it is larger than the server keeps: the sum of the bytes of the history,
 * of the contexts and of the picture.
 */
export function storedWork(
  work: DeviceWork,
  picture: Uint8Array,
): MessageInitShape<typeof StoredWorkSchema> | undefined {
  const history = json(work.history);
  const submissions = work.submissions.map(({ context, historyLength }) => ({
    context: json(context),
    historyLength,
  }));
  const size = submissions.reduce(
    (sum, { context }) => sum + context.length,
    history.length + picture.length,
  );
  if (size > MAX_WORK) return undefined;
  return { attemptId: work.attemptId, history, submissions, picture };
}

export interface SenderOptions {
  readonly api: Api;
  readonly profileId: string;
  readonly draw: Draw;
  /** Whether the profile's storage of works is on, as the tab knows it now. */
  readonly storageOn: () => boolean;
  /** api said the storage is off: the profile read again, as after `SetWorkStorage`. */
  readonly onProfile: (profile: Learner) => void;
}

/** The works of one profile, sent one after another in the order they were read. */
export interface Sender {
  /** The work as the device holds it now; none while the storage is off, or with nothing kept. */
  readonly read: (profile: Profile, attemptId: string) => Promise<DeviceWork | undefined>;
  /** Sends a work read, after those read before it; "kept" marks it on the profile. */
  readonly send: (profile: Profile, work: DeviceWork) => Promise<Put>;
  /** Reads the work of an attempt and sends it; none when there was nothing to send. */
  readonly put: (profile: Profile, attemptId: string) => Promise<Put | undefined>;
  /** Every work the profile keeps but an empty one, each read in its turn: the storage switched on. */
  readonly putAll: (profile: Profile) => Promise<void>;
  /**
   * The server's copies of the profile gone, the storage switched off: what the tab put before is
   * no copy now, and a `PutWork` still going marks nothing when it comes back.
   */
  readonly forget: () => void;
}

/** The sends of the tab, one after another: a later work never overtakes an earlier one. */
let queue: Promise<unknown> = Promise.resolve();

/** How many times the server's copies of each profile went, as the tab learnt of it. */
const epochs = new Map<string, number>();

/** The digest of the history and the contexts of each work the tab put, by profile and attempt. */
const digests = new Map<string, string>();

/** The server keeps no copy of the profile's works that the tab put: as `Sender.forget`. */
export function forgetPuts(profileId: string): void {
  epochs.set(profileId, (epochs.get(profileId) ?? 0) + 1);
  for (const key of digests.keys()) if (key.startsWith(`${profileId} `)) digests.delete(key);
}

async function digestOf(work: DeviceWork): Promise<string> {
  const bytes = json([work.history, work.submissions]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function inTurn<T>(job: () => Promise<T>): Promise<T> {
  const done = queue.then(job);
  queue = done.catch(() => {});
  return done;
}

export function createSender(options: SenderOptions): Sender {
  const { api, profileId, draw } = options;
  // api said the storage is off before the profile the tab holds says so: no other work goes
  // until it does.
  let off = false;
  const storageOn = () => {
    const on = options.storageOn();
    if (!on) off = false;
    return on && !off;
  };

  /** The profile again, from the account, and its marks gone: the server keeps no copy now. */
  async function storageOff(profile: Profile): Promise<void> {
    off = true;
    forgetPuts(profileId);
    await profile.clearStored().catch(() => {});
    const account = await api.account.getAccount({}).catch(() => undefined);
    const changed = account?.account?.profiles.find((one) => one.profileId === profileId);
    if (changed !== undefined) options.onProfile(changed);
  }

  async function sendNow(profile: Profile, work: DeviceWork): Promise<Put> {
    if (!storageOn()) return "storage-off";
    const key = `${profileId} ${work.attemptId}`;
    const digest = await digestOf(work);
    if (digests.get(key) === digest) return "kept";
    const epoch = epochs.get(profileId) ?? 0;
    const picture = new Uint8Array(await (await draw(work.history)).arrayBuffer());
    const stored = storedWork(work, picture);
    if (stored === undefined) return "too-large";
    try {
      await api.work.putWork({ profileId, work: stored });
    } catch (reason) {
      const failure = parseFailure(reason);
      if (refusedWith(failure, Cause.STORAGE_OFF)) {
        await storageOff(profile);
        return "storage-off";
      }
      if (refusedWith(failure, Cause.WORK_TOO_LARGE)) return "too-large";
      // A message larger than api reads, refused before it is parsed, with no refusal.
      if (failure.kind === "unknown" && failure.code === Code.ResourceExhausted) return "too-large";
      return failure.kind === "stale" ? "absent" : "failed";
    }
    if ((epochs.get(profileId) ?? 0) !== epoch) return "storage-off";
    digests.set(key, digest);
    const mark = { history: work.history.length, submissions: work.submissions.length };
    await profile.markStored(work.attemptId, mark).catch(() => {});
    return "kept";
  }

  const read = async (profile: Profile, attemptId: string) =>
    storageOn() ? profile.work(attemptId) : undefined;
  const send = (profile: Profile, work: DeviceWork) =>
    inTurn(() => sendNow(profile, work)).catch((): Put => "failed");
  return {
    read,
    send,
    async put(profile, attemptId) {
      const work = await read(profile, attemptId);
      return work === undefined ? undefined : send(profile, work);
    },
    async putAll(profile) {
      for (const attemptId of await profile.works().catch(() => [])) {
        void inTurn(async () => {
          const work = await read(profile, attemptId);
          if (work === undefined) return;
          // An attempt with neither strokes nor submissions is covered with no copy.
          if (work.history.length > 0 || work.submissions.length > 0) await sendNow(profile, work);
        }).catch(() => {});
      }
      await inTurn(async () => {});
    },
    forget: () => forgetPuts(profileId),
  };
}
