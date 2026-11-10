import {
  AccountService,
  GetAccountResponseSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create, toBinary } from "@bufbuild/protobuf";
import { Code, ConnectError, createRouterTransport } from "@connectrpc/connect";
import { render, screen } from "@testing-library/react";
import { useCallback } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { Boot } from "../boot/Boot.tsx";
import { memoryDevice } from "../test/device.ts";
import { ApiProvider, useApi, useRequest } from "./ApiContext.tsx";
import { type Api, createApi } from "./client.ts";

const FILE = {
  format: 1,
  api: "https://api.example.org",
  signIn: {
    service: "firebase",
    apiKey: "synthetic-web-api-key",
    authDomain: "example-project.firebaseapp.com",
    projectId: "example-project",
    appId: "synthetic-web-app-id",
  },
};

const on = { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} };

/** A screen that reads the account and says what came of it, with a button to ask again. */
function Account() {
  const call = useCallback((api: Api) => api.account.getAccount({}), []);
  const request = useRequest(call);
  return (
    <>
      <p>{request.status === "failed" ? `failed ${request.failure.kind}` : request.status}</p>
      <button type="button" onClick={request.retry}>
        again
      </button>
    </>
  );
}

/** A screen that wants the client and has no provider of it. */
function Bare() {
  useApi();
  return null;
}

describe("useRequest", () => {
  it("is loading, then the answer or what the call came to, and asks again on retry", async () => {
    let calls = 0;
    const api = createApi({
      baseUrl: "https://api.example.org",
      tokens: { token: async () => "t", signOut: async () => {} },
      on,
      sleep: async () => {},
      transport: (interceptors) =>
        createRouterTransport(
          ({ service }) =>
            service(AccountService, {
              getAccount() {
                calls += 1;
                if (calls === 1) throw new ConnectError("no", Code.PermissionDenied);
                return create(GetAccountResponseSchema, {});
              },
            }),
          { transport: { interceptors } },
        ),
    });
    render(
      <ApiProvider value={api}>
        <Account />
      </ApiProvider>,
    );
    expect(screen.getByText("loading")).toBeTruthy();
    expect(await screen.findByText("failed forbidden")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "again" }));
    expect(await screen.findByText("done")).toBeTruthy();
  });
});

/** What each render of Reader showed. */
const answers: string[] = [];

/** A screen that reads by its ID, and writes down what each render shows. */
function Reader({ id }: { readonly id: string }) {
  const call = useCallback(async () => id, [id]);
  const request = useRequest(call);
  answers.push(request.status === "done" ? `done ${request.value}` : request.status);
  return null;
}

describe("useRequest with another call", () => {
  it("shows no answer of the call before as the new one's", async () => {
    answers.length = 0;
    const api = {} as Api;
    const { rerender } = render(
      <ApiProvider value={api}>
        <Reader id="a" />
      </ApiProvider>,
    );
    await vi.waitFor(() => expect(answers).toContain("done a"));
    answers.length = 0;
    rerender(
      <ApiProvider value={api}>
        <Reader id="b" />
      </ApiProvider>,
    );
    await vi.waitFor(() => expect(answers).toContain("done b"));
    expect(answers).not.toContain("done a");
  });
});

describe("useApi", () => {
  it("is there only below its provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Bare />)).toThrow("useApi outside ApiProvider");
    vi.restoreAllMocks();
  });
});

describe("Boot and the client", () => {
  it("gives the app the client of the file's api, which offers a reload when api has not the method", async () => {
    const urls: string[] = [];
    const apiFetch = vi.fn<typeof fetch>(async (input) => {
      urls.push(String(input));
      return new Response(null, { status: 404 });
    });
    const fetcher = async () =>
      new Response(JSON.stringify(FILE), { headers: { "content-type": "application/json" } });
    render(
      <Boot
        framed={false}
        origin="https://app.example.org"
        languages={["en"]}
        device={memoryDevice().device}
        fetcher={fetcher}
        apiFetch={apiFetch}
      >
        <Account />
      </Boot>,
    );
    expect(await screen.findByText("failed stale")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("There is a new version of the app");
    expect(urls).toEqual(["https://api.example.org/novatrail.api.v1.AccountService/GetAccount"]);
  });

  it("erases the account that is gone, and signs out", async () => {
    const { device } = memoryDevice();
    const { setAccount, readRegistry } = await import("../storage/registry.ts");
    await setAccount(device, "account-1");
    const signOut = vi.fn(async () => {});
    const { RefusalSchema, Cause } = await import(
      "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js"
    );
    const detail = toBinary(RefusalSchema, create(RefusalSchema, { cause: Cause.ACCOUNT_GONE }));
    const body = JSON.stringify({
      code: "unauthenticated",
      message: "gone",
      details: [
        {
          type: "novatrail.api.v1.Refusal",
          value: btoa(String.fromCharCode(...detail)).replace(/=+$/, ""),
        },
      ],
    });
    const apiFetch = async () =>
      new Response(body, { status: 401, headers: { "content-type": "application/json" } });
    const fetcher = async () =>
      new Response(JSON.stringify(FILE), { headers: { "content-type": "application/json" } });
    render(
      <Boot
        framed={false}
        origin="https://app.example.org"
        languages={["en"]}
        device={device}
        fetcher={fetcher}
        apiFetch={apiFetch}
        tokens={{ token: async () => "t", signOut }}
      >
        <Account />
      </Boot>,
    );
    expect(await screen.findByText("failed account-gone")).toBeTruthy();
    await vi.waitFor(() => expect(signOut).toHaveBeenCalledOnce());
    expect(await readRegistry(device)).toBeUndefined();
  });
});
