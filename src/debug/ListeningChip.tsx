// The Log's choice of how the microphone listens: a chip in its bar, and a pop-over of the two ways.
import { useState } from "react";
import { type Listening, listeningMode, setListeningMode } from "../voice/listening.ts";

const WAYS: readonly { readonly mode: Listening; readonly name: string }[] = [
  { mode: "stop", name: "Till Stop" },
  { mode: "pause", name: "Till a pause" },
  { mode: "voice", name: "A word first" },
];

export function ListeningChip() {
  const [mode, setMode] = useState(listeningMode);
  const [open, setOpen] = useState(false);
  return (
    <span className="nt-debug-listening">
      <button
        type="button"
        className="nt-debug-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        Dictation: {WAYS.find((way) => way.mode === mode)?.name.toLowerCase()}
      </button>
      {open ? (
        <div className="nt-debug-menu nt-debug-listening-menu" role="menu" aria-label="Dictation">
          {WAYS.map((way) => (
            <button
              key={way.mode}
              type="button"
              role="menuitemradio"
              aria-checked={mode === way.mode}
              onClick={() => {
                setListeningMode(way.mode);
                setMode(way.mode);
                setOpen(false);
              }}
            >
              <span className="nt-debug-grow">{way.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
