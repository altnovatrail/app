// A module's level beside its map (R157 spec; R56): on every learner's map and in the adult's, "The
// level was set by an adult" with the day of the last correction, by `level_set_at`; and on the
// adult's map in the section for adults, the band of the level, by `level_band`, with "Easier" and
// "Harder", each naming the band next to it by the order of the manifest's bands, which
// `SetModuleLevel` sets. A band no longer next to the level, `CAUSE_BAND_NOT_NEXT`, reads the map
// again in place, and the buttons offer the bands next to the level it gives. A band's title is the
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
import { usePackages } from "../packages/PackagesContext.tsx";
import { levelOf } from "./level.ts";
import { type ModuleMap, mapOf } from "./map.ts";

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
 * correction gives it the level it set, and a band no longer next gives it the map read again —
 * with the open views of the module's new version, when it changed meanwhile.
 */
export function LevelCorrection({
  profileId,
  moduleId,
  map,
  onMap,
}: {
  readonly profileId: string;
  readonly moduleId: string;
  readonly map: ModuleMap;
  readonly onMap: (map: ModuleMap) => void;
}) {
  const api = useApi();
  const { views } = usePackages();
  const { words } = useLanguage();
  const id = useId();
  const { manifest, skillMap } = map;
  const level = levelOf(skillMap.levelBand, manifest?.bands);
  // A ref, not the state: two presses before a render would both pass a state's check.
  const going = useRef(false);
  const [pending, setPending] = useState(false);
  const [said, setSaid] = useState<Said>(undefined);
  // After a press the line of the level takes the focus: the button pressed may be gone, at an end
  // of the scale, and the line says where the level stands.
  const line = useRef<HTMLParagraphElement>(null);
  const [focus, setFocus] = useState(0);
  useEffect(() => {
    if (focus > 0) line.current?.focus();
  }, [focus]);

  const press = useCallback(
    (band: string) => {
      if (going.current) return;
      going.current = true;
      setPending(true);
      setSaid(undefined);
      void (async () => {
        try {
          const answer = await api.progress.setModuleLevel({ profileId, moduleId, band });
          const { levelSetAt, ...rest } = skillMap;
          const set = {
            ...rest,
            levelBand: answer.levelBand,
            ...(answer.levelSetAt === undefined ? {} : { levelSetAt: answer.levelSetAt }),
          };
          onMap({ ...map, skillMap: set });
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
            onMap(
              again.packageDigest === skillMap.packageDigest
                ? { ...map, skillMap: again }
                : await mapOf(views, again),
            );
            setSaid({ moved: true });
          } catch (reason) {
            setSaid({ failure: parseFailure(reason) });
            return;
          }
        }
        setFocus((n) => n + 1);
      })().finally(() => {
        going.current = false;
        setPending(false);
      });
    },
    [api, views, profileId, moduleId, map, skillMap, onMap],
  );

  // A manifest with no bands, or one that does not name the band, offers no correction; the day an
  // adult set the level still shows.
  if (level === undefined || manifest === undefined) return <LevelSetBy skillMap={skillMap} />;
  const lang = manifest.languages.explanation;
  const { band, easier, harder } = level;
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{words.text("level.title")}</h2>
      <p>{words.text("level.hint")}</p>
      <p ref={line} tabIndex={-1}>
        {band !== undefined ? (
          <Phrase id="level.band" values={{ band: <BandTitle band={band} lang={lang} /> }} />
        ) : harder === undefined ? null : (
          // Below the lowest band, the band Harder names is the lowest.
          <Phrase id="level.below" values={{ band: <BandTitle band={harder} lang={lang} /> }} />
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
        {easier === undefined ? null : (
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            onClick={() => press(easier.id)}
          >
            <Phrase id="level.easier" values={{ band: <BandTitle band={easier} lang={lang} /> }} />
          </button>
        )}
        {harder === undefined ? null : (
          <button
            type="button"
            className="nt-secondary"
            aria-disabled={pending}
            onClick={() => press(harder.id)}
          >
            <Phrase id="level.harder" values={{ band: <BandTitle band={harder} lang={lang} /> }} />
          </button>
        )}
      </div>
    </section>
  );
}
