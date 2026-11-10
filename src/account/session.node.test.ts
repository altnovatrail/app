// The sign-in and the account on connect-es's router, with no network (sections 3.2 and 3.10 of
// docs/architecture.md; section 15 of the text of the contracts): every refusal and every erasure.
import {
  AccountService,
  type CreateAccountRequest,
  type CreateOwnerProfileRequest,
  type ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import type { PackageChecks } from "../packages/checks.ts";
import type { Device } from "../storage/device.ts";
import { eraseAccount, noAccess } from "../storage/erase.ts";
import { MemoryBackend } from "../storage/memory.ts";
import { addProfile } from "../storage/profile.ts";
import { readRegistry, setAccount } from "../storage/registry.ts";
import { profileDatabase } from "../storage/schema.ts";
import { memoryDevice } from "../test/device.ts";
import { fakeSignIn } from "../test/signin.ts";
import { pseudonymOf, Session, type SessionState, unfinishedWork } from "./session.ts";

const PROJECT = { projectId: "example-project", apiKey: "synthetic-web-api-key" };

function refused(code: Code, cause: Cause): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
  ]);
}

function owner(profileId = "p1"): MessageInitShape<typeof ProfileSchema> {
  return { profileId, owner: true, pseudonym: "Ёжик", ageCategory: "adult", country: "US" };
}

function account(accountId = "account-1", profiles = [owner()]) {
  return { account: { accountId, profiles } };
}

interface Routes {
  getAccount?: () => unknown;
  createAccount?: (request: CreateAccountRequest) => unknown;
  createOwnerProfile?: (request: CreateOwnerProfileRequest) => unknown;
}

/** A session on the router, its device's erasures wired as Boot wires them. */
function harness(routes: Routes, user: string | null = "uid-1", device?: Device) {
  const setup = device === undefined ? memoryDevice() : { device };
  const service = fakeSignIn(user);
  const checks = { start: vi.fn(), stop: vi.fn(), check: vi.fn(async () => {}) };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: service,
    on: {
      stale: () => {},
      accountGone: async () => {
        await service.signOut();
        await eraseAccount(setup.device);
      },
      noAccess: async () => {
        await noAccess(setup.device);
      },
    },
    sleep: async () => {},
    transport: (interceptors) =>
      createRouterTransport(
        (router: ConnectRouter) =>
          router.service(AccountService, {
            getAccount: async () => (routes.getAccount ?? (() => account()))() as never,
            createAccount: async (request) => routes.createAccount?.(request) as never,
            createOwnerProfile: async (request) => routes.createOwnerProfile?.(request) as never,
          }),
        { transport: { interceptors } },
      ),
  });
  const session = new Session({
    api,
    device: setup.device,
    service,
    project: PROJECT,
    checks: checks as unknown as PackageChecks,
  });
  const steps: SessionState["step"][] = [];
  session.subscribe(() => steps.push(session.snapshot().step));
  return { session, service, checks, device: setup.device, steps };
}

/** Waits for the session to come to a step. */
async function settled(session: Session, step: SessionState["step"]): Promise<SessionState> {
  await vi.waitFor(() => expect(session.snapshot().step).toBe(step));
  return session.snapshot();
}

/** A device whose registry names an account, with a profile database of it. */
async function deviceOf(accountId: string, ...profileIds: string[]): Promise<Device> {
  const { device } = memoryDevice();
  await setAccount(device, accountId);
  for (const profileId of profileIds) await addProfile(device, profileId);
  return device;
}

describe("the session", () => {
  it("waits for the sign-in service, then shows the sign-in when nobody is signed in", async () => {
    const { session, service } = harness({}, null);
    service.set(undefined);
    session.start();
    expect(session.snapshot().step).toBe("starting");
    service.set(null);
    expect(session.snapshot().step).toBe("signed-out");
  });

  it("keeps the project of the sign-in, names the account, and offers its owner's profile", async () => {
    const { session, device, checks } = harness({});
    session.start();
    session.start();
    const state = await settled(session, "choose");
    expect(state).toMatchObject({ first: true, owner: { profileId: "p1", pseudonym: "Ёжик" } });
    const registry = await readRegistry(device);
    expect(registry?.account).toBe("account-1");
    expect(registry?.signIn).toEqual(PROJECT);
    expect(checks.start).toHaveBeenCalledOnce();
    expect(checks.check).toHaveBeenCalledOnce();
  });

  it("erases what another account left before anything opens, and the profiles api no longer lists", async () => {
    const backend = new MemoryBackend();
    const { device } = memoryDevice(backend);
    await setAccount(device, "account-0");
    await addProfile(device, "old");
    const { session } = harness({}, "uid-1", device);
    // What the device holds at the moment the choice of the learner comes.
    let atChoice: string[] | undefined;
    session.subscribe(() => {
      if (session.snapshot().step === "choose") atChoice ??= [...backend.databases.keys()];
    });
    session.start();
    expect(await settled(session, "choose")).toMatchObject({ first: true });
    expect(atChoice).not.toContain(profileDatabase("old"));
    expect((await readRegistry(device))?.databases.has(profileDatabase("old"))).toBe(false);

    const same = await deviceOf("account-1", "p1", "gone");
    const again = harness({}, "uid-1", same);
    again.session.start();
    expect(await settled(again.session, "choose")).toMatchObject({ first: false });
    const databases = (await readRegistry(same))?.databases;
    expect(databases?.has(profileDatabase("p1"))).toBe(true);
    expect(databases?.has(profileDatabase("gone"))).toBe(false);
  });

  it("erases nothing when api does not answer, and asks again on a retry", async () => {
    const device = await deviceOf("account-0", "old");
    let answer: () => unknown = () => {
      throw new ConnectError("down", Code.Unavailable);
    };
    const { session } = harness({ getAccount: () => answer() }, "uid-1", device);
    session.start();
    await settled(session, "offline");
    expect((await readRegistry(device))?.account).toBe("account-0");
    expect((await readRegistry(device))?.databases.has(profileDatabase("old"))).toBe(true);
    answer = () => account();
    await session.load();
    await settled(session, "choose");
  });

  it("asks for the invite code of a user with no account, after erasing what the registry named", async () => {
    const device = await deviceOf("account-0", "old");
    const { session } = harness(
      {
        getAccount: () => {
          throw refused(Code.PermissionDenied, Cause.NO_ACCESS);
        },
      },
      "uid-1",
      device,
    );
    session.start();
    await settled(session, "invite");
    const registry = await readRegistry(device);
    expect(registry?.account).toBeUndefined();
    expect(registry?.databases.has(profileDatabase("old"))).toBe(false);
  });

  it("shows the sign-in when the sign-in cannot be renewed, and asks again once signed in", async () => {
    let refuse = true;
    const { session, service } = harness({
      getAccount: () => {
        if (refuse) throw new ConnectError("expired", Code.Unauthenticated);
        return account();
      },
    });
    service.token = async (refresh) => (refresh ? undefined : "t");
    session.start();
    await settled(session, "signed-out");
    refuse = false;
    service.signInAs = "uid-1";
    expect(await session.signIn()).toEqual({ kind: "done" });
    await settled(session, "choose");
  });

  it("signs out of an account that is gone, erasing it", async () => {
    const device = await deviceOf("account-1", "p1");
    const { session, service } = harness(
      {
        getAccount: () => {
          throw refused(Code.Unauthenticated, Cause.ACCOUNT_GONE);
        },
      },
      "uid-1",
      device,
    );
    session.start();
    await settled(session, "signed-out");
    expect(service.calls.signOut).toBe(1);
    expect(await readRegistry(device)).toBeUndefined();
  });

  it("says what came of a window that did not sign in, and nothing of one closed", async () => {
    const { session, service } = harness({}, null);
    session.start();
    service.answer = { kind: "blocked" };
    await session.signIn();
    expect(session.snapshot()).toEqual({ step: "signed-out", result: { kind: "blocked" } });
    service.answer = { kind: "closed" };
    await session.signIn();
    expect(session.snapshot()).toEqual({ step: "signed-out" });
  });

  it("shows a failure no step is for, such as a method api no longer has", async () => {
    const { session } = harness({
      getAccount: () => {
        throw new ConnectError("gone", Code.Unimplemented);
      },
    });
    session.start();
    expect(await settled(session, "failed")).toEqual({
      step: "failed",
      failure: { kind: "stale" },
    });
  });

  it("drops the answer for a user another has replaced", async () => {
    let release: () => void = () => {};
    const asked: string[] = [];
    const { session, service } = harness({
      getAccount: () => {
        asked.push(service.user() ?? "");
        if (asked.length === 1) {
          return new Promise((resolve) => (release = () => resolve(account("account-old"))));
        }
        return account("account-2");
      },
    });
    session.start();
    await vi.waitFor(() => expect(asked).toEqual(["uid-1"]));
    service.set("uid-2");
    await settled(session, "choose");
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect((session.snapshot() as { account: { accountId: string } }).account.accountId).toBe(
      "account-2",
    );
  });

  it("chooses the owner's profile, and switches back to the choice", async () => {
    const { session } = harness({});
    session.start();
    await settled(session, "choose");
    session.switchLearner();
    expect(session.snapshot().step).toBe("choose");
    session.choose();
    expect(session.snapshot()).toMatchObject({ step: "learning", learner: { profileId: "p1" } });
    session.choose();
    expect(session.snapshot().step).toBe("learning");
    session.switchLearner();
    expect(session.snapshot()).toMatchObject({ step: "choose", first: false });
  });

  it("signs out of the sign-in service first, then erases everything of the account", async () => {
    const device = await deviceOf("account-1", "p1");
    const { session, service, checks } = harness({}, "uid-1", device);
    const order: string[] = [];
    const signOut = service.signOut;
    service.signOut = async () => {
      order.push(`sign-out ${String(await readRegistry(device).then((r) => r?.account))}`);
      await signOut();
    };
    session.start();
    await settled(session, "choose");
    expect(await session.signOut()).toBe("erased");
    expect(order).toEqual(["sign-out account-1"]);
    expect(await readRegistry(device)).toBeUndefined();
    expect(session.snapshot()).toEqual({ step: "signed-out" });
    expect(checks.stop).toHaveBeenCalled();
  });

  it("erases nothing when the sign-in service could not sign out, and stays where it was", async () => {
    const device = await deviceOf("account-1", "p1");
    const { session, service } = harness({}, "uid-1", device);
    service.signOut = async () => {
      throw new Error("no network");
    };
    session.start();
    await settled(session, "choose");
    expect(await session.signOut()).toBe("failed");
    expect(session.snapshot().step).toBe("choose");
    expect((await readRegistry(device))?.databases.has(profileDatabase("p1"))).toBe(true);
  });

  it("says when the browser did not erase all of a sign-out, which the next start erases", async () => {
    const backend = new MemoryBackend();
    const { device } = memoryDevice(backend);
    await setAccount(device, "account-1");
    await addProfile(device, "p1");
    const { session } = harness({}, "uid-1", device);
    session.start();
    await settled(session, "choose");
    backend.blocked.add(profileDatabase("p1"));
    expect(await session.signOut()).toBe("left");
    expect(session.snapshot().step).toBe("signed-out");
  });

  it("asks for the account once when the window signs in a new user", async () => {
    let asked = 0;
    const { session, service } = harness(
      {
        getAccount: () => {
          asked += 1;
          return account();
        },
      },
      null,
    );
    session.start();
    // The service tells its listeners after the window answers, as Firebase may.
    const set = service.set;
    service.signIn = async () => {
      queueMicrotask(() => set("uid-1"));
      return { kind: "done" };
    };
    await session.signIn();
    await settled(session, "choose");
    expect(asked).toBe(1);
  });

  it("drops the answer of a load once stopped, and starts again by the user then", async () => {
    let release: () => void = () => {};
    let first = true;
    const { session, checks } = harness({
      getAccount: () => {
        if (!first) return account();
        first = false;
        return new Promise((resolve) => (release = () => resolve(account("account-old"))));
      },
    });
    session.start();
    await vi.waitFor(() => expect(first).toBe(false));
    session.stop();
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(session.snapshot().step).toBe("loading");
    expect(checks.start).not.toHaveBeenCalled();
    session.start();
    expect(await settled(session, "choose")).toMatchObject({ account: { accountId: "account-1" } });
  });
});

describe("the session where it cannot go on", () => {
  it("opens nothing while another tab holds what another account left, and erases it on a retry", async () => {
    const backend = new MemoryBackend();
    const { device } = memoryDevice(backend);
    await setAccount(device, "account-0");
    await addProfile(device, "old");
    backend.blocked.add(profileDatabase("old"));
    const { session } = harness({}, "uid-1", device);
    session.start();
    await settled(session, "held");
    backend.blocked.clear();
    await session.load();
    await settled(session, "choose");
    expect((await readRegistry(device))?.databases.has(profileDatabase("old"))).toBe(false);
  });

  it("opens nothing of the account when the registry cannot be written", async () => {
    class Broken extends MemoryBackend {
      override async open(): Promise<never> {
        throw new Error("broken");
      }
    }
    const { session } = harness({}, "uid-1", memoryDevice(new Broken()).device);
    session.start();
    await settled(session, "unreadable");
  });

  it("shows a failure when api answers with no account, and waits when the service forgets its user", async () => {
    const { session, service } = harness({ getAccount: () => ({}) });
    session.start();
    expect(await settled(session, "failed")).toEqual({
      step: "failed",
      failure: { kind: "invalid" },
    });
    service.set(undefined);
    expect(session.snapshot().step).toBe("starting");
  });
});

describe("the forms of the account", () => {
  it("creates the account with the code as given and the statement of being 18", async () => {
    const created: CreateAccountRequest[] = [];
    let has = false;
    const { session } = harness({
      getAccount: () => {
        if (!has) throw refused(Code.PermissionDenied, Cause.NO_ACCESS);
        return account("account-1", []);
      },
      createAccount: (request) => {
        created.push(request);
        has = true;
        return { account: { accountId: "account-1", profiles: [] } };
      },
    });
    session.start();
    await settled(session, "invite");
    expect(await session.createAccount("0123-4567-89AB-CDEF")).toBe("done");
    expect(created[0]).toMatchObject({ inviteCode: "0123-4567-89AB-CDEF", adultStated: true });
    await settled(session, "owner-profile");
  });

  it("tells a code api did not take, and reads the account that is there already", async () => {
    let cause = Cause.CODE_NOT_ACCEPTED;
    let has = false;
    const { session } = harness({
      getAccount: () => {
        if (!has) throw refused(Code.PermissionDenied, Cause.NO_ACCESS);
        return account();
      },
      createAccount: () => {
        throw refused(
          cause === Cause.CODE_NOT_ACCEPTED ? Code.InvalidArgument : Code.AlreadyExists,
          cause,
        );
      },
    });
    session.start();
    await settled(session, "invite");
    expect(await session.createAccount("WRONG")).toBe("code-not-accepted");
    cause = Cause.ALREADY_EXISTS;
    has = true;
    expect(await session.createAccount("USED")).toBe("done");
    await settled(session, "choose");
  });

  it("gives the form a failure to show, and the sign-in when the sign-in is gone", async () => {
    let error = new ConnectError("down", Code.Unavailable);
    const { session } = harness({
      getAccount: () => {
        throw refused(Code.PermissionDenied, Cause.NO_ACCESS);
      },
      createAccount: () => {
        throw error;
      },
    });
    session.start();
    await settled(session, "invite");
    expect(await session.createAccount("CODE")).toEqual({ kind: "offline" });
    expect(session.snapshot().step).toBe("invite");
    error = new ConnectError("expired", Code.Unauthenticated);
    expect(await session.createAccount("CODE")).toEqual({ kind: "sign-in" });
    expect(session.snapshot().step).toBe("signed-out");
  });

  it("creates the owner's profile with its country and pseudonym, and tells a country not taken", async () => {
    const asked: CreateOwnerProfileRequest[] = [];
    let profiles: MessageInitShape<typeof ProfileSchema>[] = [];
    let cause: Cause | undefined = Cause.COUNTRY_NOT_ACCEPTED;
    const { session } = harness({
      getAccount: () => account("account-1", profiles),
      createOwnerProfile: (request) => {
        asked.push(request);
        if (cause === Cause.COUNTRY_NOT_ACCEPTED) throw refused(Code.FailedPrecondition, cause);
        if (cause === Cause.ALREADY_EXISTS) throw refused(Code.AlreadyExists, cause);
        if (cause !== undefined) throw refused(Code.FailedPrecondition, cause);
        profiles = [owner()];
        return { profile: owner() };
      },
    });
    session.start();
    await settled(session, "owner-profile");
    expect(await session.createOwnerProfile("Ёжик", "DE")).toBe("country-not-accepted");
    expect(asked[0]).toMatchObject({ country: "DE", settings: { pseudonym: "Ёжик" } });
    cause = undefined;
    expect(await session.createOwnerProfile("Ёжик", "US")).toBe("done");
    await settled(session, "choose");

    cause = Cause.ALREADY_EXISTS;
    expect(await session.createOwnerProfile("Ёжик", "US")).toBe("done");
    cause = Cause.NO_CONSENT;
    expect(await session.createOwnerProfile("Ёжик", "US")).toMatchObject({ kind: "refused" });
  });
});

describe("pseudonymOf", () => {
  it("trims the ends and counts Unicode code points, from 1 to 30", () => {
    expect(pseudonymOf("  Ёжик  ")).toBe("Ёжик");
    expect(pseudonymOf("   ")).toBeUndefined();
    const thirty = "🦔".repeat(30);
    expect(thirty.length).toBe(60);
    expect(pseudonymOf(thirty)).toBe(thirty);
    expect(pseudonymOf("🦔".repeat(31))).toBeUndefined();
  });
});

describe("unfinishedWork", () => {
  it("names each profile with unfinished attempts here, and no other", async () => {
    const device = await deviceOf("account-1", "p1", "p2");
    const p1 = await addProfile(device, "p1");
    await p1?.beginAttempt({ attemptId: "a1", digest: `sha256:${"1".repeat(64)}` });
    await p1?.beginAttempt({ attemptId: "a2", digest: `sha256:${"1".repeat(64)}` });
    const profiles = [owner("p1"), owner("p2"), owner("p3")].map((p) => ({
      ...p,
      pseudonym: p.profileId ?? "",
    }));
    expect(await unfinishedWork(device, profiles as never)).toEqual([
      { profileId: "p1", pseudonym: "p1", count: 2 },
    ]);
  });
});
