// The legal texts app shows, from api (section 3.8 of docs/architecture.md; section 15 of the text
// of the contracts, "The legal texts" and "The versions of the texts"; R27 in docs/decisions.md):
// `GetLegalTexts` in the language of the screen, by Connect GET with no token, and the versions a
// consent names. A text with no version in force is absent, and a request names it not; an api on
// a tag of spec older than v0.13.0 has no `LegalService`, and none of its texts is in force there,
// so its `unimplemented` is the empty list. No DOM.
import type { LegalText, LegalTextRef } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import type { Api } from "../api/client.ts";
import { parseFailure } from "../api/failure.ts";
import type { Language } from "../i18n/language.ts";

/** The texts `CreateAccount` names: the owner accepts both (R131 in spec). */
export const ACCOUNT_TEXTS = ["privacy-policy", "terms-of-use"] as const;

/** The current version of each text of the place `app`, in the screen's language. */
export async function readTexts(api: Api, language: Language): Promise<readonly LegalText[]> {
  try {
    return (await api.legal.getLegalTexts({ interfaceLanguage: language })).texts;
  } catch (reason) {
    if (parseFailure(reason).kind === "stale") return [];
    throw reason;
  }
}

/** The texts of the account among them, in the order of ACCOUNT_TEXTS: those in force alone. */
export function accountTexts(texts: readonly LegalText[]): LegalText[] {
  return ACCOUNT_TEXTS.flatMap((id) => texts.filter((text) => text.id === id));
}

/** The versions a consent names: each text by its ID and the number of the version shown. */
export function refsOf(texts: readonly LegalText[]): Pick<LegalTextRef, "id" | "version">[] {
  return texts.map(({ id, version }) => ({ id, version }));
}
