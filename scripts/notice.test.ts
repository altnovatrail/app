import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { licenseIds, noticeProblems, packageName, run, shippedPackages } from "./notice.ts";

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
      { path: "node_modules/a/node_modules/b", name: "b", version: "1.0.0", license: "ISC" },
      { path: "node_modules/react", name: "react", version: "19.3.1", license: "MIT" },
    ]);
  });

  it("keeps a path without node_modules whole, and an entry without a license as empty", () => {
    expect(shippedPackages({ packages: { "packages/foo": { version: "1.0.0" } } })).toEqual([
      { path: "packages/foo", name: "packages/foo", version: "1.0.0", license: "" },
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
    const c = { path: "node_modules/c", name: "c", version: "2.0.0", license: "" };
    const shipped = [...shippedPackages(lock), c];
    expect(noticeProblems(good.replace("Text of ISC:", ""), shipped)).toEqual([
      "c 2.0.0: the lock file names no license",
      "no text of ISC",
    ]);
  });

  it("takes a license that is an SPDX expression, and wants the text of each of its licenses", () => {
    const both = {
      path: "node_modules/p",
      name: "p",
      version: "2.16.0",
      license: "(Apache-2.0 AND BSD-3-Clause)",
    };
    const line = "p 2.16.0 — (Apache-2.0 AND BSD-3-Clause) — Copyright z — and its part";
    expect(
      noticeProblems([line, "Text of Apache-2.0", "Text of BSD-3-Clause"].join("\n"), [both]),
    ).toEqual([]);
    expect(noticeProblems([line, "Text of Apache-2.0"].join("\n"), [both])).toEqual([
      "no text of BSD-3-Clause",
    ]);
  });

  it("wants the NOTICE of a package that holds one, as it is, and none of one that holds none", () => {
    const shipped = shippedPackages(lock);
    const own = (pkg: { name: string }) =>
      pkg.name === "react" ? "React's notice.\nLine two.\n" : undefined;
    const section = "Notice of react 19.3.1:\n\nReact's notice.\nLine two.\n";
    expect(noticeProblems(`${good}\n${section}`, shipped, own)).toEqual([]);
    expect(noticeProblems(good, shipped, own)).toEqual(["no notice of react 19.3.1 as it is"]);
    expect(
      noticeProblems(`${good}\nNotice of react 19.3.1:\n\nReact's notice.\n`, shipped, own),
    ).toEqual(["no notice of react 19.3.1 as it is"]);
    expect(noticeProblems(`${good}\n${section}`, shipped)).toEqual([
      "a notice of what holds none: react 19.3.1",
    ]);
  });
});

describe("noticeProblems, on a package's own NOTICE", () => {
  it("takes a NOTICE with CRLF as the same text with LF", () => {
    const shipped = shippedPackages(lock);
    const own = (pkg: { name: string }) => (pkg.name === "react" ? "One.\r\nTwo.\r\n" : undefined);
    expect(
      noticeProblems(`${good}\nNotice of react 19.3.1:\n\nOne.\nTwo.\n`, shipped, own),
    ).toEqual([]);
  });

  it("wants the NOTICE of a package the lock file names no license of, too", () => {
    const bare = { path: "node_modules/c", name: "c", version: "2.0.0", license: "" };
    const own = () => "C's notice.";
    expect(noticeProblems("Notice of c 2.0.0:\n\nC's notice.\n", [bare], own)).toEqual([
      "c 2.0.0: the lock file names no license",
    ]);
  });
});

describe("packageName", () => {
  it("is the part after the last node_modules/, or the whole path", () => {
    expect(packageName("node_modules/a/node_modules/@s/b")).toBe("@s/b");
    expect(packageName("packages/foo")).toBe("packages/foo");
  });
});

describe("licenseIds", () => {
  it("gives the identifiers of an expression, without its operators", () => {
    expect(licenseIds("MIT")).toEqual(["MIT"]);
    expect(licenseIds("(Apache-2.0 AND BSD-3-Clause)")).toEqual(["Apache-2.0", "BSD-3-Clause"]);
    expect(licenseIds("(MIT OR GPL-2.0-or-later WITH Classpath-exception-2.0)")).toEqual([
      "MIT",
      "GPL-2.0-or-later",
      "Classpath-exception-2.0",
    ]);
  });
});

describe("run", () => {
  it("fails a tree whose shipped packages are not installed, and names them", () => {
    const dir = mkdtempSync(join(tmpdir(), "notice-"));
    try {
      writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
      writeFileSync(join(dir, "NOTICE"), good);
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(run(dir)).toBe(1);
      expect(error.mock.calls[0]?.[0]).toBe(
        "NOTICE: not installed, run npm ci: node_modules/a/node_modules/b, node_modules/react",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes this repository's NOTICE", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    expect(run()).toBe(0);
  });

  it("fails a NOTICE that misses a package or a package's own NOTICE, and says which", () => {
    const dir = mkdtempSync(join(tmpdir(), "notice-"));
    try {
      for (const path of ["node_modules/react", "node_modules/a/node_modules/b"]) {
        mkdirSync(join(dir, path), { recursive: true });
      }
      writeFileSync(join(dir, "node_modules/react/NOTICE.txt"), "React's notice.\n");
      writeFileSync(join(dir, "package-lock.json"), JSON.stringify(lock));
      writeFileSync(join(dir, "NOTICE"), "Text of MIT\n");
      const error = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(run(dir)).toBe(1);
      expect(error.mock.calls[0]?.[0]).toContain("no line for react 19.3.1 (MIT)");
      expect(error.mock.calls[0]?.[0]).toContain("no notice of react 19.3.1 as it is");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
