// The microphone of the tutor's field: the browser's recognition of speech,
// `SpeechRecognition` or WebKit's `webkitSpeechRecognition`, which turns what the learner says into
// text in the field — the interim text while it listens, the final once it stops —, and the learner
// reads it and corrects it before Send. The app asks the browser to recognise on the device where
// it offers that; where it runs is the browser's all the same, and the app gets text alone. A browser without it, as Firefox,
// draws no microphone.
//
// WebKit on an iPad shares one audio session between the synthesis and the recognition: while the
// tutor's voice holds it, a recognition starts, the system shows its microphone, and no sound comes;
// a voice that begins while it listens takes the sound back, and the recognition neither hears nor
// ends. So a press first stops the voice and holds it until the listening ends, and where the
// browser has nothing to ask first — no `available`, as WebKit — starts the recognition within the
// press itself. A recognition with no sound NO_AUDIO_MS after its start is put away as one that
// heard nothing, but only once the browser has the microphone granted, or it gave sound on the page
// before: a prompt for it waits for the learner, however long; one whose sound began and gave no words NO_WORDS_MS later, too. Each
// event of a listening goes to the journal of the Debug window.
import { useEffect, useRef, useState } from "react";
import { note } from "../debug/journal.ts";
import { listeningMode } from "./listening.ts";
import { useSpeech } from "./VoicingContext.tsx";

/** How long a started recognition may go with no sound before it counts as one that heard nothing. */
export const NO_AUDIO_MS = 3000;

/**
 * How long a recognition may hear sound, or speech, with no word before it counts as one that heard
 * nothing: long enough for a learner who thinks before speaking.
 */
export const NO_WORDS_MS = 10_000;

/**
 * What the page has learnt of the microphone, kept past a field that goes and comes: whether it
 * has given sound once — then it is granted, whatever the browser says of it —, and when the last
 * listening ended.
 */
const page: { sounded: boolean; lastEnd: number | undefined; listenings: number } = {
  sounded: false,
  lastEnd: undefined,
  listenings: 0,
};

/** Forgets what the page learnt of the microphone: for the tests, each on a page of its own. */
export function forgetMicrophone(): void {
  page.sounded = false;
  page.lastEnd = undefined;
  page.listenings = 0;
}

/** The part of the browser's recognition the microphone uses. */
export interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  /** Recognise on the device alone: where the browser has the property, and offers it. */
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

/** A result of the recognition: every phrase of this listening so far, each its best reading. */
export interface RecognitionEvent {
  readonly results: ArrayLike<ArrayLike<{ readonly transcript: string }>>;
}

type RecognitionClass = (new () => Recognition) & {
  /** Whether the browser can recognise the languages, on the device alone if asked. */
  available?: (options: {
    readonly langs: readonly string[];
    readonly processLocally: boolean;
  }) => Promise<string>;
};

/** Whether the browser can recognise the language on the device alone. */
async function onDevice(Class: RecognitionClass, language: string): Promise<boolean> {
  try {
    return (await Class.available?.({ langs: [language], processLocally: true })) === "available";
  } catch {
    return false;
  }
}

/** The browser's recognition, or none where it has none. */
export function recognitionClass(): RecognitionClass | undefined {
  const scope = globalThis as {
    SpeechRecognition?: RecognitionClass;
    webkitSpeechRecognition?: RecognitionClass;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
}

/** What the learner said in one listening: its phrases one after another. */
export function heardOf(event: RecognitionEvent): string {
  return Array.from(event.results, (result) => result[0]?.transcript ?? "")
    .join("")
    .trim();
}

/**
 * The microphone: `start` listens in `language` and gives each reading to `onText`, the whole of
 * this listening so far; `stop` ends it, and `onEnd` comes once it has ended, by Stop, by the
 * browser at a pause, or by a failure, with whether anything was heard. An unmount, or `off`, puts
 * the listening away with nothing more said. `start` stops what the app is saying first and holds
 * the voice till the listening ends; a listening with no sound `NO_AUDIO_MS` after it began, the
 * microphone already granted, or with sound and no word `NO_WORDS_MS` after the sound began, ends
 * as one that heard nothing.
 */
export function useDictation({
  language,
  off,
  onText,
  onEnd,
}: {
  readonly language: string;
  readonly off: boolean;
  readonly onText: (heard: string) => void;
  readonly onEnd: (heard: boolean) => void;
}) {
  const Class = recognitionClass();
  const speech = useSpeech();
  const [listening, setListening] = useState(false);
  const live = useRef<Recognition | undefined>(undefined);
  const deaf = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // What lets the voice go once the listening ends.
  const quiet = useRef<(() => number) | undefined>(undefined);
  // The recognitions started: one is asked whether it can recognise on the device first.
  const began = useRef(new WeakSet<Recognition>()).current;
  // Whether the browser has the microphone granted: unknown counts as not, so no prompt is cut short.
  const granted = useRef(false);
  const permission = useRef("not said");
  useEffect(() => {
    let status: PermissionStatus | undefined;
    let gone = false;
    const read = () => {
      granted.current = status?.state === "granted";
      permission.current = status?.state ?? "not said";
    };
    void (async () => {
      try {
        status = await navigator.permissions?.query({ name: "microphone" as PermissionName });
        if (gone) return;
        read();
        status?.addEventListener("change", read);
      } catch {
        // A browser that does not say: the timer stays off.
      }
    })();
    return () => {
      gone = true;
      status?.removeEventListener("change", read);
    };
  }, []);
  // The callbacks of the render the recognition ends in, not of the one it began in.
  const callbacks = useRef({ onText, onEnd });
  callbacks.current = { onText, onEnd };
  const unwatch = () => {
    clearTimeout(deaf.current);
    deaf.current = undefined;
  };
  const unhold = () => {
    const kept = quiet.current?.() ?? 0;
    quiet.current = undefined;
    if (kept > 0)
      note(
        "info",
        "app",
        `dictation: the voice kept quiet ${kept} ${kept === 1 ? "time" : "times"} while it listened`,
      );
  };
  /** Puts `recognition` away as one that heard nothing `ms` from now, unless watched again. */
  const watch = (recognition: Recognition, ms: number, line: string) => {
    unwatch();
    deaf.current = setTimeout(() => {
      if (live.current !== recognition) return;
      note("warn", "app", line);
      put();
      callbacks.current.onEnd(false);
    }, ms);
  };
  const put = () => {
    unwatch();
    unhold();
    const was = live.current;
    live.current = undefined;
    if (was === undefined) return;
    was.onresult = null;
    was.onerror = null;
    was.onend = null;
    was.onaudiostart = null;
    was.onspeechstart = null;
    was.onaudioend = null;
    was.abort();
    page.lastEnd = performance.now();
    setListening(false);
  };
  // The field going off or on, and the unmount, put the listening away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on `off` and at the unmount.
  useEffect(() => put, [off]);
  const ended = (recognition: Recognition, heard: boolean) => {
    if (live.current !== recognition) return;
    unwatch();
    unhold();
    live.current = undefined;
    page.lastEnd = performance.now();
    setListening(false);
    callbacks.current.onEnd(heard);
  };
  const start = () => {
    if (Class === undefined || live.current !== undefined) return;
    const voiced = voiceNow();
    speech.stop();
    const recognition = new Class();
    recognition.lang = language;
    recognition.interimResults = true;
    // It listens until Stop, through the learner's pauses; or, as the Debug window chose, till the
    // browser hears a pause.
    const mode = listeningMode();
    recognition.continuous = mode === "stop";
    let heard = false;
    let results = 0;
    let empty = 0;
    recognition.onaudiostart = () => {
      page.sounded = true;
      note("info", "app", "dictation: sound began");
      watch(
        recognition,
        NO_WORDS_MS,
        `dictation: no words in ${NO_WORDS_MS} ms of sound — put away`,
      );
    };
    // Speech, with or without the sound's event before it, gives the words their time again.
    recognition.onspeechstart = () => {
      note("info", "app", "dictation: speech began");
      watch(
        recognition,
        NO_WORDS_MS,
        `dictation: no words in ${NO_WORDS_MS} ms of speech — put away`,
      );
    };
    recognition.onaudioend = () => {
      note("info", "app", "dictation: sound ended");
    };
    // A result with no word leaves the watch on: WebKit gives one where it hears sound and no word.
    recognition.onresult = (event) => {
      results += 1;
      const text = heardOf(event);
      if (text === "") {
        empty += 1;
        if (empty === 1) note("info", "app", "dictation: a result with no word");
        return;
      }
      unwatch();
      heard = true;
      callbacks.current.onText(text);
    };
    recognition.onerror = (event) => {
      const { error = "", message = "" } = event as Event & { error?: string; message?: string };
      note("warn", "app", `dictation: the browser refused — ${error || "no code"}`, message);
    };
    recognition.onend = () => {
      note(
        "info",
        "app",
        `dictation: ended, ${results} results, ${empty} with no word, ${heard ? "heard" : "nothing heard"}`,
      );
      ended(recognition, heard);
    };
    live.current = recognition;
    unhold();
    quiet.current = speech.hold();
    setListening(true);
    const begin = (local: boolean) => {
      // Stopped, or put away, before it began.
      if (live.current !== recognition) return;
      if (local) recognition.processLocally = true;
      began.add(recognition);
      note(
        "info",
        "app",
        // Its number keeps each start a line of its own: the journal folds a line said again soon
        // into the first, and its detail with it.
        `dictation: started in ${language}${local ? " on the device" : ""}, listening ${++page.listenings}${mode === "pause" ? ", till a pause" : ""}`,
        [
          voiced === "" ? "" : `the voice was ${voiced}: stopped first`,
          `microphone: ${permission.current}${page.sounded ? ", gave sound before" : ""}`,
          page.lastEnd === undefined
            ? "the first listening of the page"
            : `${((performance.now() - page.lastEnd) / 1000).toFixed(1)} s after the last listening`,
        ]
          .filter((line) => line !== "")
          .join("\n"),
      );
      // Set before the start, so that a sound the start reports at once clears it. A microphone that
      // gave sound on this page is granted, whatever the browser says: Chrome on an iPad never says.
      if (granted.current || page.sounded)
        watch(recognition, NO_AUDIO_MS, `dictation: no sound in ${NO_AUDIO_MS} ms — put away`);
      try {
        recognition.start();
      } catch (reason) {
        // Started already elsewhere, or refused at once: nothing was heard.
        note("warn", "app", "dictation: the browser refused to start", String(reason));
        ended(recognition, false);
        return;
      }
    };
    if (Class.available === undefined) begin(false);
    else void onDevice(Class, language).then(begin);
  };
  const stop = () => {
    const now = live.current;
    if (now === undefined) return;
    // Stop before it began: it ends with nothing heard.
    if (!began.has(now)) {
      ended(now, false);
      return;
    }
    // The learner is done speaking: the voice may speak again while the last words come.
    unhold();
    now.stop();
  };
  return { available: Class !== undefined, listening, start, stop };
}

/** What the browser's synthesis is about now: "speaking", "waiting to speak", or "" for nothing. */
function voiceNow(): string {
  try {
    const synth = globalThis.speechSynthesis;
    if (synth?.speaking === true) return "speaking";
    if (synth?.pending === true) return "waiting to speak";
    return "";
  } catch {
    return "";
  }
}
