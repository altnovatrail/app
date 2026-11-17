// The stored works of the learner chosen, for the screens that write a work to the device (section
// 3.2 of docs/architecture.md; the 2026-11-17 amendment to R30 in docs/decisions.md): the task
// screens and the way to what the engine chooses. The storage is on as the profile the tab holds
// says, read at each send, and api's word that it is off reads the profile again for the session
// and the other tabs. Outside the gate — a screen's own test — no learner is chosen, and nothing
// is sent.
import { useMemo, useRef } from "react";
import { useLearner } from "../account/AccountGate.tsx";
import { useApi } from "../api/ApiContext.tsx";
import { drawPicture } from "./picture.ts";
import { createSender, type Draw, type Sender } from "./stored.ts";

export function useWorks(profileId: string, draw: Draw = drawPicture): Sender {
  const api = useApi();
  const chosen = useLearner();
  const latest = useRef(chosen);
  latest.current = chosen;
  return useMemo(
    () =>
      createSender({
        api,
        profileId,
        draw,
        storageOn: () => {
          const learner = latest.current?.learner;
          return learner?.profileId === profileId && learner.workStorage;
        },
        onProfile: (profile) => latest.current?.onSaved(profile),
      }),
    [api, profileId, draw],
  );
}
