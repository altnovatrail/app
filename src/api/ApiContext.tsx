// The client of api for every screen below Boot, and the state of a read for a screen to show
// (R18 in docs/decisions.md): loading, the answer, or what the call came to, and a retry. An action
// with an idempotency key a screen calls itself, on a press, keeping its key until it is done.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Api } from "./client.ts";
import { type Failure, parseFailure } from "./failure.ts";

const ApiContext = createContext<Api | undefined>(undefined);

export const ApiProvider = ApiContext.Provider;

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (api === undefined) throw new Error("useApi outside ApiProvider");
  return api;
}

export type RequestState<T> =
  | { readonly status: "loading" }
  | { readonly status: "done"; readonly value: T }
  | { readonly status: "failed"; readonly failure: Failure };

/**
 * The state of a read: `call` asks api, and a new `call` asks again — the screen keeps it stable,
 * with useCallback, for as long as it means the same request. `retry` asks the same once more.
 */
export function useRequest<T>(
  call: (api: Api) => Promise<T>,
): RequestState<T> & { readonly retry: () => void } {
  const api = useApi();
  // Each state is of the call that made it: another call's answer is never shown as this one's.
  const [held, setHeld] = useState<{ call: unknown; state: RequestState<T> }>({
    call,
    state: { status: "loading" },
  });
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry asks the same call again.
  useEffect(() => {
    let current = true;
    setHeld({ call, state: { status: "loading" } });
    call(api).then(
      (value) => {
        if (current) setHeld({ call, state: { status: "done", value } });
      },
      (reason: unknown) => {
        if (current) setHeld({ call, state: { status: "failed", failure: parseFailure(reason) } });
      },
    );
    return () => {
      current = false;
    };
  }, [api, call, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: RequestState<T> = held.call === call ? held.state : { status: "loading" };
  return { ...state, retry };
}
