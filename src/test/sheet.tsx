// The card of the sheet of a task while its Check has gone on to a later model, for the tests of
// the theme: its spinner in a tinted disc whose ring pulses, and the track of the models under it.
import { VerdictCard } from "../solving/parts.tsx";

export function readingCloser() {
  return (
    <VerdictCard
      kind="reading"
      title="Looking more closely…"
      line="The first look wasn't sure — now a closer one."
      track={{ model: 1, models: 3 }}
    />
  );
}
