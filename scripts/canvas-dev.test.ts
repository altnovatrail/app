import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canvasCopy } from "./canvas-dev.ts";

/** A made-up working copy: its package.json, by the path canvasCopy reads it at. */
function copy(manifest: object) {
  return (path: string) => {
    expect(path).toBe(`${resolve("../canvas")}/package.json`);
    return JSON.stringify(manifest);
  };
}

describe("canvasCopy", () => {
  it("points each entry point canvas exports at the copy's file, by its exact name", () => {
    const { aliases, allow } = canvasCopy(
      "../canvas",
      copy({
        name: "@altnovatrail/canvas",
        exports: {
          ".": { types: "./lib/element/index.d.ts", default: "./lib/element/index.js" },
          "./core": { types: "./lib/core/index.d.ts", default: "./lib/core/index.js" },
          "./package.json": "./package.json",
          "./types-only": { types: "./lib/t.d.ts" },
        },
      }),
    );
    expect(allow).toBe(resolve("../canvas"));
    expect(aliases.map((a) => [a.find.source, a.replacement])).toEqual([
      ["^@altnovatrail\\/canvas$", resolve("../canvas/lib/element/index.js")],
      ["^@altnovatrail\\/canvas\\/core$", resolve("../canvas/lib/core/index.js")],
      ["^@altnovatrail\\/canvas\\/package\\.json$", resolve("../canvas/package.json")],
    ]);
    const [element, core] = aliases;
    expect(element?.find.test("@altnovatrail/canvas")).toBe(true);
    expect(element?.find.test("@altnovatrail/canvas/core")).toBe(false);
    expect(core?.find.test("@altnovatrail/canvas/core")).toBe(true);
  });

  it("refuses a folder that is not canvas, or a canvas that exports nothing", () => {
    expect(() => canvasCopy("../canvas", copy({ name: "@altnovatrail/skill-map" }))).toThrow(
      "holds @altnovatrail/skill-map, not @altnovatrail/canvas",
    );
    expect(() => canvasCopy("../canvas", copy({}))).toThrow("holds no package");
    expect(() => canvasCopy("../canvas", copy({ name: "@altnovatrail/canvas" }))).toThrow(
      "exports nothing",
    );
  });
});

describe("canvasCopy, on a folder", () => {
  it("reads the copy's package.json from the folder itself", () => {
    const folder = mkdtempSync(join(tmpdir(), "canvas-"));
    try {
      const exports = { ".": { default: "./lib/element/index.js" } };
      writeFileSync(
        join(folder, "package.json"),
        JSON.stringify({ name: "@altnovatrail/canvas", exports }),
      );
      expect(canvasCopy(folder).aliases.map((a) => a.replacement)).toEqual([
        join(folder, "lib/element/index.js"),
      ]);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("canvasCopy, on conditions and patterns", () => {
  it("takes a browser's file by its conditions, nested too, and passes over types alone", () => {
    const { aliases } = canvasCopy(
      "../canvas",
      copy({
        name: "@altnovatrail/canvas",
        exports: {
          ".": { types: "./lib/a.d.ts", import: "./lib/a.js", default: "./lib/a.cjs" },
          "./b": { browser: { import: "./lib/b.js" }, default: "./lib/b.cjs" },
          "./c": { types: "./lib/c.d.ts" },
        },
      }),
    );
    expect(aliases.map((a) => a.replacement)).toEqual([
      resolve("../canvas/lib/a.js"),
      resolve("../canvas/lib/b.js"),
    ]);
  });

  it("refuses an export by pattern, which an exact alias would miss", () => {
    const manifest = { name: "@altnovatrail/canvas", exports: { "./*": "./lib/*.js" } };
    expect(() => canvasCopy("../canvas", copy(manifest))).toThrow("exports a pattern, ./*");
  });
});
