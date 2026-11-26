// The language of the page, `<html lang>` (WCAG 3.1.1): the device's, which Boot sets, and which
// every screen speaks, a learner's too. One place writes the attribute.
import type { Language } from "./language.ts";

/** The device's language, the page's. */
export function setDeviceLanguage(language: Language): void {
  document.documentElement.lang = language;
}
