// The archive of a release (R25): packed from a build of synthetic files, the same bytes twice, in
// the layout infra's rollout reads, and refused for each way out of it.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { gunzipSync, gzipSync } from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { tar, tarEntries } from "./archive.ts";
import { archiveName, archiveProblems, pack, run } from "./release.ts";

const PAGE =
  '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src \'none\'" />\n  </head>\n</html>\n';
const NOTICES = { NOTICE: Buffer.from("A notice.\n"), LICENSE: Buffer.from("A licence.\n") };

const roots: string[] = [];

/** A folder of a build, with what each test changes in it, and the repository's notices beside. */
function fixture(change: (build: string) => void = () => {}): string {
  const root = mkdtempSync(`${tmpdir()}/release-`);
  roots.push(root);
  const build = `${root}/build`;
  mkdirSync(`${build}/assets`, { recursive: true });
  writeFileSync(`${build}/index.html`, PAGE);
  writeFileSync(`${build}/csp.json`, '{"default-src":"\'none\'"}\n');
  writeFileSync(`${build}/deployment.schema.json`, "{}\n");
  writeFileSync(`${build}/assets/index-a.js`, "console.log(1);\n");
  writeFileSync(`${build}/assets/index-b.css`, "a{}\n");
  for (const [name, body] of Object.entries(NOTICES)) writeFileSync(`${root}/${name}`, body);
  change(build);
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("the archive of a release", () => {
  it("names the archive by its version, and refuses one not vX.Y.Z", () => {
    expect(archiveName("v0.1.0")).toBe("app_v0.1.0.tar.gz");
    for (const wrong of ["0.1.0", "v0.1", "v01.0.0", "v0.1.0-rc.1", ""]) {
      expect(() => archiveName(wrong)).toThrow(/as v0\.1\.0/);
    }
  });

  it("packs the build sorted, with no time and no owner, files 0644 and folders 0755, the same bytes twice", () => {
    const root = fixture();
    const archive = pack(`${root}/build`, NOTICES);
    expect(pack(`${root}/build`, NOTICES).equals(archive)).toBe(true);
    const entries = tarEntries(gunzipSync(archive));
    expect(entries.map((entry) => entry.path)).toEqual([
      "./",
      "./LICENSE",
      "./NOTICE",
      "./assets/",
      "./assets/index-a.js",
      "./assets/index-b.css",
      "./csp.json",
      "./deployment.schema.json",
      "./index.html",
    ]);
    for (const entry of entries) {
      expect([entry.mtime, entry.uid, entry.gid]).toEqual([0, 0, 0]);
      expect(entry.mode).toBe(entry.type === "5" ? 0o755 : 0o644);
    }
    expect(archiveProblems(archive, NOTICES)).toEqual([]);
    // The gzip header names no time and no system, so another machine packs the same bytes.
    expect([...archive.subarray(4, 10)]).toEqual([0, 0, 0, 0, 2, 0xff]);
    // A tar of the system reads it as it is.
    const listed = spawnSync("tar", ["-tzf", "-"], { input: archive, encoding: "utf8" });
    expect(listed.status).toBe(0);
    expect(listed.stdout.split("\n")).toContain("./assets/index-a.js");
  });

  it("splits a path longer than the name field at the first slash that fits, and refuses one none fits", () => {
    expect(
      tarEntries(
        tar([
          { path: `./assets/${"d".repeat(120)}/${"e".repeat(50)}/x.js`, body: Buffer.from("1") },
        ]),
      )[0]?.path,
    ).toBe(`./assets/${"d".repeat(120)}/${"e".repeat(50)}/x.js`);
    expect(() => tar([{ path: `./${"f".repeat(260)}`, body: Buffer.from("1") }])).toThrow(
      /too long for ustar/,
    );
    const deep = `${"d".repeat(60)}/${"e".repeat(60)}`;
    const root = fixture((build) => {
      mkdirSync(`${build}/assets/${deep}`, { recursive: true });
      writeFileSync(`${build}/assets/${deep}/f.js`, "1\n");
    });
    const entries = tarEntries(gunzipSync(pack(`${root}/build`, NOTICES)));
    expect(entries.map((entry) => entry.path)).toContain(`./assets/${deep}/f.js`);
  });

  it.each([
    [
      "a deployment.json of the build's own",
      (build: string) => writeFileSync(`${build}/deployment.json`, "{}"),
      /that file is the deployment's/,
    ],
    [
      "no csp.json",
      (build: string) => rmSync(`${build}/csp.json`),
      /holds no csp\.json at its root/,
    ],
    [
      "no file under assets/",
      (build: string) => {
        rmSync(`${build}/assets`, { recursive: true });
        mkdirSync(`${build}/assets`);
      },
      /no file under assets\//,
    ],
    [
      "a file the layout has not",
      (build: string) => writeFileSync(`${build}/robots.txt`, ""),
      /robots\.txt, which its layout has not/,
    ],
    [
      "a folder the layout has not",
      (build: string) => mkdirSync(`${build}/extra`),
      /extra, which its layout has not/,
    ],
    [
      "the lower layer not first",
      (build: string) =>
        writeFileSync(
          `${build}/index.html`,
          "<!doctype html><html><head><title>x</title></head></html>",
        ),
      /lower layer/,
    ],
  ])("refuses %s", (_, change, problem) => {
    const root = fixture(change);
    expect(archiveProblems(pack(`${root}/build`, NOTICES), NOTICES).join("; ")).toMatch(problem);
  });

  it("refuses notices that are not the repository's, and a build that holds its own", () => {
    const root = fixture();
    const archive = pack(`${root}/build`, NOTICES);
    expect(archiveProblems(archive, { ...NOTICES, NOTICE: Buffer.from("Another.\n") })).toEqual([
      "the archive's NOTICE is not the repository's",
    ]);
    const own = fixture((build) => writeFileSync(`${build}/NOTICE`, "mine"));
    expect(() => pack(`${own}/build`, NOTICES)).toThrow(/holds a NOTICE of its own/);
  });

  it("refuses a link in the build, a path out of it, and what is no gzipped tar", () => {
    const linked = fixture((build) => symlinkSync("index.html", `${build}/assets/page.html`));
    expect(() => pack(`${linked}/build`, NOTICES)).toThrow(/neither a file nor a folder/);
    const out = gzipSync(tar([{ path: "./../outside", body: Buffer.from("x") }]));
    expect(archiveProblems(out, NOTICES).join("; ")).toMatch(/a path out of the build/);
    expect(archiveProblems(Buffer.from("not an archive"), NOTICES)).toEqual([
      "the archive is no gzipped tar",
    ]);
  });

  it("refuses times, owners, modes and links that a tar of the system leaves", () => {
    const root = fixture((build) => symlinkSync("index.html", `${build}/link.html`));
    const made = spawnSync("tar", ["-czf", "-", "-C", `${root}/build`, "."]);
    expect(made.status).toBe(0);
    const problems = archiveProblems(made.stdout, NOTICES).join("; ");
    expect(problems).toMatch(/has a time or an owner/);
    expect(problems).toMatch(/link\.html is neither a file nor a folder/);
    expect(problems).toMatch(/holds no NOTICE at its root/);
  });
});

describe("the recipe's script", () => {
  it("writes the archive of build/ into dist/, and checks it against a second build", () => {
    const root = fixture();
    const again = fixture();
    expect(run("--check", `${again}/build`, root)).toBe(0);
    expect(existsSync(`${root}/dist`)).toBe(false);
    expect(run("--name", "v0.1.0", root)).toBe(0);
    expect(run("v0.1.0", undefined, root)).toBe(0);
    const archive = readFileSync(`${root}/dist/app_v0.1.0.tar.gz`);
    expect(archiveProblems(archive, NOTICES)).toEqual([]);
  });

  it("writes nothing for a version not vX.Y.Z, nor for a build out of the layout", () => {
    const root = fixture();
    expect(run("0.1.0", undefined, root)).toBe(1);
    expect(run("--name", "0.1", root)).toBe(1);
    expect(existsSync(`${root}/dist`)).toBe(false);
    const broken = fixture((build) => writeFileSync(`${build}/deployment.json`, "{}"));
    expect(run("v0.1.0", undefined, broken)).toBe(1);
    expect(run("--check", `${root}/build`, broken)).toBe(1);
    expect(existsSync(`${broken}/dist`)).toBe(false);
  });

  it("refuses a second build that is not the same bytes, a check with none, and missing notices", () => {
    const root = fixture();
    const other = fixture((build) =>
      writeFileSync(`${build}/assets/index-a.js`, "console.log(2);\n"),
    );
    expect(run("--check", `${other}/build`, root)).toBe(1);
    expect(run("--check", undefined, root)).toBe(1);
    rmSync(`${root}/NOTICE`);
    // A line and the code 1, not a stack.
    expect(run("v0.1.0", undefined, root)).toBe(1);
  });
});
