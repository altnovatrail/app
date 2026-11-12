// What an adult sets of a profile in the section for adults (R29 in docs/decisions.md; R05, R07 and
// R10; section 15 of the text of the contracts): the form of the profile's page as the profile gives
// it, and the settings `UpdateProfile` sends — only those that changed, so that a value the build
// does not know is never written back; the profile api gave after a change, with what the tab
// learnt itself of its open attempt and lesson runs, which stays the profile GetAccount gave for
// that; and the message the other tabs hear of a change by. No DOM.
import {
  Mode,
  type Profile,
  ProfileSchema,
  type ProfileSettingsSchema,
  VoicingSpeed,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { fromBinary, type MessageInitShape, toBinary } from "@bufbuild/protobuf";
import { type Language, lookup } from "../i18n/language.ts";

/** The settings of a profile's page, each as the build shows it. */
export interface ProfileForm {
  /** The pseudonym, trimmed: the page checks it before it asks (`pseudonymOf`). */
  readonly pseudonym: string;
  readonly defaultMode: Mode.BY_STEPS | Mode.SELF;
  /** The language of the learner's screens; none while the field is absent or unknown to the build. */
  readonly language: Language | undefined;
  readonly voicing: boolean;
  readonly speed: VoicingSpeed.NORMAL | VoicingSpeed.SLOW;
}

/**
 * The form as the profile gives it: a mode or a speed the build does not know is "by steps" or
 * normal, as the contract's enums say, and voicing not said is off.
 */
export function formOf(profile: Profile): ProfileForm {
  const voicing = profile.presentationStyle?.voicing;
  return {
    pseudonym: profile.pseudonym,
    defaultMode: profile.defaultMode === Mode.SELF ? Mode.SELF : Mode.BY_STEPS,
    language:
      profile.interfaceLanguage === undefined ? undefined : lookup(profile.interfaceLanguage),
    voicing: voicing?.enabled === true,
    speed: voicing?.speed === VoicingSpeed.SLOW ? VoicingSpeed.SLOW : VoicingSpeed.NORMAL,
  };
}

export type Settings = MessageInitShape<typeof ProfileSettingsSchema>;

/**
 * The settings that changed against the form as the profile gives it, for `UpdateProfile`: none
 * when nothing did. A field the form shows as the build reads it — a tag cut to its language, an
 * unknown mode — goes only once the adult changed it.
 */
export function changes(profile: Profile, form: ProfileForm): Settings | undefined {
  const before = formOf(profile);
  const voicing = {
    ...(form.voicing === before.voicing ? {} : { enabled: form.voicing }),
    ...(form.speed === before.speed ? {} : { speed: form.speed }),
  };
  const settings: Settings = {
    ...(form.pseudonym === before.pseudonym ? {} : { pseudonym: form.pseudonym }),
    ...(form.defaultMode === before.defaultMode ? {} : { defaultMode: form.defaultMode }),
    ...(form.language === undefined || form.language === before.language
      ? {}
      : { interfaceLanguage: form.language }),
    ...(Object.keys(voicing).length === 0 ? {} : { voicing }),
  };
  return Object.keys(settings).length === 0 ? undefined : settings;
}

/** Each profile as GetAccount gave it, by the profiles made from it with other settings. */
const given = new WeakMap<Profile, Profile>();

/**
 * The profile as GetAccount gave it, which what a tab learnt of the profile since — its open
 * attempt and lesson runs — is kept by: other settings do not make it another.
 */
export function asGiven(profile: Profile): Profile {
  return given.get(profile) ?? profile;
}

/**
 * The profile as api gave it after a change, `from`, with the open attempt and the lesson runs the
 * tab has: those the tab learns itself, as they begin and end on its screens (R20, R23), and an
 * answer about settings neither brings back one that ended nor loses one begun. Whatever else api
 * gave — every setting, a field the contract adds to them among them — is api's. The profile
 * GetAccount gave stays the same.
 */
export function withSettings(profile: Profile, from: Profile): Profile {
  const next: Profile = { ...from, openLessonRuns: profile.openLessonRuns };
  // An optional field absent is no field, not one set to undefined.
  if (profile.openAttempt === undefined) delete next.openAttempt;
  else next.openAttempt = profile.openAttempt;
  given.set(next, asGiven(profile));
  return next;
}

/** The channel the tabs of app tell each other of a profile changed on. */
export const PROFILES_CHANNEL = "novatrail-profiles";

/** What a tab tells the others of a profile api changed: the profile as api gave it, in binary. */
export interface ProfileMessage {
  readonly profile: Uint8Array;
}

export function profileMessage(profile: Profile): ProfileMessage {
  return { profile: toBinary(ProfileSchema, profile) };
}

/** The profile a message of another tab names; none for a message that is not one. */
export function profileOf(data: unknown): Profile | undefined {
  if (typeof data !== "object" || data === null || !("profile" in data)) return undefined;
  const { profile } = data;
  if (!(profile instanceof Uint8Array)) return undefined;
  try {
    return fromBinary(ProfileSchema, profile);
  } catch {
    return undefined;
  }
}
