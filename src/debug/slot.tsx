// The debug button, in the bottom bars of the screens of a task from paper: in every build, for an
// account with api's debug right. The slot asks `GetDebug` itself and loads the window's code, a
// chunk of its own, only once it answered; a refusal shows nothing.
import { lazy, Suspense, useEffect, useSyncExternalStore } from "react";
import { useApi } from "../api/ApiContext.tsx";
import { ask, snapshot, subscribe } from "./gate.ts";

const Debug = lazy(() => import("./DebugButton.tsx"));

/** The debug button in a bar, with a line after it where `line` says so: none, and no line. */
export function DebugSlot({ line = false }: { readonly line?: boolean }) {
  const api = useApi();
  const gate = useSyncExternalStore(subscribe, snapshot);
  // Once a mount and an account: a failure that is no refusal is asked again at the next.
  // biome-ignore lint/correctness/useExhaustiveDependencies: another account asks again.
  useEffect(() => {
    void ask(api.debug);
  }, [api, gate.account]);
  if (gate.status !== "on") return null;
  return (
    <Suspense fallback={null}>
      <Debug line={line} />
    </Suspense>
  );
}
