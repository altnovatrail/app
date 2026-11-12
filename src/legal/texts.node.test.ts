// The legal texts from api on connect-es's router (section 15 of the text of the contracts; R27):
// asked in the language of the screen, those of the account in their order, the versions a consent
// names, an api with no LegalService as no text in force, and the title and tokens of a body.
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
import { titleOf, tokensOf } from "./body.ts";
import {
  ACCOUNT_TEXTS,
  accountTexts,
  readTexts,
  refsOf,
  STORAGE_TEXT,
  storageText,
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

  it("finds the consent to the storage of works, and none while it has no version in force", () => {
    const texts = [text("privacy-policy", 2), text(STORAGE_TEXT, 3)];
    expect(storageText(texts)).toMatchObject({ id: "storage-consent", version: 3 });
    expect(storageText([text("privacy-policy", 2)])).toBeUndefined();
  });

  it("reads an api with no LegalService as no text in force, and offers it no reload", async () => {
    const { api, on } = harness(() => {});
    expect(await readTexts(api, "en")).toEqual([]);
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

  it("reads the tables of GitHub's flavour", () => {
    const types = tokensOf("| A | B |\n|:--|--:|\n| 1 | 2 |\n").map((token) => token.type);
    expect(types).toContain("table");
  });
});
