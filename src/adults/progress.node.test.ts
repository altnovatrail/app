// The reason code of a choice of a task: no screen of the app reads it or words it, since no page
// of the section for adults shows a profile's progress now; the learner's screens never did.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every file of the app's code under src/, with its path from src/, tests and helpers aside. */
async function sources(): Promise<{ path: string; text: string }[]> {
  const root = join(import.meta.dirname, "..");
  const found: { path: string; text: string }[] = [];
  for (const entry of await readdir(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.test\.tsx?$/.test(entry.name)) {
      continue;
    }
    const path = join(entry.parentPath, entry.name).slice(root.length + 1);
    if (path.startsWith("test/")) continue;
    found.push({ path, text: await readFile(join(root, path), "utf8") });
  }
  return found;
}

describe("the reason code of a choice", () => {
  it("is read and worded nowhere in the app, nor is a profile's progress asked for", async () => {
    const files = await sources();
    expect(files.length).toBeGreaterThan(50);
    const reading = (pattern: RegExp) =>
      files.filter((file) => pattern.test(file.text)).map((file) => file.path);
    expect(reading(/getProgress\b|\breasonCode\b|\bReasonCode\b|progress\.reason-/)).toEqual([]);
  });
});
