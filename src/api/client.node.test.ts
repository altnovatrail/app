// The client of the contract on connect-es's router, with no network (section 15 of the text of the
// contracts; R18 in docs/decisions.md): every branch of a refusal, the repeat, the token, and the
// open views without one.
import {
  AccountService,
  GetAccountResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  AttemptService,
  SubmitWorkResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import {
  Cause,
  CloseReason,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import {
  GetManifestResponseSchema,
  PackageService,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { create, type MessageInitShape } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "./client.ts";
import { ApiError, type Failure, parseFailure } from "./failure.ts";
import { PAUSES, STILL_GOING_MS } from "./interceptors.ts";
import { idempotencyKey } from "./keys.ts";
import type { Tokens } from "./tokens.ts";

/** An error of Connect with a refusal of a cause, and what it tells. */
function refused(code: Code, refusal: MessageInitShape<typeof RefusalSchema>): ConnectError {
  return new ConnectError("refused", code, undefined, [
    { desc: RefusalSchema, value: create(RefusalSchema, refusal) },
  ]);
}

/** Tokens that count their asking: "t1" first, then "t2" once refreshed, or none if told. */
function tokens(refreshed: string | null = "t2") {
  const asked: boolean[] = [];
  const fake: Tokens & { asked: boolean[] } = {
    asked,
    token: async (refresh) => {
      asked.push(refresh);
      return refresh ? (refreshed ?? undefined) : "t1";
    },
    signOut: vi.fn(async () => {}),
  };
  return fake;
}

function harness(routes: (router: ConnectRouter) => void, given = tokens()) {
  const sleeps: number[] = [];
  const on = {
    stale: vi.fn(),
    accountGone: vi.fn(async () => {}),
    noAccess: vi.fn(async () => {}),
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: given,
    on,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  return { api, on, sleeps, tokens: given };
}

/** What a call came to. */
async function failureOf(call: Promise<unknown>): Promise<Failure> {
  const error = await call.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(ApiError);
  return (error as ApiError).failure;
}

const GET_ACCOUNT = {} as const;

describe("the sign-in", () => {
  it("sends a request with no token when none can be had, and refreshes on its refusal", async () => {
    const sent: (string | null)[] = [];
    const failing: Tokens & { asked: boolean[] } = {
      asked: [],
      token: async (refresh) => {
        if (!refresh) throw new Error("offline");
        return "t2";
      },
      signOut: async () => {},
    };
    const { api } = harness(
      ({ service }) =>
        service(AccountService, {
          getAccount(_, context) {
            sent.push(context.requestHeader.get("Authorization"));
            if (sent.length === 1) throw new ConnectError("no token", Code.Unauthenticated);
            return create(GetAccountResponseSchema, {});
          },
        }),
      failing,
    );
    await api.account.getAccount(GET_ACCOUNT);
    expect(sent).toEqual([null, "Bearer t2"]);
  });

  it("refreshes on a refusal of a cause the build does not know, as on none", async () => {
    let calls = 0;
    const { api, tokens: used } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          calls += 1;
          if (calls === 1) throw refused(Code.Unauthenticated, { cause: 999 as Cause });
          return create(GetAccountResponseSchema, {});
        },
      }),
    );
    await api.account.getAccount(GET_ACCOUNT);
    expect(used.asked).toEqual([false, true]);
  });

  it("still tells the screen the refusal when the device fails to erase", async () => {
    const { api, on } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          throw refused(Code.Unauthenticated, { cause: Cause.ACCOUNT_GONE });
        },
        createAccount() {
          throw refused(Code.PermissionDenied, { cause: Cause.NO_ACCESS });
        },
      }),
    );
    on.accountGone.mockRejectedValueOnce(new Error("disk"));
    on.noAccess.mockRejectedValueOnce(new Error("disk"));
    expect(await failureOf(api.account.getAccount(GET_ACCOUNT))).toEqual({ kind: "account-gone" });
    expect(await failureOf(api.account.createAccount({}))).toEqual({ kind: "no-access" });
  });

  it("sends the ID token in Authorization, and nothing on the open views", async () => {
    const seen: (string | null)[] = [];
    const { api } = harness(({ service }) => {
      service(AccountService, {
        getAccount(_, context) {
          seen.push(context.requestHeader.get("Authorization"));
          return create(GetAccountResponseSchema, {});
        },
      });
      service(PackageService, {
        getManifest(_, context) {
          seen.push(context.requestHeader.get("Authorization"));
          return create(GetManifestResponseSchema, {});
        },
      });
    });
    await api.account.getAccount(GET_ACCOUNT);
    await api.package.getManifest({ packageDigest: "d1" });
    expect(seen).toEqual(["Bearer t1", null]);
  });

  it("refreshes an expired token once and repeats, and asks for the sign-in when it cannot", async () => {
    const tokensSent: (string | null)[] = [];
    let calls = 0;
    const routes = ({ service }: ConnectRouter) =>
      service(AccountService, {
        getAccount(_, context) {
          tokensSent.push(context.requestHeader.get("Authorization"));
          calls += 1;
          if (calls === 1) throw new ConnectError("expired", Code.Unauthenticated);
          return create(GetAccountResponseSchema, {});
        },
      });
    const { api, tokens: used } = harness(routes);
    await api.account.getAccount(GET_ACCOUNT);
    expect(tokensSent).toEqual(["Bearer t1", "Bearer t2"]);
    expect(used.asked).toEqual([false, true]);

    calls = 0;
    const nobody = harness(routes, tokens(null));
    expect(await failureOf(nobody.api.account.getAccount(GET_ACCOUNT))).toEqual({
      kind: "sign-in",
    });
    expect(calls).toBe(1);
  });

  it("reads the cause before any refresh: an account gone is erased and signed out, not refreshed", async () => {
    const {
      api,
      on,
      tokens: used,
    } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          throw refused(Code.Unauthenticated, { cause: Cause.ACCOUNT_GONE });
        },
      }),
    );
    expect(await failureOf(api.account.getAccount(GET_ACCOUNT))).toEqual({ kind: "account-gone" });
    expect(on.accountGone).toHaveBeenCalledOnce();
    expect(used.asked).toEqual([false]);
  });

  it("gives a fresh sign-in needed with its age, and no refresh", async () => {
    const { api, tokens: used } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          throw refused(Code.Unauthenticated, {
            cause: Cause.FRESH_SIGN_IN_NEEDED,
            data: { case: "maxAuthAgeSeconds", value: 300 },
          });
        },
      }),
    );
    expect(await failureOf(api.account.getAccount(GET_ACCOUNT))).toEqual({
      kind: "fresh-sign-in",
      maxAuthAgeSeconds: 300,
    });
    expect(used.asked).toEqual([false]);
  });

  it("on no access erases what is left of the account the registry names", async () => {
    const { api, on } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          throw refused(Code.PermissionDenied, { cause: Cause.NO_ACCESS });
        },
      }),
    );
    expect(await failureOf(api.account.getAccount(GET_ACCOUNT))).toEqual({ kind: "no-access" });
    expect(on.noAccess).toHaveBeenCalledOnce();
  });
});

describe("the repeat", () => {
  it("waits for a first request still going as long as api lets it go, at the pause Retry-After asks", async () => {
    const { api, sleeps } = harness(({ service }) =>
      service(AttemptService, {
        submitWork() {
          const error = refused(Code.Unavailable, { cause: Cause.STILL_GOING });
          error.metadata.set("Retry-After", "3");
          throw error;
        },
      }),
    );
    expect(await failureOf(api.attempt.submitWork({ idempotencyKey: "k" }))).toEqual({
      kind: "offline",
    });
    expect(sleeps).toEqual(Array(10).fill(3000));
    const plain = harness(({ service }) =>
      service(AttemptService, {
        submitWork() {
          throw refused(Code.Unavailable, { cause: Cause.STILL_GOING });
        },
      }),
    );
    await failureOf(plain.api.attempt.submitWork({ idempotencyKey: "k" }));
    expect(plain.sleeps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(STILL_GOING_MS);
    expect(plain.sleeps.slice(0, 5)).toEqual([500, 1000, 2000, 4000, 4000]);
  });

  it("does not repeat a call that was aborted", async () => {
    let calls = 0;
    const { api, sleeps } = harness(({ service }) =>
      service(AccountService, {
        getAccount() {
          calls += 1;
          throw new ConnectError("busy", Code.Unavailable);
        },
      }),
    );
    const controller = new AbortController();
    const call = api.account.getAccount(GET_ACCOUNT, { signal: controller.signal });
    controller.abort();
    await call.catch(() => {});
    expect(sleeps).toEqual([]);
    expect(calls).toBeLessThanOrEqual(1);
  });

  it("repeats unavailable after a growing pause, the same key each time, then gives no connection", async () => {
    const keys: string[] = [];
    const { api, sleeps } = harness(({ service }) =>
      service(AttemptService, {
        submitWork(request) {
          keys.push(request.idempotencyKey);
          throw new ConnectError("busy", Code.Unavailable);
        },
      }),
    );
    const key = idempotencyKey();
    expect(await failureOf(api.attempt.submitWork({ idempotencyKey: key }))).toEqual({
      kind: "offline",
    });
    expect(sleeps).toEqual([...PAUSES]);
    expect(keys).toEqual(Array(PAUSES.length + 1).fill(key));
  });

  it("repeats a request still going and a package api does not know yet, and takes the answer that comes", async () => {
    for (const cause of [Cause.STILL_GOING, Cause.PACKAGE_UNKNOWN]) {
      let calls = 0;
      const { api, sleeps } = harness(({ service }) =>
        service(AttemptService, {
          submitWork() {
            calls += 1;
            if (calls < 3) throw refused(Code.Unavailable, { cause });
            return create(SubmitWorkResponseSchema, { wrongAnswers: 1 });
          },
        }),
      );
      expect((await api.attempt.submitWork({ idempotencyKey: "k" })).wrongAnswers).toBe(1);
      expect(sleeps).toEqual([500, 1000]);
    }
  });

  it("does not repeat what will not come back", async () => {
    let calls = 0;
    const { api, sleeps } = harness(({ service }) =>
      service(AttemptService, {
        submitWork() {
          calls += 1;
          throw refused(Code.FailedPrecondition, {
            cause: Cause.ATTEMPT_CLOSED,
            data: { case: "closeReason", value: CloseReason.CORRECT },
          });
        },
      }),
    );
    expect(await failureOf(api.attempt.submitWork({}))).toEqual({
      kind: "refused",
      cause: Cause.ATTEMPT_CLOSED,
      data: { case: "closeReason", value: CloseReason.CORRECT },
      code: Code.FailedPrecondition,
    });
    expect([calls, sleeps.length]).toEqual([1, 0]);
  });
});

describe("what a call comes to", () => {
  it("offers a reload when api no longer has the method", async () => {
    const { api, on } = harness(() => {});
    expect(await failureOf(api.attempt.done({}))).toEqual({ kind: "stale" });
    expect(on.stale).toHaveBeenCalledOnce();
  });

  it("tells a refused form and a missing right without a cause, and anything else by its code", async () => {
    const { api } = harness(({ service }) =>
      service(AttemptService, {
        submitWork() {
          throw new ConnectError("form", Code.InvalidArgument);
        },
        getHint() {
          throw new ConnectError("right", Code.PermissionDenied);
        },
        beginStep() {
          throw new ConnectError("boom", Code.Internal);
        },
        done() {
          throw refused(Code.FailedPrecondition, { cause: 999 as Cause });
        },
      }),
    );
    expect(await failureOf(api.attempt.submitWork({}))).toEqual({ kind: "invalid" });
    expect(await failureOf(api.attempt.getHint({}))).toEqual({ kind: "forbidden" });
    expect(await failureOf(api.attempt.beginStep({}))).toEqual({
      kind: "unknown",
      code: Code.Internal,
    });
    // A cause the build does not know is read by the code of the error alone.
    expect(await failureOf(api.attempt.done({}))).toEqual({
      kind: "unknown",
      code: Code.FailedPrecondition,
    });
  });

  it("reads a cause the build does not know by the code of the error", () => {
    const unknown = (code: Code) => refused(code, { cause: 999 as Cause });
    expect(parseFailure(unknown(Code.Unauthenticated))).toEqual({ kind: "sign-in" });
    expect(parseFailure(unknown(Code.Unavailable))).toEqual({ kind: "offline" });
    expect(parseFailure(unknown(Code.PermissionDenied))).toEqual({ kind: "forbidden" });
    expect(parseFailure(unknown(Code.InvalidArgument))).toEqual({ kind: "invalid" });
    expect(parseFailure(new ConnectError("late", Code.DeadlineExceeded))).toEqual({
      kind: "offline",
    });
    expect(parseFailure(new Error("odd"))).toEqual({ kind: "unknown", code: Code.Unknown });
    const kept = new ApiError({ kind: "offline" });
    expect(parseFailure(kept)).toBe(kept.failure);
    const zero = parseFailure(refused(Code.Unauthenticated, { cause: Cause.FRESH_SIGN_IN_NEEDED }));
    expect(zero).toEqual({ kind: "fresh-sign-in", maxAuthAgeSeconds: 0 });
  });

  it("keeps what is not a method of the client as it is, and each method the same function", () => {
    const { api } = harness(() => {});
    expect(typeof api.account.getAccount).toBe("function");
    expect(api.account.getAccount).toBe(api.account.getAccount);
    expect((api.account as unknown as Record<string, unknown>).notAMethod).toBeUndefined();
  });
});
