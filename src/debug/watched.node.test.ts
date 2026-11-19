// The debug mode through app's own client (R72): an api without its debug flag answers GetDebug
// `unimplemented`, which turns the mode off and is no sign of a stale build; with it, a request of a
// task from paper watched by the slot takes what its calls returned once it ends.
import {
  DebugActionKind,
  DebugActionSchema,
  DebugOutcome,
  DebugService,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create } from "@bufbuild/protobuf";
import { type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { load, reset, snapshot } from "./debug.ts";
import { watched } from "./watched.ts";

function apiOn(routes: (router: ConnectRouter) => void) {
  const stale = vi.fn();
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  return { api, stale };
}

afterEach(() => reset());

describe("the debug mode through the client", () => {
  it("is off where api has no debug flag, and no stale build", async () => {
    const { api, stale } = apiOn(() => {});
    await load(api.debug);
    expect(snapshot().status).toBe("off");
    expect(stale).not.toHaveBeenCalled();
    // A watched call goes all the same, and takes nothing.
    await expect(watched(api, async () => 7)).resolves.toBe(7);
    expect(snapshot().actions).toEqual([]);
  });

  it("takes the calls of a watched request once it ends, a failed one too", async () => {
    let taken = 0;
    const { api } = apiOn((router) =>
      router.service(DebugService, {
        getDebug: () => ({}),
        setDebugModels: () => ({}),
        takeDebugCalls: () => {
          taken++;
          return {
            actions: [
              create(DebugActionSchema, { kind: DebugActionKind.CHECK, attemptId: `a${taken}` }),
            ],
          };
        },
      }),
    );
    await load(api.debug);
    expect(snapshot().status).toBe("on");
    const check = {
      attemptId: "a1",
      statement: new Uint8Array([1]),
      crop: new Uint8Array([2]),
      verdict: (answer: string) => (answer === "found" ? "correct" : undefined),
    };
    await expect(watched(api, async () => "found", check)).resolves.toBe("found");
    await expect(
      watched(api, async () => {
        throw new Error("refused");
      }),
    ).rejects.toThrow("refused");
    await vi.waitFor(() =>
      expect(snapshot().actions.map((a) => a.attemptId)).toEqual(["a1", "a2"]),
    );
    expect(snapshot().busy).toBe(0);
    // The Check kept what it sent, with its answer's verdict.
    expect([...snapshot().sent.values()].map((x) => [x.attemptId, x.outcome])).toEqual([
      ["a1", DebugOutcome.CORRECT],
    ]);
  });
});
