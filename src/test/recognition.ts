// The browser's recognition of speech in a test: a fake that hears what the test says it hears,
// put in the place of the browser's own — Chromium and WebKit have one, Firefox none —, or none.
import { vi } from "vitest";
import type { Recognition, RecognitionEvent } from "../voice/dictation.ts";

export class FakeRecognition implements Recognition {
  /** The recognitions made, the last one the one listening. */
  static made: FakeRecognition[] = [];
  lang = "";
  interimResults = false;
  continuous = false;
  processLocally?: boolean;
  onresult: ((event: RecognitionEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onend: (() => void) | null = null;
  onaudiostart: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onaudioend: (() => void) | null = null;
  started = false;
  /** Set before the press: the recognition starts and no sound ever comes, as on an iPad whose voice holds the audio. */
  static deaf = false;
  /** Set before the press: the browser refuses the start at once, as one started elsewhere. */
  static refuses = false;
  constructor() {
    FakeRecognition.made.push(this);
  }
  start() {
    if (FakeRecognition.refuses) throw new DOMException("already started", "InvalidStateError");
    this.started = true;
    if (!FakeRecognition.deaf) queueMicrotask(() => this.onaudiostart?.());
  }
  /** Stop: the browser ends the listening, and says so. */
  stop() {
    this.onend?.();
  }
  abort() {}
  /** The phrases heard so far in this listening, each its reading of the moment. */
  hear(...phrases: readonly string[]) {
    this.onresult?.({ results: phrases.map((transcript) => [{ transcript }]) });
  }
}

/** A fake of a browser that recognises the language on the device alone when asked. */
export class LocalRecognition extends FakeRecognition {
  static asked: unknown[] = [];
  static available(options: unknown): Promise<string> {
    LocalRecognition.asked.push(options);
    return Promise.resolve("available");
  }
}

/** A fake of a browser that takes its time to say whether it recognises on the device. */
export class SlowRecognition extends FakeRecognition {
  static answer: ((state: string) => void) | undefined;
  static available(): Promise<string> {
    return new Promise((resolve) => {
      SlowRecognition.answer = resolve;
    });
  }
}

/**
 * The fake in the place of the browser's recognition, "local" the one that recognises on the
 * device; false to take the browser's away.
 */
export function withRecognition(fake: boolean | "local" | "slow"): void {
  FakeRecognition.made = [];
  FakeRecognition.deaf = false;
  FakeRecognition.refuses = false;
  LocalRecognition.asked = [];
  SlowRecognition.answer = undefined;
  const Class =
    fake === "local"
      ? LocalRecognition
      : fake === "slow"
        ? SlowRecognition
        : fake
          ? FakeRecognition
          : undefined;
  vi.stubGlobal("SpeechRecognition", Class);
  vi.stubGlobal("webkitSpeechRecognition", Class);
}

/** The recognition listening now. */
export function listening(): FakeRecognition {
  const last = FakeRecognition.made.at(-1);
  if (last === undefined) throw new Error("no recognition was made");
  return last;
}
