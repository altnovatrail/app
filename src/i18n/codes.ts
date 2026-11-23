// The words of a code from api — a verdict, a cause, a reason of the choice — by a typed table.
// A code the build does not know gets the common string, not an error: a newer api may send
// one. No DOM.
import type { Key } from "./words.ts";

/**
 * The key of a code's words in its table, or for a code not in it the fallback — the common
 * string's unless the table's own caller names another.
 */
export function keyFor<
  T extends Readonly<Record<PropertyKey, Key>>,
  F extends Key = "common.unknown",
>(table: T, code: PropertyKey, fallback: F = "common.unknown" as F): T[keyof T] | F {
  return Object.hasOwn(table, code) ? (table[code as keyof T] as T[keyof T]) : fallback;
}
