// The client on the browser's transport, with a fetch of the test's own (section 15 of the text of
// the contracts): a request carries no header but Authorization, Content-Type,
// Connect-Protocol-Version and Connect-Timeout-Ms, its body is binary protobuf, and a network that
// fails is no connection once the repeats are over.
import {
  GetAccountRequestSchema,
  GetAccountResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { describe, expect, it, vi } from "vitest";
import { createApi, TIMEOUT_MS } from "./client.ts";
import { ApiError } from "./failure.ts";
import { PAUSES } from "./interceptors.ts";

const on = { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} };
const tokens = { token: async () => "t1", signOut: async () => {} };

describe("the browser's transport", () => {
  it("sends only the headers the contract allows, and binary protobuf", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      const body = toBinary(GetAccountResponseSchema, create(GetAccountResponseSchema, {}));
      return new Response(body, { status: 200, headers: { "content-type": "application/proto" } });
    });
    const api = createApi({ baseUrl: "https://api.example.org", tokens, on, fetch: fetcher });
    await api.account.getAccount({});
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.org/novatrail.api.v1.AccountService/GetAccount");
    const headers = new Headers(init.headers);
    expect([...headers.keys()].sort()).toEqual([
      "authorization",
      "connect-protocol-version",
      "connect-timeout-ms",
      "content-type",
    ]);
    expect(headers.get("authorization")).toBe("Bearer t1");
    expect(headers.get("content-type")).toBe("application/proto");
    expect(Number(headers.get("connect-timeout-ms"))).toBeLessThanOrEqual(TIMEOUT_MS);
    const sent = new Uint8Array(
      await new Response(init.body as ConstructorParameters<typeof Response>[0]).arrayBuffer(),
    );
    expect(fromBinary(GetAccountRequestSchema, sent)).toBeDefined();
  });

  it("takes a network that fails as no connection once the repeats are over", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    const sleeps: number[] = [];
    const api = createApi({
      baseUrl: "https://api.example.org",
      tokens,
      on,
      fetch: fetcher,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });
    const error = await api.account.getAccount({}).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure).toEqual({ kind: "offline" });
    expect(fetcher).toHaveBeenCalledTimes(PAUSES.length + 1);
    expect(sleeps).toEqual([...PAUSES]);
  });

  it("lets a request aborted be aborted, without repeats", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    const api = createApi({ baseUrl: "https://api.example.org", tokens, on, fetch: fetcher });
    const error = await api.account.getAccount({}).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
