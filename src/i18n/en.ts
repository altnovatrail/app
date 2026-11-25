// The English dictionary, the source of every other: a key is the screen's word, a dot, then
// what the string is; its places are `{name}`, and the forms of a number are
// `plural({ one, other })`. A note to the translator is the key's JSDoc. The words that every
// screen takes alike are the glossary's.
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
  /** The task screen's line when a write of the learner's work failed. */
  "task.not-saved": "Your work isn't saved on this device",
  /** A call of AI that gave nothing, and platform AI out of its limit: a neutral phrase. */
  "api.ai-failure": "The tutor can't answer right now",
  /**
   * The quota of platform AI for the family day is spent; the next day begins on {date} at {time},
   * later than tomorrow on the device's clock.
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
  /** The own key, or its provider, came with a profile that is not an adult's. */
  "api.key-not-for-profile": "This profile can't use an own AI key",
  /** The limit of the own key ran out: the spending limit the owner set at the provider. */
  "api.limit-spend": "The spending limit set for your AI key is reached",
  /** The same: the provider's limit of the key's usage tier. */
  "api.limit-tier": "Your AI key has reached the limit of its usage tier at the provider",
  /** The same: the balance of the key's account at the provider ran out. */
  "api.limit-balance": "The balance of your AI key's account has run out",
  /** The same: the provider could not take the payment. */
  "api.limit-payment": "The AI provider couldn't take the payment for your key",
  /**
   * After one of the four above, when the provider named the moment access comes back: on {date} at
   * {time}, later than tomorrow on the device's clock.
   */
  "api.access-returns": "Access comes back on {date} at {time}",
  /** The same, when access comes back today on the device's clock, at {time}. */
  "api.access-returns-today": "Access comes back today at {time}",
  /** The same, when access comes back tomorrow on the device's clock, at {time}. */
  "api.access-returns-tomorrow": "Access comes back tomorrow at {time}",
  /** The owner checked own keys as many times as api lets an account in its window. */
  "api.key-checks": "You've checked keys too many times. Try again later",
  /** The same, when the next check opens on {date} at {time}, later than tomorrow. */
  "api.key-checks-later":
    "You've checked keys too many times. You can check again on {date} at {time}",
  /** The same, when the next check opens today on the device's clock, at {time}. */
  "api.key-checks-today": "You've checked keys too many times. You can check again today at {time}",
  /** The same, when the next check opens tomorrow on the device's clock, at {time}. */
  "api.key-checks-tomorrow":
    "You've checked keys too many times. You can check again tomorrow at {time}",
  "api.no-consent": "A grown-up's consent is needed first",
  /** The version of the module was withdrawn, or the learner has no current version of it. */
  "api.version-gone": "This version of the module is no longer given",
  "api.not-found": "This isn't there any more",
  "api.attempt-closed": "This task is already over",
  /** The account has given as many consents for children as it may for now. */
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
  /** The same button while Google's window is open. */
  "signin.signing": "Signing in with Google…",
  /** Below the heading of the sign-in: what NovaTrail is. */
  "signin.intro":
    "Learn from the best teachers, think on a canvas, find the answers yourself — and the AI tutor will guide you",
  /** Below the button: an account is a grown-up's alone. */
  "signin.grown-ups":
    "Accounts are for grown-ups, 18 and over. A child learns in a profile their grown-up adds, and never signs in",
  /** The browser did not open the sign-in window. */
  "signin.blocked":
    "The browser didn't open the sign-in window. Allow pop-ups for this site and try again",
  /** The sign-in failed for a reason app cannot name. */
  "signin.failed": "The sign-in didn't go through. Try again",
  /** Another tab still holds the sign-in of the copy's previous project. */
  "signin.other-tab":
    "The app is open in another tab with the previous sign-in. Close that tab and try again",
  /** The heading of the screen that asks for the invite code. */
  "account.invite-title": "You're invited",
  "account.invite-intro": "NovaTrail is in a closed preview. Enter the code from your invitation",
  /** The name of the code's field, drawn as four boxes of four characters. */
  "account.code-label": "Invite code",
  /** The owner's statement, a checkbox: kept by api with its date. */
  "account.adult": "I am 18 or older",
  /** Below the statement: why it is asked. */
  "account.adult-line": "Only grown-ups hold an account",
  /** Below the checkbox when "Create account" is pressed with it unticked. */
  "account.adult-needed": "Only someone 18 or older can create an account",
  "account.create": "Create account",
  /** What another account left on this device cannot be erased yet: another tab of the app holds it. */
  "account.held":
    "Another account's data on this device can't be erased yet. Close the app's other tabs and try again",
  /** api did not take the invite code. */
  "account.code-not-accepted": "This code isn't valid or has been used",
  /** Below the boxes of the code. */
  "account.code-hint": "Tap the boxes to paste the code from your invitation",
  /** Below the field when "Continue" is pressed with it empty. */
  "account.code-needed": "Enter the invite code",
  /** From the code to the statement and the texts. */
  "account.next": "Continue",
  /** Below the code: the sign-in is done, the account is not yet. */
  "account.signed-in": "Signed in with Google",
  /** The heading of the step of the statement and the texts. */
  "account.agree-title": "Create your account",
  "account.agree-intro": "One account holds your own profile and your children's. Only you sign in",
  /**
   * The owner accepts both legal texts, a checkbox: api keeps the versions in force.
   * Each name is a link to its legal page.
   */
  "account.texts": "I agree to the {terms} and the {policy}",
  "account.texts-policy": "Privacy Policy",
  "account.texts-terms": "Terms of Use",
  /** Below the checkbox when "Create account" is pressed with it unticked. */
  "account.texts-needed": "To create an account, accept the Privacy Policy and the Terms of Use",
  /** api has newer versions of the texts than the screen showed: they are shown anew, unticked. */
  "account.texts-changed": "The texts have changed. Read them again and accept them",
  /** Below the checkboxes: each text is in English and in force, its gist in the screen's language. */
  "account.texts-note": "Each text is in English, the one in force, with its gist in your language",
  /** What a screen reader hears while the next screen is read, after 0.3 s. */
  "wait.label": "Loading",
  /** The gist of a legal text, in the language of the screen, above the text. */
  "legal.gist": "In short",
  /** At the foot of a legal text's sheet: its page, with the whole text. */
  "legal.full": "Read the full text",
  /** On a screen in another language than English: the legal text in force is the English one. */
  "legal.english-in-force": "The text is in English, and the English text is the one in force",
  /** Above a translation of a legal text, which has no force of its own. */
  "legal.translation": "Translation, for reading only",
  /** Above the English text of a legal text, the one in force. */
  "legal.original": "The text in force, in English",
  /**
   * The list of the legal pages, its heading, and the button to it on the sign-in screen: it holds
   * the word "privacy".
   */
  "legal.title": "Privacy and legal information",
  "legal.intro":
    "The privacy policy, the terms of use and the consent are the texts of the operator of this copy of the app",
  /** The button to the legal pages on the first page of the section for adults. */
  "legal.open": "Read the privacy policy and other texts",
  "legal.hint":
    "The privacy policy, the terms of use, the consent to keeping works, accessibility and licenses",
  /** The way back before a legal page's heading, a button that shows its icon alone. */
  "legal.back": "Back to the list",
  "legal.privacy-policy": "Privacy Policy",
  "legal.terms-of-use": "Terms of Use",
  "legal.storage-consent": "Consent to keeping works on the server",
  "legal.accessibility": "Accessibility",
  "legal.notices": "Licenses and third-party notices",
  /** The page of the section Who we are of the privacy policy in force, and its button. */
  "legal.operator": "Who runs this copy of the app",
  /** Below a legal text's heading: the number of its version and the day it came into force. */
  "legal.version": "Version {version}, in force since {date}",
  /** api gives no version of the text in force: none was approved, or this copy has none. */
  "legal.none": "This copy of the app has no version of this text in force",
  /** On a text's page: its next version, which does not apply yet. */
  "legal.next-coming": "Version {version} of this text applies from {date}",
  "legal.next-read": "Read version {version}",
  /** The title of the page of a text's next version; {text} is the text's name. */
  "legal.next-page": "{text}: the next version",
  /** Below the heading of a next version: the number of its version and the day it applies from. */
  "legal.next-version": "Version {version}, applies from {date}",
  /** Below it: the version that is in force until that day. */
  "legal.next-until": "Until then, version {version} is in force",
  /** What a learner's adult can withdraw before a next version applies: the keeping of works. */
  "legal.next-withdraw":
    "Before it applies, you can withdraw a consent you gave in the app: keeping works on the server is switched off on a profile's page in the section for adults",
  "legal.next-none": "This text has no next version now",
  "legal.current-read": "Read the version in force",
  /** In the title of a next version shown in place, after the text's own title. */
  "legal.next-summary": "version {version}, applies from {date}",
  /** After signing in, on the choice of the learner and in the section for adults. */
  "legal.next-title": "New versions of the texts",
  /** {text} is the text's name. */
  "legal.next-line": "{text}: version {version} applies from {date}",
  /** Its button, which names the text too: two texts may have next versions of one number. */
  "legal.next-open": "Read {text}, version {version}",
  "legal.next-storage":
    "Keeping works on the server is on for a profile of this account. Before the new version applies, you can switch it off on the profile's page in the section for adults",
  /** On the page Who runs this copy: which version of the policy the section is from. */
  "legal.operator-from": "From the Privacy Policy, version {version}, in force since {date}",
  "legal.operator-none": "This copy's privacy policy has no section on who runs it",
  "legal.operator-no-policy": "This copy of the app has no privacy policy in force",
  "legal.operator-policy": "Read the whole privacy policy",
  "legal.notices-intro":
    "The app is free software under the Apache License, Version 2.0. Its build includes software by others, each under its own license. Below are their notices and the text of the license, in English, as they come with the app",
  /** The heading above the file NOTICE, as it is; the name of the file stays. */
  "legal.notice-file": "Notices (NOTICE)",
  /** The heading above the file LICENSE, as it is; the name of the file stays. */
  "legal.license-file": "License (LICENSE)",
  "license.title": "The module's license and notices",
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
  /** The chip under the page's heading: the standard and its level, as the mockup has it. */
  "accessibility.level": "WCAG 2.2 · level AA",
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
  "accessibility.handwriting-instead":
    "Choosing among options, and everything else in the app, works with a tap and from the keyboard",
  "accessibility.handwriting-when":
    "Once there is a second way to answer, such as a keyboard or buttons with digits. The platform has not chosen it yet",
  /** The sheet's own scrolling, which canvas declares. */
  "accessibility.moving": "Moving the sheet",
  "accessibility.moving-criteria": "2.5.7 Dragging Movements, level AA",
  /** Hand is the canvas's own tool, in its words. */
  "accessibility.moving-why":
    "With a single pointer, the sheet moves only by dragging it: with the Hand tool under a finger, a stylus or a mouse, with one finger once a stylus has written on it, and with two fingers always. The sheet has no buttons that move it. A task from paper over its sheet is moved by dragging its grip",
  "accessibility.moving-instead":
    "A mouse wheel, a trackpad and the arrow keys move the sheet across and down once it has the focus, and the arrow keys move a task from paper by its grip",
  "accessibility.moving-when":
    "There is no date: buttons that move the sheet come back only if the platform decides so",
  "accessibility.print": "Print in the lines of a workbook",
  "accessibility.print-criteria": "1.4.12 Text Spacing, level AA",
  /** Zoom in and Zoom out are the words of the sheet's bar. */
  "accessibility.print-why":
    "The printed numbers, words and values in the lines of a workbook lie on the task's page, each in a place fixed on it, so the spacing you set for text does not reach them",
  "accessibility.print-instead":
    "The task's statement above the workbook and the rest of the app take your spacing, and Zoom in on the sheet's bar makes the print up to twice as large",
  "accessibility.print-when":
    "There is no date: wider spacing comes only once the layout of the page leaves the lines room for it",
  /** Check and Not yet are the words of the task screen, Can't read this its reading's. */
  "accessibility.check": "Sending an answer with Check",
  "accessibility.check-criteria": "3.3.4 Error Prevention (Legal, Financial, Data), level AA",
  "accessibility.check-why":
    "Check sends the answer at once, with no question before it and no undo after: it is checked and counts in the learner's progress. A question before every check would get in a child's way",
  "accessibility.check-instead":
    "A wrong answer does not end the task: after Not yet, the learner can change the work and check it again. Work that can't be read comes back with Can't read this",
  "accessibility.check-when":
    "Once the second way to answer lets an answer be changed before it is checked",
  /** A frame drawn round a task the AI missed on the photo of a page. */
  "accessibility.framing": "Framing a task on a photo by hand",
  "accessibility.framing-criteria": "2.1.1 Keyboard, level A",
  "accessibility.framing-why":
    "A task the AI missed on the photo of a page is framed by drawing round it, or by tapping two of its corners: with a finger, a stylus or a mouse. A frame can't be drawn from the keyboard",
  "accessibility.framing-instead":
    "The tasks the AI found are picked and left out from the keyboard, and Retake takes a new photo",
  "accessibility.framing-when":
    "There is no date: a frame from the keyboard would need a way to point at a place on the photo",
  "accessibility.paper": "Solving a task from paper",
  "accessibility.paper-criteria": "2.1.1 Keyboard, level A",
  "accessibility.paper-why":
    "A task from a photo of a page is solved in handwriting, on the sheet or on the task over it: with a finger, a stylus or a mouse. Its solution cannot be typed on a keyboard",
  "accessibility.paper-instead":
    "Moving the task and hiding it, the list of the tasks, Hint and Check work from the keyboard. The tasks of a subject have options to choose among",
  "accessibility.paper-when":
    "There is no date: a task from paper has no answers to choose among, and the platform has not chosen a second way to write a solution",
  "accessibility.checked": "How it is checked",
  "accessibility.checked-text":
    "Automated checks run on every change to the app's code: the rules of WCAG 2.2 that a program can find, the size of buttons, a screen 320 pixels wide, forced colors and reduced motion. Checks by people, with the screen readers VoiceOver, TalkBack and NVDA on tablets and computers, have not been done yet",
  "accessibility.contact": "If something is hard to use",
  "accessibility.contact-text":
    "Write to the operator of this copy of the app if something in it is hard to use, or if you need what this page says in another form. How to reach the operator is in the privacy policy. Please write no personal details of a child",
  /** The button to the section Who we are of the privacy policy in force. */
  "accessibility.operator": "Who runs this copy and how to reach them",
  /** The heading of the screen that makes the owner's own profile as a learner. */
  "profile.title": "Your learner profile",
  /** The button of the avatars, before one is chosen and after. */
  "profile.avatar-choose": "Choose an avatar",
  "profile.avatar-change": "Change the avatar",
  /** Below the owner's fields: the name's bounds, and why no age is asked. */
  "profile.owner-hint":
    "A made-up name, up to 30 characters. A grown-up's profile needs no age: you stated that you are 18 or older",
  /** The avatars of the set (src/account/avatars.ts), each by its picture. */
  "avatar.peak": "Peak",
  "avatar.rocket": "Rocket",
  "avatar.leaf": "Leaf",
  "avatar.star": "Star",
  "avatar.moon": "Moon",
  "avatar.wave": "Wave",
  "avatar.sun": "Sun",
  "avatar.bolt": "Bolt",
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
  "choose.intro": "Choose a profile",
  /** Below a profile's name: whose it is. */
  "choose.owner": "You · grown-up",
  "choose.learner": "Learner",
  /** On a profile's card: the look of the card's one button, not a button of its own. */
  "choose.start": "Start",
  /** Shown but not open until a child's profile comes with a parent's consent. */
  "choose.add": "Add a learner",
  "choose.add-why": "Comes later: a child's profile waits for a parent's consent",
  /** Switches to the choice of the learner. */
  "learner.switch": "Switch learner",
  /** The profile's menu: its dialog, its pill by the pseudonym it shows, the learner in it. */
  "learner.menu": "Profile menu",
  "learner.menu-button": "{pseudonym}, profile menu",
  "learner.now": "Learning now",
  /**
   * The hint mode in the profile's menu: its group, and for a child's that a
   * grown-up sets it; each mode's title and line, as the mockup's.
   */
  "hints.title": "Hints",
  "hints.by-adult": "set by a grown-up",
  "hints.questions": "Questions only",
  "hints.questions-line": "The tutor asks about a step of the work",
  "hints.where": "Show where",
  "hints.where-line":
    "After “Not yet” the tutor also underlines where the mistake is — and corrects nothing",
  /** The adult's Help on the home screen: three things, and three pages. */
  "help.ai": "The tutor is an AI",
  "help.ai-text":
    "A computer program, not a person. The AI checks a task from paper, a program the rest. If the AI read your work wrongly, write it again, or tell the operator with Report a problem at the task",
  "help.name": "Your name is made up",
  "help.name-text": "Write no real names in the work — in an essay either",
  "signout.button": "Sign out",
  /** After "Erase everything on this device", whose erasure the browser did not finish. */
  "signout.left": "Not all of it was erased. The app finishes at the next start",
  "common.cancel": "Cancel",
  /** A button that shows its icon alone, ×, and its tooltip: closes a pop-over or a panel. */
  "common.close": "Close",
  /** Puts a card away once it is read. */
  "common.ok": "OK",
  /**
   * The captions of the other buttons that show an icon alone, each the button's name and its
   * tooltip: back, a chevron; the previous and the next task, ‹ ›; Help; the tutor's button at
   * the edge of the screen; the grabber of the tutor's sheet on a phone, by what it does next.
   */
  "icon.back": "Back",
  "icon.previous-task": "Previous task",
  "icon.next-task": "Next task",
  "icon.help": "Help",
  "icon.tutor": "Tutor",
  "icon.full-screen": "Full screen",
  "icon.half-screen": "Half screen",
  /** The camera's shutter, a white ring. */
  "icon.take-photo": "Take photo",
  /** The camera's way to a picture the device keeps, in place of the camera. */
  "icon.choose-photos": "Choose from photos",
  /** The cross and the corner of a frame the learner drew round a task the AI missed. */
  "icon.remove-frame": "Remove the frame",
  "icon.resize-frame": "Resize the frame",
  /**
   * The row of places of Home, Subjects and the skill map, and the phone's tab bar: its
   * name, its places, the cognitive map shut until it comes with its "Soon" and its tooltip, and
   * For grown-ups; Help is the bar's.
   */
  "nav.title": "Main",
  "nav.home": "Home",
  "nav.subjects": "Subjects",
  "nav.cognitive": "Cognitive map",
  "nav.soon": "Soon",
  "nav.cognitive-later": "Cognitive map — comes later",
  "nav.grown": "Grown-ups",
  /** Home: its title and heading, no pseudonym — the profile's menu has it. */
  "home.screen": "Home",
  /**
   * Subjects, the catalog of the server: its heading and line, the connected modules by their
   * count, the others, and a connected module's mark.
   */
  "catalog.title": "Subjects",
  "catalog.sub": "The modules of this server. A connected one is on Home, with its skill map",
  "catalog.connected": "Connected · {count}",
  "catalog.more": "More on this server",
  "catalog.is-connected": "Connected",
  /** At the title of a module's map: the pop-over of the connected modules, and its button. */
  "skillmap.modules": "Connected modules",
  "skillmap.module": "Module: {module}",
  /** The profile's menu: whose profile it is. */
  "learner.yours": "Your profile",
  /** For grown-ups, from the row of places: whose settings it holds, and the section's other pages. */
  "grown.who": "Your profile and this device",
  "grown.section": "All settings",
  /** The notifications at the top right: nothing sends one yet. */
  "bell.title": "Notifications",
  "bell.none": "Nothing new yet",
  "bell.later": "Notifications will appear here",
  /** The tutor's panel from the top right of Home, where there is no work: what it is and where it helps. */
  "tutor-home.ai":
    "The tutor is an AI — a computer program, not a person. The AI checks a task from paper, a program the rest",
  "tutor-home.where":
    "Open a lesson or a page from your book, and the tutor helps with the work there",
  /** The heading of the learner's home: the modules connected to the profile. */
  "subjects.title": "My subjects",
  /** A module's kind on Home: the engine leads, or its skills go in a chain. */
  "home.adaptive": "Adaptive",
  "home.sequential": "Sequential",
  /** A module's card on Home: goes on with it. */
  "home.continue": "Continue",
  /** Under an adaptive module: who chooses what comes next, from any module connected. */
  "home.engine-chooses": "The tutor chooses",
  "home.engine-what": "The next skill, as the work goes",
  "home.engine-any": "Any module",
  /** Under a module whose skills go in a chain: the skill to work on, how much is mastered, the next. */
  "home.chain-current": "Current skill",
  "home.chain-done": "Every skill mastered",
  "home.chain-percent": "{percent}%",
  "home.chain-next": "Next",
  /** A module's skills due for review, a chip. */
  "home.review": plural({
    one: "{count} skill to review",
    other: "{count} skills to review",
  }),
  /** Above "Tasks from my paper": what the half of the card opens. */
  "home.camera": "Camera",
  /** In "Next up", the task open: of its module, not declined, or from paper. */
  "task.of-module": "A task: {module}",
  "task.of-paper": "A task from paper",
  /** In "Next up" with nothing open: the engine names what it gives only once asked. */
  "home.engine-picks": "The tutor picks the next lesson or task",
  /** In "Next up" with no module connected. */
  "home.nothing": "Nothing to begin yet: no subject is connected",
  /** Before the other lessons begun, each a link. */
  "home.more-runs": "Also begun:",
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
  /** On a module's card in the section for adults: the page of its LICENSE and NOTICE. */
  "subjects.license": "License",
  /** On a module's card: its skill graph is a chain, so its lessons go one after another. */
  "subjects.sequential": "In order",
  /** The heading of the card of what comes next: the task in progress, the engine's way, the tutor time. */
  "subjects.next-up": "Next up",
  /** The second card at the top: "Tasks from my paper", the tasks of a page of the learner's book. */
  "subjects.paper": "Tasks from my paper",
  /** Under its heading: what the card does, the mockup's line. */
  "subjects.paper-sub": "Snap a page from your book, pick the tasks, and solve each one here",
  /** The button of "Tasks from my paper": it opens the camera. */
  "subjects.paper-open": "Open camera",
  /** On a module's card under its bar: of its skills with a verdict, how many are mastered. */
  "subjects.mastered": "{mastered} of {count} mastered",
  /** On the card of a module whose skills have a rubric and no verdict. */
  "subjects.rubric": plural({
    one: "{count} skill, with a rubric",
    other: "{count} skills, each with a rubric",
  }),
  /** The name of a module's bar: {list} is each state and mark of its skills with its count. */
  "subjects.skills": "All the skills: {list}",
  /** One state or mark in the bar's name; {state} is its word below. */
  "subjects.skill-count": "{state}: {count}",
  /** A card of Subjects: the button ⋯ and its pop-over, the facts of the module's manifest. */
  "subjects.about": "About the module",
  "subjects.about-version": "Version",
  "subjects.about-authors": "Authors",
  "subjects.about-for": "For",
  "subjects.about-language": "Explanation language",
  "subjects.about-license": "License",
  /** The subject of a module, on the line under its title. */
  "subjects.subject-mathematics": "Mathematics",
  "subjects.subject-physics": "Physics",
  "subjects.subject-writing": "Writing",
  /** Whom a module is for: its grades, or its ages. */
  "subjects.grade": "Grade {grade}",
  "subjects.grades": "Grades {from}–{to}",
  "subjects.grade-list": "Grades {list}",
  "subjects.age-under-13": "Under 13",
  "subjects.age-teen": "13–17",
  "subjects.age-adult": "Grown-ups",
  "subjects.age-any": "Any age",
  /** The kind of a module solved on the sheet of a task from paper. */
  "subjects.kind-sheet": "On a sheet",
  /** On the line under a module's title: its explanation language, when it is not the screen's. */
  "subjects.in-language": "In {language}",
  /** The heading of a module's skills on its card and in their pop-over. */
  "subjects.skills-head": "Skills · {count}",
  /** The chip of the skills a card does not name, which opens them all. */
  "subjects.skills-more": "+{count} more",
  /** A tier with no name of its own, by its number. */
  "subjects.tier": "Tier {tier}",
  "subjects.open-map": "Open the skill map",
  /** A connected module's counts beside how many are mastered. */
  "subjects.to-review": "{count} to review",
  "subjects.in-progress": "{count} in progress",
  /** Beside Connect: how many skills the module has. */
  "subjects.skill-total": plural({ one: "{count} skill", other: "{count} skills" }),
  /** The legend of the marks of the cards: below the modules, and on a phone a button that opens it. */
  "subjects.legend": "What the marks mean",
  /**
   * The states of a skill and the marks of a skill with a rubric and of one not assessed, the words
   * that spec holds for every package, which the skill map shows too.
   */
  "skill-state.mastered": "Mastered",
  "skill-state.time-to-review": "Time to review",
  "skill-state.in-progress": "In progress",
  "skill-state.ready-to-start": "Ready to start",
  "skill-state.locked": "Locked",
  "skill-state.feedback-by-criteria": "Feedback by criteria",
  "skill-state.not-assessed": "Not assessed",
  /** The second way in beside Home, and its screen's heading. */
  "skillmap.title": "Skill map",
  /** On a module's card on the screen Skill map: opens the module's map. */
  "skillmap.open": "Open the map",
  /** Back from a module's map to the list of the maps of the modules connected. */
  /** The heading of a module's map; {module} is the module's title, in its own language. */
  "skillmap.module-title": "Skill map: {module}",
  /** Above a module's map: the map's own button is Practise (skill-map's words). */
  "skillmap.hint": "To practise a skill, open it on the map and press Practise",
  /** A module with no skill graph. */
  "skillmap.none": "This subject has no skill map",
  /** The modules of the catalog that teach the anchor skills whose holding is unknown. */
  "skillmap.offered-title": "Modules to connect",
  /** "Unknown" and "Skills from other modules" are skill-map's own words on the map. */
  "skillmap.offered-text":
    "This subject builds on skills from other modules that are Unknown on the map. These modules teach them",
  /** While the choice of a skill pressed on the map is under way: another press waits for it. */
  "skillmap.choosing": "Opening what's next…",
  /** A module of those connected from the map: its card says so in place of its button. */
  "skillmap.connected": "Connected: it is on Home now",
  /**
   * Under a module's map, on the learner's screen and in the section for adults alike: an adult set
   * the module's level, {date} the day of the last correction.
   */
  "level.set-by-adult": "The level was set by an adult on {date}",
  /** The adult's correction of a module's level, on its map in the section for adults. */
  "level.title": "Level",
  /** Each press sets the level one band easier or harder: a fact the learner model takes. */
  "level.hint":
    "Each press moves the level one band, and the learner sees on their map that an adult set it",
  /** {band} is the title of the band of the level, in the module's language. */
  "level.band": "The level: {band}",
  /** The level stands below the lowest band, {band}, where a new learner may start. */
  "level.below": "The level: below {band}",
  /** The button that sets the level in the band before it, {band}. */
  "level.easier": "Easier: {band}",
  /** The button that sets the level in the band after it, {band}. */
  "level.harder": "Harder: {band}",
  /** The band pressed was no longer next to the level: the map was read again. */
  "level.moved": "The level had changed meanwhile. It shows here as it stands now",
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
  "task.check-locked-line": "Choose one of the answers, then Check.",
  "task.correct": "Correct",
  /** Not "wrong": the verdict that the learner can still get it. */
  "task.not-yet": "Not yet",
  "task.unreadable": "Can't read this",
  "task.unchecked": "Not checked",
  /** After a check with items not right yet. */
  "task.summary-not-yet": plural({
    one: "Not right yet: {count} item of {total}",
    other: "Not right yet: {count} items of {total}",
  }),
  /** After a check of a workbook with lines not right yet. */
  "task.summary-lines": plural({
    one: "Not right yet: {count} line of {total}",
    other: "Not right yet: {count} lines of {total}",
  }),
  /** The heading of the solution, shown once the task is solved. */
  "task.solution": "Solution",
  /** Begins the same task again: a template may give another instance. */
  "task.again": "Try it again",
  "task.home": "Back to Home",
  /** On Home while the learner has an attempt open. */
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
  "task.check-write-line": "Write it with the pen, then Check.",
  /** Beside Check while a box of the workbook holds no answer. */
  "task.check-boxes": "Write an answer in each box",
  "task.check-boxes-line": "Write it in each box with the pen, then Check.",
  /** The name of the pill of the mode, which opens its pop-over: the mode shown follows. */
  "task.mode-open": "Mode: {mode}",
  /** Under "Step by step" in the pop-over of the mode. */
  "task.by-steps-line": "The task's steps, one at a time, in the tutor's panel",
  /** Under "On my own" in the pop-over of the mode: the tutor's panel stays closed until opened. */
  "task.on-my-own-line": "The tutor waits until called",
  /** At the foot of the pop-over of the mode: the choice holds for this attempt. */
  "task.mode-note": "For this task. A grown-up sets which one a task starts with.",
  /** The button of the row that opens the options of the task's answer slots bound choice. */
  "task.choose": "Choose an answer",
  /** The same button's name once the one option is chosen, which it shows. */
  "task.chosen": "Your answer: {option}. Change it",
  "task.chosen-judged": "Your answer: {option}, {verdict}. Change it",
  "task.chosen-over": "Your answer: {option}, {verdict}",
  /** The verdict's card while the work is read and checked. */
  "task.reading": "Reading your work…",
  /** Under "Reading your work…": what goes, and what does not. */
  "task.reading-line": "A picture of the work goes to be read.",
  /** Puts the card of "Not yet" away, back to the work. */
  "task.try-again": "Try again",
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
  /** A box of a workbook's line, by its place in the line from 1, beside its verdict. */
  "task.box": "Box {n}",
  /** Asks for a hint: what the task gives and asks, its technique and question, or the rung again. */
  "task.hint": "Hint",
  /** The task has no technique and no question to hint before a wrong answer. */
  "task.hint-none": "This task has nothing more to hint",
  /** The same rung in other words: one call of AI on a rung. */
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
  /** Ends the attempt of an essay: open once it was sent at least once. */
  "task.done": "Done",
  "task.done-locked": "Done opens once the essay has been sent",
  /** Under "Done opens once…" in the card, once Done is pressed before the first submission. */
  "task.done-locked-line": "Write the essay, then send it with Check.",
  /** The card of an essay whose feedback came: it says where the words are, the tutor's panel. */
  "task.feedback": "Feedback",
  "task.feedback-line": "The feedback is in the tutor's panel. Write again, or press Done.",
  /** The result of an essay finished by Done. */
  "task.essay-done": "Essay finished",
  /** The heading of what was read of the essay at its last submission. */
  "task.essay-text": "What was read",
  /** The feedback whose words did not pass the checks of api. */
  "task.feedback-none": "No feedback this time",
  /** A repeat of a submission whose answer was lost: the words are nowhere on the server. */
  "task.feedback-lost": "The feedback was lost on the way. Send the essay again to get it",
  /** An essay that cannot be read as a whole: the reason's words follow. */
  "task.essay-unreadable": "The essay can't be read: {reason}. Write it again and send it",
  /** No check: a call of AI gave nothing, or the assessment marked no criterion. */
  "task.essay-unchecked": "The essay wasn't checked this time",
  /** Told to a screen reader once the feedback of a submission came. */
  "task.feedback-came": "The feedback came",
  /** The criteria of the rubric, once the essay is finished: what the feedback looked at. */
  "task.criteria": "What the feedback looked at",
  /** The heading of the panel of the solving steps. */
  "steps.title": "Steps",
  /** Leads to the next step; it reads no work. */
  "steps.done": "Step done",
  /** Above the step's title in the tutor's panel and in the step's pill: where the step stands. */
  "steps.of": "Step {place} of {count}",
  /** The name of the step's card in the tutor's panel, which scrolls on its own. */
  "steps.card": "The step",
  /**
   * The name of the step's pill above the row while the tutor's panel is closed: the step, then
   * what a press does.
   */
  "steps.pill": "{of}: {title}. Open the tutor",
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
  /** The name of the list of a lesson's segments, and of its pop-over. */
  "lesson.segments": "Segments of the lesson",
  /** The name of the line under the lesson's title that opens its segments: the line's own words first. */
  "lesson.segments-open": "{where}: segments of the lesson",
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
  /** The heading of a lesson's screen while its run is read, before its own title is known. */
  "lesson.title": "Lesson",
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
  /** In "Next up" while the learner has a lesson open. */
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
  /** The section for adults: its heading, and the buttons that open it. */
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
  /** The setting each task begins in: the learner switches it on the task screen. */
  "adults.mode": "Default mode",
  "adults.mode-hint": "Each task begins in it. The learner can switch it on the task screen",
  /** The language of the learner's screens, a field of the profile. */
  "adults.language": "Language of the learner's screens",
  /** The profile has no language: its learner's screens are in the device's. */
  "adults.language-none": "None is chosen: the learner's screens are in the language of the device",
  /** The profile's language is one this build does not have; {language} is its name. */
  "adults.language-unknown":
    "The profile's language is {language}, which this version of the app doesn't have. The learner's screens are in the language of the device",
  /** The voicing of the tutor's words by the device. */
  "adults.voicing": "Voicing",
  "adults.voicing-on": "Read the tutor's words aloud",
  "adults.speed": "Speed of voicing",
  "adults.speed-normal": "Normal",
  "adults.speed-slow": "Slow",
  /** The voice is the device's: chosen on the page This device of each device. */
  "adults.voicing-device":
    "The tutor's words are read by a voice of the device. Each device's voice is chosen on its page This device",
  /** Voicing and a screen reader would speak at once. */
  "adults.voicing-reader":
    "If you listen to a screen reader, turn voicing off: the two would speak at once",
  "adults.save": "Save",
  /** api kept the settings changed. */
  "adults.saved": "Saved",
  /** Save with nothing changed: nothing is asked. */
  "adults.unchanged": "Nothing has changed",
  /** The modules of a profile, on its page: each with the page of its license. */
  "adults.modules": "Modules",
  "adults.modules-hint": "The modules connected to the profile, and the license of each",
  "adults.modules-open": "See the modules and their licenses",
  "adults.modules-title": "Modules: {pseudonym}",
  /** On the page of a module's license in the section: back to the profile's modules. */
  "adults.modules-back": "Back to the modules",
  /** The progress of a profile, on its page: the way to the page of the progress. */
  "progress.section": "Progress",
  "progress.section-hint":
    "The skill maps, the attempts with why each task was given, and the traps that repeat",
  "progress.open": "See the progress",
  "progress.title": "Progress: {pseudonym}",
  /** The reason codes are the adult's alone: no learner's screen shows them. */
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
  /** The nine reason codes of the engine's choice. */
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
  /** The storage of a profile's works on the server, on the profile's page. */
  "storage.title": "Keeping works on the server",
  "storage.on": "Keeping this profile's works on the server is on",
  "storage.off": "Keeping this profile's works on the server is off",
  /** Opens the consent, in place. */
  "storage.keep": "Keep works on the server",
  /** Switches the storage off at once, with no question. */
  "storage.switch-off": "Stop keeping works on the server",
  "storage.off-hint":
    "It stops at once, and the copies of this profile's works on the server are erased. The works on this device stay",
  /** The heading of the consent, above the text storage-consent. */
  "storage.consent": "Consent to keeping works on the server",
  /** What spec has the switch say: a work may tell of health and family; nobody reads it. */
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
   * On Home: the share of today's quota of platform AI the learner's profile has used, as a
   * percentage — never a sum of money. Once it is used up, the line is api.quota.
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
  /** When the next family day begins, today on the device's clock, at {time}. */
  "quota.renews-today": "Tutor time renews today at {time}",
  "quota.renews-tomorrow": "Tutor time renews tomorrow at {time}",
  /** The same, later than tomorrow, on {date} with no year. */
  "quota.renews": "Tutor time renews on {date} at {time}",
  /** The account's tariff has no caps: platform AI is closed to it, and there is no share. */
  "quota.closed": "The platform's AI has no tutor time on this account now: it is closed to it",
  /** The page Own AI key: its heading, and its place on the first page. */
  "ownkey.title": "Own AI key",
  "ownkey.hint": "Your own key at an AI provider, for the tutor's requests of your profile",
  "ownkey.open": "Set up an own AI key",
  /** The owner's profile as a learner is not open: the key is its, and goes with its requests. */
  "ownkey.not-open":
    "The key belongs to your profile as a learner and goes with its requests. Open your profile first",
  "ownkey.open-profile": "Open my profile",
  /** The account has no owner's profile of an adult as a learner. */
  "ownkey.no-profile": "Only your own profile as an adult learner can have an own AI key",
  /** What happens to the key, said before its field, in words and with no links. */
  "ownkey.server":
    "The key goes to NovaTrail's server with each request of your profile that calls the AI, and lives there only while the request runs: not in the database and not in the logs",
  "ownkey.billing":
    "The provider links each such request to your account with it and to your terms with it",
  "ownkey.not-protected":
    "A PIN doesn't protect the key, and the browser doesn't encrypt it: whoever holds this device can get at a key kept on it",
  /** How to limit the damage, for OpenAI and Anthropic. */
  "ownkey.limits":
    "To limit the damage, make the key in a separate OpenAI project with a hard spending limit, or bind it to a separate Anthropic workspace with a monthly limit, not the default workspace, where no limit can be set. Give the key a lifetime, and if it may have fallen into other hands, revoke it at the provider",
  "ownkey.provider": "AI provider",
  "ownkey.provider-choose": "Choose the provider",
  /** The server opens no provider to an own key: on a deployment, until its models are admitted. */
  "ownkey.no-providers":
    "No AI provider takes an own key on this server yet. Your profile's requests go to the platform's AI",
  "ownkey.key": "Key",
  "ownkey.key-needed": "Enter the key",
  "ownkey.keep": "Keep on this device",
  "ownkey.keep-hint":
    "Without this mark the key stays only in this tab's memory until you switch the learner or reload, and then you enter it again",
  "ownkey.connect": "Connect",
  /** The answers of the check of a new key; the former key, if any, stays as it was. */
  "ownkey.invalid": "The provider doesn't accept this key: it isn't valid, or it was revoked",
  "ownkey.no-permission": "The key is valid, but it has no right to the models the tutor uses",
  "ownkey.provider-closed": "This provider doesn't take an own key for your profile",
  "ownkey.check-failed": "The key couldn't be checked. Try again",
  /** The key connected: {provider} is the provider's name, {last4} the key's last four characters. */
  "ownkey.connected": "Connected: a key of {provider} ending in {last4}",
  "ownkey.kept": "The key is kept on this device",
  "ownkey.in-memory": "The key is in this tab's memory alone",
  "ownkey.not-saved": "The key couldn't be kept on this device: it is in this tab's memory alone",
  "ownkey.replace": "Replace the key",
  "ownkey.replace-hint": "The key now connected stays until the new one passes the check",
  "ownkey.remove": "Remove key",
  /** The one way back to platform AI: the owner's action, never the app's. */
  "ownkey.remove-hint":
    "Your profile's requests then go to the platform's AI and spend its tutor time. The key keeps working at the provider: revoke it there if you no longer need it",
  "ownkey.remove-confirm": "The key is erased from this tab and from this device",
  "ownkey.removed": "The key is removed",
  /** What the last request on the key came to, and what the owner can do about it. */
  "ownkey.refused":
    "The provider refused the key at the last request. Replace the key, or remove it to go to the platform's AI",
  /** After the line of the limit, when the provider named no limit, or one the build does not know. */
  "ownkey.limit":
    "Raise the limit or top up the balance at the provider, replace the key, or remove it to go to the platform's AI",
  /** The same, after the spending limit the owner set: no time comes beside it. */
  "ownkey.limit-spend":
    "Raise the spending limit you set at the provider, replace the key, or remove it to go to the platform's AI",
  /** The same, after the ceiling of the provider's tier, with or without when access comes back. */
  "ownkey.limit-tier": "Replace the key, or remove it to go to the platform's AI",
  /** The same, after the balance of the key's account. */
  "ownkey.limit-balance":
    "Top up the balance at the provider, replace the key, or remove it to go to the platform's AI",
  /** The same, after the payment the provider could not take. */
  "ownkey.limit-payment":
    "Check the payment details at the provider, replace the key, or remove it to go to the platform's AI",
  /** The page This device: its heading, and its place on the first page. */
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
  /**
   * While a work of the profile is on this device alone — its storage off, or the last PutWork of a
   * work not gone through: the warning of its loss.
   */
  "device.only-here":
    "Its work is on this device alone: if the site's data is erased, the work is lost",
  /** The owner's own key kept on this device: {provider} is the provider's name. */
  "device.own-key": "Its own AI key is kept on this device: a key of {provider} ending in {last4}",
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
  /** What the browser may erase by itself, and Safari's seven days. */
  "device.browser-erases":
    "The browser may erase the site's data by itself when space runs low. Safari erases it after seven days of use in which this app isn't touched",
  /** The data of a web app on the Home Screen is kept apart from Safari's. */
  "device.home-screen":
    "In Safari, the app can be added to the Home Screen: there its data isn't erased after seven days. But it is apart from Safari's: you sign in there again, and unfinished work from this tab doesn't move there",
  "device.erase-all": "Erase everything on this device",
  /** The question before everything goes: the work, the device's language, and the sign-in. */
  "device.erase-all-confirm":
    "Everything the app keeps on this device is lost: the work of every profile and the language of the device. The app signs out, and nothing changes on the server",
  "device.erase-all-failed": "The sign-out didn't go through, so nothing was erased. Try again",
  /** The speaker button beside a text: reads it by the device's voice, not "listen". */
  "voice.read": "Read aloud",
  /** Beside a speaker button that cannot read: {language} is the name of the text's language. */
  "voice.no-voice": "This device has no voice for {language}",
  /** Beside a speaker button on Android and Linux before an adult's leave on this device. */
  "voice.ask-adult": "On this device, an adult turns voicing on first",
  /** The task screen's switch of the voicing of the tutor's words: pressed while it is on. */
  "voice.toggle": "Voicing",
  /** The page This device, in a browser with no speech synthesis. */
  "voice.unsupported": "This browser doesn't read text aloud. The text stays on the screen",
  /** On Android and Linux: why the voicing waits for the adult. */
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
  /** How to add a voice, in words with no link. */
  "voice.add":
    "A voice is added in the system's settings: in Windows, in the speech settings; on a Mac, the voice is downloaded from Apple; on Android, as the voice data of the language",
  /** Says a sentence by the voice chosen. */
  "voice.sample": "Read a sample aloud",
  "voice.not-kept": "The choice wasn't kept on this device. Try again",
  /** The name of the part of the tutor's panel that holds its words and the verdicts, and scrolls. */
  "tutor.conversation": "Conversation",
  /**
   * The field of the tutor's panel: the microphone listening, its Stop, the line under the field
   * once the browser's recognition put the voice in it, the line when it heard nothing, and the
   * mark under a line the learner sent by voice.
   */
  "tutor.listening": "Listening…",
  "tutor.stop": "Stop",
  "tutor.dictated": "From your voice: read it, correct it, then send.",
  "tutor.unheard": "Nothing was heard. Try again, or type.",
  "tutor.stopped": "Stopped: your question is back in the field — change it and send it again.",
  "tutor.by-voice": "By voice",
  /** The heading of the page on the tutor. */
  "tutor.title": "How to use the AI tutor safely",
  "tutor.what": "The tutor is an AI",
  "tutor.what-1":
    "The tutor, which gives hints and explains, is an AI: a computer program, not a person. No person writes its replies while you learn",
  "tutor.what-2":
    "Whether an answer to a task of a subject is right, a program decides by the task's key; a task from your paper the AI checks. The AI also reads your work, the handwriting or the drawing, and words the tutor's replies",
  "tutor.wrong": "It can be wrong",
  "tutor.wrong-1":
    "An AI can misread the work or say what isn't so. If its words seem wrong, read the task again and check what you can yourself",
  /** Explain differently is the button of the block Tutor, once on each rung. */
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
  /** The button to the section Who we are of the privacy policy in force. */
  "tutor.operator": "Who runs the app",
  /** Beside each reply of the tutor, for the adult of the account. */
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
  /** The report keeps the text for a year after its review, as written. */
  "report.text-hint":
    "Up to 1000 characters. Please write no names in it, yours or anyone else's: the report keeps it as it is written",
  "report.words": "The tutor's words above go with the report, as the app showed them",
  /** Also on the page on the tutor: the texts tell to call at once. */
  "report.danger":
    "If anyone is in danger now, call your country's emergency number: don't wait for the review",
  "report.send": "Send",
  "report.no-kind": "Choose what is wrong",
  /** The kind Something else, sent with no text. */
  "report.no-text": "Say in the text what is wrong",
  /** The answer of api; {date} is the day the operator reviews it by. */
  "report.sent": "Thank you: the report is sent. It will be reviewed by {date}",
  "report.sent-undated": "Thank you: the report is sent",
  /**
   * Under "Open camera" on the card of a task from paper and on the camera's screen: a name on the
   * page would go to the AI with its photo.
   */
  "paper.names": "Keep names out of the photo",
  /** The heading of the camera's screen. */
  "paper.camera": "Photo of a page",
  /** The device has no camera, or the browser was not let use it: the photos are the way in. */
  "paper.no-camera": "The camera isn't available here. Choose a photo of the page instead",
  "paper.unreadable": "This picture can't be read. Take another photo, or choose one",
  /** The heading of the screen where the learner picks the tasks of the page. */
  "paper.title": "Your page",
  /** After "{count} tasks found" in the top bar's middle, between dots: those framed by hand. */
  "paper.drawn": plural({
    one: "{count} framed by you",
    other: "{count} framed by you",
  }),
  /** The top bar's button that throws the page away and opens the camera again. */
  "paper.retake": "Retake",
  "paper.remove-all": "Remove all frames",
  /** While FindTasks is under way. */
  "paper.finding": "Finding the tasks on the page…",
  /** FindTasks gave no frames: the learner draws them. */
  "paper.none-found": "No tasks were found",
  "paper.none-found-how": "Drag a frame round each task you want to solve",
  "paper.find-again": "Find the tasks again",
  /**
   * At the head of the bar: FindTasks gave the most tasks one page begins, {max}, and the page may
   * hold more; or more than {max} are picked, and "Start" is shut. Each a sentence in bold, no full
   * stop of its own, and what to do after it.
   */
  "paper.at-most": "{max} tasks is the most at once",
  "paper.at-most-how":
    "To take another, remove one of these with its cross and drag a frame round the one you want. You can also drag one frame round several tasks, or ask the tutor to",
  "paper.too-many": "At most {max} tasks start at once",
  "paper.too-many-how": "Leave some out",
  /** In the middle of the top bar once the tasks are found. */
  "paper.found-head": plural({
    one: "{count} task found",
    other: "{count} tasks found",
  }),
  /** A task's frame, a button; {n} is its place on the page, from the top. */
  "paper.select": "Select task {n}",
  "paper.deselect": "Deselect task {n}",
  /** A frame drawn by hand; {n} is its place on the page, from the top. */
  "paper.select-drawn": "Select your frame, task {n}",
  "paper.deselect-drawn": "Deselect your frame, task {n}",
  /** The first of two taps is down: the second one makes the frame. */
  "paper.corner": "Now tap the opposite corner of the task",
  /** The note above the bar, beside a lock. */
  "paper.note":
    "The AI looked at the whole page to find the tasks. The photo stays on this device. Drag a frame round a task it missed.",
  "paper.select-all": "Select all",
  "paper.select-none": "Select none",
  "paper.picked": "{count} of {total} selected",
  "paper.start": "Start",
  /** The row's button of the screen of solving that opens the tutor's panel. */
  "paper.ask": "Ask",
  /**
   * The tutor's chat on the page to pick from: its line of what it takes, the field of a
   * request and its buttons, and the program's line of what the request came to.
   */
  "paper.ask-hello":
    "Tell me which tasks to take from this page and how to split them: a column, a row, each example on its own. I only change the frames.",
  "paper.ask-label": "Your request about the page",
  "paper.ask-placeholder": "Say which tasks to take…",
  "paper.ask-send": "Send",
  /** The microphone of the tutor's field, which puts what the learner says into it as text. */
  "paper.ask-voice": "Dictate",
  "paper.asked-found": plural({
    one: "Found {count} task",
    other: "Found {count} tasks",
  }),
  "paper.asked-found-line": "Your own frames stay. Undo brings back the frames before.",
  "paper.asked-none": "No tasks found for that",
  "paper.asked-none-line": "The frames stay as they were.",
  "paper.undo": "Undo",
  "paper.undone": "The frames are back as they were",
  /** Start is shut: without AI a task from paper can't be checked. */
  "paper.no-ai": "Without the AI a task from paper can't be checked",
  /** The heading of the screen of solving: a task the AI found; {n} is its place on the page. */
  "paper.task": "Task {n}",
  /** A frame drawn by hand; {n} is its place on the page, from the top. */
  "paper.your-frame": "Your frame, task {n}",
  /** The button between ‹ and ›, which opens the list of the tasks begun. */
  "paper.counter": "{n} / {total}",
  /** The list's heading, and the button's name, which holds its caption as said (WCAG 2.5.3). */
  "paper.tasks": "Tasks",
  "paper.tasks-done": "{n} of {total} done",
  "paper.task-solved": "Solved",
  "paper.task-not-yet": "Not yet",
  "paper.task-so-far": "So far correct",
  "paper.task-no-key": "Cannot be checked",
  "paper.task-closed": "Closed",
  "paper.task-to-do": "Not checked yet",
  "paper.tasks-open": "Tasks, {n} / {total}",
  /** At the list's head: back to the page, to pick more of its tasks. */
  "paper.add": "Add",
  /** The button on the card "Tasks from my paper" that opens the profile's pages from paper kept on the device. */
  "paper.pages": "Your pages",
  /** Beside the heading of its pop-over, which is its button's words. */
  "paper.pages-here": "on this device",
  /** A page in it: when it was photographed, and how many tasks were begun on it. */
  "paper.page": "{when} · {tasks}",
  "paper.page-tasks": plural({
    one: "{count} task",
    other: "{count} tasks",
  }),
  /** The pop-over while the device keeps no page of the profile. */
  "paper.pages-none": "No pages yet",
  /** A page that would not open: the device keeps it no more. */
  "paper.page-gone": "This page isn't on this device any more",
  /** Under the list: how many pages live, where and until when. */
  "paper.pages-kept": plural({
    one: "The latest {count} page is kept on this device until the profile is deleted, and is in its export.",
    other:
      "The latest {count} pages are kept on this device until the profile is deleted, and are in its export.",
  }),
  /** Check pressed with nothing written, on the sheet or on the task. */
  "paper.write-first": "Write your solution first",
  "paper.write-first-line": "Write it with the pen on the sheet or on the task, then Check.",
  /** The card of a Check of a task from paper that read nothing of a solution in any task. */
  "paper.no-key": "Couldn't check this one",
  "paper.no-key-line":
    "No solution could be read here. Write it out, then Check again. Hints still work.",
  /** The tutor's first line on the screen of solving, and its field of a question about the task. */
  "paper.solve-hello":
    "Ask about this task by text or voice, or take a hint: the tutor answers with a question, never with the answer. A program checks every answer.",
  "paper.question-label": "Your question about the task",
  "paper.question-placeholder": "Ask about this task…",
  /**
   * Grown-up mode of the tutor on a task from paper, behind the grown-ups' PIN: the key in the
   * panel's head, its name; the PIN's dialog — its line, the same in red after a wrong PIN, the
   * dots of the digits entered for a screen reader, Cancel and the delete key, and the line under
   * it while the PIN is the same for everyone.
   */
  "grown.mode": "Grown-up mode",
  "grown.pin-line": "Enter your PIN to lift the tutor's limits on this task.",
  "grown.pin-wrong": "Wrong PIN. Try again.",
  "grown.pin-dots": "{n} of 4 digits",
  "grown.pin-cancel": "Cancel",
  "grown.pin-delete": "Delete",
  "grown.pin-note": "The PIN is 5555 for now.",
  /** The band under the panel's head while the mode is on, and its button. */
  "grown.band-line": "No limits, up to the full solution. Turn it off before the child goes on.",
  "grown.off": "Turn off",
  /** The lines of the conversation as the mode is turned on and off. */
  "grown.on-title": "Grown-up mode on",
  "grown.on-line": "The tutor does what the grown-up asks, up to the full solution.",
  "grown.off-title": "Grown-up mode off",
  "grown.off-line": "The tutor's limits are back: hints and questions, never the answer.",
  /** The field while the mode is on, and the head's line while the tutor acts on the sheet. */
  "grown.placeholder": "Ask for anything, up to the full solution…",
  "grown.writing": "Writing on the sheet…",
  /** The card of a task from paper with no answer yet and no mistake in its solution so far. */
  "paper.so-far": "So far correct",
  "paper.so-far-line": "No mistake yet. Go on to the answer, then Check.",
  /**
   * The card of a frame of several tasks: {n} of the {of} tasks checked are correct; {tasks} are
   * the numbers of those whose answer was not read, in the frame's order.
   */
  "paper.parts-correct": "Correct · {n} of {of}",
  "paper.parts-not-yet": "Not yet · {n} of {of} correct",
  "paper.parts-so-far": "So far correct · {n} of {of} done",
  "paper.parts-unread": "No answer was read in tasks {tasks}",
  /** The tick and the cross by an answer on the crop, for a screen reader; {n} is the task's number in the frame. */
  "paper.mark-correct": "Task {n}: correct",
  "paper.mark-not-yet": "Task {n}: not yet",
  "paper.mark-wavy": "Tutor's mark: where the mistake is",
  /** The cards of a work with no final answer, or more than one: written, or one option circled. */
  "paper.no-answer": "No answer found",
  "paper.no-answer-line": "Write your answer, or circle one option, then Check.",
  "paper.several": "More than one answer",
  "paper.several-line": "Leave one answer or one circled option, then Check.",
  /** In place of the words of a code from api this build does not know: a newer api sent it. */
  "common.unknown": "This version of the app doesn't know this yet",
} as const satisfies Dictionary;
