import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import { openModuleOf } from "./openModule.ts";

const START = {
  packageDigest: "sha256:1",
  task: { json: new Uint8Array(), moduleFormatVersion: "0.4" },
};

function apiGiving(getOpenAttempt: () => unknown): Api {
  return { learning: { getOpenAttempt: async () => getOpenAttempt() } } as unknown as Api;
}

function viewsOf(manifest?: unknown): OpenViews {
  return {
    get: async () => {
      if (manifest === undefined) throw new Error("no manifest");
      return { view: manifest };
    },
  } as unknown as OpenViews;
}

describe("openModuleOf", () => {
  it("gives the module of the attempt's package", async () => {
    await expect(
      openModuleOf(
        apiGiving(() => ({ attempt: { start: START } })),
        viewsOf({ id: "novatrail/olympiad-math" }),
        "p1",
        "a1",
      ),
    ).resolves.toBe("novatrail/olympiad-math");
  });

  it("gives none when the manifest does not come, nor of a task from paper", async () => {
    await expect(
      openModuleOf(
        apiGiving(() => ({ attempt: { start: START } })),
        viewsOf(),
        "p1",
        "a1",
      ),
    ).resolves.toBeUndefined();
    const paper = apiGiving(() => {
      throw new ConnectError("paper", Code.InvalidArgument);
    });
    await expect(openModuleOf(paper, viewsOf(), "p1", "a1")).resolves.toBeUndefined();
  });

  it("refuses as GetOpenAttempt does, and an attempt without its start", async () => {
    const gone = new ConnectError("gone", Code.NotFound);
    const api = apiGiving(() => {
      throw gone;
    });
    await expect(openModuleOf(api, viewsOf(), "p1", "a1")).rejects.toBe(gone);
    await expect(
      openModuleOf(
        apiGiving(() => ({ attempt: {} })),
        viewsOf(),
        "p1",
        "a1",
      ),
    ).rejects.toThrow("an open attempt without its start");
    await expect(
      openModuleOf(
        apiGiving(() => ({ attempt: { start: { packageDigest: "d" } } })),
        viewsOf(),
        "p1",
        "a1",
      ),
    ).rejects.toThrow("an open attempt without its start");
  });
});
