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
import { AccountGate } from "../account/AccountGate.tsx";
import { Boot } from "../boot/Boot.tsx";
import { usePackages } from "../packages/PackagesContext.tsx";
import { memoryDevice } from "../test/device.ts";
import { fakeSignIn } from "../test/signin.ts";
import { ApiProvider, useApi, useRequest } from "./ApiContext.tsx";
import { type Api, createApi } from "./client.ts";

/** A sign-in service with nobody signed in, in place of Firebase Auth. */
const signedOut = () => fakeSignIn();

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

/** A screen that has the packages. */
function Packaged() {
  usePackages();
  return <p>packages</p>;
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

describe("Boot and the packages", () => {
  it("asks about the packages the device keeps once the account is there, and erases one no longer given", async () => {
    const { device } = memoryDevice();
    const { setAccount } = await import("../storage/registry.ts");
    const { openCache } = await import("../storage/cache.ts");
    const { PackageStatus, CheckPackagesResponseSchema } = await import(
      "@altnovatrail/contracts/novatrail/api/v1/package_pb.js"
    );
    await setAccount(device, "account-1");
    const digest = `sha256:${"1".repeat(64)}`;
    const cache = await openCache(device);
    await cache?.put(digest, "manifest", { json: new Uint8Array([123, 125]), version: "0.4" });
    const { GetAccountResponseSchema } = await import(
      "@altnovatrail/contracts/novatrail/api/v1/account_pb.js"
    );
    const apiFetch = vi.fn<typeof fetch>(async (input) => {
      const body = String(input).endsWith("/GetAccount")
        ? toBinary(
            GetAccountResponseSchema,
            create(GetAccountResponseSchema, {
              account: {
                accountId: "account-1",
                profiles: [{ profileId: "p1", owner: true, pseudonym: "Ёжик" }],
              },
            }),
          )
        : toBinary(
            CheckPackagesResponseSchema,
            create(CheckPackagesResponseSchema, {
              packages: [{ packageDigest: digest, status: PackageStatus.NOT_GIVEN }],
            }),
          );
      return new Response(body, { headers: { "content-type": "application/proto" } });
    });
    const fetcher = async () =>
      new Response(JSON.stringify(FILE), { headers: { "content-type": "application/json" } });
    render(
      <Boot
        signIn={() => fakeSignIn("uid-1")}
        framed={false}
        origin="https://app.example.org"
        languages={["en"]}
        device={device}
        fetcher={fetcher}
        apiFetch={apiFetch}
      >
        <AccountGate>
          <Packaged />
        </AccountGate>
      </Boot>,
    );
    expect(await screen.findByRole("heading", { name: "Who is learning?" })).toBeTruthy();
    await vi.waitFor(async () => expect(await cache?.get(digest, "manifest")).toBeUndefined());
    const methods = apiFetch.mock.calls.map(([input]) => new URL(String(input)).pathname);
    // The choice of the learner reads the legal texts too, for their next versions (R46).
    expect(
      methods.map((path) => path.split("/").at(-1)).filter((method) => method !== "GetLegalTexts"),
    ).toEqual(["GetAccount", "CheckPackages"]);
  });

  it("are there only below Boot", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Packaged />)).toThrow("usePackages outside PackagesProvider");
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
        signIn={signedOut}
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
    const service = fakeSignIn("uid-1");
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
        signIn={() => service}
        framed={false}
        origin="https://app.example.org"
        languages={["en"]}
        device={device}
        fetcher={fetcher}
        apiFetch={apiFetch}
      >
        <Account />
      </Boot>,
    );
    expect(await screen.findByText("failed account-gone")).toBeTruthy();
    await vi.waitFor(() => expect(service.calls.signOut).toBe(1));
    expect(await readRegistry(device)).toBeUndefined();
    // Another account signs in on the same page and is gone too: it is erased again.
    service.set("uid-2");
    await setAccount(device, "account-2");
    await userEvent.click(screen.getByRole("button", { name: "again" }));
    await vi.waitFor(() => expect(service.calls.signOut).toBe(2));
    await vi.waitFor(async () => expect(await readRegistry(device)).toBeUndefined());
  });
});
