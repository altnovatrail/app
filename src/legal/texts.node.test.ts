// The legal texts from api on connect-es's router (section 15 of the text of the contracts; R27 and
// R46): asked in the language of the screen, those of the account in their order, the versions a
// consent names, the next versions, an api with no LegalService as no text in force, and the
// title, tokens and the section Who we are of a body.
import {
  LegalService,
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { Code, ConnectError, type ConnectRouter, createRouterTransport } from "@connectrpc/connect";
import { describe, expect, it, vi } from "vitest";
import { createApi } from "../api/client.ts";
import { ApiError } from "../api/failure.ts";
import { OPERATOR_SECTION, sectionOf, titleOf, tokensOf } from "./body.ts";
import {
  ACCOUNT_TEXTS,
  accountTexts,
  isPageText,
  nextOf,
  PAGE_TEXTS,
  pageNext,
  readLegal,
  readTexts,
  refsOf,
  STORAGE_TEXT,
  versionsOf,
} from "./texts.ts";

function text(id: string, version: number): LegalText {
  return create(LegalTextSchema, {
    id,
    version,
    body: `# The ${id}\n\nText.\n`,
    summary: "In short.",
    summaryLanguage: "en",
  });
}

function harness(routes: (router: ConnectRouter) => void) {
  const on = { stale: vi.fn(), accountGone: async () => {}, noAccess: async () => {} };
  const api = createApi({
    baseUrl: "https://api.example.org",
    tokens: { token: async () => "t1", signOut: async () => {} },
    on,
    sleep: async () => {},
    transport: (interceptors) => createRouterTransport(routes, { transport: { interceptors } }),
  });
  return { api, on };
}

describe("the legal texts", () => {
  it("asks them in the language of the screen, and takes those of the account in their order", async () => {
    const asked: string[] = [];
    const { api } = harness(({ service }) =>
      service(LegalService, {
        getLegalTexts(request) {
          asked.push(request.interfaceLanguage);
          return {
            texts: [text("storage-consent", 1), text("terms-of-use", 1), text("privacy-policy", 2)],
          };
        },
      }),
    );
    const texts = accountTexts(await readTexts(api, "ru"));
    expect(asked).toEqual(["ru"]);
    expect(texts.map((t) => t.id)).toEqual([...ACCOUNT_TEXTS]);
    expect(refsOf(texts)).toEqual([
      { id: "privacy-policy", version: 2 },
      { id: "terms-of-use", version: 1 },
    ]);
    expect(accountTexts([text("terms-of-use", 1)]).map((t) => t.id)).toEqual(["terms-of-use"]);
  });

  it("reads the next versions beside the current ones, and none from an api that gives none", async () => {
    let next = true;
    const { api } = harness(({ service }) =>
      service(LegalService, {
        getLegalTexts() {
          return {
            texts: [text("privacy-policy", 2)],
            ...(next ? { nextTexts: [text("parent-consent", 2), text("privacy-policy", 3)] } : {}),
          };
        },
      }),
    );
    const read = await readLegal(api, "en");
    expect(read.texts.map((t) => t.version)).toEqual([2]);
    expect(read.next.map((t) => [t.id, t.version])).toEqual([
      ["parent-consent", 2],
      ["privacy-policy", 3],
    ]);
    // The pages' own, in their order: a family's text has no page in E3.
    expect(pageNext(read.next).map((t) => t.id)).toEqual(["privacy-policy"]);
    expect(nextOf(read.next, "privacy-policy")?.version).toBe(3);
    expect(nextOf(read.next, STORAGE_TEXT)).toBeUndefined();
    next = false;
    expect((await readLegal(api, "en")).next).toEqual([]);
    expect(await readTexts(api, "en")).toHaveLength(1);
  });

  it("finds a text's current and next versions, and none while it has no version", () => {
    const legal = { texts: [text("privacy-policy", 2), text(STORAGE_TEXT, 3)], next: [] };
    expect(versionsOf(legal, STORAGE_TEXT).current).toMatchObject({
      id: "storage-consent",
      version: 3,
    });
    expect(versionsOf(legal, STORAGE_TEXT).next).toBeUndefined();
    const only = { texts: [text("privacy-policy", 2)], next: [text(STORAGE_TEXT, 4)] };
    expect(versionsOf(only, STORAGE_TEXT).current).toBeUndefined();
    expect(versionsOf(only, STORAGE_TEXT).next?.version).toBe(4);
  });

  it("makes pages of the account's texts and the consent to the storage, not of a family's", () => {
    expect(PAGE_TEXTS).toEqual(["privacy-policy", "terms-of-use", "storage-consent"]);
    expect(isPageText("terms-of-use")).toBe(true);
    expect(isPageText("parent-consent")).toBe(false);
    expect(isPageText("accessibility")).toBe(false);
  });

  it("reads an api with no LegalService as no text in force, and offers it no reload", async () => {
    const { api, on } = harness(() => {});
    expect(await readTexts(api, "en")).toEqual([]);
    expect(await readLegal(api, "en")).toEqual({ texts: [], next: [] });
    expect(on.stale).not.toHaveBeenCalled();
  });

  it("gives any other failure to the screen", async () => {
    const { api } = harness(({ service }) =>
      service(LegalService, {
        getLegalTexts() {
          throw new ConnectError("down", Code.Unavailable);
        },
      }),
    );
    const error = await readTexts(api, "en").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).failure).toEqual({ kind: "offline" });
  });
});

describe("a body of Markdown", () => {
  it("takes its title from the heading of the first level that begins it", () => {
    expect(titleOf("\n# Privacy Policy &amp; more\n\nText.")).toBe("Privacy Policy & more");
    expect(titleOf("Text first.\n\n# Later")).toBeUndefined();
    expect(titleOf("## Second level")).toBeUndefined();
    // Its words alone, with no markup, and a code span as written.
    expect(titleOf("# Terms of **Use** \\*draft\\* `&amp;`")).toBe("Terms of Use *draft* &amp;");
    expect(titleOf("# &laquo;Оператор&raquo; &mdash; &unknown;")).toBe("«Оператор» — &unknown;");
  });

  it("gives the section Who we are, up to the next heading of its level, and none without it", () => {
    const body = [
      "# Privacy policy",
      "Intro.",
      "## Who we are",
      "The operator, by post:",
      "- an address;",
      "### By email",
      "An address.",
      "## What we collect",
      "Little.",
    ].join("\n\n");
    expect(sectionOf(body, OPERATOR_SECTION)).toBe(
      "## Who we are\n\nThe operator, by post:\n\n- an address;\n\n### By email\n\nAn address.\n\n",
    );
    // To the end, when it is the last section.
    expect(sectionOf("# P\n\n## Who we are\n\nUs.\n", OPERATOR_SECTION)).toBe(
      "## Who we are\n\nUs.\n",
    );
    // Only a heading of the second level that reads exactly so.
    expect(sectionOf("# P\n\n### Who we are\n\nUs.\n", OPERATOR_SECTION)).toBeUndefined();
    expect(sectionOf("# P\n\n## Who we are now\n\nUs.\n", OPERATOR_SECTION)).toBeUndefined();
    expect(sectionOf("# P\n\n## **Who** we are\n\nUs.\n", OPERATOR_SECTION)).toBe(
      "## **Who** we are\n\nUs.\n",
    );
    expect(sectionOf("# P\n\nNo sections.\n", OPERATOR_SECTION)).toBeUndefined();
  });

  it("reads the tables of GitHub's flavour", () => {
    const types = tokensOf("| A | B |\n|:--|--:|\n| 1 | 2 |\n").map((token) => token.type);
    expect(types).toContain("table");
  });
});
