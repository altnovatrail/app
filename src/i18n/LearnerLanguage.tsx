// The language of a learner's screens (section 3.8 of docs/architecture.md; R10 in
// docs/decisions.md): the field of the profile, which an adult sets in the section for adults, as
// the build finds it, else the device's. The page's `<html lang>` is it while the screens are there;
// the device's language is chosen as before, by the buttons outside them.
import { type ReactNode, useEffect, useMemo } from "react";
import { LanguageProvider, type LanguageState, useLanguage } from "./LanguageContext.tsx";
import { learnerLanguage } from "./language.ts";
import { holdPageLanguage } from "./page.ts";
import { WORDS } from "./words.ts";

export function LearnerLanguage({
  field,
  children,
}: {
  /** The profile's field `interface_language`: absent when none is set. */
  readonly field: string | undefined;
  readonly children: ReactNode;
}) {
  const device = useLanguage();
  const language = learnerLanguage(field, device.language);
  useEffect(() => holdPageLanguage(language), [language]);
  // In the device's language the device's words stay, the pseudo-language of a test among them.
  const state = useMemo<LanguageState>(
    () =>
      language === device.language
        ? device
        : { language, words: WORDS[language], choose: device.choose },
    [language, device],
  );
  return <LanguageProvider value={state}>{children}</LanguageProvider>;
}
