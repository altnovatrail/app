// The microphone of the tutor's field: the browser's recognition of speech,
// `SpeechRecognition` or WebKit's `webkitSpeechRecognition`, which turns what the learner says into
// text in the field — the interim text while it listens, the final once it stops —, and the learner
// reads it and corrects it before Send. The app asks the browser to recognise on the device where
// it offers that; where it runs is the browser's all the same, and the app gets text alone. A browser without it, as Firefox,
// draws no microphone.
import { useEffect, useRef, useState } from "react";

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
 * the listening away with nothing more said.
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
  const [listening, setListening] = useState(false);
  const live = useRef<Recognition | undefined>(undefined);
  // The recognitions started: one is asked whether it can recognise on the device first.
  const began = useRef(new WeakSet<Recognition>()).current;
  // The callbacks of the render the recognition ends in, not of the one it began in.
  const callbacks = useRef({ onText, onEnd });
  callbacks.current = { onText, onEnd };
  const put = () => {
    const was = live.current;
    live.current = undefined;
    if (was === undefined) return;
    was.onresult = null;
    was.onerror = null;
    was.onend = null;
    was.abort();
    setListening(false);
  };
  // The field going off or on, and the unmount, put the listening away.
  // biome-ignore lint/correctness/useExhaustiveDependencies: it runs on `off` and at the unmount.
  useEffect(() => put, [off]);
  const start = () => {
    if (Class === undefined || live.current !== undefined) return;
    const recognition = new Class();
    recognition.lang = language;
    recognition.interimResults = true;
    // It listens until Stop, through the learner's pauses.
    recognition.continuous = true;
    let heard = false;
    recognition.onresult = (event) => {
      const text = heardOf(event);
      if (text === "") return;
      heard = true;
      callbacks.current.onText(text);
    };
    // A failure ends the listening too: its end follows.
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (live.current !== recognition) return;
      live.current = undefined;
      setListening(false);
      callbacks.current.onEnd(heard);
    };
    live.current = recognition;
    setListening(true);
    void onDevice(Class, language).then((local) => {
      // Stopped, or put away, before it began.
      if (live.current !== recognition) return;
      if (local) recognition.processLocally = true;
      began.add(recognition);
      try {
        recognition.start();
      } catch {
        // Started already elsewhere, or refused at once: nothing was heard.
        live.current = undefined;
        setListening(false);
        callbacks.current.onEnd(false);
      }
    });
  };
  const stop = () => {
    const now = live.current;
    if (now === undefined) return;
    // Stop before it began: it ends with nothing heard.
    if (!began.has(now)) {
      live.current = undefined;
      setListening(false);
      callbacks.current.onEnd(false);
      return;
    }
    now.stop();
  };
  return { available: Class !== undefined, listening, start, stop };
}
