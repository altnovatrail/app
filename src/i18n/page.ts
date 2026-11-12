// The language of the page, `<html lang>` (section 3.8 of docs/architecture.md; WCAG 3.1.1): the
// device's, which Boot sets, unless a learner's screens are shown, which hold their learner's
// language over it for as long as they are there. One place writes the attribute, so that which of
// them set it last does not matter.
import type { Language } from "./language.ts";

/** The languages held over the device's, the last one held first. */
const held: { readonly language: Language }[] = [];
let device: Language | undefined;

function apply(): void {
  const language = held.at(-1)?.language ?? device;
  if (language !== undefined) document.documentElement.lang = language;
}

/** The device's language, the page's while nothing holds another. */
export function setDeviceLanguage(language: Language): void {
  device = language;
  apply();
}

/** Holds a language over the device's, until the function it gives is called. */
export function holdPageLanguage(language: Language): () => void {
  const hold = { language };
  held.push(hold);
  apply();
  return () => {
    const index = held.indexOf(hold);
    if (index >= 0) held.splice(index, 1);
    apply();
  };
}
