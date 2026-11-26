// "The level was set by an adult" beside a module's map, with the day of the last correction, by
// `level_set_at` of the skill map.
import type { GetSkillMapResponse } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Phrase } from "../i18n/Phrase.tsx";

/** "The level was set by an adult" with its day, when an adult set the module's level. */
export function LevelSetBy({ skillMap }: { readonly skillMap: GetSkillMapResponse }) {
  const { language } = useLanguage();
  const at = skillMap.levelSetAt;
  if (at === undefined) return null;
  const date = timestampDate(at);
  return (
    <p>
      <Phrase
        id="level.set-by-adult"
        values={{
          date: (
            <time dateTime={date.toISOString()}>
              {dateTimeFormat(language, { dateStyle: "long" }).format(date)}
            </time>
          ),
        }}
      />
    </p>
  );
}
