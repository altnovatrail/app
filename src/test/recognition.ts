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
  started = false;
  constructor() {
    FakeRecognition.made.push(this);
  }
  start() {
    this.started = true;
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

/**
 * The fake in the place of the browser's recognition, "local" the one that recognises on the
 * device; false to take the browser's away.
 */
export function withRecognition(fake: boolean | "local"): void {
  FakeRecognition.made = [];
  LocalRecognition.asked = [];
  const Class = fake === "local" ? LocalRecognition : fake ? FakeRecognition : undefined;
  vi.stubGlobal("SpeechRecognition", Class);
  vi.stubGlobal("webkitSpeechRecognition", Class);
}

/** The recognition listening now. */
export function listening(): FakeRecognition {
  const last = FakeRecognition.made.at(-1);
  if (last === undefined) throw new Error("no recognition was made");
  return last;
}
