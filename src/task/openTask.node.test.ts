import { Code, ConnectError } from "@connectrpc/connect";
import { describe, expect, it } from "vitest";
import type { Api } from "../api/client.ts";
import type { OpenViews } from "../packages/views.ts";
import { openTaskOf } from "./openTask.ts";

const START = {
  packageDigest: "sha256:1",
  task: { json: new Uint8Array(), moduleFormatVersion: "0.4" },
};

function apiGiving(getOpenAttempt: () => unknown): Api {
  return { learning: { getOpenAttempt: async () => getOpenAttempt() } } as unknown as Api;
}

function viewsOf(statement: { text?: string }[], manifest?: unknown): OpenViews {
  return {
    parseView: () => ({ statement }),
    get: async () => {
      if (manifest === undefined) throw new Error("no manifest");
      return { view: manifest };
    },
  } as unknown as OpenViews;
}

const MANIFEST = {
  id: "novatrail/olympiad-math",
  title: "Olympiad maths",
  languages: { explanation: "en" },
};

describe("openTaskOf", () => {
  it("gives the module and the first paragraph of the statement", async () => {
    const views = viewsOf([{}, { text: "How many?" }, { text: "Then?" }], MANIFEST);
    await expect(
      openTaskOf(
        apiGiving(() => ({ attempt: { start: START } })),
        views,
        "p1",
        "a1",
      ),
    ).resolves.toEqual({
      kind: "module",
      moduleId: "novatrail/olympiad-math",
      module: "Olympiad maths",
      language: "en",
      statement: "How many?",
    });
  });

  it("gives no module when its manifest does not come, and no statement of pictures alone", async () => {
    const views = viewsOf([{}]);
    await expect(
      openTaskOf(
        apiGiving(() => ({ attempt: { start: START } })),
        views,
        "p1",
        "a1",
      ),
    ).resolves.toEqual({ kind: "module" });
  });

  it("gives a task from paper where GetOpenAttempt refuses it as an invalid argument", async () => {
    const api = apiGiving(() => {
      throw new ConnectError("paper", Code.InvalidArgument);
    });
    await expect(openTaskOf(api, viewsOf([]), "p1", "a1")).resolves.toEqual({ kind: "paper" });
  });

  it("refuses as GetOpenAttempt does, and an attempt without its start", async () => {
    const gone = new ConnectError("gone", Code.NotFound);
    const api = apiGiving(() => {
      throw gone;
    });
    await expect(openTaskOf(api, viewsOf([]), "p1", "a1")).rejects.toBe(gone);
    await expect(
      openTaskOf(
        apiGiving(() => ({ attempt: {} })),
        viewsOf([]),
        "p1",
        "a1",
      ),
    ).rejects.toThrow("an open attempt without its start");
    await expect(
      openTaskOf(
        apiGiving(() => ({ attempt: { start: { packageDigest: "d" } } })),
        viewsOf([]),
        "p1",
        "a1",
      ),
    ).rejects.toThrow("an open attempt without its start");
  });
});
