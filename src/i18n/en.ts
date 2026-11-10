// The English dictionary, the source of every other (section 3.8 of docs/architecture.md): a key
// is the screen's word, a dot, then what the string is; its places are `{name}`, and the forms of
// a number are `plural({ one, other })`. A note to the translator is the key's JSDoc. The words
// that every screen takes alike are the glossary of section 3.8.
import type { Dictionary } from "./types.ts";

export const en = {
  /** The title of the document, in the browser's tab: the screen's heading, then the app's name. */
  "app.document-title": "{screen} — NovaTrail",
  /** The heading of the home screen: the name of the platform, not translated. */
  "home.title": "NovaTrail",
  /** The name of the group of buttons that choose the language of this device. */
  "language.title": "Language",
  /** app opened in a frame of another page. */
  "boot.framed": "This app opens only in a tab of its own",
  "boot.offline": "No connection",
  /** The button of the offline screen: asks again. */
  "boot.retry": "Try again",
  /** /deployment.json is not there, or not right. */
  "boot.unconfigured": "This app isn't set up",
  /** Below a failure screen a child cannot fix. */
  "boot.grown-up": "A grown-up needs to help",
  /** Over any screen once the hosting has a newer build. */
  "boot.new-version": "There is a new version of the app",
  "boot.reload": "Reload",
  /** The browser erased the site's data while app was open. */
  "boot.erased": "The data on this device was erased",
  /** The data is there but could not be read; nothing was erased. */
  "boot.unreadable": "The data on this device can't be read",
  /** The task screen's line when a write of the learner's work failed (T24). */
  "task.not-saved": "Your work isn't saved on this device",
  /** A call of AI that gave nothing, and platform AI out of its limit: a neutral phrase (R04 spec). */
  "api.ai-failure": "The tutor can't answer right now",
  /** The quota of platform AI for the family day is spent; {time} is when the next day begins. */
  "api.quota": "Today's tutor time is used up. It comes back at {time}",
  "api.not-admitted": "The tutor isn't available for this profile",
  /** The limit of the adult's own AI key ran out at its provider. */
  "api.limit-reached": "The limit of your AI key is used up",
  /** The provider refused the adult's own AI key. */
  "api.key-refused": "The AI service didn't accept your key",
  "api.no-consent": "A grown-up's consent is needed first",
  /** The version of the module was withdrawn, or the learner has no current version of it. */
  "api.version-gone": "This version of the module is no longer given",
  "api.not-found": "This isn't there any more",
  "api.attempt-closed": "This task is already over",
  /** The user of the sign-in service has no account of NovaTrail yet. */
  "api.no-access": "This account has no access yet",
  /** The sign-in could not be renewed: the sign-in window comes on a press. */
  "api.sign-in": "Sign in again",
  /** The action needs a sign-in just made. */
  "api.fresh-sign-in": "Sign in again to do this",
  /** In place of the words of a code from api this build does not know: a newer api sent it. */
  "common.unknown": "This version of the app doesn't know this yet",
} as const satisfies Dictionary;
