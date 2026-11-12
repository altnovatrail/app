// Which voice of the device speaks a text, and where the device must ask an adult first (R07 and
// R36 in docs/decisions.md; section 3.5 of docs/architecture.md): app names the voice of every
// utterance itself and leaves the browser no choice. The candidates for a
// language are the voices the browser says are local, with no "Online" in their name — Edge's
// voices that Azure speaks —, whose `lang` the language matches by RFC 4647's Basic Filtering, the
// same tag first, then a longer one; failing that, the same for the language less its last
// subtag. Of them the voice the adult chose on this device, else the one `default` marks if the
// language has one alone, else the first. On Android and Linux the browser cannot know whether the
// system speaks on the device, so voicing waits there for the adult's leave on this device. No DOM.
import { VoicingSpeed } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";

/** What app reads of a voice: SpeechSynthesisVoice has it all. */
export interface VoiceLike {
  readonly name: string;
  readonly lang: string;
  readonly localService: boolean;
  readonly default: boolean;
  readonly voiceURI: string;
}

/** A tag as app compares it: lower case, `_` read as `-`, as Chrome on Android gives `en_US`. */
export function tagOf(lang: string): string {
  return lang.trim().replaceAll("_", "-").toLowerCase();
}

/** RFC 4647, 3.3.1: the range equals the tag, or a prefix of it that a "-" follows. */
function matches(range: string, tag: string): boolean {
  return tag === range || tag.startsWith(`${range}-`);
}

/** Whether a voice may speak at all: local, and none that Edge speaks by Azure (section 3.5). */
export function mayUse(voice: VoiceLike): boolean {
  return voice.localService && !/online/i.test(voice.name);
}

/**
 * The voices that may speak a language, in the order of the list: the same tag first, then the
 * longer tags it is a prefix of; none such, the same for the language less its last subtag.
 */
export function candidates<V extends VoiceLike>(voices: readonly V[], language: string): V[] {
  const usable = voices.filter(mayUse);
  const subtags = tagOf(language).split("-");
  while (subtags.length > 0 && subtags[0] !== "") {
    const range = subtags.join("-");
    const same = usable.filter((voice) => tagOf(voice.lang) === range);
    const longer = usable.filter(
      (voice) => tagOf(voice.lang) !== range && matches(range, tagOf(voice.lang)),
    );
    if (same.length + longer.length > 0) return [...same, ...longer];
    subtags.pop();
  }
  return [];
}

/**
 * The voice that speaks a language: the adult's choice on this device if it is a candidate, else
 * the candidate `default` marks when it marks one alone — WebKit marks every voice — else the
 * first; none when the language has no candidate.
 */
export function voiceFor<V extends VoiceLike>(
  voices: readonly V[],
  language: string,
  chosen?: string,
): V | undefined {
  const found = candidates(voices, language);
  const picked =
    chosen === undefined ? undefined : found.find((voice) => voice.voiceURI === chosen);
  if (picked !== undefined) return picked;
  const marked = found.filter((voice) => voice.default);
  return marked.length === 1 ? marked[0] : found[0];
}

/** The system as app tells it apart for voicing; ChromeOS is no Linux (section 3.5). */
export type Platform = "android" | "chromeos" | "linux" | "other";

/** What app reads of `navigator` to tell the system. */
export interface NavigatorLike {
  readonly userAgent: string;
  readonly userAgentData?: { readonly platform?: string } | undefined;
}

/**
 * The system the browser names: `navigator.userAgentData.platform` where it says one of the
 * values app knows, else the user agent string, "Android" before "CrOS" and "CrOS" before "Linux"
 * or "X11" — Android's string holds "Linux", and ChromeOS's "X11". A system it does not name is
 * neither Android nor Linux: iPadOS calls itself a Mac, and needs no telling apart, since the
 * empty utterance goes on every press everywhere.
 */
export function platformOf(navigator: NavigatorLike): Platform {
  const named = navigator.userAgentData?.platform;
  if (named === "Android") return "android";
  if (named === "Chrome OS") return "chromeos";
  if (named === "Linux") return "linux";
  if (named === "Windows" || named === "macOS" || named === "iOS") return "other";
  const agent = navigator.userAgent;
  if (/Android/i.test(agent)) return "android";
  if (/CrOS/.test(agent)) return "chromeos";
  if (/Linux|X11/i.test(agent)) return "linux";
  return "other";
}

/** Whether voicing waits for an adult's leave on this device: on Android and Linux (R07). */
export function needsLeave(platform: Platform): boolean {
  return platform === "android" || platform === "linux";
}

/**
 * The rate of the slow speed: three quarters of the voice's own, which the rate `1` is. Not tuned
 * on devices yet: each engine maps the rate its own way, and T51 tunes it (Д5 in RUN.md).
 */
export const SLOW_RATE = 0.75;

/** The rate of an utterance by the profile's speed: a speed the build does not know is normal. */
export function rateOf(speed: VoicingSpeed | undefined): number {
  return speed === VoicingSpeed.SLOW ? SLOW_RATE : 1;
}
