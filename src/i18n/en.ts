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
  /** The heading of the task screen: a task has no title of its own. */
  "task.title": "Task",
  /** The name of the group of the two buttons of the mode. */
  "task.mode": "Mode",
  "task.by-steps": "Step by step",
  /** The mode without the steps; in Russian not "сам", which tells the learner's gender. */
  "task.on-my-own": "On my own",
  /** The name of the panel beside the canvas. */
  "task.tutor": "Tutor",
  /** The name of an item that has no text of its own, by its place from 1. */
  "task.item": "Item {n}",
  /** The name of one of an item's answer slots, by its place from 1. */
  "task.slot": "Answer {n}",
  /** Sends the work to be checked. */
  "task.check": "Check",
  /** Beside Check while an answer slot bound choice has no option tapped. */
  "task.check-locked": "Choose an answer in each item",
  "task.correct": "Correct",
  /** Not "wrong": the verdict that the learner can still get it (product 7 spec). */
  "task.not-yet": "Not yet",
  "task.unreadable": "Can't read this",
  "task.unchecked": "Not checked",
  /** After a check with items not right yet. */
  "task.summary-not-yet": plural({
    one: "Not right yet: {count} item of {total}",
    other: "Not right yet: {count} items of {total}",
  }),
  /** The heading of the solution, shown once the task is solved. */
  "task.solution": "Solution",
  /** Begins the same task again: a template may give another instance. */
  "task.again": "Try it again",
  "task.home": "Back to My subjects",
  /** On My subjects while the learner has an attempt open. */
  "task.continue-title": "There is a task in progress",
  "task.continue": "Continue the task",
  /** Why the task is over, below "This task is already over". */
  "task.closed-correct": "It was answered correctly",
  "task.closed-solution-shown": "Its solution was shown",
  "task.closed-left": "Another task was begun",
  "task.closed-abandoned": "Nothing was done on it for 7 days",
  "task.closed-not-suitable": "It doesn't suit this profile any more",
  "task.closed-done": "It was finished with Done",
  /** What was read in a slot written by hand: the reading, as the learner sees it. */
  "task.read": "Read: {text}",
  /** Why a slot could not be read: nothing is written in it. */
  "task.reason-blank": "Nothing is written",
  /** The answer is not written in the form the task asks for. */
  "task.reason-notation": "Write it the way the task asks",
  "task.reason-illegible": "It can't be made out",
  "task.reason-ambiguous": "It can be read two ways",
  "task.reason-no_final_answer": "There is no final answer",
  "task.reason-several_final_answers": "There is more than one final answer",
  /** Beside Check while the sheet holds no answer. */
  "task.check-write": "Write an answer on the sheet",
  /** Told to a screen reader when the tutor's words have come; the words themselves are not. */
  "task.words-came": "The tutor's words came",
  /** The name of a tutor's mark on a handwriting sheet, by its number and the count. */
  "task.mark": "Tutor's mark {n} of {total}",
  /** The name of a tutor's mark on a workbook, with its line and its box. */
  "task.mark-box": "Tutor's mark {n} of {total}: line {line}, box {box}",
  /** A line of a workbook, by its place from 1, beside its verdict. */
  "task.line": "Line {n}",
  /** Asks for a hint: what the task gives and asks, its technique and question, or the rung again. */
  "task.hint": "Hint",
  /** The task has no technique and no question to hint before a wrong answer. */
  "task.hint-none": "This task has nothing more to hint",
  /** The same rung in other words: one call of AI on a rung (R82 spec). */
  "task.explain": "Explain differently",
  /** "Explain differently" gave the words the learner reads already. */
  "task.no-other-words": "The tutor has no other words for this",
  /** Shows the solution, which ends the attempt. */
  "task.show-solution": "Show the solution",
  "task.show-confirm": "Once the solution is shown, the task is over",
  "task.show-it": "Show it",
  /** The result of an attempt ended by the solution shown. */
  "task.solution-shown": "Solution shown",
  /** A task with a rubric has no solution to show: "Done" ends it. */
  "task.no-showing": "This task has no solution to show",
  /** A child asks for the solution before the hint ladder is passed. */
  "task.ladder-not-passed": "The solution can be shown after a few more answers",
  /** The heading of the panel of the solving steps. */
  "steps.title": "Steps",
  /** Leads to the next step; it reads no work. */
  "steps.done": "Step done",
  /** Beside a step passed, in the bar of steps. */
  "steps.passed": "done",
  /** Beside the step shown. */
  "steps.now": "now",
  /** Beside a step not open yet. */
  "steps.later": "later",
  /** The chips of what the statement gives. */
  "steps.givens": "What we know",
  /** The chip of what the task asks to find. */
  "steps.unknown": "What to find",
  "steps.techniques": "Techniques",
  /** What opens "Step done" at a step whose exit condition is givens_ticked. */
  "steps.exit-givens": "Mark what we know and what to find",
  /** What opens "Step done", or Check, at a step whose exit condition is answer_slots_filled. */
  "steps.exit-slots": "Write an answer in each slot",
  /** The name of the bar of a lesson's segments. */
  "lesson.segments": "Segments of the lesson",
  /** The kinds of a lesson's segments, in the bar and in the line below it. */
  "lesson.explanation": "Explanation",
  "lesson.example": "Worked example",
  "lesson.task": "Task",
  /** Below the bar: the kind of the segment shown, its place and how many segments there are. */
  "lesson.where": "{kind} · {n} of {total}",
  /** Beside a segment passed, in the bar of segments. */
  "lesson.passed": "passed",
  /** Beside the segment the learner has reached. */
  "lesson.now": "now",
  /** Beside a segment not reached yet. */
  "lesson.later": "later",
  /** Why a task of the bar does not open: its attempt is closed. */
  "lesson.task-over": "This task is over",
  /** Why a segment of the bar does not open: it is not reached yet. */
  "lesson.not-open": "Not open yet",
  /** To the next segment; not "Next", which is the canvas's button of a worked example. */
  "lesson.continue": "Continue",
  "lesson.leave": "Leave the lesson",
  /** The end screen of a lesson done, below its title: no score, no comparison. */
  "lesson.complete": "Lesson complete",
  /** A task of the lesson left or abandoned: it begins once more, a new attempt. */
  "lesson.task-again": "Begin the task again",
  /** "Lesson done" before every task of the lesson ended. */
  "lesson.task-left": "The lesson has a task to finish",
  /** A lesson api ended: the module or the lesson suits the profile no more. */
  "lesson.ended-not-suitable": "This lesson doesn't suit this profile any more",
  "lesson.ended-abandoned": "The lesson wasn't opened for 30 days",
  /** A lesson ended for a reason this build has no words for. */
  "lesson.ended": "This lesson is over",
  /** On My subjects while the learner has a lesson open. */
  "lesson.open-title": "A lesson in progress",
  "lesson.open-continue": "Continue the lesson",
  /** A lesson open whose title is not on this device: its module's name, not declined. */
  "lesson.of-module": "A lesson: {module}",
  /** Goes to what the engine chooses; it asks api first when no answer said it yet. */
  "next.what": "What's next",
  /** Goes to the lesson the engine chose. */
  "next.lesson": "Next lesson",
  /** Goes to the task the engine chose. */
  "next.task": "Next task",
  /** The engine chose nothing: no module connected has more to give now. */
  "next.nothing": "There is nothing more to offer for now",
  /** Asks the engine for something other than the task in progress, which it closes. */
  "next.else": "Something else",
  "next.else-confirm": "The task in progress closes, and it can't be gone back to",
  "next.else-go": "Go on",
  /** In place of the words of a code from api this build does not know: a newer api sent it. */
  "common.unknown": "This version of the app doesn't know this yet",
} as const satisfies Dictionary;
