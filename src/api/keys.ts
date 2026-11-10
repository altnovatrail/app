// What a request carries in its message, by the contract's rules (section 15 of the text of the
// contracts; R18 in docs/decisions.md): the idempotency key of an action that must not be done
// twice, and, with a request on platform AI alone, the offset of the device's clock from UTC for
// the family day of the quota; with the learner's own key, the key and not the offset. No DOM.
import type { OwnKey } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";

/**
 * A new idempotency key, for one action of the learner: the screen keeps it with the action and
 * sends it with every repeat of it.
 */
export function idempotencyKey(): string {
  return crypto.randomUUID();
}

/** The offset of the device's clock from UTC, in minutes: +180 in Moscow. */
export function clockOffsetMinutes(now: Date = new Date()): number {
  return -now.getTimezoneOffset() || 0;
}

/** The fields of a request that calls AI: the own key, or on platform AI the clock's offset. */
export function aiFields(
  ownKey?: OwnKey,
  now?: Date,
): { readonly ownKey: OwnKey } | { readonly clockOffsetMinutes: number } {
  return ownKey === undefined ? { clockOffsetMinutes: clockOffsetMinutes(now) } : { ownKey };
}
