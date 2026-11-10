// The Russian dictionary: every key of the English one and no other, with the same places, and
// the forms of a number Russian has — `one`, `few`, `many` and `other`. tsc checks all of it, so a
// pull request without a Russian string fails ci-lint (section 3.8 of docs/architecture.md). On
// the learner's screens no address to the learner, no past tense and no short adjective about them.
import type { en } from "./en.ts";
import type { Holds, SamePlaces, Translation } from "./types.ts";

export const ru = {
  "app.document-title": "{screen} — NovaTrail",
  "home.title": "NovaTrail",
  "language.title": "Язык",
  "boot.framed": "Приложение открывается только в своей вкладке",
  "boot.offline": "Нет связи",
  "boot.retry": "Повторить",
  "boot.unconfigured": "Приложение не настроено",
  "boot.grown-up": "Нужна помощь взрослого",
  "boot.new-version": "Вышла новая версия приложения",
  "boot.reload": "Перезагрузить",
  "boot.erased": "Данные на этом устройстве стёрты",
  "boot.unreadable": "Не удалось прочитать данные на этом устройстве",
  "task.not-saved": "Работа на этом устройстве не сохранилась",
  "common.unknown": "Эта версия приложения этого ещё не знает",
} as const satisfies Translation<typeof en, "ru">;

/** Every Russian string has the places of its English one: a key that has not is a type error. */
export type RussianPlaces = Holds<SamePlaces<typeof en, typeof ru>>;
