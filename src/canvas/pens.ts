// The settings of the pen and the eraser a learner chose in an element's popovers, given to each
// new element of the same learner — the next task, a lesson's next segment, the next task from
// paper —, so that the pen does not go back to canvas's between them. They are the tab's memory
// alone and stored nowhere, not with the profile and not in its export: a reload starts with
// canvas's, and so does another learner of the same device.
import type { PenChangeEvent, PenSettings } from "@altnovatrail/spec/canvas";
import { useCallback } from "react";
import { useLearner } from "../account/AccountGate.tsx";

// Read as a screen renders, never subscribed to: a change is for the next element, which a render
// brings, and the element that told it holds it already, so that no screen renders again for it.
let kept: { readonly learner: string; readonly pens: PenSettings } | undefined;

/** What an element takes, spread on it: the settings and the listener that keeps their change. */
export interface Pens {
  /** The learner's settings, once changed in this tab; without them the element keeps canvas's. */
  readonly pens?: PenSettings;
  readonly onpenchange: (event: PenChangeEvent) => void;
}

/**
 * The pens of the learner chosen; outside the gate, as in a screen's own test, those of no learner.
 * The element given back what its own `penchange` told sends no event and changes nothing.
 */
export function usePens(): Pens {
  const learner = useLearner()?.learner.profileId ?? "";
  const pens = kept?.learner === learner ? kept.pens : undefined;
  const onpenchange = useCallback(
    (event: PenChangeEvent) => {
      kept = { learner, pens: event.detail };
    },
    [learner],
  );
  return pens === undefined ? { onpenchange } : { pens, onpenchange };
}

/** The settings forgotten, for the tests. */
export function forgetPens(): void {
  kept = undefined;
}
