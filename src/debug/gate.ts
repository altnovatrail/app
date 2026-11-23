// Whether the account signed in has the debug mode: api's `GetDebug` asked once an account,
// in every build. This module is in the app's main chunk and the window's code is not: the slot
// loads that only once `GetDebug` answered. Any refusal shows nothing and is no error to the
// learner: `permission_denied`, an account without the right, and `unimplemented`, a run beside the
// stub of tutor, turn the mode off for the account; any other failure leaves it unknown, and the
// next asking asks again.

import type {
  DebugService,
  GetDebugResponse,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import type { Client } from "@connectrpc/connect";
import { ApiError } from "../api/failure.ts";

type DebugClient = Client<typeof DebugService>;

export interface Gate {
  /** Unknown until `GetDebug` answers for the account, on once it does, off once it refuses. */
  readonly status: "unknown" | "asking" | "on" | "off";
  /** What `GetDebug` answered, while on. */
  readonly answer: GetDebugResponse | undefined;
  /** Which account since the tab opened: a new one asks again. */
  readonly account: number;
}

let gate: Gate = { status: "unknown", answer: undefined, account: 0 };
let user: string | null | undefined;
let asking: Promise<GetDebugResponse | undefined> | undefined;
const listeners = new Set<() => void>();

function set(next: Gate): void {
  gate = next;
  for (const listener of listeners) listener();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function snapshot(): Gate {
  return gate;
}

/**
 * What `GetDebug` answered for the account signed in, or undefined when it did not: asked once an
 * account, the asking under way joined. Never throws.
 */
export function ask(client: DebugClient | undefined): Promise<GetDebugResponse | undefined> {
  if (client === undefined || gate.status === "off") return Promise.resolve(undefined);
  if (gate.status === "on") return Promise.resolve(gate.answer);
  if (asking !== undefined) return asking;
  const account = gate.account;
  set({ ...gate, status: "asking" });
  const asked = client.getDebug({}).then(
    (answer) => {
      if (gate.account !== account) return undefined;
      set({ ...gate, status: "on", answer });
      return answer;
    },
    (reason: unknown) => {
      if (gate.account !== account) return undefined;
      const kind = reason instanceof ApiError ? reason.failure.kind : undefined;
      const refused = kind === "forbidden" || kind === "stale";
      set({ ...gate, status: refused ? "off" : "unknown" });
      return undefined;
    },
  );
  asking = asked;
  void asked.then(() => {
    if (asking === asked) asking = undefined;
  });
  return asked;
}

/** The user the sign-in service names: another one is another account, whose right is its own. */
export function signedIn(now: string | null | undefined): void {
  if (now === user) return;
  user = now;
  forget();
}

function forget(): void {
  asking = undefined;
  set({ status: "unknown", answer: undefined, account: gate.account + 1 });
}

/** The gate forgotten, for the tests. */
export function reset(): void {
  user = undefined;
  forget();
}
