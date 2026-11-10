// The English dictionary, the source of every other (section 3.8 of docs/architecture.md): a key
// is the screen's word, a dot, then what the string is; its places are `{name}`, and the forms of
// a number are `plural({ one, other })`. A note to the translator is the key's JSDoc. The words
// that every screen takes alike are the glossary of section 3.8.
import { type Dictionary, plural } from "./types.ts";

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
  /** The heading of the sign-in screen. */
  "signin.title": "Sign in",
  /** The button that opens Google's sign-in window. */
  "signin.google": "Sign in with Google",
  /** The browser did not open the sign-in window. */
  "signin.blocked":
    "The browser didn't open the sign-in window. Allow pop-ups for this site and try again",
  /** The sign-in failed for a reason app cannot name. */
  "signin.failed": "The sign-in didn't go through. Try again",
  /** Another tab still holds the sign-in of the copy's previous project (section 3.7). */
  "signin.other-tab":
    "The app is open in another tab with the previous sign-in. Close that tab and try again",
  /** The heading of the screen that asks for the invite code. */
  "account.invite-title": "Invite code",
  "account.invite-intro": "NovaTrail is open by invitation for now",
  /** The owner's statement, a checkbox: kept by api with its date (R118 spec). */
  "account.adult": "I am 18 or older",
  /** Below the checkbox when it is not ticked. */
  "account.adult-needed": "Only someone 18 or older can create an account",
  "account.create": "Create account",
  /** What another account left on this device cannot be erased yet: another tab of the app holds it. */
  "account.held":
    "Another account's data on this device can't be erased yet. Close the app's other tabs and try again",
  /** api did not take the invite code. */
  "account.code-not-accepted": "This code isn't valid or has been used",
  /** Below the field when it is empty. */
  "account.code-needed": "Enter the invite code",
  /** The heading of the screen that makes the owner's own profile as a learner. */
  "profile.title": "Your learner profile",
  /** The name a learner goes by: never a real one. */
  "profile.pseudonym": "Pseudonym",
  "profile.pseudonym-hint": "Not a real name, up to 30 characters",
  "profile.pseudonym-length": "From 1 to 30 characters",
  "profile.country": "Country",
  /** The first choice of the list of countries, before one is chosen. */
  "profile.country-choose": "Choose a country",
  /** api does not take learners from the country chosen. */
  "profile.country-not-accepted": "NovaTrail doesn't take learners from this country yet",
  "profile.create": "Continue",
  /** The heading of the choice of the learner. */
  "choose.title": "Who is learning?",
  /** On the first sign-in of an account on this device (section 3.2). */
  "persist.line": "Learners' work is kept on this device",
  /** Asks the browser to keep the site's data: navigator.storage.persist(). */
  "persist.ask": "Ask the browser to keep it",
  "persist.granted": "The browser will keep it",
  "persist.refused": "The browser may still erase it when space runs low",
  /** Switches to the choice of the learner. */
  "learner.switch": "Switch learner",
  "signout.button": "Sign out",
  /** The heading of the screen before the sign-out. */
  "signout.title": "Sign out?",
  "signout.erases": "Signing out erases everything of this account on this device",
  /** One line for each profile with unfinished tasks on this device. */
  "signout.unfinished": plural({
    one: "{pseudonym}: {count} unfinished task",
    other: "{pseudonym}: {count} unfinished tasks",
  }),
  "signout.nothing": "No unfinished work is on this device",
  "signout.confirm": "Sign out and erase",
  /** The sign-in service did not sign out: nothing was erased. */
  "signout.failed": "The sign-out didn't go through. Nothing was erased. Try again",
  /** After a sign-out whose erasure the browser did not finish. */
  "signout.left": "Not all of it was erased. The app finishes at the next start",
  "common.cancel": "Cancel",
  /** The heading of the learner's home: the modules connected to the profile (product 4 spec). */
  "subjects.title": "My subjects",
  /** The heading of the modules connected to the profile. */
  "subjects.connected": "Connected",
  "subjects.none": "No subjects are connected yet",
  /** Some modules are named by their IDs: their manifests did not come. */
  "subjects.unnamed": "The names of some modules didn't come",
  /** The heading of the modules the profile may connect. */
  "subjects.catalog": "Catalog",
  "subjects.catalog-empty": "The catalog has no modules for this profile yet",
  /** On a module's card when its explanation language is not the screen's; {language} is its name. */
  "subjects.explanation-language": "Explanation language: {language}",
  /** A module connected that has no current version for the learner. */
  "subjects.unavailable": "Not available now",
  "subjects.connect": "Connect",
  "subjects.disconnect": "Disconnect",
  /** In place of the words of a code from api this build does not know: a newer api sent it. */
  "common.unknown": "This version of the app doesn't know this yet",
} as const satisfies Dictionary;
