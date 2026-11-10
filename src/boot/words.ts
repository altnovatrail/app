// The words of the failure screens, in English and Russian, by the glossary of section 3.8 of
// docs/architecture.md, until the dictionaries of src/i18n/ take them (T19). No address to the
// child: these screens are for whoever is there, and the line for whoever deployed the copy is
// English on every screen (the 2026-11-02 amendment to R09).
import type { Language } from "./language.ts";

export interface Words {
  readonly framed: string;
  readonly offline: string;
  readonly retry: string;
  readonly unconfigured: string;
  readonly grownUp: string;
  readonly newVersion: string;
  readonly reload: string;
  readonly erased: string;
  readonly unreadable: string;
}

export const WORDS: Readonly<Record<Language, Words>> = {
  en: {
    framed: "This app opens only in a tab of its own",
    offline: "No connection",
    retry: "Try again",
    unconfigured: "This app isn't set up",
    grownUp: "A grown-up needs to help",
    newVersion: "There is a new version of the app",
    reload: "Reload",
    erased: "The data on this device was erased",
    unreadable: "The data on this device can't be read",
  },
  ru: {
    framed: "Приложение открывается только в своей вкладке",
    offline: "Нет связи",
    retry: "Повторить",
    unconfigured: "Приложение не настроено",
    grownUp: "Нужна помощь взрослого",
    newVersion: "Вышла новая версия приложения",
    reload: "Перезагрузить",
    erased: "Данные на этом устройстве стёрты",
    unreadable: "Не удалось прочитать данные на этом устройстве",
  },
};

/** The line for whoever deployed the copy, in English, with what is wrong. */
export function operatorLine(detail: string): string {
  return `For whoever deployed this copy: ${detail}.`;
}
