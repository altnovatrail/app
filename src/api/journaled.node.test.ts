// Each call to api as a line of the app's log: how it ended, how long it took and what its fields
// of bytes held, never the message itself.
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, createContextValues } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { bytesOf, expecting, journaled, repeat } from "./interceptors.ts";

function request(message: unknown, stream = false, contextValues = createContextValues()) {
  return {
    contextValues,
    service: { typeName: "novatrail.api.v1.AttemptService" },
    method: { name: "SubmitWork" },
    message,
    stream,
    signal: new AbortController().signal,
  } as never;
}

describe("journaled", () => {
  it("notes a call that answered, with the bytes it sent", async () => {
    const note = vi.fn();
    let t = 0;
    const call = journaled(note, () => (t += 1500))(async () => "ok" as never);
    await expect(
      call(request({ work: { crop: new Uint8Array(3 * 1024 * 1024) }, key: "k" })),
    ).resolves.toBe("ok");
    expect(note).toHaveBeenCalledWith(
      "info",
      "api",
      "AttemptService/SubmitWork · ok · 1.5 s",
      "code: ok\ntook: 1.5 s\nsent: 3.0 MiB",
    );
  });

  it("notes a refusal with its code, message and cause, and lets it through", async () => {
    const note = vi.fn();
    const error = new ConnectError("the crop is 4.6 MiB", Code.InvalidArgument);
    const call = journaled(
      note,
      () => 0,
    )(async () => {
      throw error;
    });
    await expect(call(request({ crop: new Uint8Array(2048) }))).rejects.toBe(error);
    expect(note).toHaveBeenCalledWith(
      "error",
      "api",
      "AttemptService/SubmitWork · invalid_argument · the crop is 4.6 MiB",
      "code: invalid_argument\ntook: 0.0 s\nsent: 2 KiB",
    );
  });

  it("names the cause of a refusal, and a call called off as no error", async () => {
    const note = vi.fn();
    const refused = new ConnectError("", Code.ResourceExhausted, undefined, [
      { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.LIMIT_REACHED }) },
    ]);
    const call = journaled(note, () => 0);
    await expect(
      call(async () => {
        throw refused;
      })(request({})),
    ).rejects.toBeDefined();
    expect(note.mock.calls[0]?.slice(2)).toEqual([
      "AttemptService/SubmitWork · resource_exhausted",
      "code: resource_exhausted\ncause: LIMIT_REACHED\ntook: 0.0 s",
    ]);
    await expect(
      call(async () => {
        throw new ConnectError("gone", Code.Canceled);
      })(request({}, true)),
    ).rejects.toBeDefined();
    expect(note.mock.calls[1]?.[0]).toBe("debug");
  });

  it("notes a refusal the screen waits for as info, and any other as an error", async () => {
    const note = vi.fn();
    const refusal = (cause: Cause) =>
      new ConnectError("", Code.FailedPrecondition, undefined, [
        { desc: RefusalSchema, value: create(RefusalSchema, { cause }) },
      ]);
    const { contextValues } = expecting([Cause.NO_MORE_WORDS, Cause.NO_RUNG]);
    for (const cause of [Cause.NO_MORE_WORDS, Cause.ATTEMPT_CLOSED]) {
      await expect(
        journaled(
          note,
          () => 0,
        )(async () => {
          throw refusal(cause);
        })(request({}, false, contextValues)),
      ).rejects.toBeDefined();
    }
    await expect(
      journaled(
        note,
        () => 0,
      )(async () => {
        throw refusal(Cause.NO_MORE_WORDS);
      })(request({})),
    ).rejects.toBeDefined();
    expect(note.mock.calls.map((call) => [call[0], call[2]])).toEqual([
      ["info", "AttemptService/SubmitWork · failed_precondition"],
      ["error", "AttemptService/SubmitWork · failed_precondition"],
      ["error", "AttemptService/SubmitWork · failed_precondition"],
    ]);
  });

  it("notes each attempt the client repeats: what the browser said, and how long it had gone", async () => {
    const note = vi.fn();
    let t = 0;
    const going = new ConnectError("", Code.Aborted, undefined, [
      { desc: RefusalSchema, value: create(RefusalSchema, { cause: Cause.STILL_GOING }) },
    ]);
    const failures = [
      new ConnectError(
        "the network failed",
        Code.Unavailable,
        undefined,
        undefined,
        new TypeError("Load failed"),
      ),
      going,
    ];
    const call = repeat(
      async () => {},
      note,
      () => (t += 24_000),
    )(async () => {
      const failure = failures.shift();
      if (failure !== undefined) throw failure;
      return "ok" as never;
    });
    await expect(call(request({}))).resolves.toBe("ok");
    expect(note.mock.calls).toEqual([
      [
        "warn",
        "api",
        "AttemptService/SubmitWork · unavailable · the network failed · repeated",
        "attempt: 1\ncode: unavailable\nbrowser: TypeError: Load failed\ntook: 24.0 s\nnext in: 0.5 s",
      ],
      [
        "info",
        "api",
        "AttemptService/SubmitWork · still going · repeated",
        "attempt: 2\ncode: aborted\ncause: STILL_GOING\ntook: 24.0 s\nnext in: 1.0 s",
      ],
    ]);
  });

  it("counts the bytes a few levels down, and nothing else", () => {
    expect(bytesOf(new Uint8Array(5))).toBe(5);
    expect(bytesOf({ a: [new Uint8Array(2), { b: new Uint8Array(3) }], c: "text", d: null })).toBe(
      5,
    );
    expect(bytesOf({ a: { b: { c: { d: new Uint8Array(9) } } } })).toBe(0);
    expect(bytesOf(7)).toBe(0);
  });
});
