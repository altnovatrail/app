// The legal texts app shows, from api (section 3.8 of docs/architecture.md; section 15 of the text
// of the contracts, "The legal texts" and "The versions of the texts"; R27 and R46 in
// docs/decisions.md): `GetLegalTexts` in the language of the screen, by Connect GET with no token —
// the current version of each text and its next one, which app shows before its day —, and the
// versions a consent names: the current ones alone. A text with no current version is absent, and
// a request names it not; an api on a tag of spec older than v0.13.0 has no `LegalService`, and none
// of its texts is in force there, so its `unimplemented` is the empty list; one older than v0.17.0
// gives no next version, and the list of them is empty. No DOM.
import type { LegalText, LegalTextRef } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import type { Api } from "../api/client.ts";
import { parseFailure } from "../api/failure.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import type { Language } from "../i18n/language.ts";

/** The texts `CreateAccount` names: the owner accepts both (R131 in spec). */
export const ACCOUNT_TEXTS = ["privacy-policy", "terms-of-use"] as const;

/** The texts of the place `app`: the current version of each, and the next version of some. */
export interface Legal {
  readonly texts: readonly LegalText[];
  readonly next: readonly LegalText[];
}

/** The current and the next versions of the texts of the place `app`, in the screen's language. */
export async function readLegal(api: Api, language: Language): Promise<Legal> {
  try {
    const answer = await api.legal.getLegalTexts({ interfaceLanguage: language });
    return { texts: answer.texts, next: answer.nextTexts };
  } catch (reason) {
    if (parseFailure(reason).kind === "stale") return { texts: [], next: [] };
    throw reason;
  }
}

/** The current version of each text of the place `app`, in the screen's language. */
export async function readTexts(api: Api, language: Language): Promise<readonly LegalText[]> {
  return (await readLegal(api, language)).texts;
}

/** The next version of a text among them: none while it has none. */
export function nextOf(next: readonly LegalText[], id: string): LegalText | undefined {
  return next.find((text) => text.id === id);
}

/** A text's current version and its next one, each none while api gives none. */
export interface Versions {
  readonly current: LegalText | undefined;
  readonly next: LegalText | undefined;
}

/** The versions of one text among those read. */
export function versionsOf(legal: Legal, id: string): Versions {
  return { current: legal.texts.find((text) => text.id === id), next: nextOf(legal.next, id) };
}

/** The text `SetWorkStorage` names when it switches the storage of works on (R113, R131 in spec). */
export const STORAGE_TEXT = "storage-consent";

/**
 * The texts that are legal pages of their own (R31): the account's two and the consent to the
 * storage of works. The texts for a family come with the screens of a child's consent, in E4.
 */
export const PAGE_TEXTS = [...ACCOUNT_TEXTS, STORAGE_TEXT] as const;

/** The ID of a text that is a legal page. */
export type PageText = (typeof PAGE_TEXTS)[number];

/** A text that is a legal page, by its ID. */
export type PageLegalText = LegalText & { readonly id: PageText };

/** The next versions of the texts that are legal pages, in the order of PAGE_TEXTS. */
export function pageNext(next: readonly LegalText[]): PageLegalText[] {
  return PAGE_TEXTS.flatMap((id) => next.filter((text): text is PageLegalText => text.id === id));
}

/** Whether a part of the hash names a text that is a legal page. */
export function isPageText(id: string): id is PageText {
  return (PAGE_TEXTS as readonly string[]).includes(id);
}

/** The texts of the account among them, in the order of ACCOUNT_TEXTS: those in force alone. */
export function accountTexts(texts: readonly LegalText[]): LegalText[] {
  return ACCOUNT_TEXTS.flatMap((id) => texts.filter((text) => text.id === id));
}

/** The versions a consent names: each text by its ID and the number of the version shown. */
export function refsOf(texts: readonly LegalText[]): Pick<LegalTextRef, "id" | "version">[] {
  return texts.map(({ id, version }) => ({ id, version }));
}

/** The day a version applies from, `YYYY-MM-DD`, as the screen's language writes it. */
export function dayText(language: Language, day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const date = new Date(`${day}T00:00:00Z`);
  // A day the calendar does not have, such as 02-30, which the engine would roll over: as it came.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== day) return day;
  return dateTimeFormat(language, { dateStyle: "long", timeZone: "UTC" }).format(date);
}
