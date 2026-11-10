import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { noticeProblems, run, shippedPackages } from "./notice.ts";

const lock = {
  packages: {
    "": { version: "0.0.0" },
    "node_modules/react": { version: "19.3.1", license: "MIT" },
    "node_modules/vite": { version: "8.3.6", license: "MIT", dev: true },
    "node_modules/a/node_modules/b": { version: "1.0.0", license: "ISC" },
    "node_modules/linked": { link: true },
  },
};

const good = [
  "b 1.0.0 — ISC — Copyright x",
  "react 19.3.1 — MIT — Copyright y",
  "Text of ISC:",
  "Text of MIT:",
].join("\n");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shippedPackages", () => {
  it("takes the packages that are not dev, by their innermost name, sorted", () => {
    expect(shippedPackages(lock)).toEqual([
      { name: "b", version: "1.0.0", license: "ISC" },
      { name: "react", version: "19.3.1", license: "MIT" },
    ]);
  });

  it("keeps a path without node_modules whole, and an entry without a license as empty", () => {
    expect(shippedPackages({ packages: { "packages/foo": { version: "1.0.0" } } })).toEqual([
      { name: "packages/foo", version: "1.0.0", license: "" },
    ]);
  });
});

describe("noticeProblems", () => {
  it("accepts a NOTICE that names each package with a copyright and has each license's text", () => {
    expect(noticeProblems(good, shippedPackages(lock))).toEqual([]);
  });

  it("names a missing line, another version's line and an empty copyright", () => {
    const notice = [
      "react 19.3.0 — MIT — Copyright y",
      "b 1.0.0 — ISC — ",
      "Text of ISC",
      "Text of MIT",
    ];
    expect(noticeProblems(notice.join("\n"), shippedPackages(lock))).toEqual([
      "no copyright for b 1.0.0",
      "no line for react 19.3.1 (MIT)",
      "a line for what the build does not ship: react 19.3.0 — MIT",
    ]);
  });

  it("names a license without its text, and a package without a license", () => {
    const shipped = [...shippedPackages(lock), { name: "c", version: "2.0.0", license: "" }];
    expect(noticeProblems(good.replace("Text of ISC:", ""), shipped)).toEqual([
      "c 2.0.0: the lock file names no license",
      "no text of ISC",
    ]);
  });
});

describe("run", () => {
  it("passes this repository's NOTICE", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(run()).toBe(0);
  });

  it("fails a NOTICE that misses a package, and says which", () => {
    const dir = mkdtempSync(join(tmpdir(), "notice-"));
    writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
    writeFileSync(join(dir, "NOTICE"), "Text of MIT\n");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(run(dir)).toBe(1);
    expect(error.mock.calls[0]?.[0]).toContain("no line for react 19.3.1 (MIT)");
  });
});
