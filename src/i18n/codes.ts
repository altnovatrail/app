// The words of a code from api — a verdict, a cause, a reason of the choice — by a typed table
// (section 3.8 of docs/architecture.md). A code the build does not know gets the common string, not
// an error: a newer api may send one (section 3.7). No DOM.
import type { Key } from "./words.ts";

/** The key of a code's words in its table, or the common string's for a code not in it. */
export function keyFor<T extends Readonly<Record<PropertyKey, Key>>>(
  table: T,
  code: PropertyKey,
): T[keyof T] | "common.unknown" {
  return Object.hasOwn(table, code) ? (table[code as keyof T] as T[keyof T]) : "common.unknown";
}
