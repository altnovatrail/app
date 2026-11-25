// Each call to api as a line of the app's log: how it ended, how long it took and what its fields
// of bytes held, never the message itself.
import { Cause, RefusalSchema } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { bytesOf, journaled } from "./interceptors.ts";

function request(message: unknown, stream = false) {
  return {
    service: { typeName: "novatrail.api.v1.AttemptService" },
    method: { name: "SubmitWork" },
    message,
    stream,
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

  it("counts the bytes a few levels down, and nothing else", () => {
    expect(bytesOf(new Uint8Array(5))).toBe(5);
    expect(bytesOf({ a: [new Uint8Array(2), { b: new Uint8Array(3) }], c: "text", d: null })).toBe(
      5,
    );
    expect(bytesOf({ a: { b: { c: { d: new Uint8Array(9) } } } })).toBe(0);
    expect(bytesOf(7)).toBe(0);
  });
});
