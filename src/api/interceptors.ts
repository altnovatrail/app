// The interceptors of the contract's rules, outermost first:
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
  /** api no longer has a method: the build is older, and a reload is offered. */
  readonly stale: () => void;
  /** The account is no more: everything of it is erased, and the device signs out. */
  readonly accountGone: () => Promise<void>;
  /** The user has no account: what is left of the one the registry names is erased. */
  readonly noAccess: () => Promise<void>;
  /** api no longer gives a package's version: CheckPackages is asked. */
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
 * The methods whose absence is no build older than api: an api on an older tag of spec has no
 * legal texts in force and answers them `unimplemented`, nor a share of the quota to give;
 * an api with no `WorkService` keeps no work, which then stays on the device alone; and an
 * api beside the stub of tutor has no debug mode, which every build asks of it.
 */
const MAY_BE_ABSENT = new Set([
  "novatrail.api.v1.LegalService/GetLegalTexts",
  "novatrail.api.v1.AccountService/GetQuota",
  "novatrail.api.v1.WorkService/PutWork",
  "novatrail.api.v1.DebugService/GetDebug",
]);

/** The pauses before each repeat, ms: 7.5 s in all, "for a short while". */
export const PAUSES = [500, 1000, 2000, 4000] as const;

/**
 * How long a repeat waits for a first request still going, ms: as long as api lets a request go,
 * at the pause `Retry-After` asks, else at the last of PAUSES.
 */
export const STILL_GOING_MS = 30_000;

/**
 * api's limit of FindTasks, SubmitWork, GetOpeningWords and AskTutor, whose calls of a task from paper
 * ask up to three models in turn — the last two run the Check first while the attempt keeps none —:
 * a call of any of them names it as its deadline, since a shorter Connect-Timeout-Ms
 * would cut api short, and a repeat waits for a first one still going as long.
 */
export const PAPER_TIMEOUT_MS = 90_000;

const PAPER_METHODS = new Set([
  "novatrail.api.v1.PaperService/FindTasks",
  "novatrail.api.v1.AttemptService/SubmitWork",
  "novatrail.api.v1.AttemptService/GetOpeningWords",
  "novatrail.api.v1.AttemptService/AskTutor",
]);

/** How long a repeat waits for a first request of the method still going, ms. */
export function stillGoingMs(service: string, method: string): number {
  return PAPER_METHODS.has(`${service}/${method}`) ? PAPER_TIMEOUT_MS : STILL_GOING_MS;
}

/** The pause `Retry-After` asks for, ms, from the seconds api sends; none when it names none. */
export function retryAfter(headers: Pick<Headers, "get">): number | undefined {
  const seconds = Number(headers.get("Retry-After"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
}

/**
 * The methods whose `CAUSE_VERSION_NOT_GIVEN` is no withdrawal: `PutWork` gets it for a version out
 * of the window of formats that api reads, with no work of the attempt kept before.
 */
const NOT_WITHDRAWN = new Set(["novatrail.api.v1.WorkService/PutWork"]);

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
      else if (cause === Cause.VERSION_NOT_GIVEN && !NOT_WITHDRAWN.has(method)) on.withdrawn?.();
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
      // The cause first: a refusal with one is never met by a refresh.
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
        const limit = stillGoingMs(request.service.typeName, request.method.name);
        if (pause === undefined || (going && waited + pause > limit)) throw error;
        waited += pause;
        await sleep(pause);
      }
    }
  };
}

/** The bytes a message carries in its fields of bytes, a few levels down: a photo's, a crop's. */
export function bytesOf(message: unknown, depth = 3): number {
  if (message instanceof Uint8Array) return message.byteLength;
  if (depth === 0 || message === null || typeof message !== "object") return 0;
  let n = 0;
  for (const value of Array.isArray(message) ? message : Object.values(message))
    n += bytesOf(value, depth - 1);
  return n;
}

function size(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KiB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
}

/** Connect's code as the contract writes it: `invalid_argument`. */
function codeName(code: Code): string {
  return (Code[code] ?? String(code)).replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
}

/**
 * Each call to api as a line of the app's log, outermost, so once a call however often it was
 * repeated: the method, how it ended and how long it took, and what its fields of bytes held. The
 * message itself is never written: it may hold the learner's work.
 */
export function journaled(
  note: (
    level: "error" | "warn" | "info" | "debug",
    source: "api",
    text: string,
    detail: string,
  ) => void,
  now: () => number = () => performance.now(),
): Interceptor {
  return (next) => async (request) => {
    const method = `${request.service.typeName.split(".").pop()}/${request.method.name}`;
    const began = now();
    const sent = request.stream ? 0 : bytesOf(request.message);
    const fields = (took: number) =>
      [`took: ${(took / 1000).toFixed(1)} s`, sent > 0 ? `sent: ${size(sent)}` : ""].filter(
        Boolean,
      );
    try {
      const response = await next(request);
      const took = now() - began;
      note(
        "info",
        "api",
        `${method} · ok · ${(took / 1000).toFixed(1)} s`,
        ["code: ok", ...fields(took)].join("\n"),
      );
      return response;
    } catch (reason) {
      const took = now() - began;
      const error = ConnectError.from(reason);
      const code = codeName(error.code);
      const cause = refusalOf(error)?.cause;
      // A call the app called off is no failure of api's.
      const level = error.code === Code.Canceled ? "debug" : "error";
      note(
        level,
        "api",
        `${method} · ${code}${error.rawMessage ? ` · ${error.rawMessage}` : ""}`,
        [`code: ${code}`, cause === undefined ? "" : `cause: ${Cause[cause]}`, ...fields(took)]
          .filter(Boolean)
          .join("\n"),
      );
      throw error;
    }
  };
}
