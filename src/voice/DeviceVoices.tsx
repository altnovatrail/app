// The section Voicing of the page This device (R07 and R36 in
// docs/decisions.md; sections 3.2 and 3.5 of docs/architecture.md): on Android and Linux, why the
// voicing waits for an adult here and the leave to give or take back; and for each language a text
// may be in — the languages of the build, which every profile's screens and the device's are in, and
// the explanation languages of the modules the cache holds — the voice that says it, chosen among
// its candidates, with a sample; a language with no voice says so, and how to add one in the
// system, in words, with no link (privacy 1 and 7 in spec). The choice and the leave lie in the
// registry of this device, the other tabs hear of a change of them, and the sign-out of the owner
// or another account signing in erases them.
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { languageName } from "../i18n/intl.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { LANGUAGES } from "../i18n/language.ts";
import { useOptionalPackages } from "../packages/PackagesContext.tsx";
import type { Device } from "../storage/device.ts";
import {
  allowVoicing,
  chooseVoice,
  type DeviceVoicing,
  NO_VOICING,
  readVoicing,
} from "../storage/voicing.ts";
import { useSpeech, voicingChanged } from "./VoicingContext.tsx";
import { candidates, needsLeave, tagOf } from "./voices.ts";

/** The sentence a sample says, in each language of the build: in the voice's language, not the screen's. */
const SAMPLES: Readonly<Record<string, string>> = {
  en: "This is how the tutor's words will sound.",
  ru: "Так будут звучать слова наставника.",
};

/** The languages a text may be in on this device's screens, each once, the build's first. */
function useLanguagesHere(): readonly string[] {
  const packages = useOptionalPackages();
  const [modules, setModules] = useState<readonly string[]>([]);
  useEffect(() => {
    let current = true;
    void packages?.views
      .keptManifests()
      .then((manifests) => {
        if (!current) return;
        setModules([...manifests.values()].map((manifest) => manifest.languages.explanation));
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [packages]);
  return useMemo(() => {
    const seen = new Set<string>();
    return [...LANGUAGES, ...modules].filter((tag) => {
      const key = tagOf(tag);
      if (key === "" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [modules]);
}

/** One language: its voice among the candidates, with a sample, or how to add one. */
function LanguageVoice({
  tag,
  kept,
  waits,
  onChoose,
}: {
  readonly tag: string;
  readonly kept: DeviceVoicing;
  /** The adult's leave is not given yet: no sample is said. */
  readonly waits: boolean;
  readonly onChoose: (tag: string, voiceURI: string) => void;
}) {
  const { language, words } = useLanguage();
  const speech = useSpeech();
  const voices = useSyncExternalStore(speech.subscribe, speech.voices);
  const id = useId();
  const found = candidates(voices, tag);
  const taken = speech.voiceOf(tag, kept.voices);
  let name = tag;
  try {
    // A legend stands alone: its first letter is a capital, in Russian too.
    const named = languageName(language, tag);
    name = named.charAt(0).toLocaleUpperCase(language) + named.slice(1);
  } catch {
    // A tag Intl cannot read stands for itself.
  }
  const sample = SAMPLES[tagOf(tag)];
  return (
    <fieldset className="nt-choices">
      <legend>{name}</legend>
      {found.length === 0 ? (
        <>
          <p>{words.text("voice.none")}</p>
          <p className="nt-hint">{words.text("voice.add")}</p>
        </>
      ) : (
        <>
          {found.map((voice) => (
            <div key={voice.voiceURI} className="nt-option">
              <label>
                <input
                  type="radio"
                  name={id}
                  checked={voice === taken}
                  onChange={() => onChoose(tagOf(tag), voice.voiceURI)}
                />
                {voice.name}
              </label>
            </div>
          ))}
          {sample === undefined || waits ? null : (
            <div className="nt-buttons">
              <button
                type="button"
                className="nt-secondary"
                onClick={() =>
                  speech.say([{ text: sample, language: tag }], { rate: 1, chosen: kept.voices })
                }
              >
                {words.text("voice.sample")}
              </button>
            </div>
          )}
        </>
      )}
    </fieldset>
  );
}

export function DeviceVoices({ device }: { readonly device: Device }) {
  const { words } = useLanguage();
  const speech = useSpeech();
  const languages = useLanguagesHere();
  const [kept, setKept] = useState<DeviceVoicing>(NO_VOICING);
  const [failed, setFailed] = useState(false);
  const [said, setSaid] = useState<string | undefined>(undefined);
  useEffect(() => {
    let current = true;
    void readVoicing(device).then((read) => {
      if (current) setKept(read);
    });
    return () => {
      current = false;
      speech.stop();
    };
  }, [device, speech]);
  const leave = needsLeave(speech.platform);
  const waits = leave && !kept.allowed;

  async function written(change: Promise<DeviceVoicing | undefined>, done?: string) {
    setFailed(false);
    setSaid(undefined);
    const after = await change;
    if (after === undefined) setFailed(true);
    else {
      setKept(after);
      setSaid(done);
      // A learner's screens open in another tab read it again: a leave taken back holds there too.
      voicingChanged();
    }
  }

  return (
    <>
      <h2>{words.text("adults.voicing")}</h2>
      {speech.supported ? null : <p>{words.text("voice.unsupported")}</p>}
      {leave ? (
        <>
          <p>{words.text("voice.leave-why")}</p>
          <p>{words.text(kept.allowed ? "voice.allowed" : "voice.not-allowed")}</p>
          <div className="nt-buttons">
            <button
              type="button"
              className="nt-secondary"
              onClick={() => {
                if (kept.allowed) speech.stop();
                void written(
                  allowVoicing(device, !kept.allowed),
                  words.text(kept.allowed ? "voice.disallowed" : "voice.allowed"),
                );
              }}
            >
              {words.text(kept.allowed ? "voice.disallow" : "voice.allow")}
            </button>
          </div>
        </>
      ) : null}
      <p role="status">{said ?? ""}</p>
      {speech.supported ? (
        <>
          <p>{words.text("voice.languages")}</p>
          {languages.map((tag) => (
            <LanguageVoice
              key={tag}
              tag={tag}
              kept={kept}
              waits={waits}
              onChoose={(key, voiceURI) => void written(chooseVoice(device, key, voiceURI))}
            />
          ))}
        </>
      ) : null}
      {failed ? (
        <p role="alert" className="nt-error">
          {words.text("voice.not-kept")}
        </p>
      ) : null}
    </>
  );
}
