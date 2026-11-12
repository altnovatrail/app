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
  /**
   * The quota of platform AI for the family day is spent; the next day begins on {date} at {time},
   * later than tomorrow on the device's clock (R37).
   */
  "api.quota": "Today's tutor time is used up. It comes back on {date} at {time}",
  /** The same, when the next family day begins today on the device's clock, at {time}. */
  "api.quota-today": "Today's tutor time is used up. It comes back today at {time}",
  /** The same, when the next family day begins tomorrow on the device's clock, at {time}. */
  "api.quota-tomorrow": "Today's tutor time is used up. It comes back tomorrow at {time}",
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
  /** The account has given as many consents for children as it may for now (R136 spec). */
  "api.too-many-consents": "No more consents can be given on this account for now",
  /** The learner's country raised its age of digital consent: an adult gives the age again. */
  "api.age-needed": "The learner's age needs to be given again",
  /** The legal text shown is not the current one: the screen shows the current one. */
  "api.text-not-current": "The text has changed. Read it again",
  /** The learner gave their own consent, and this is theirs to decide. */
  "api.learner-decides": "The learner decides this themselves",
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
  /** The owner accepts both legal texts, a checkbox: api keeps the versions shown (R131 spec). */
  "account.texts": "I accept the Privacy Policy and the Terms of Use",
  /** Below the checkbox when it is not ticked. */
  "account.texts-needed": "To create an account, accept the Privacy Policy and the Terms of Use",
  /** api has newer versions of the texts than the screen showed: they are shown anew, unticked. */
  "account.texts-changed": "The texts have changed. Read them again and accept them",
  /** The heading above the legal texts of the account, each opened in place. */
  "account.texts-title": "Privacy Policy and Terms of Use",
  /** The gist of a legal text, in the language of the screen, above the text. */
  "legal.gist": "In short",
  /** On a screen in another language than English: the legal text in force is the English one. */
  "legal.english-in-force": "The text is in English, and the English text is the one in force",
  /** Above a translation of a legal text, which has no force of its own (R141 spec). */
  "legal.translation": "Translation, for reading only",
  /** Above the English text of a legal text, the one in force. */
  "legal.original": "The text in force, in English",
  /**
   * The list of the legal pages, its heading, and the button to it on the sign-in screen: it holds
   * the word "privacy" (Д204 in spec's RUN.md).
   */
  "legal.title": "Privacy and legal information",
  "legal.intro":
    "The privacy policy, the terms of use and the consent are the texts of the operator of this copy of the app",
  /** The button to the legal pages on the first page of the section for adults. */
  "legal.open": "Read the privacy policy and other texts",
  "legal.hint":
    "The privacy policy, the terms of use, the consent to keeping works, accessibility and licenses",
  /** The bar above a legal page: back to their list. */
  "legal.back": "Back to the list",
  /** The bar above a legal page: back to where they were opened from. */
  "legal.close": "Close",
  "legal.privacy-policy": "Privacy Policy",
  "legal.terms-of-use": "Terms of Use",
  "legal.storage-consent": "Consent to keeping works on the server",
  "legal.accessibility": "Accessibility",
  "legal.notices": "Licenses and third-party notices",
  /** Below a legal text's heading: the number of its version and the day it came into force. */
  "legal.version": "Version {version}, in force since {date}",
  /** api gives no version of the text in force: none was approved, or this copy has none. */
  "legal.none": "This copy of the app has no version of this text in force",
  "legal.notices-intro":
    "The app is free software under the Apache License, Version 2.0. Its build includes software by others, each under its own license. Below are their notices and the text of the license, in English, as they come with the app",
  /** The heading above the file NOTICE, as it is; the name of the file stays. */
  "legal.notice-file": "Notices (NOTICE)",
  /** The heading above the file LICENSE, as it is; the name of the file stays. */
  "legal.license-file": "License (LICENSE)",
  /** The bar above the page of a module's license (R32). */
  "license.bar": "Licenses of modules",
  "license.title": "The module's license and notices",
  /** The bar above the page of a module's license: back to where it was opened from. */
  "license.close": "Close",
  "license.intro":
    "The module's author gives it under this license. Its text and the notices are below, as they come with the module",
  /** The terms of the module whose license the page shows, from its manifest. */
  "license.module": "Module",
  "license.version": "Version",
  /** The license of the module by its name, an identifier of the SPDX list such as Apache-2.0. */
  "license.name": "License",
  /** The module came with no LICENSE, which the module format does not allow. */
  "license.no-license": "No file LICENSE came with the module",
  /** The module has no NOTICE, which the module format allows. */
  "license.no-notice": "The module has no file NOTICE",
  "accessibility.standard": "The standard",
  /** The names of the criteria are those of WCAG 2.2. */
  "accessibility.standard-text":
    "The app is made to meet the Web Content Accessibility Guidelines, WCAG 2.2, at level AA, and two criteria of level AAA beyond it: 2.5.5 Target Size (Enhanced), so that every button is at least 44 by 44 pixels, and 2.3.3 Animation from Interactions, so that nothing moves when the device asks for reduced motion",
  "accessibility.partly": "In the places below, the app does not meet the standard yet",
  "accessibility.gaps": "Where the app does not meet it yet",
  /** The terms of each place where the app does not meet the standard. */
  "accessibility.criteria": "Criteria",
  "accessibility.why": "Why",
  "accessibility.instead": "What there is instead",
  "accessibility.when": "When this changes",
  "accessibility.handwriting": "Answering in handwriting",
  "accessibility.handwriting-criteria":
    "2.1.1 Keyboard, level A; 2.5.1 Pointer Gestures, level A; 2.5.7 Dragging Movements, level AA",
  "accessibility.handwriting-why":
    "An answer on the sheet, or in a box of the workbook, is written by hand: with a finger, a stylus or a mouse. It cannot be typed on a keyboard or given with a single tap",
  /** Up, Down, Left and Right are the canvas's own buttons, in its words. */
  "accessibility.handwriting-instead":
    "Choosing among options, and everything else in the app, works with a tap and from the keyboard. The sheet moves with its buttons Up and Down, and Left and Right when it is enlarged, with no two-finger gesture",
  "accessibility.handwriting-when":
    "Once there is a second way to answer, such as a keyboard or buttons with digits. The platform has not chosen it yet",
  "accessibility.print": "Print in the lines of a workbook",
  "accessibility.print-criteria": "1.4.12 Text Spacing, level AA",
  "accessibility.print-why":
    "The printed numbers, words and values in the lines of a workbook keep their own spacing: the place of each piece is fixed on the page, so the spacing you set for text does not reach them",
  /** Zoom in and Zoom out are the canvas's own buttons, in its words. */
  "accessibility.print-instead":
    "The print can be made up to twice as large with the sheet's buttons Zoom in and Zoom out. The task's statement above the workbook takes your spacing",
  "accessibility.print-when":
    "There is no date yet: only once the layout of the page leaves the lines room for wider spacing",
  /** Check and Not yet are the words of the task screen, Can't read this its reading's. */
  "accessibility.check": "Sending an answer with Check",
  "accessibility.check-criteria": "3.3.4 Error Prevention (Legal, Financial, Data), level AA",
  "accessibility.check-why":
    "Check sends the answer at once, with no question before it and no undo after: it is checked and counts in the learner's progress. A question before every check would get in a child's way",
  "accessibility.check-instead":
    "A wrong answer does not end the task: after Not yet, the learner can change the work and check it again. Work that can't be read comes back with Can't read this",
  "accessibility.check-when":
    "Once the second way to answer lets an answer be changed before it is checked",
  "accessibility.checked": "How it is checked",
  "accessibility.checked-text":
    "Automated checks run on every change to the app's code: the rules of WCAG 2.2 that a program can find, the size of buttons, a screen 320 pixels wide, forced colors and reduced motion. Checks by people, with the screen readers VoiceOver, TalkBack and NVDA on tablets and computers, have not been done yet",
  "accessibility.contact": "If something is hard to use",
  "accessibility.contact-text":
    "Write to the operator of this copy of the app if something in it is hard to use, or if you need what this page says in another form. How to reach the operator is in the privacy policy. Please write no personal details of a child",
  "accessibility.policy": "Open the privacy policy",
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
  /** On a module's card: the page of its LICENSE and NOTICE (R32). */
  "subjects.license": "License",
  /** On a module's card: its skill graph is a chain, so its lessons go one after another (R06). */
  "subjects.sequential": "In order",
  /** The second way in beside My subjects, and its screen's heading (product 4 spec; R34). */
  "skillmap.title": "Skill map",
  /** On a module's card on the screen Skill map: opens the module's map. */
  "skillmap.open": "Open the map",
  /** Back from a module's map to the list of the maps of the modules connected. */
  "skillmap.all": "All skill maps",
  /** The heading of a module's map; {module} is the module's title, in its own language. */
  "skillmap.module-title": "Skill map: {module}",
  /** Above a module's map: the map's own button is Practise (skill-map's words). */
  "skillmap.hint": "To practise a skill, open it on the map and press Practise",
  /** A module with no skill graph. */
  "skillmap.none": "This subject has no skill map",
  /** The modules of the catalog that teach the anchor skills whose holding is unknown (Д211). */
  "skillmap.offered-title": "Modules to connect",
  /** "Unknown" and "Skills from other modules" are skill-map's own words on the map. */
  "skillmap.offered-text":
    "This subject builds on skills from other modules that are Unknown on the map. These modules teach them",
  /** While the choice of a skill pressed on the map is under way: another press waits for it. */
  "skillmap.choosing": "Opening what's next…",
  /** A module of those connected from the map: its card says so in place of its button. */
  "skillmap.connected": "Connected: it is in My subjects now",
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
  /** In the block "Tutor" while the tutor's words are asked: they take some seconds to come. */
  "task.words-waiting": "The tutor is writing…",
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
  /** A line of the screen when a chip of the bar not reached is pressed: it names the chip. */
  "lesson.not-open-pressed": "{n} {kind}: not open yet",
  /** A line of the screen when the chip of a task that ended is pressed: it names the chip. */
  "lesson.task-over-pressed": "{n} {kind}: already over",
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
  /** The section for adults: its heading, and the buttons that open it (section 3.10). */
  "adults.title": "For grown-ups",
  /** Leaves the section for the learner's home, or the choice of the learner. */
  "adults.close": "Close the section",
  /** From a page of the section to its first page. */
  "adults.back": "Back to the section",
  /** The heading above the buttons of the language of this device, on the section's first page. */
  "adults.device-language": "Language on this device",
  "adults.device-language-hint":
    "This section and the screens before a learner is chosen are in it",
  /** The heading above the profiles of the account, each a page of its own. */
  "adults.profiles": "Profiles",
  /** A profile's page and the button that opens it: the pseudonym is not declined. */
  "adults.profile": "Profile: {pseudonym}",
  /** The setting each task begins in (R05): the learner switches it on the task screen. */
  "adults.mode": "Default mode",
  "adults.mode-hint": "Each task begins in it. The learner can switch it on the task screen",
  /** The language of the learner's screens, a field of the profile (R10). */
  "adults.language": "Language of the learner's screens",
  /** The profile has no language: its learner's screens are in the device's. */
  "adults.language-none": "None is chosen: the learner's screens are in the language of the device",
  /** The profile's language is one this build does not have; {language} is its name. */
  "adults.language-unknown":
    "The profile's language is {language}, which this version of the app doesn't have. The learner's screens are in the language of the device",
  /** The voicing of the tutor's words by the device (R07). */
  "adults.voicing": "Voicing",
  "adults.voicing-on": "Read the tutor's words aloud",
  "adults.speed": "Speed of voicing",
  "adults.speed-normal": "Normal",
  "adults.speed-slow": "Slow",
  /** The voice is the device's: chosen on the page This device of each device (R07). */
  "adults.voicing-device":
    "The tutor's words are read by a voice of the device. Each device's voice is chosen on its page This device",
  /** Voicing and a screen reader would speak at once (section 3.9). */
  "adults.voicing-reader":
    "If you listen to a screen reader, turn voicing off: the two would speak at once",
  "adults.save": "Save",
  /** api kept the settings changed. */
  "adults.saved": "Saved",
  /** Save with nothing changed: nothing is asked. */
  "adults.unchanged": "Nothing has changed",
  /** The modules of a profile, on its page: each with the page of its license (R32). */
  "adults.modules": "Modules",
  "adults.modules-hint": "The modules connected to the profile, and the license of each",
  "adults.modules-open": "See the modules and their licenses",
  "adults.modules-title": "Modules: {pseudonym}",
  /** On the page of a module's license in the section: back to the profile's modules. */
  "adults.modules-back": "Back to the modules",
  /** The progress of a profile (R35), on its page: the way to the page of the progress. */
  "progress.section": "Progress",
  "progress.section-hint":
    "The skill maps, the attempts with why each task was given, and the traps that repeat",
  "progress.open": "See the progress",
  "progress.title": "Progress: {pseudonym}",
  /** The reason codes are the adult's alone: no learner's screen shows them (R100 in spec). */
  "progress.hint": "Why each task was given shows here alone: the learner's screens don't say it",
  "progress.maps": "Skill maps",
  "progress.maps-hint": "The skills of each module connected, as the learner model reads them",
  /** On a module's map in the progress: back to the page of the progress. */
  "progress.back": "Back to the progress",
  /** The traps that repeat: mistakes the program found in two closed attempts or more. */
  "progress.traps": "Traps that repeat",
  "progress.traps-hint":
    "Mistakes the program found in two closed attempts or more, each with the advice of the module's author",
  "progress.traps-none": "No trap repeats yet",
  "progress.trap-advice": "Advice",
  /** How many closed attempts found the trap: two or more. */
  "progress.trap-found": "Found in",
  "progress.trap-count": plural({
    one: "{count} closed attempt",
    other: "{count} closed attempts",
  }),
  "progress.trap-last": "Last time",
  "progress.attempts": "Attempts",
  "progress.attempts-hint": "The newest first",
  "progress.attempts-none": "No attempts yet",
  /** Asks api for the next page of attempts. */
  "progress.more": "Show more",
  /** The heading of an attempt: {task} is the task's ID in its module, as the progress names it. */
  "progress.task": "Task {task}",
  "progress.module": "Module",
  /** The lesson of an attempt of a lesson's segment, by its title, or else its ID in its module. */
  "progress.lesson": "Lesson",
  /** The skills a solved attempt's task trains, by their titles in the module's language. */
  "progress.skills": "Skills",
  "progress.version": "Version",
  "progress.outcome": "Outcome",
  "progress.outcome-open": "Still going",
  "progress.outcome-first": "Answered correctly at the first answer",
  "progress.outcome-correct": "Answered correctly",
  "progress.outcome-solution-shown": "Solution shown",
  "progress.outcome-left": "Left: another task was begun",
  "progress.outcome-abandoned": "Nothing was done on it for 7 days",
  "progress.outcome-unchecked": "Not checked: this version of the module is no longer given",
  "progress.outcome-not-suitable": "Ended: its lesson doesn't suit this profile any more",
  "progress.outcome-done": "Finished with Done",
  "progress.wrong": "Wrong answers",
  "progress.begun": "Begun",
  "progress.closed": "Closed",
  /** Why the engine gave the task, outside a lesson. */
  "progress.why": "Why it was given",
  /** Why the engine gave the lesson the attempt is a segment of. */
  "progress.why-lesson": "Why its lesson was given",
  "progress.chosen": "Chosen",
  /** No choice of the engine: the learner began the same task again. */
  "progress.again": "The learner began it again: the program chose nothing",
  /** The nine reason codes of the engine's choice (concepts 12 in spec; R100 and R107 in spec). */
  "progress.reason-consolidation":
    "Consolidation: after a wrong answer, another task on the same skill",
  "progress.reason-new-skill":
    "A new skill: one not given before, whose prerequisites are counted as met, or which has none",
  "progress.reason-queue":
    "Next in the queue: of the skills within reach given before and not mastered, the one not given for longest",
  "progress.reason-repetition": "Review: the time to review a mastered skill has come",
  "progress.reason-probe": "A probe: a skill put aside comes back as a check",
  "progress.reason-skill-chosen":
    "The learner chose the skill on the skill map, and the program the task or lesson on it",
  "progress.reason-author-order":
    "The author's order: a skill with a rubric or with no assessment comes next by the skill graph",
  "progress.reason-open-run": "The lesson begun: the learner goes on with it",
  "progress.reason-rotation":
    "In rotation: a skill given before comes round again, the one not given for longest first",
  /** The storage of a profile's works on the server (R113 in spec), on the profile's page. */
  "storage.title": "Keeping works on the server",
  "storage.on": "Keeping this profile's works on the server is on",
  "storage.off": "Keeping this profile's works on the server is off",
  /** While api keeps no copy of a work: the consent is recorded, and no work goes to the server. */
  "storage.not-yet":
    "The server doesn't keep works yet: switching this on records the consent, and the works stay on this device alone",
  /** Opens the consent, in place. */
  "storage.keep": "Keep works on the server",
  /** Switches the storage off at once, with no question. */
  "storage.switch-off": "Stop keeping works on the server",
  "storage.off-hint":
    "It stops at once, and any copies of this profile's works on the server are erased. The works on this device stay",
  /** The heading of the consent, above the text storage-consent. */
  "storage.consent": "Consent to keeping works on the server",
  /** What R127 in spec has the switch say: a work may tell of health and family; nobody reads it. */
  "storage.what":
    "A work may tell something personal, about health and family too. Nobody reads it",
  /** The checkbox of the consent: explicit, to what the works tell about health too. */
  "storage.agree":
    "I give my explicit consent to keeping this profile's works on the server, with what they tell about health",
  "storage.agree-needed": "To switch it on, tick the consent",
  /** api has a newer version of the text than the one shown: it is shown, and agreed to again. */
  "storage.text-changed": "The text of the consent has changed. Read it again and tick the consent",
  /** The button of the consent: switches the storage on. */
  "storage.switch-on": "Switch it on",
  /**
   * On My subjects: the share of today's quota of platform AI the learner's profile has used, as a
   * percentage — never a sum of money (concepts 14 spec). Once it is used up, the line is api.quota.
   */
  "quota.learner": "Tutor time today: {percent} used",
  /** The share of the quota of platform AI, on a profile's page in the section for adults. */
  "quota.title": "Tutor time",
  "quota.hint":
    "How much of today's tutor time — the platform's AI, which checks work and words the tutor's replies — this profile and the whole account have used",
  /** The share of the profile's own cap, as a percentage: {percent} is "40%". */
  "quota.profile": "This profile: {percent} used",
  /** The share of the cap of the whole account, which all its profiles use. */
  "quota.account": "The whole account: {percent} used",
  /** The profile's or the account's cap is reached: no work of the profile goes to platform AI. */
  "quota.reached":
    "Today's tutor time is used up: until it renews, the platform's AI checks no work of this profile",
  /** When the next family day begins, today on the device's clock, at {time} (R37). */
  "quota.renews-today": "Tutor time renews today at {time}",
  "quota.renews-tomorrow": "Tutor time renews tomorrow at {time}",
  /** The same, later than tomorrow, on {date} with no year (R37). */
  "quota.renews": "Tutor time renews on {date} at {time}",
  /** The account's tariff has no caps: platform AI is closed to it, and there is no share. */
  "quota.closed": "The platform's AI has no tutor time on this account now: it is closed to it",
  /** The page This device (R04; section 3.2): its heading, and its place on the first page. */
  "device.title": "This device",
  "device.hint": "What the app keeps on this device, and how to erase it",
  "device.open": "See what is on this device",
  /** The attempts a profile keeps unfinished on this device. */
  "device.unfinished": plural({
    one: "{count} unfinished task",
    other: "{count} unfinished tasks",
  }),
  /** About how much space the profile's data takes on this device: an estimate. */
  "device.size": "Its data here takes about {size}",
  "device.none": "Nothing of this profile is kept on this device",
  "device.unreadable": "The data of this profile on this device can't be read",
  /** While no copy of the profile's work is on the server (R113): the warning of its loss. */
  "device.only-here":
    "Its work is on this device alone: if the site's data is erased, the work is lost",
  "device.erase-profile": "Erase the profile's data on this device",
  /** The question before the profile's data goes: the pseudonym is not declined. */
  "device.erase-profile-confirm":
    "Profile: {pseudonym}. Its unfinished work on this device is lost, and nothing changes on the server",
  /** The button that answers the question yes. */
  "device.erase": "Erase",
  "device.erased": "Erased",
  /** A database another tab still holds: the registry keeps it, and the next start erases it. */
  "device.left": "Not all of it was erased. The app finishes at the next start",
  "device.erase-failed": "Nothing was erased. Try again",
  /** The space the whole site takes, as the browser estimates it. */
  "device.space": "Space",
  "device.estimate":
    "The app takes about {usage} here, of the {quota} the browser gives it. This is the browser's estimate for the whole site",
  /** Whether the browser agreed to keep the site's data: persistent storage. */
  "device.keeping": "Keeping the data",
  "device.persisted": "The browser has agreed to keep the site's data",
  "device.not-persisted": "The browser hasn't agreed to keep the site's data",
  "device.persist": "Ask the browser to keep it",
  "device.refused": "The browser didn't agree. The data is kept, but the browser may erase it",
  /** What the browser may erase by itself, and Safari's seven days (section 3.2). */
  "device.browser-erases":
    "The browser may erase the site's data by itself when space runs low. Safari erases it after seven days of use in which this app isn't touched",
  /** The data of a web app on the Home Screen is kept apart from Safari's (section 3.2). */
  "device.home-screen":
    "In Safari, the app can be added to the Home Screen: there its data isn't erased after seven days. But it is apart from Safari's: you sign in there again, and unfinished work from this tab doesn't move there",
  "device.erase-all": "Erase everything on this device",
  /** The question before everything goes: the work, the device's language, and the sign-in. */
  "device.erase-all-confirm":
    "Everything the app keeps on this device is lost: the work of every profile and the language of the device. The app signs out, and nothing changes on the server",
  "device.erase-all-failed": "The sign-out didn't go through, so nothing was erased. Try again",
  /** The speaker button beside a text: reads it by the device's voice (section 3.5), not "listen". */
  "voice.read": "Read aloud",
  /** Beside a speaker button that cannot read: {language} is the name of the text's language. */
  "voice.no-voice": "This device has no voice for {language}",
  /** Beside a speaker button on Android and Linux before an adult's leave on this device (R07). */
  "voice.ask-adult": "On this device, an adult turns voicing on first",
  /** The task screen's switch of the voicing of the tutor's words: pressed while it is on. */
  "voice.toggle": "Voicing",
  /** The page This device, in a browser with no speech synthesis. */
  "voice.unsupported": "This browser doesn't read text aloud. The text stays on the screen",
  /** On Android and Linux: why the voicing waits for the adult (R07). */
  "voice.leave-why":
    "On this device the system chooses the voice, and the browser can't tell whether it speaks on the device or sends the text over the network. So the app reads aloud here only once you turn it on",
  "voice.not-allowed": "Voicing is off on this device",
  "voice.allowed": "Voicing is on on this device",
  "voice.disallowed": "Voicing is off on this device now",
  "voice.allow": "Turn voicing on on this device",
  "voice.disallow": "Turn voicing off on this device",
  /** Above the voices of each language. */
  "voice.languages": "Each language is read by a voice of this device. You can choose it",
  /** A language this device has no voice for: the text stays, and nothing reads it. */
  "voice.none": "This device has no voice for this language. Its texts stay on the screen",
  /** How to add a voice, in words with no link (privacy 1, 7 spec; section 3.5). */
  "voice.add":
    "A voice is added in the system's settings: in Windows, in the speech settings; on a Mac, the voice is downloaded from Apple; on Android, as the voice data of the language",
  /** Says a sentence by the voice chosen. */
  "voice.sample": "Read a sample aloud",
  "voice.not-kept": "The choice wasn't kept on this device. Try again",
  /**
   * In the block Tutor, below its heading, wherever the tutor's words stand: the disclosure that
   * the tutor is an AI (R123 spec). Plain, for a learner of any age.
   */
  "tutor.ai": "The tutor is an AI, not a person",
  /** The heading of the section of My subjects that leads to the page on the tutor. */
  "tutor.home-title": "The tutor is an AI",
  "tutor.home-text":
    "The tutor, which gives hints and explains, is an AI: a computer program, not a person. Whether an answer is right, a program decides by the task's key, not the AI",
  /** The button to the page on the tutor, the learning material of R123 spec. */
  "tutor.open": "How to use the tutor safely",
  /** The bar above the page on the tutor, and its button that closes it home. */
  "tutor.bar": "About the tutor",
  "tutor.close": "Close",
  /** The heading of the page on the tutor. */
  "tutor.title": "How to use the AI tutor safely",
  "tutor.what": "The tutor is an AI",
  "tutor.what-1":
    "The tutor, which gives hints and explains, is an AI: a computer program, not a person. No person writes its replies while you learn",
  "tutor.what-2":
    "Whether an answer is right, a program decides by the task's key, not the AI. The AI reads your work, the handwriting or the drawing, and words the tutor's replies",
  "tutor.wrong": "It can be wrong",
  "tutor.wrong-1":
    "An AI can misread the work or say what isn't so. If its words seem wrong, read the task again and check what you can yourself",
  /** Explain differently is the button of the block Tutor, once on each rung (R82 spec). */
  "tutor.wrong-2":
    "When it can't read the work, it asks you to write it again. When its words after a wrong answer aren't clear, the button Explain differently says them another way, once",
  "tutor.gets": "What it gets, and what it doesn't",
  "tutor.gets-1":
    "To check the work, the app sends a picture of it with the task. Your name, your pseudonym and any ID never go to the AI",
  "tutor.gets-2":
    "But the picture shows everything on the sheet. So don't write your name or the real names of people you know on it, nor anything else personal: an address, a phone number, a school",
  "tutor.gets-3": "Which AI services the tutor uses, and what they keep, the privacy policy says",
  "tutor.learn": "It is there to help you learn",
  "tutor.learn-1":
    "The tutor gives hints step by step; it doesn't solve the task for you. Try on your own first: what you work out yourself, you learn best",
  "tutor.personal": "It is not someone to confide in",
  "tutor.personal-1":
    "The tutor is there for the task, and it needs nothing personal about you. Don't write to it about your health, your family or your feelings, and don't look to it for advice on them: talk to someone you trust",
  "tutor.personal-2":
    "If it asks for something personal, or says something that upsets you or seems unsafe, stop and tell someone you trust",
  "tutor.problem": "If something is wrong",
  /** Report a problem is the button beside each reply of the tutor. */
  "tutor.problem-1":
    "Beside each reply of the tutor, the adult of the account can press Report a problem. The report goes to the operator of the app, who reviews it within 3 days",
  "tutor.problem-2":
    "The report keeps the tutor's words and what is written in it as they are, so write no names in it",
  /** Beside each reply of the tutor, for the adult of the account (R123 spec). */
  "report.button": "Report a problem",
  /** The heading of the form of a report, below the words it is about. */
  "report.title": "Report a problem with these words",
  /** The group of the six kinds of a problem, one of which the adult picks. */
  "report.kind": "What is wrong with the words?",
  "report.kind-wrong": "Wrong",
  "report.kind-unclear": "Unclear",
  "report.kind-not-for-age": "Not right for the learner's age",
  "report.kind-harmful": "Harmful, dangerous or upsetting",
  "report.kind-personal": "Asks about something personal, or talks of it",
  "report.kind-other": "Something else",
  /** The label of the text of a report, which may be left empty. */
  "report.text": "What else to say, if anything",
  /** The report keeps the text for a year after its review, as written (R123 spec). */
  "report.text-hint":
    "Up to 1000 characters. Please write no names in it, yours or anyone else's: the report keeps it as it is written",
  "report.words": "The tutor's words above go with the report, as the app showed them",
  /** Also on the page on the tutor: the texts tell to call at once (R123 spec). */
  "report.danger":
    "If anyone is in danger now, call your country's emergency number: don't wait for the review",
  "report.send": "Send",
  "report.no-kind": "Choose what is wrong",
  /** The kind Something else, sent with no text. */
  "report.no-text": "Say in the text what is wrong",
  /** The answer of api; {date} is the day the operator reviews it by. */
  "report.sent": "Thank you: the report is sent. It will be reviewed by {date}",
  "report.sent-undated": "Thank you: the report is sent",
  /** In place of the words of a code from api this build does not know: a newer api sent it. */
  "common.unknown": "This version of the app doesn't know this yet",
} as const satisfies Dictionary;
