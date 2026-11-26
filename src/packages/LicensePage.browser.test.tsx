import { ModuleService } from "@altnovatrail/contracts/novatrail/api/v1/module_pb.js";
import {
  GetManifestResponseSchema,
  PackageService,
} from "@altnovatrail/contracts/novatrail/api/v1/package_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import { createApi } from "../api/client.ts";
import type { Route } from "../app/router.ts";
import type { Language } from "../i18n/language.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { expectLoaded, expectLoading, held } from "../test/loading.ts";
import { PackageChecks } from "./checks.ts";
import { DeviceFiles } from "./files.ts";
import { LicensePages, licenseRoute } from "./LicensePage.tsx";
import { PackagesProvider } from "./PackagesContext.tsx";
import { OpenViews } from "./views.ts";

const D1 = `sha256:${"1".repeat(64)}`;
const D2 = `sha256:${"2".repeat(64)}`;
/** A version whose manifest never comes. */
const SLOW = `sha256:${"3".repeat(64)}`;
/** A version whose manifest does not come. */
const UNNAMED = `sha256:${"9".repeat(64)}`;
const LICENSE =
  "Apache License\n                           Version 2.0, January 2004\n\n   1. Definitions.\n";
const NOTICE = "Olympiad maths\nCopyright 2026 The NovaTrail authors\n";

function manifest(id: string, title: string, explanation: string) {
  const json = {
    module_format_version: "0.4",
    id,
    version: "1.2.0",
    title,
    languages: { explanation },
    license: "Apache-2.0",
  };
  return { json: new TextEncoder().encode(JSON.stringify(json)), moduleFormatVersion: "0.4" };
}

const MANIFESTS: Readonly<Record<string, ReturnType<typeof manifest>>> = {
  [D1]: manifest("novatrail/olympiad-math", "Olympiad maths", "en"),
  [D2]: manifest("novatrail/physics", "Физика", "ru"),
};

/** The answers to the files, by their path in the device part, each a list in turn. */
type Files = Record<string, (() => Response | Promise<Response>)[]>;

function renderWith(
  node: ReactNode,
  files: Files,
  language: Language = "en",
  connected: { moduleId: string; packageDigest: string }[] | "fail" = [],
  /** What ListConnectedModules answers only once it is given. */
  listed?: Promise<void>,
) {
  const { device } = memoryDevice();
  const asked: string[] = [];
  const routes = (router: ConnectRouter) => {
    router.service(PackageService, {
      getManifest(request) {
        if (request.packageDigest === SLOW) return new Promise(() => {});
        if (request.packageDigest === UNNAMED) throw new ConnectError("down", Code.Internal);
        const found = MANIFESTS[request.packageDigest];
        return create(GetManifestResponseSchema, found === undefined ? {} : { manifest: found });
      },
    });
    router.service(ModuleService, {
      async listConnectedModules(request) {
        asked.push(`list ${request.profileId}`);
        await listed;
        if (connected === "fail") throw new ConnectError("down", Code.Unavailable);
        return { modules: connected };
      },
    });
  };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t", signOut: async () => {} },
    on: { stale: () => {}, accountGone: async () => {}, noAccess: async () => {} },
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  const withdrawn = vi.fn();
  const fetched: string[] = [];
  const packages = {
    views: new OpenViews({ api, device, stale: () => {} }),
    checks: new PackageChecks(api, device),
    files: new DeviceFiles({
      api: "https://api.example.org",
      withdrawn,
      sleep: async () => {},
      fetch: async (input) => {
        const url = String(input);
        fetched.push(url);
        const answer = files[url.split("/device/")[1] ?? ""]?.shift();
        if (answer === undefined) throw new TypeError("Failed to fetch");
        return answer();
      },
    }),
  };
  render(
    inLanguage(
      <ApiProvider value={api}>
        <PackagesProvider value={packages}>{node}</PackagesProvider>
      </ApiProvider>,
      language,
    ),
  );
  return { withdrawn, fetched, asked };
}

const text = (body: string) => () => new Response(body);
const status = (code: number) => () => new Response(null, { status: code });

// The tablet's width, where the section's list stands beside its page; the runner's own after.
beforeEach(() => page.viewport(1194, 834));
afterEach(async () => {
  window.location.hash = "";
  await page.viewport(414, 896);
});

describe("the page of a module's license", () => {
  it("shows LICENSE and NOTICE as they come, in English, below the module, and closes home", async () => {
    window.location.hash = "#/license";
    const { fetched } = renderWith(<LicensePages route={licenseRoute(D1)} />, {
      LICENSE: [text(LICENSE)],
      NOTICE: [text(NOTICE)],
    });
    // A sheet of the mockup's legal text: its heading, and its close at the other end.
    expect(screen.queryByRole("banner")).toBeNull();
    const head = document.querySelector<HTMLElement>("main.nt-sheet .nt-sheet-head");
    expect(head).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 1, name: "The module's license and notices" }),
    ).toBeTruthy();
    const files = await screen.findAllByText((_, element) => element?.tagName === "PRE");
    expect(files.map((file) => file.textContent)).toEqual([LICENSE, NOTICE]);
    for (const file of files) expect(file.getAttribute("lang")).toBe("en");
    expect(screen.getByRole("heading", { level: 2, name: "License (LICENSE)" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 2, name: "Notices (NOTICE)" })).toBeTruthy();
    // The module, by its manifest: its title in its own language.
    const title = await screen.findByText("Olympiad maths");
    expect(title.getAttribute("lang")).toBe("en");
    expect(screen.getByText("1.2.0")).toBeTruthy();
    expect(screen.getByText("Apache-2.0")).toBeTruthy();
    expect(fetched).toEqual([
      `https://api.example.org/packages/sha256-${"1".repeat(64)}/device/LICENSE`,
      `https://api.example.org/packages/sha256-${"1".repeat(64)}/device/NOTICE`,
    ]);
    expect(document.querySelector("a")).toBeNull();
    await userEvent.click(within(head as HTMLElement).getByRole("button", { name: "Close" }));
    expect(window.location.hash).toBe("#/home");
  });

  it("stands with the shapes of the files while they are read, under its heading, busy", async () => {
    const { given, give } = held();
    renderWith(<LicensePages route={licenseRoute(D1)} />, {
      LICENSE: [
        async () => {
          await given;
          return new Response(LICENSE);
        },
      ],
      NOTICE: [text(NOTICE)],
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "The module's license and notices" }),
    ).toBeTruthy();
    expectLoading(document, 7);
    give();
    await vi.waitFor(() => expect(document.querySelectorAll("pre")).toHaveLength(2));
    expectLoaded(document);
  });

  it("says so of a module with no NOTICE, in the screen's language", async () => {
    renderWith(
      <LicensePages route={licenseRoute(D2)} />,
      { LICENSE: [text(LICENSE)], NOTICE: [status(404)] },
      "ru",
    );
    expect(await screen.findByText("Файла NOTICE у модуля нет")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Лицензия и уведомления модуля" }),
    ).toBeTruthy();
    expect((await screen.findByText("Физика")).getAttribute("lang")).toBe("ru");
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeTruthy();
  });

  it("says so of a version api no longer gives, and CheckPackages is asked", async () => {
    const { withdrawn } = renderWith(<LicensePages route={licenseRoute(D1)} />, {
      LICENSE: [status(410)],
      NOTICE: [status(410)],
    });
    expect(await screen.findByText("This version of the module is no longer given")).toBeTruthy();
    expect(withdrawn).toHaveBeenCalled();
    expect(document.querySelector("pre")).toBeNull();
  });

  it("shows the texts while the manifest has not come, with no module named", async () => {
    renderWith(<LicensePages route={licenseRoute(SLOW)} />, {
      LICENSE: [text(LICENSE)],
      NOTICE: [text(NOTICE)],
    });
    await vi.waitFor(() => expect(document.querySelectorAll("pre")).toHaveLength(2));
    expect(document.querySelector("dl")).toBeNull();
  });

  it("names a LICENSE missing, which the format does not allow", async () => {
    renderWith(<LicensePages route={licenseRoute(D1)} />, {
      LICENSE: [status(404)],
      NOTICE: [text(NOTICE)],
    });
    expect(await screen.findByText("No file LICENSE came with the module")).toBeTruthy();
    expect(document.querySelector("pre")?.textContent).toBe(NOTICE);
  });

  it("says what a read that did not come came to, and reads again on Try again", async () => {
    renderWith(<LicensePages route={licenseRoute(D1)} />, {
      LICENSE: [status(500), text(LICENSE)],
      NOTICE: [text(NOTICE), text(NOTICE)],
    });
    expect((await screen.findByRole("alert")).textContent).not.toBe("");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await vi.waitFor(() => expect(document.querySelectorAll("pre")).toHaveLength(2));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("goes home in place of a route that names no digest", async () => {
    for (const parts of [[], ["sha256:ab"], [D1, "more"]]) {
      window.location.hash = "#/license";
      const route: Route = { screen: "license", parts };
      const { fetched } = renderWith(<LicensePages route={route} />, {});
      await vi.waitFor(() => expect(window.location.hash).toBe("#/home"));
      expect(fetched).toEqual([]);
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    }
  });
});
