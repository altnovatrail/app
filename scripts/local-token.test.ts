// The development server's route to api's development token (R44 in docs/decisions.md): the token
// from its file, read at each request, 404 without it, and nothing of it in `vite preview`.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer, preview } from "vite";
import { describe, expect, it } from "vitest";
import { LOCAL_TOKEN_PATH } from "../src/signin/token-path.ts";
import { localToken, TOKEN_FILE } from "./local-token.ts";

/** A port of its own, beside the 5173 of `just dev` and those of the other tests. */
const PORT = 5185;
const ORIGIN = `http://127.0.0.1:${PORT}`;

describe("localToken", () => {
  it("reads the file of api's just dev-app by default", () => {
    expect(TOKEN_FILE).toBe("/home/vscode/.novatrail-token/custom-token");
    expect(localToken().apply).toBe("serve");
  });

  it("hands out the token on the development server, as the file is now, and 404 without it", async () => {
    const folder = mkdtempSync(join(tmpdir(), "token-"));
    const file = join(folder, "custom-token");
    const server = await createServer({
      configFile: false,
      logLevel: "silent",
      appType: "mpa",
      plugins: [localToken(file)],
      server: { host: "127.0.0.1", port: PORT, strictPort: true },
    });
    try {
      await server.listen();
      expect((await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}`)).status).toBe(404);
      writeFileSync(file, "aa.bb.cc\n");
      const answer = await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}?x=1`);
      expect(answer.status).toBe(200);
      expect(answer.headers.get("content-type")).toBe("text/plain; charset=utf-8");
      expect(answer.headers.get("cache-control")).toBe("no-store");
      expect(await answer.text()).toBe("aa.bb.cc");
      writeFileSync(file, "dd.ee.ff\n");
      expect(await (await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}`)).text()).toBe("dd.ee.ff");
      writeFileSync(file, "\n");
      expect((await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}`)).status).toBe(404);
      rmSync(file);
      expect((await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}`)).status).toBe(404);
      expect((await fetch(`${ORIGIN}/__novatrail/other`)).status).toBe(404);
    } finally {
      await server.close();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60_000);

  it("is not in vite preview, even with the file there", async () => {
    const folder = mkdtempSync(join(tmpdir(), "token-"));
    const file = join(folder, "custom-token");
    writeFileSync(file, "aa.bb.cc\n");
    const server = await preview({
      configFile: false,
      logLevel: "silent",
      appType: "mpa",
      build: { outDir: folder },
      plugins: [localToken(file)],
      preview: { host: "127.0.0.1", port: PORT, strictPort: true },
    });
    try {
      const answer = await fetch(`${ORIGIN}${LOCAL_TOKEN_PATH}`);
      expect(answer.status).toBe(404);
      expect(await answer.text()).not.toContain("aa.bb.cc");
    } finally {
      await server.close();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60_000);
});
