import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { differences, drawn, type IconSet, MODULE, module, report, run, TABLE } from "./icons.ts";

afterEach(() => {
  vi.restoreAllMocks();
  vi.doUnmock("@iconify-json/material-symbols");
  vi.resetModules();
});

/** A made-up set: two filled paths, a fill, an alias, and an icon that is no path. */
const SET: IconSet = {
  prefix: "test",
  width: 24,
  height: 24,
  icons: {
    "go-outline-rounded": {
      body: '<path fill="currentColor" d="M1 1h2"/><path fill="currentColor" d="M3 3h4"/>',
    },
    "go-rounded": { body: '<path fill="currentColor" d="M5 5h6"/>' },
    "circle-outline-rounded": { body: '<circle cx="12" cy="12" r="4"/>' },
    "twice-outline-rounded": {
      body: '<path fill="currentColor" d="M1 1h2"/><path fill="currentColor" d="M1 1h2"/>',
    },
  },
  aliases: { "ahead-outline-rounded": { parent: "go-outline-rounded" } },
};

describe("drawn", () => {
  it("gives an icon's view box and its paths, and an alias's as its parent's", () => {
    const go = { viewBox: "0 0 24 24", paths: ["M1 1h2", "M3 3h4"] };
    expect(drawn(SET, "go-outline-rounded")).toEqual(go);
    expect(drawn(SET, "ahead-outline-rounded")).toEqual(go);
  });

  it("refuses a name the set does not have and an icon that is not filled paths alone", () => {
    expect(() => drawn(SET, "none-outline-rounded")).toThrow("has no icon none-outline-rounded");
    expect(() => drawn(SET, "circle-outline-rounded")).toThrow("is not filled paths alone");
    expect(() => drawn(SET, "twice-outline-rounded")).toThrow("draws a path twice");
  });
});

describe("module", () => {
  it("quotes a key that is no identifier", () => {
    const text = module(SET, "9.9.9", { "go-on": { base: "go", filled: false, mirrored: false } });
    expect(text).toContain('"go-on": {"outline":"go-outline-rounded"');
  });

  it("holds each icon once, the fill only of a value that shows one", () => {
    const text = module(SET, "9.9.9", {
      go: { base: "go", filled: true, mirrored: true },
      ahead: { base: "ahead", filled: false, mirrored: false },
    });
    expect(text).toContain("from @iconify-json/material-symbols 9.9.9");
    expect(text).toContain(
      '"go-outline-rounded": {"viewBox":"0 0 24 24","paths":["M1 1h2","M3 3h4"]},',
    );
    expect(text).toContain('"go-rounded": {"viewBox":"0 0 24 24","paths":["M5 5h6"]},');
    expect(text).toContain(
      '"go": {"outline":"go-outline-rounded","filled":"go-rounded","mirrored":true},',
    );
    expect(text).toContain(
      '"ahead": {"outline":"ahead-outline-rounded","filled":"ahead-outline-rounded","mirrored":false},',
    );
    expect(text.match(/"ahead-outline-rounded": \{/g)).toHaveLength(1);
  });

  it("takes the app's own table when none is given", () => {
    expect(Object.keys(TABLE)).toContain("continue");
  });
});

describe("differences", () => {
  it("is empty only when the module is what the script writes", () => {
    expect(differences("a", "a")).toEqual([]);
    expect(differences("a", "b")).toEqual([
      `icons: ${MODULE} is not what scripts/icons.ts writes; run just icons`,
    ]);
    expect(differences("a", undefined)).toHaveLength(1);
  });
});

describe("run", () => {
  it("finds this repository's module written from the set the lock file pins", async () => {
    expect(await run(true)).toEqual([]);
  });

  it("writes the module, and then finds it as the script writes it, but not edited by hand", async () => {
    const root = mkdtempSync(join(tmpdir(), "icons-"));
    try {
      mkdirSync(join(root, "src/app"), { recursive: true });
      expect(await run(true, root)).toHaveLength(1);
      expect(await run(false, root)).toEqual([]);
      const path = join(root, MODULE);
      expect(readFileSync(path, "utf8")).toBe(readFileSync(MODULE, "utf8"));
      expect(await run(true, root)).toEqual([]);
      writeFileSync(path, `${readFileSync(path, "utf8")}// edited\n`);
      expect(await run(true, root)).toHaveLength(1);
      // A module that cannot be read is no module to write again: the error is the reader's.
      rmSync(path);
      mkdirSync(path);
      await expect(run(true, root)).rejects.toThrow(/EISDIR/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("report", () => {
  it("prints each problem and gives 1, or prints ok and gives 0", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(report([])).toBe(0);
    expect(log).toHaveBeenLastCalledWith("icons: ok");
    expect(report(["one", "two"])).toBe(1);
    expect(error.mock.calls).toEqual([["one"], ["two"]]);
    expect(log).toHaveBeenLastCalledWith("icons: 2 problems");
  });
});

describe("run, on a set that is not Material Symbols under Apache-2.0", () => {
  it("writes nothing and names what the package of the set says it is", async () => {
    vi.doMock("@iconify-json/material-symbols", () => ({
      icons: SET,
      info: { name: "Other Symbols", license: { spdx: "MIT" } },
    }));
    const fresh = await import("./icons.ts");
    expect(await fresh.run(false, "/nonexistent")).toEqual([
      expect.stringMatching(
        /^icons: @iconify-json\/material-symbols \S+ is Other Symbols under MIT$/,
      ),
    ]);
  });
});
