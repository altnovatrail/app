// What a call of api that did not answer comes to, for the screens (section 15 of the text of the
// contracts; R18 in docs/decisions.md): a refusal with its cause and what it tells, or what the
// client itself makes of the code — no connection, a sign-in needed, a build that no longer
// understands api. A cause the build does not know it reads by the code of the error. No DOM.
import {
  Cause,
  type Cause as CauseValue,
  type Refusal,
  RefusalSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { Code, ConnectError } from "@connectrpc/connect";

export type Failure =
  /** A refusal: its cause, which the build may not know, what it tells beside it, and its code. */
  | {
      readonly kind: "refused";
      readonly cause: CauseValue;
      readonly data: Refusal["data"];
      readonly code: Code;
    }
  /** No network, api unavailable after its repeats, or no answer in time. */
  | { readonly kind: "offline" }
  /** The token could not be refreshed: the sign-in window, on a press. */
  | { readonly kind: "sign-in" }
  /** The action needs a sign-in no older than this. */
  | { readonly kind: "fresh-sign-in"; readonly maxAuthAgeSeconds: number }
  /** The account is no more; the device erased it and signed out. */
  | { readonly kind: "account-gone" }
  /** The user has no account: only its creation is open. */
  | { readonly kind: "no-access" }
  /** api no longer has the method: the build is older than api, and a reload is offered. */
  | { readonly kind: "stale" }
  /** The form of the request is refused: a fault of the build. */
  | { readonly kind: "invalid" }
  /** The request lacks the right it needs. */
  | { readonly kind: "forbidden" }
  /** Anything else, by its code. */
  | { readonly kind: "unknown"; readonly code: Code };

/** A call that did not answer: what it came to. */
export class ApiError extends Error {
  readonly failure: Failure;

  constructor(failure: Failure, cause?: unknown) {
    super(`api: ${failure.kind}`, { cause });
    this.name = "ApiError";
    this.failure = failure;
  }
}

/**
 * The refusal an error of Connect carries, if any, and if the build knows its cause: a cause it does
 * not know it reads by the code of the error alone (section 15).
 */
export function refusalOf(error: ConnectError): Refusal | undefined {
  const refusal = error.findDetails(RefusalSchema)[0];
  return refusal === undefined || Cause[refusal.cause] === undefined ? undefined : refusal;
}

/** What an error of a call comes to. */
export function parseFailure(error: unknown): Failure {
  if (error instanceof ApiError) return error.failure;
  if (!(error instanceof ConnectError)) return { kind: "unknown", code: Code.Unknown };
  const refusal = refusalOf(error);
  switch (error.code) {
    case Code.Unauthenticated:
      if (refusal?.cause === Cause.FRESH_SIGN_IN_NEEDED) {
        const age = refusal.data.case === "maxAuthAgeSeconds" ? refusal.data.value : 0;
        return { kind: "fresh-sign-in", maxAuthAgeSeconds: age };
      }
      if (refusal?.cause === Cause.ACCOUNT_GONE) return { kind: "account-gone" };
      return { kind: "sign-in" };
    case Code.Unavailable:
    case Code.DeadlineExceeded:
      return { kind: "offline" };
    case Code.Unimplemented:
      return { kind: "stale" };
    case Code.PermissionDenied:
      if (refusal?.cause === Cause.NO_ACCESS) return { kind: "no-access" };
      if (refusal === undefined) return { kind: "forbidden" };
      break;
    case Code.InvalidArgument:
      if (refusal === undefined) return { kind: "invalid" };
      break;
  }
  if (refusal === undefined) return { kind: "unknown", code: error.code };
  return { kind: "refused", cause: refusal.cause, data: refusal.data, code: error.code };
}
