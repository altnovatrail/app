import { describe, expect, it } from "vitest";
import { described } from "./described.ts";

describe("aria-describedby of a field", () => {
  it("names the IDs shown, and none is no attribute", () => {
    expect(described("hint", false, "error")).toBe("hint error");
    expect(described(false)).toBeUndefined();
    expect(described()).toBeUndefined();
  });
});
