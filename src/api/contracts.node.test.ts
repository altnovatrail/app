// The probe of the contracts' code: app imports it by the path of its file of code, as the package
// exports it (Д92 in spec's RUN.md), and the client of connect-es calls a service of it. The
// browser's transport and its settings come with the contract's client (T20).

import {
  AttemptService,
  DoneRequestSchema,
  DoneResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { createClient, createRouterTransport } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import { describe, expect, it } from "vitest";

describe("the contracts' code", () => {
  it("writes a message to protobuf's binary form and reads it back", () => {
    const request = create(DoneRequestSchema, { profileId: "profile-1", attemptId: "attempt-1" });
    const read = fromBinary(DoneRequestSchema, toBinary(DoneRequestSchema, request));
    expect(read.profileId).toBe("profile-1");
    expect(read.attemptId).toBe("attempt-1");
  });

  it("is called through connect-es, a method the service does not implement refused", async () => {
    const seen: string[] = [];
    const transport = createRouterTransport(({ service }) => {
      service(AttemptService, {
        done(request) {
          seen.push(request.attemptId);
          return create(DoneResponseSchema, {});
        },
      });
    });
    const client = createClient(AttemptService, transport);
    const response = await client.done({ profileId: "profile-1", attemptId: "attempt-1" });
    expect(seen).toEqual(["attempt-1"]);
    expect(response.solved).toBeUndefined();
    await expect(client.getRungWords({})).rejects.toThrow(/unimplemented/i);
  });

  it("gives the browser's Connect transport a client of the same service", () => {
    const client = createClient(
      AttemptService,
      createConnectTransport({ baseUrl: "http://127.0.0.1:9" }),
    );
    expect(typeof client.submitWork).toBe("function");
  });
});
