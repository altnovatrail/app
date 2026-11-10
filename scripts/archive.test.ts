import { describe, expect, it } from "vitest";
import { DEPLOYMENT_ARCHIVE, deploymentPart, partText, tarFiles } from "./archive.ts";

/** A tar header block: name, size, type and prefix, as ustar lays them out. */
function header(name: string, size: number, type: string, prefix = ""): Buffer {
  const block = Buffer.alloc(512);
  block.write(name, 0, 100, "utf8");
  block.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  block.write(type, 156, 1, "ascii");
  block.write("ustar\0", 257, 6, "ascii");
  block.write(prefix, 345, 155, "utf8");
  return block;
}

/** An entry: its header and its body, padded to a block. */
function entry(name: string, body: string, type = "0", prefix = ""): Buffer {
  const bytes = Buffer.from(body, "utf8");
  const padded = Buffer.alloc(Math.ceil(bytes.length / 512) * 512);
  bytes.copy(padded);
  return Buffer.concat([header(name, bytes.length, type, prefix), padded]);
}

/** A pax record: its length, counted with itself, then `key=value` and a newline. */
function record(key: string, value: string): string {
  const rest = ` ${key}=${value}\n`;
  let length = rest.length + 1;
  while (String(length).length + rest.length !== length) length += 1;
  return `${length}${rest}`;
}

describe("tarFiles", () => {
  it("reads regular files, by a ustar prefix or a pax path, and passes over the rest", () => {
    const tar = Buffer.concat([
      entry("pax_global_header", record("comment", "abc"), "g"),
      entry("dir/", "", "5"),
      entry("a.txt", "A", "0", "dir"),
      entry("short", record("path", "long/path/b.txt"), "x"),
      entry("short", "B"),
      entry("link", "", "2"),
      entry("c.txt", "C", ""),
      Buffer.alloc(1024),
      entry("after-the-end", "Z"),
    ]);
    const files = tarFiles(tar);
    expect([...files.keys()]).toEqual(["dir/a.txt", "long/path/b.txt", "c.txt"]);
    expect(files.get("long/path/b.txt")?.toString()).toBe("B");
  });

  it("forgets a pax path that gave no file, and one that names no path", () => {
    const tar = Buffer.concat([
      entry("x1", record("path", "lost.txt"), "x"),
      entry("d/", "", "5"),
      entry("x2", record("mtime", "1"), "x"),
      entry("kept.txt", "K"),
    ]);
    expect([...tarFiles(tar).keys()]).toEqual(["kept.txt"]);
  });
});

describe("deploymentPart", () => {
  it("holds the part of the release file, by its paths within the part", () => {
    const part = deploymentPart();
    expect(partText(part, "VERSION")).toBe("1\n");
    expect(part.has("schemas/deployment.schema.json")).toBe(true);
    expect(() => partText(part, "nothing")).toThrow(`${DEPLOYMENT_ARCHIVE} holds no nothing`);
  });
});
