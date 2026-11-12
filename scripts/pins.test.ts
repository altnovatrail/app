import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pinProblems, run, SET, UI_PACKAGES } from "./pins.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

const app = {
  dependencies: { "@iconify-json/material-symbols": "1.2.97", "@bufbuild/protobuf": "2.16.0" },
};

/** Installed manifests by name, as run reads them from node_modules. */
function installed(manifests: Record<string, object>) {
  return (name: string) => manifests[name];
}

const canvas = { devDependencies: { "@iconify-json/material-symbols": "1.2.97" } };
const contracts = { dependencies: { "@bufbuild/protobuf": "2.16.0" } };
const lock = {
  packages: {
    "": {},
    "node_modules/@firebase/app": { version: "0.16.5" },
    "node_modules/@firebase/component": { version: "0.7.5" },
  },
};

describe("pinProblems", () => {
  it("passes a set and a runtime that are the packages' own, and one copy of each @firebase", () => {
    const all = installed({ "@altnovatrail/canvas": canvas, "@altnovatrail/contracts": contracts });
    expect(pinProblems(app, all, lock)).toEqual([]);
  });

  it("passes over a package that is not installed or names no set", () => {
    const some = installed({ "@altnovatrail/skill-map": {} });
    expect(pinProblems({}, some, { packages: {} })).toEqual([]);
  });

  it("names a set that is not canvas's or skill-map's, and one that is missing", () => {
    const skillMap = { devDependencies: { "@iconify-json/material-symbols": "1.2.98" } };
    const all = installed({ "@altnovatrail/canvas": canvas, "@altnovatrail/skill-map": skillMap });
    expect(pinProblems(app, all, lock)).toEqual([
      "@iconify-json/material-symbols is 1.2.97, but @altnovatrail/skill-map takes 1.2.98",
    ]);
    expect(pinProblems({}, all, lock)).toEqual([
      "@iconify-json/material-symbols is missing, but @altnovatrail/canvas takes 1.2.97",
      "@iconify-json/material-symbols is missing, but @altnovatrail/skill-map takes 1.2.98",
    ]);
  });

  it("names a runtime of protobuf that is not the contracts' own", () => {
    const newer = { dependencies: { "@bufbuild/protobuf": "2.17.0" } };
    expect(pinProblems(app, installed({ "@altnovatrail/contracts": newer }), lock)).toEqual([
      "@bufbuild/protobuf is 2.16.0, but @altnovatrail/contracts takes 2.17.0",
    ]);
    expect(pinProblems({}, installed({ "@altnovatrail/contracts": newer }), lock)).toEqual([
      "@bufbuild/protobuf is missing, but @altnovatrail/contracts takes 2.17.0",
    ]);
  });

  it("names a link to a folder and a second copy of a package of @firebase", () => {
    const linked = {
      packages: {
        ...lock.packages,
        "node_modules/@altnovatrail/canvas": { resolved: "../canvas", link: true },
        "node_modules/@firebase/auth/node_modules/@firebase/component": { version: "0.7.4" },
        "node_modules/other": { link: true },
        "packages/@firebase/app": { version: "0.0.0" },
      },
    };
    expect(pinProblems(app, installed({}), linked)).toEqual([
      "node_modules/@altnovatrail/canvas is a link to ../canvas",
      "node_modules/other is a link to a folder",
      "@firebase/component is in the lock file 2 times",
    ]);
  });
});

describe("run", () => {
  it("passes this repository, as npm ci installed it", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(run()).toBe(0);
  });

  it.each(UI_PACKAGES)(
    "holds this repository's set to the one its %s names, not passing it over",
    (ui) => {
      const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
      const named = read(`node_modules/${ui}/package.json`).devDependencies?.[SET];
      expect(named).toBeDefined();
      expect(read("package.json").dependencies[SET]).toBe(named);
    },
  );

  it("fails a tree whose set is not canvas's, and names it", () => {
    const root = mkdtempSync(join(tmpdir(), "pins-"));
    const write = (path: string, value: object) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), JSON.stringify(value));
    };
    try {
      write("package.json", { dependencies: { "@iconify-json/material-symbols": "1.2.98" } });
      write("package-lock.json", { packages: {} });
      write("node_modules/@altnovatrail/canvas/package.json", canvas);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(run(root)).toBe(1);
      expect(error.mock.calls[0]?.[0]).toContain("but @altnovatrail/canvas takes 1.2.97");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
