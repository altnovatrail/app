// The notices the page of notices shows are the repository's NOTICE and LICENSE as they are: the
// same bytes the release check holds the archive's two files to (R25, R31).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LICENSE, NOTICE } from "./notices.ts";

describe("the notices of the build", () => {
  it("are NOTICE and LICENSE of the repository, as they are", () => {
    expect(NOTICE).toBe(readFileSync("NOTICE", "utf8"));
    expect(LICENSE).toBe(readFileSync("LICENSE", "utf8"));
    expect(NOTICE).toContain("NovaTrail app");
    expect(LICENSE).toContain("Apache License");
  });
});
