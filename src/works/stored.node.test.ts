// The works on the server, in Node (section 3.2 of docs/architecture.md; the 2026-11-17 amendment
// to R30): the form of `StoredWork`, the limit of 4 MiB, each answer of `PutWork` and what the
// device's marks say after it, the order of the sends, a work put once, a put the switch-off
// overtook, and the works the storage sends once on.
// The picture is a stand-in: the browser's test draws the canvas's own.
import {
  AccountService,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  type PutWorkRequest,
  WorkService,
} from "@altnovatrail/contracts/novatrail/api/v1/work_pb.js";
import type { HistoryEvent, SheetSubmission } from "@altnovatrail/spec/canvas";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { addProfile, attemptOver, type DeviceWork, type Profile } from "../storage/profile.ts";
import { setAccount } from "../storage/registry.ts";
import { memoryDevice } from "../test/device.ts";
import { createSender, type Draw, MAX_WORK, storedWork } from "./stored.ts";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const draw = async () => new Blob([new Uint8Array(SIGNATURE)], { type: "image/png" });

function stroke(id: number): HistoryEvent {
  return {
    kind: "write",
    t: id * 100,
    stroke: { id, kind: "pen", points: [{ x: id, y: 1, t: 0, p: 0.5 }] },
  };
}

const CONTEXT = { crop: { sheetBox: [1, 2, 3, 4] }, digest: "abc" } as unknown as SheetSubmission;

function refused(cause: Cause, code = Code.FailedPrecondition): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

/** The profile p1's database, with the attempt a1: two strokes and one submission after the first. */
async function profileWithWork(): Promise<Profile> {
  const { device } = memoryDevice();
  await setAccount(device, "account-1");
  const profile = await addProfile(device, "p1");
  if (profile === undefined) throw new Error("no profile database");
  await profile.beginAttempt({ attemptId: "a1", digest: "d1" });
  await profile.replaceHistory("a1", [stroke(1), stroke(2)]);
  const png = await draw();
  await profile.addSubmission("a1", { png, submission: CONTEXT }, 1);
  return profile;
}

/** A sender on api's routes, and what it asked and what it did. */
function sender(put: (request: PutWorkRequest) => void, on = true, drawn: Draw = draw) {
  const asked: PutWorkRequest[] = [];
  const stale = vi.fn();
  const withdrawn = vi.fn();
  const changed: string[] = [];
  const storage = { on };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, withdrawn, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) => {
          router.service(WorkService, {
            putWork(request) {
              asked.push(request);
              put(request);
              return { work: { attemptId: request.work?.attemptId ?? "" } };
            },
          });
          router.service(AccountService, {
            getAccount() {
              const profile = create(ProfileSchema, { profileId: "p1", workStorage: false });
              return { account: { accountId: "account-1", profiles: [profile] } };
            },
          });
        },
        { transport: { interceptors } },
      ),
  });
  const works = createSender({
    api,
    profileId: "p1",
    draw: drawn,
    storageOn: () => storage.on,
    onProfile: (profile) => changed.push(`${profile.profileId} ${profile.workStorage}`),
  });
  // What an earlier test's sender put of p1 is no copy for this one.
  works.forget();
  return { works, asked, stale, withdrawn, changed, storage };
}

const decoder = new TextDecoder();

describe("the stored work", () => {
  it("is the history and each context as JSON in UTF-8, and the picture, with no kind or time", () => {
    const work: DeviceWork = {
      attemptId: "a1",
      history: [stroke(1)],
      submissions: [{ context: CONTEXT, historyLength: 1 }],
    };
    const picture = new Uint8Array(SIGNATURE);
    const stored = storedWork(work, picture);
    expect(stored?.attemptId).toBe("a1");
    expect(JSON.parse(decoder.decode(stored?.history as Uint8Array))).toEqual(work.history);
    const [submission] = stored?.submissions ?? [];
    expect(JSON.parse(decoder.decode(submission?.context as Uint8Array))).toEqual(CONTEXT);
    expect(submission?.historyLength).toBe(1);
    expect(stored?.picture).toBe(picture);
    expect(stored).not.toHaveProperty("kind");
    expect(stored).not.toHaveProperty("storedAt");
  });

  it("goes up to 4 MiB of history, contexts and picture, and not a byte over", () => {
    const work: DeviceWork = { attemptId: "a1", history: [], submissions: [] };
    // "[]" is two bytes of history.
    expect(storedWork(work, new Uint8Array(MAX_WORK - 2))).toBeDefined();
    expect(storedWork(work, new Uint8Array(MAX_WORK - 1))).toBeUndefined();
    const context = { context: CONTEXT, historyLength: 0 };
    const size = new TextEncoder().encode(JSON.stringify(CONTEXT)).length;
    const one = { ...work, submissions: [context] };
    expect(storedWork(one, new Uint8Array(MAX_WORK - 2 - size))).toBeDefined();
    expect(storedWork(one, new Uint8Array(MAX_WORK - 1 - size))).toBeUndefined();
  });
});

describe("PutWork", () => {
  it("keeps the work as the device holds it, and marks it on the profile", async () => {
    const profile = await profileWithWork();
    expect((await profile.usage()).stored).toBe(false);
    const { works, asked } = sender(() => {});
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(asked).toHaveLength(1);
    expect(asked[0]?.profileId).toBe("p1");
    const work = asked[0]?.work;
    expect(JSON.parse(decoder.decode(work?.history))).toEqual([stroke(1), stroke(2)]);
    expect(work?.submissions.map((one) => one.historyLength)).toEqual([1]);
    expect(JSON.parse(decoder.decode(work?.submissions[0]?.context))).toEqual(CONTEXT);
    expect([...(work?.picture ?? [])]).toEqual(SIGNATURE);
    expect((await profile.usage()).stored).toBe(true);
    // A stroke more is on this device alone, until the next PutWork.
    await profile.appendHistory("a1", { from: 2, events: [stroke(3)] });
    expect((await profile.usage()).stored).toBe(false);
  });

  it("sends nothing while the storage is off, nor of an attempt the device keeps nothing of", async () => {
    const profile = await profileWithWork();
    const { works, asked, storage } = sender(() => {}, false);
    expect(await works.put(profile, "a1")).toBeUndefined();
    storage.on = true;
    expect(await works.put(profile, "a9")).toBeUndefined();
    expect(asked).toEqual([]);
  });

  it("leaves a work over 4 MiB on the device alone, unsent", async () => {
    const profile = await profileWithWork();
    const big = async () => new Blob([new Uint8Array(MAX_WORK)]);
    const { works, asked } = sender(() => {}, true, big);
    expect(await works.put(profile, "a1")).toBe("too-large");
    expect(asked).toEqual([]);
    expect((await profile.usage()).stored).toBe(false);
  });

  it("reads api's refusal of a work too large, and its code before the refusal, as too large", async () => {
    const profile = await profileWithWork();
    const refusal = sender(() => {
      throw refused(Cause.WORK_TOO_LARGE, Code.InvalidArgument);
    });
    expect(await refusal.works.put(profile, "a1")).toBe("too-large");
    const unread = sender(() => {
      throw new ConnectError("too large to read", Code.ResourceExhausted);
    });
    expect(await unread.works.put(profile, "a1")).toBe("too-large");
    expect((await profile.usage()).stored).toBe(false);
  });

  it("on the storage off reads the profile again, and lets go of the marks", async () => {
    const profile = await profileWithWork();
    expect(await sender(() => {}).works.put(profile, "a1")).toBe("kept");
    expect((await profile.usage()).stored).toBe(true);
    const { works, changed } = sender(() => {
      throw refused(Cause.STORAGE_OFF);
    });
    expect(await works.put(profile, "a1")).toBe("storage-off");
    expect(changed).toEqual(["p1 false"]);
    expect((await profile.usage()).stored).toBe(false);
  });

  it("goes on as before with an api that has no WorkService, offering no reload", async () => {
    const profile = await profileWithWork();
    const { works, stale } = sender(() => {
      throw new ConnectError("no such method", Code.Unimplemented);
    });
    expect(await works.put(profile, "a1")).toBe("absent");
    expect(stale).not.toHaveBeenCalled();
    expect((await profile.usage()).stored).toBe(false);
  });

  it("marks nothing when the network fails, and the next PutWork carries the work again", async () => {
    const profile = await profileWithWork();
    let down = true;
    const { works, asked } = sender(() => {
      if (down) throw new ConnectError("the network failed", Code.Unavailable);
    });
    expect(await works.put(profile, "a1")).toBe("failed");
    expect((await profile.usage()).stored).toBe(false);
    down = false;
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(asked.at(-1)?.work?.history).toEqual(asked[0]?.work?.history);
    expect((await profile.usage()).stored).toBe(true);
  });

  it("marks nothing for another refusal: a package api's index does not know, a version out of its window", async () => {
    const profile = await profileWithWork();
    for (const cause of [Cause.PACKAGE_UNKNOWN, Cause.VERSION_NOT_GIVEN, Cause.NOT_FOUND]) {
      const { works, withdrawn } = sender(() => {
        throw refused(cause);
      });
      expect(await works.put(profile, "a1")).toBe("failed");
      expect((await profile.usage()).stored).toBe(false);
      // No version was withdrawn: PackageService is not asked.
      expect(withdrawn).not.toHaveBeenCalled();
    }
  });

  it("puts a work once: the same history and contexts again do not go, a stroke more does", async () => {
    const profile = await profileWithWork();
    const { works, asked } = sender(() => {});
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(asked).toHaveLength(1);
    await profile.appendHistory("a1", { from: 2, events: [stroke(3)] });
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(asked).toHaveLength(2);
    // A history replaced by one of the same length is another work: its mark goes, and it goes.
    await profile.replaceHistory("a1", [stroke(4), stroke(5), stroke(6)]);
    expect((await profile.usage()).stored).toBe(false);
    expect(await works.put(profile, "a1")).toBe("kept");
    expect(asked).toHaveLength(3);
    expect((await profile.usage()).stored).toBe(true);
  });

  it("marks nothing of a PutWork the switch-off overtook", async () => {
    const profile = await profileWithWork();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let drawing: () => void = () => {};
    const drawn = new Promise<void>((resolve) => {
      drawing = resolve;
    });
    const slow: Draw = async () => {
      drawing();
      await held;
      return draw();
    };
    const { works, asked } = sender(() => {}, true, slow);
    const sending = works.put(profile, "a1");
    await drawn;
    // The adult switched the storage off: the server erased its copies.
    works.forget();
    await profile.clearStored();
    release();
    expect(await sending).toBe("storage-off");
    expect(asked).toHaveLength(1);
    expect((await profile.usage()).stored).toBe(false);
  });

  it("sends no other work once api said the storage is off, until the profile says so too", async () => {
    const profile = await profileWithWork();
    await profile.beginAttempt({ attemptId: "a2", digest: "d1" });
    await profile.replaceHistory("a2", [stroke(1)]);
    let off = true;
    const { works, asked, storage } = sender(() => {
      if (off) throw refused(Cause.STORAGE_OFF);
    });
    const first = works.put(profile, "a1");
    const second = works.put(profile, "a2");
    expect(await first).toBe("storage-off");
    expect(await second).toBe("storage-off");
    expect(asked).toHaveLength(1);
    // The profile read again says off, and later on: the works go again.
    storage.on = false;
    expect(await works.put(profile, "a2")).toBeUndefined();
    storage.on = true;
    off = false;
    expect(await works.put(profile, "a2")).toBe("kept");
    expect(asked).toHaveLength(2);
  });

  it("sends the works in the order they were read, the last one read standing", async () => {
    const profile = await profileWithWork();
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const lengths: number[] = [];
    // The picture of the first work read takes its time; the second one's comes at once.
    const slow: Draw = async (history) => {
      if (history.length === 2) await held;
      return draw();
    };
    const { works } = sender(
      (request) => lengths.push(JSON.parse(decoder.decode(request.work?.history)).length),
      true,
      slow,
    );
    const first = await works.read(profile, "a1");
    await profile.appendHistory("a1", { from: 2, events: [stroke(3)] });
    const second = await works.read(profile, "a1");
    if (first === undefined || second === undefined) throw new Error("no work read");
    const sending = works.send(profile, first);
    const after = works.send(profile, second);
    release();
    expect(await sending).toBe("kept");
    expect(await after).toBe("kept");
    // The second waited its turn: the server holds the later one.
    expect(lengths).toEqual([2, 3]);
  });
});

describe("switching the storage on", () => {
  it("sends every work the profile keeps: the attempts and the essays", async () => {
    const profile = await profileWithWork();
    await profile.beginAttempt({ attemptId: "e1", digest: "d1" });
    await profile.beginEssay({ attemptId: "e1", digest: "d1" }, "en");
    await profile.replaceHistory("e1", [stroke(1)]);
    await profile.addEssaySubmission("e1", await draw(), {
      end: "feedback",
      context: CONTEXT,
      historyLength: 1,
    });
    // An essay of a build before T62 keeps no context: that submission does not go.
    await profile.addEssaySubmission("e1", await draw(), { end: "unchecked" });
    await profile.attemptEnded("e1");
    // An attempt just opened, with neither strokes nor submissions, needs no copy.
    await profile.beginAttempt({ attemptId: "x1", digest: "d1" });
    const { works, asked } = sender(() => {});
    await works.putAll(profile);
    expect(asked.map((one) => one.work?.attemptId).sort()).toEqual(["a1", "e1"]);
    const essay = asked.find((one) => one.work?.attemptId === "e1")?.work;
    expect(essay?.submissions.map((one) => one.historyLength)).toEqual([1]);
    expect((await profile.usage()).stored).toBe(true);
    // Switched off: the server erased its copies, and no mark holds.
    await profile.clearStored();
    expect((await profile.usage()).stored).toBe(false);
  });
});

describe("an attempt that closes", () => {
  it("goes to the server as it was at the end, then off the device; an essay keeps its mark", async () => {
    const { device } = memoryDevice();
    await setAccount(device, "account-1");
    const profile = await addProfile(device, "p1");
    if (profile === undefined) throw new Error("no profile database");
    await profile.beginAttempt({ attemptId: "a1", digest: "d1" });
    await profile.replaceHistory("a1", [stroke(1), stroke(2), stroke(3)]);
    await profile.beginAttempt({ attemptId: "e1", digest: "d1" });
    await profile.beginEssay({ attemptId: "e1", digest: "d1" }, "en");
    await profile.replaceHistory("e1", [stroke(1)]);
    const { works, asked } = sender(() => {});
    let sent: Promise<unknown> = Promise.resolve();
    const watched = {
      read: works.read,
      send: (...args: Parameters<typeof works.send>) => {
        sent = works.send(...args);
        return sent;
      },
    };
    await attemptOver(device, "p1", "a1", { held: profile, works: watched });
    // The attempt is off the device at once, and its work, read before, goes after.
    expect(await profile.readAttempt("a1")).toBeUndefined();
    await sent;
    expect(JSON.parse(decoder.decode(asked[0]?.work?.history))).toHaveLength(3);
    await attemptOver(device, "p1", "e1", { held: profile, works: watched });
    await sent;
    expect(asked.map((one) => one.work?.attemptId)).toEqual(["a1", "e1"]);
    expect((await profile.essay("e1"))?.stored).toEqual({ history: 1, submissions: 0 });
    expect((await profile.usage()).stored).toBe(true);
  });
});
