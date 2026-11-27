// The microphone of the tutor's field: the browser's recognition of speech,
// `SpeechRecognition` or WebKit's `webkitSpeechRecognition`, which turns what the learner says into
// text in the field — the interim text while it listens, the final once it stops —, and the learner
// reads it and corrects it before Send. The app asks the browser to recognise on the device where
// it offers that; where it runs is the browser's all the same, and the app gets text alone. A browser without it, as Firefox,
// draws no microphone.
//
// A press stops what the app is saying, and where the browser has nothing to ask first — no
// `available`, as WebKit — starts the recognition within the press itself. A listening never hangs
// on "Listening…": one with no sound NO_AUDIO_MS after its start ends as one that heard nothing,
// but only once the browser has the microphone granted — a prompt for it waits for the learner,
// however long —; one whose sound began and gave no word NO_WORDS_MS later, too.
import { useEffect, useRef, useState } from "react";
import { useSpeech } from "./VoicingContext.tsx";

/** How long a started recognition may go with no sound before it counts as one that heard nothing. */
export const NO_AUDIO_MS = 3000;

/**
 * How long a recognition may hear sound, or speech, with no word before it counts as one that heard
 * nothing: long enough for a learner who thinks before speaking.
 */
export const NO_WORDS_MS = 10_000;

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
 * browser, or by a failure, with whether anything was heard. An unmount, or `off`, puts the
 * listening away with nothing more said. `start` stops what the app is saying first; a listening
 * with no sound `NO_AUDIO_MS` after it began, the microphone granted, or with sound and no word
 * `NO_WORDS_MS` after the sound began, ends as one that heard nothing.
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
  // The recognitions started: one is asked whether it can recognise on the device first.
  const began = useRef(new WeakSet<Recognition>()).current;
  // Whether the browser has the microphone granted: unknown counts as not, so no prompt is cut short.
  const granted = useRef(false);
  useEffect(() => {
    let status: PermissionStatus | undefined;
    let gone = false;
    const read = () => {
      granted.current = status?.state === "granted";
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
  /** Puts `recognition` away as one that heard nothing `ms` from now, unless watched again. */
  const watch = (recognition: Recognition, ms: number) => {
    unwatch();
    deaf.current = setTimeout(() => {
      if (live.current !== recognition) return;
      put();
      callbacks.current.onEnd(false);
    }, ms);
  };
  const put = () => {
    unwatch();
    const was = live.current;
    live.current = undefined;
    if (was === undefined) return;
    was.onresult = null;
    was.onerror = null;
    was.onend = null;
    was.onaudiostart = null;
    was.onspeechstart = null;
    was.abort();
    setListening(false);
  };
  // The field going off or on, and the unmount, put the listening away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on `off` and at the unmount.
  useEffect(() => put, [off]);
  const ended = (recognition: Recognition, heard: boolean) => {
    if (live.current !== recognition) return;
    unwatch();
    live.current = undefined;
    setListening(false);
    callbacks.current.onEnd(heard);
  };
  const start = () => {
    if (Class === undefined || live.current !== undefined) return;
    speech.stop();
    const recognition = new Class();
    recognition.lang = language;
    recognition.interimResults = true;
    // It listens until Stop, through the learner's pauses.
    recognition.continuous = true;
    let heard = false;
    recognition.onaudiostart = () => watch(recognition, NO_WORDS_MS);
    // Speech, with or without the sound's event before it, gives the words their time again.
    recognition.onspeechstart = () => watch(recognition, NO_WORDS_MS);
    // A result with no word leaves the watch on: WebKit gives one where it hears sound and no word.
    recognition.onresult = (event) => {
      const text = heardOf(event);
      if (text === "") return;
      unwatch();
      heard = true;
      callbacks.current.onText(text);
    };
    recognition.onerror = () => {};
    recognition.onend = () => ended(recognition, heard);
    live.current = recognition;
    setListening(true);
    const begin = (local: boolean) => {
      // Stopped, or put away, before it began.
      if (live.current !== recognition) return;
      if (local) recognition.processLocally = true;
      began.add(recognition);
      // Set before the start, so that a sound the start reports at once clears it.
      if (granted.current) watch(recognition, NO_AUDIO_MS);
      try {
        recognition.start();
      } catch {
        // Started already elsewhere, or refused at once: nothing was heard.
        ended(recognition, false);
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
    now.stop();
  };
  return { available: Class !== undefined, listening, start, stop };
}
