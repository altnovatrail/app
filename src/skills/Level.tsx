// A module's level beside its map (R157 in spec and its amendment of T173; R56 in
// docs/decisions.md; section 3.10 of docs/architecture.md): on every learner's map and in the
// adult's, "The level was set by an adult" with the day of the last correction, by `level_set_at`;
// and on the adult's map in the section for adults, the band of the level, by `level_band`, with
// "Easier" and "Harder", each naming the band next to it by the order of the manifest's bands,
// which `SetModuleLevel` sets. A band no longer next to the level, `CAUSE_BAND_NOT_NEXT`, reads the
// map again, and the buttons offer the bands next to the level it gives. A band's title is the
// module's text, in its explanation language.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { Cause } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import type { GetSkillMapResponse } from "@altnovatrail/contracts/novatrail/api/v1/progress_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { type Failure, parseFailure, refusedWith } from "../api/failure.ts";
import { failureText } from "../api/words.ts";
import { dateTimeFormat } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { Phrase } from "../i18n/Phrase.tsx";
import { levelOf } from "./level.ts";
import type { ModuleMap } from "./map.ts";

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

/** A band's title, in the module's explanation language. */
function BandTitle({ band, lang }: { readonly band: open.Band; readonly lang: string }) {
  return <span lang={lang}>{band.title}</span>;
}

/** What the last press came to: nothing yet, a refusal or failure, or a level that had moved. */
type Said = { readonly failure: Failure } | { readonly moved: true } | undefined;

/**
 * The adult's correction of a module's level, above its map in the section for adults: the band of
 * the level, "Easier" and "Harder", and the day an adult last set it. The map is the screen's: a
 * correction gives it the level it set, and a band no longer next reads it again — the state alone
 * when the module's version is the same, the whole map by `onStale` when it is not.
 */
export function LevelCorrection({
  profileId,
  moduleId,
  map,
  onMap,
  onStale,
}: {
  readonly profileId: string;
  readonly moduleId: string;
  readonly map: ModuleMap;
  readonly onMap: (skillMap: GetSkillMapResponse) => void;
  readonly onStale: () => void;
}) {
  const api = useApi();
  const { words } = useLanguage();
  const id = useId();
  const { manifest, skillMap } = map;
  const level = levelOf(skillMap.levelBand, manifest?.bands);
  const [pending, setPending] = useState(false);
  const [said, setSaid] = useState<Said>(undefined);
  // After a press the line of the level takes the focus: the button pressed may be gone, at an end
  // of the scale, and the line says where the level stands.
  const line = useRef<HTMLParagraphElement>(null);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    if (focus > 0) line.current?.focus();
  }, [focus]);

  const set = useCallback(
    (band: string) => {
      if (pending) return;
      setPending(true);
      setSaid(undefined);
      void (async () => {
        try {
          const set = await api.progress.setModuleLevel({ profileId, moduleId, band });
          const { levelSetAt, ...rest } = skillMap;
          onMap({
            ...rest,
            levelBand: set.levelBand,
            ...(set.levelSetAt === undefined ? {} : { levelSetAt: set.levelSetAt }),
          });
        } catch (reason) {
          const failure = parseFailure(reason);
          if (!refusedWith(failure, Cause.BAND_NOT_NEXT)) {
            setSaid({ failure });
            return;
          }
          try {
            const again = await api.progress.getSkillMap({
              profileId,
              moduleId,
              action: Action.ADULT,
            });
            if (again.packageDigest === skillMap.packageDigest) onMap(again);
            else onStale();
            setSaid({ moved: true });
          } catch (reason) {
            setSaid({ failure: parseFailure(reason) });
            return;
          }
        }
        setFocus((n) => n + 1);
      })().finally(() => setPending(false));
    },
    [api, profileId, moduleId, skillMap, pending, onMap, onStale],
  );

  if (level === undefined || manifest === undefined) return null;
  const lang = manifest.languages.explanation;
  const lowest = manifest.bands?.[0];
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{words.text("level.title")}</h2>
      <p>{words.text("level.hint")}</p>
      <p ref={line} tabIndex={-1}>
        {level.band !== undefined ? (
          <Phrase id="level.band" values={{ band: <BandTitle band={level.band} lang={lang} /> }} />
        ) : lowest === undefined ? null : (
          <Phrase id="level.below" values={{ band: <BandTitle band={lowest} lang={lang} /> }} />
        )}
      </p>
      <LevelSetBy skillMap={skillMap} />
      <p role="status" className="nt-hint">
        {said !== undefined && "moved" in said ? words.text("level.moved") : ""}
      </p>
      {said !== undefined && "failure" in said ? (
        <p role="alert" className="nt-error">
          {failureText(said.failure, words)}
        </p>
      ) : null}
      <div className="nt-buttons">
        {/* Not disabled while the correction goes: a disabled button would drop the focus. */}
        {level.easier === undefined ? null : (
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            onClick={() => level.easier !== undefined && set(level.easier.id)}
          >
            <Phrase
              id="level.easier"
              values={{ band: <BandTitle band={level.easier} lang={lang} /> }}
            />
          </button>
        )}
        {level.harder === undefined ? null : (
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            onClick={() => level.harder !== undefined && set(level.harder.id)}
          >
            <Phrase
              id="level.harder"
              values={{ band: <BandTitle band={level.harder} lang={lang} /> }}
            />
          </button>
        )}
      </div>
    </section>
  );
}
