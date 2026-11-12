// The order of the account's profiles in the section for adults (R29 in docs/decisions.md): the
// owner's first, the others by their pseudonyms in the screen's language (section 3.8). No DOM.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { collator } from "../i18n/intl.ts";
import type { Language } from "../i18n/language.ts";

export function inOrder(profiles: readonly Profile[], language: Language): Profile[] {
  const order = collator(language);
  return [...profiles].sort(
    (a, b) => Number(b.owner) - Number(a.owner) || order.compare(a.pseudonym, b.pseudonym),
  );
}
