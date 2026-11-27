// How the microphone listens, a choice of the Debug window kept on the device: till Stop, through
// the learner's pauses, or till the browser hears a pause. WebKit on an iPad gives words to the
// first listening of a page alone, now and then, and the continuous listening is the one its
// developers suspect; the choice lets the device try either without a release. It is the device's
// own: a storage that refuses leaves the listening till Stop.

/** Till Stop, through the pauses; or till the browser hears a pause. */
export type Listening = "stop" | "pause";

const KEY = "novatrail.debug.listening";

export function listeningMode(): Listening {
  try {
    return globalThis.localStorage?.getItem(KEY) === "pause" ? "pause" : "stop";
  } catch {
    return "stop";
  }
}

export function setListeningMode(mode: Listening): void {
  try {
    if (mode === "stop") globalThis.localStorage?.removeItem(KEY);
    else globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    // The device keeps nothing: the listening stays till Stop.
  }
}
