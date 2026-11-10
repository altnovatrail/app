import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inexactVersions, run } from "./versions.ts";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("inexactVersions", () => {
  it("names ranges, tags and links, and passes exact versions", () => {
    expect(
      inexactVersions({
        dependencies: { a: "1.2.3", b: "^1.2.3", c: "1.0.0-rc.1" },
        devDependencies: { d: "~2.0.0", e: "latest", f: "file:../f", g: "1.x" },
      }),
    ).toEqual(["b@^1.2.3", "d@~2.0.0", "e@latest", "f@file:../f", "g@1.x"]);
  });

  it("finds none in this repository's package.json", () => {
    expect(inexactVersions(JSON.parse(readFileSync("package.json", "utf8")))).toEqual([]);
  });
});

describe("run", () => {
  it("passes this repository's package.json", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(run()).toBe(0);
  });

  it("fails a package.json with a range, and names it", () => {
    const dir = mkdtempSync(join(tmpdir(), "versions-"));
    writeFileSync(join(dir, "package.json"), JSON.stringify({ dependencies: { a: "^1.0.0" } }));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(run(dir)).toBe(1);
    expect(error.mock.calls[0]?.[0]).toContain("a@^1.0.0");
  });
});
