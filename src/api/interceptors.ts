// The interceptors of the contract's rules (section 15 of the text of the contracts; R18 in
// docs/decisions.md), outermost first:
// - what the device does on a refusal: the account gone — erased and signed out; no access — what is
//   left of the account before erased; a method api no longer has — a reload offered;
// - the sign-in: the ID token in `Authorization` on every request but the open views and the legal
//   texts, and on `unauthenticated` with no refusal one refresh and one repeat — the cause read
//   first, so that the refusal of an account gone is never met by a refresh;
// - the repeat of what may come back: `unavailable`, no network among it, after a growing pause, for
//   a short while, the same message and so the same idempotency key.
// No header of app's own: whatever else a request says is a field of its message.
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { Code, ConnectError, type Interceptor } from "@connectrpc/connect";
import { refusalOf } from "./failure.ts";
import type { Tokens } from "./tokens.ts";

/** What the device does on the refusals that touch it. */
export interface ApiEvents {
  /** api no longer has a method: the build is older, and a reload is offered (section 3.7). */
  readonly stale: () => void;
  /** The account is no more: everything of it is erased, and the device signs out. */
  readonly accountGone: () => Promise<void>;
  /** The user has no account: what is left of the one the registry names is erased (R04). */
  readonly noAccess: () => Promise<void>;
  /** api no longer gives a package's version: CheckPackages is asked (section 15; T21). */
  readonly withdrawn?: () => void;
}

/** The methods that go without a token: the four open views and the legal texts. */
const OPEN = new Set([
  "novatrail.api.v1.PackageService/GetManifest",
  "novatrail.api.v1.PackageService/GetSkillGraph",
  "novatrail.api.v1.PackageService/GetTechniques",
  "novatrail.api.v1.PackageService/GetSolvingSteps",
  "novatrail.api.v1.LegalService/GetLegalTexts",
]);

/**
 * The methods whose absence is no build older than api: the legal texts came with spec v0.13.0,
 * and an api on an older tag, which has none in force, answers them `unimplemented` (R27).
 */
const MAY_BE_ABSENT = new Set(["novatrail.api.v1.LegalService/GetLegalTexts"]);

/** The pauses before each repeat, ms: 7.5 s in all, "for a short while". */
export const PAUSES = [500, 1000, 2000, 4000] as const;

/**
 * How long a repeat waits for a first request still going, ms: as long as api lets a request go
 * (R33 in api), at the pause `Retry-After` asks, else at the last of PAUSES.
 */
export const STILL_GOING_MS = 30_000;

/** The pause `Retry-After` asks for, ms, from the seconds api sends; none when it names none. */
export function retryAfter(headers: Pick<Headers, "get">): number | undefined {
  const seconds = Number(headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/** The device's part in the refusals that touch it. */
export function effects(on: ApiEvents): Interceptor {
  return (next) => async (request) => {
    try {
      return await next(request);
    } catch (reason) {
      const error = ConnectError.from(reason);
      const cause = refusalOf(error)?.cause;
      // What the device does cannot take the refusal's place: the screen still learns of it.
      const method = `${request.service.typeName}/${request.method.name}`;
      if (error.code === Code.Unimplemented) {
        if (!MAY_BE_ABSENT.has(method)) on.stale();
      } else if (cause === Cause.ACCOUNT_GONE) await on.accountGone().catch(() => {});
      else if (cause === Cause.NO_ACCESS) await on.noAccess().catch(() => {});
      else if (cause === Cause.VERSION_NOT_GIVEN) on.withdrawn?.();
      throw error;
    }
  };
}

/** The ID token on every request that needs one, refreshed once when it has expired. */
export function signIn(tokens: Tokens): Interceptor {
  return (next) => async (request) => {
    if (OPEN.has(`${request.service.typeName}/${request.method.name}`)) return next(request);
    // A token that cannot be had is none: api answers unauthenticated, and the refresh follows.
    const token = await tokens.token(false).catch(() => undefined);
    if (token !== undefined) request.header.set("Authorization", `Bearer ${token}`);
    try {
      return await next(request);
    } catch (reason) {
      const error = ConnectError.from(reason);
      // The cause first: a refusal with one is never met by a refresh (section 15).
      if (error.code !== Code.Unauthenticated || refusalOf(error) !== undefined) throw error;
      const fresh = await tokens.token(true).catch(() => undefined);
      if (fresh === undefined) throw error;
      request.header.set("Authorization", `Bearer ${fresh}`);
      return next(request);
    }
  };
}

/**
 * The repeat of a request api may answer in a moment, after a growing pause; of one still going,
 * for as long as api lets the first go.
 */
export function repeat(sleep: (ms: number) => Promise<void>): Interceptor {
  return (next) => async (request) => {
    let waited = 0;
    for (let tried = 0; ; tried++) {
      try {
        return await next(request);
      } catch (reason) {
        const error = ConnectError.from(reason);
        // A call its deadline or its caller aborted is over: no repeat brings it back.
        if (error.code !== Code.Unavailable || request.signal.aborted) throw error;
        const going = refusalOf(error)?.cause === Cause.STILL_GOING;
        const last = PAUSES[PAUSES.length - 1] as number;
        const pause = going ? (retryAfter(error.metadata) ?? PAUSES[tried] ?? last) : PAUSES[tried];
        if (pause === undefined || (going && waited + pause > STILL_GOING_MS)) throw error;
        waited += pause;
        await sleep(pause);
      }
    }
  };
}
