import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";
import { describe, expect, it } from "vitest";
import { deploymentPart, partText } from "./archive.ts";
import {
  deployment,
  layerIsFirst,
  layerTag,
  localProblem,
  placesOf,
  withLayer,
} from "./deployment-plugin.ts";

const PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>x</title>
  </head>
</html>`;

describe("withLayer", () => {
  it("puts the lower layer right after <meta charset>, and layerIsFirst finds it there", () => {
    const html = withLayer(PAGE, { "default-src": "'none'" });
    expect(html).toContain(
      `<meta charset="utf-8" />\n    ${layerTag({ "default-src": "'none'" })}`,
    );
    expect(layerIsFirst(html)).toBe(true);
    expect(layerIsFirst(PAGE)).toBe(false);
  });

  it("refuses a page whose <head> does not begin with <meta charset>", () => {
    const late = PAGE.replace(
      '<meta charset="utf-8" />',
      '<title>y</title><meta charset="utf-8" />',
    );
    expect(() => withLayer(late, {})).toThrow("does not begin its <head> with <meta charset");
    const before = withLayer(PAGE, {}).replace(
      "<meta http-equiv",
      '<script src="/a.js"></script><meta http-equiv',
    );
    expect(layerIsFirst(before)).toBe(false);
  });
});

describe("localProblem", () => {
  it("wants the api of the local file to be the server's origin", () => {
    expect(
      localProblem('{"api":"http://127.0.0.1:5173"}', "http://127.0.0.1:5173"),
    ).toBeUndefined();
    expect(localProblem('{"api":"http://127.0.0.1:8080"}', "http://127.0.0.1:5173")).toBe(
      "deployment.local.json names api http://127.0.0.1:8080, not this server's origin http://127.0.0.1:5173",
    );
    expect(localProblem("{", "http://127.0.0.1:5173")).toBe("deployment.local.json is not JSON");
    expect(localProblem("null", "x")).toBe(
      "deployment.local.json names api undefined, not this server's origin x",
    );
  });
});

describe("placesOf", () => {
  it("gives the places only from a file that holds both", () => {
    const api = "http://127.0.0.1:5173";
    expect(placesOf(JSON.stringify({ api, signIn: { authDomain: "a.example.org" } }))).toEqual({
      api,
      authDomain: "a.example.org",
    });
    expect(placesOf(JSON.stringify({ api }))).toBeUndefined();
    expect(placesOf(JSON.stringify({ signIn: { authDomain: "a" } }))).toBeUndefined();
    expect(placesOf("null")).toBeUndefined();
  });
});

describe("deployment", () => {
  it("refuses a template the rollout would refuse, at the build", () => {
    const folder = mkdtempSync(join(tmpdir(), "plugin-"));
    try {
      const template = join(folder, "csp.json");
      writeFileSync(template, JSON.stringify({ "frame-ancestors": "'self'" }));
      const hook = deployment({ template }).transformIndexHtml as {
        handler: (html: string, context: object) => string;
      };
      expect(() => hook.handler(PAGE, {})).toThrow("csp.json: frame-ancestors is not 'none'");
      expect(hook.handler(PAGE, { server: {} })).toBe(PAGE);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });

  it("stops a build whose lower layer is not first, and puts csp.json and the schema beside the page", () => {
    const plugin = deployment();
    const emitted: { fileName: string; source: Buffer }[] = [];
    const context = {
      emitFile: (file: { fileName: string; source: Buffer }) => emitted.push(file),
      error: (message: string) => {
        throw new Error(message);
      },
    };
    const run = plugin.generateBundle as (this: object, options: object, bundle: object) => void;
    const page = (source: string) => ({ "index.html": { type: "asset", source } });
    expect(() => run.call(context, {}, page(PAGE))).toThrow(
      "the lower layer of the CSP is not first",
    );
    expect(() => run.call(context, {}, {})).toThrow("the lower layer of the CSP is not first");
    run.call(context, {}, page(withLayer(PAGE, { "default-src": "'none'" })));
    expect(emitted.map((file) => file.fileName)).toEqual(["csp.json", "deployment.schema.json"]);
    expect(String(emitted[1]?.source)).toBe(
      partText(deploymentPart(), "schemas/deployment.schema.json"),
    );
  });

  it("serves the local file on the development server, without the lower layer", async () => {
    const folder = mkdtempSync(join(tmpdir(), "plugin-"));
    const local = join(folder, "deployment.local.json");
    const port = 5183;
    const origin = `http://127.0.0.1:${port}`;
    const server = await createServer({
      configFile: false,
      logLevel: "silent",
      appType: "mpa",
      plugins: [deployment({ local })],
      server: { host: "127.0.0.1", port, strictPort: true },
    });
    try {
      await server.listen();
      expect((await fetch(`${origin}/deployment.json`)).status).toBe(404);
      writeFileSync(local, JSON.stringify({ api: origin }));
      const answer = await fetch(`${origin}/deployment.json?x=1`);
      expect(answer.status).toBe(200);
      expect(answer.headers.get("content-type")).toBe("application/json");
      expect(answer.headers.get("cache-control")).toBe("no-cache");
      expect(answer.headers.get("content-security-policy")).toBeNull();
      expect(await answer.json()).toEqual({ api: origin });
      writeFileSync(local, JSON.stringify({ api: "http://127.0.0.1:1" }));
      expect((await fetch(`${origin}/deployment.json`)).status).toBe(404);
    } finally {
      await server.close();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60_000);
});
