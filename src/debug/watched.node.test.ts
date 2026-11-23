// The debug mode through app's own client: an api beside the stub of tutor answers GetDebug
// `unimplemented`, and an account without the right `permission_denied`, either of which turns the
// mode off and is no sign of a stale build; with it, a request of a task from paper watched by the
// slot takes what its calls returned once it ends, one made while GetDebug is asked waits for it, and
// one made before anything asked it asks it first.
import {
  DebugActionKind,
  DebugActionSchema,
  DebugOutcome,
  DebugService,
} from "@altnovatrail/contracts/novatrail/api/v1/debug_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { load, reset, snapshot } from "./debug.ts";
import { ask } from "./gate.ts";
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

  it("is off for an account without the right, no stale build, and watches no call", async () => {
    let taken = 0;
    const { api, stale } = apiOn((router) =>
      router.service(DebugService, {
        getDebug: () => {
          throw new ConnectError("no right", Code.PermissionDenied);
        },
        takeDebugCalls: () => {
          taken++;
          return {};
        },
      }),
    );
    await load(api.debug);
    expect(snapshot().status).toBe("off");
    expect(stale).not.toHaveBeenCalled();
    await expect(watched(api, async () => 7)).resolves.toBe(7);
    expect(taken).toBe(0);
  });

  it("makes a call while GetDebug is asked wait for its answer, and watches it", async () => {
    let answered: () => void = () => {};
    const asked = new Promise<void>((done) => (answered = done));
    let taken = 0;
    const { api } = apiOn((router) =>
      router.service(DebugService, {
        getDebug: async () => {
          await asked;
          return {};
        },
        takeDebugCalls: () => {
          taken++;
          return { actions: [create(DebugActionSchema, { kind: DebugActionKind.FIND_TASKS })] };
        },
      }),
    );
    void ask(api.debug);
    const call = watched(api, async () => "found");
    answered();
    await expect(call).resolves.toBe("found");
    await vi.waitFor(() => expect(snapshot().actions).toHaveLength(1));
    expect(taken).toBe(1);
  });

  it("asks GetDebug for a call made before the slot asked it, and watches the call", async () => {
    let taken = 0;
    const { api } = apiOn((router) =>
      router.service(DebugService, {
        getDebug: () => ({}),
        takeDebugCalls: () => {
          taken++;
          return { actions: [create(DebugActionSchema, { kind: DebugActionKind.FIND_TASKS })] };
        },
      }),
    );
    await expect(watched(api, async () => "found")).resolves.toBe("found");
    await vi.waitFor(() => expect(snapshot().actions).toHaveLength(1));
    expect(taken).toBe(1);
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
      verdicts: (answer: string) => (answer === "found" ? ["correct", "not_yet"] : []),
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
    // The Check kept what it sent, with the verdict of each task of its answer.
    expect([...snapshot().sent.values()].map((x) => [x.attemptId, x.outcomes])).toEqual([
      ["a1", [DebugOutcome.CORRECT, DebugOutcome.NOT_YET]],
    ]);
  });
});
