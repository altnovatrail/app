// The voicing of the learner's screens (R07 and R36 in docs/decisions.md;
// section 3.5 of docs/architecture.md): the one synthesis of the app, and what the profile and
// this device say of it — whether the voicing is on and its speed, a field of the profile on the
// server that goes with the learner to every device; the voice an adult chose for a language and,
// on Android and Linux, the adult's leave, in the device's registry. The tutor's words are said by
// themselves only while the voicing is on and the device lets it; a speaker button reads at any
// time a voice is there, the voicing off too. Speech stops when the learner leaves a screen, when
// another learner comes, and when the tab is hidden (speech.ts). Outside a learner's screens — a
// screen's own test — the voicing is off and nothing is chosen.
import type { Profile } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { Failure } from "../api/failure.ts";
import type { Device } from "../storage/device.ts";
import { type DeviceVoicing, NO_VOICING, readVoicing } from "../storage/voicing.ts";
import { browserSpeech } from "./browser.ts";
import type { Speech } from "./speech.ts";
import type { Phrase } from "./texts.ts";
import { needsLeave, rateOf } from "./voices.ts";

const SpeechContext = createContext<Speech | undefined>(undefined);

/** The synthesis below it: a test's own; the browser's when left out. */
export const SpeechProvider = SpeechContext.Provider;

/** The one synthesis of the app. */
export function useSpeech(): Speech {
  return useContext(SpeechContext) ?? browserSpeech();
}

/**
 * Why a language is not said on this device: the adult's leave not given, no voice for it, or not
 * known yet — the record of the device not read, the module's language not come.
 */
export type Silent = "leave" | "voice" | "wait";

/** The channel on which a tab tells the others that the voicing of this device changed. */
export const VOICING_CHANNEL = "novatrail-voicing";

/** Tells the other tabs that the voicing of this device changed: they read it again. */
export function voicingChanged(): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(VOICING_CHANNEL);
  channel.postMessage("changed");
  channel.close();
}

/** What a learner's screen knows of the voicing. */
interface VoicingState {
  /** The profile's: none outside a learner's screens. */
  readonly profile?: Profile;
  readonly on: boolean;
  readonly rate: number;
  readonly device: DeviceVoicing;
  /** Whether the record of the device is read: until it is, nothing is said. */
  readonly ready: boolean;
  /** api changed the profile: the profile its answer gives. */
  readonly onSaved?: (profile: Profile) => void;
  /** A request of the voicing did not go through. */
  readonly onFailed?: (failure: Failure) => void;
}

const OFF: VoicingState = { on: false, rate: 1, device: NO_VOICING, ready: true };

const VoicingContext = createContext<VoicingState>(OFF);

/**
 * The voicing of a learner's screens, from the profile and this device. `place` names the screen:
 * speech stops when it changes, and when the learner goes.
 */
export function VoicingProvider({
  profile,
  device,
  place,
  onSaved,
  onFailed,
  children,
}: {
  readonly profile: Profile;
  readonly device: Device;
  readonly place: string;
  readonly onSaved: (profile: Profile) => void;
  readonly onFailed: (failure: Failure) => void;
  readonly children: ReactNode;
}) {
  const speech = useSpeech();
  const [kept, setKept] = useState<DeviceVoicing | undefined>(undefined);
  useEffect(() => {
    let current = true;
    const read = () =>
      void readVoicing(device).then((found) => {
        if (current) setKept(found);
      });
    read();
    // The page This device of another tab changed it: the leave taken back holds here at once.
    const channel =
      typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(VOICING_CHANNEL);
    channel?.addEventListener("message", read);
    return () => {
      current = false;
      channel?.close();
    };
  }, [device]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a screen left is speech stopped.
  useEffect(() => () => speech.stop(), [speech, place]);
  const voicing = profile.presentationStyle?.voicing;
  const on = voicing?.enabled === true;
  const allowed = kept?.allowed === true;
  // The voicing turned off, or the leave taken back, by whatever way — another tab, the profile's
  // page —: what is being said stops.
  const was = useRef({ on, allowed });
  useEffect(() => {
    if ((was.current.on && !on) || (was.current.allowed && !allowed)) speech.stop();
    was.current = { on, allowed };
  }, [on, allowed, speech]);
  const state = useMemo<VoicingState>(
    () => ({
      profile,
      on,
      rate: rateOf(voicing?.speed),
      device: kept ?? NO_VOICING,
      ready: kept !== undefined,
      onSaved,
      onFailed,
    }),
    [profile, on, voicing, kept, onSaved, onFailed],
  );
  return <VoicingContext.Provider value={state}>{children}</VoicingContext.Provider>;
}

/** The voicing of the screen, and what says texts by it. */
export function useVoicing() {
  const state = useContext(VoicingContext);
  const speech = useSpeech();
  // A list of voices that changes is a screen drawn again: a language may have one now.
  const voices = useSyncExternalStore(speech.subscribe, speech.voices);
  const waits = needsLeave(speech.platform) && !state.device.allowed;
  const { on, rate, device, ready } = state;
  const mute = waits || !ready;

  /** Why a language is not said on this device, if it is not. */
  // biome-ignore lint/correctness/useExhaustiveDependencies: the voice of a language is of the list.
  const silent = useCallback(
    (language: string | undefined): Silent | undefined => {
      if (!ready || language === undefined) return "wait";
      if (waits) return "leave";
      return speech.voiceOf(language, device.voices) === undefined ? "voice" : undefined;
    },
    [ready, waits, voices, speech, device],
  );

  /** Says phrases on a press of a speaker button: the voicing off too. */
  const read = useCallback(
    (phrases: readonly Phrase[]) =>
      mute ? undefined : speech.say(phrases, { rate, chosen: device.voices }),
    [mute, speech, rate, device],
  );

  /** Says what came by itself — the tutor's words, the verdict — while the voicing is on. */
  const auto = useCallback(
    (phrases: readonly Phrase[], after?: object) =>
      on && !mute ? speech.say(phrases, { rate, chosen: device.voices, after }) : undefined,
    [on, mute, speech, rate, device],
  );

  /** Marks a press after which the tutor's words will come, while the voicing is on (WebKit). */
  const prime = useCallback(() => {
    if (on && !mute) speech.prime();
  }, [on, mute, speech]);

  return { ...state, speech, silent, read, auto, prime };
}
