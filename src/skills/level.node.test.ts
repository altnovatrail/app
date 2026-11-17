// The level of a module on the scale of its bands, and the bands next to it (R157 in spec; R56).
import type * as open from "@altnovatrail/spec/formatv0/open";
import { describe, expect, it } from "vitest";
import { levelOf } from "./level.ts";

const band = (id: string): open.Band => ({ id, title: `Band ${id}` });
const BANDS = [band("a"), band("b"), band("c")];

describe("levelOf", () => {
  it("names the bands before and after the band of the level", () => {
    expect(levelOf("b", BANDS)).toEqual({ band: BANDS[1], easier: BANDS[0], harder: BANDS[2] });
  });

  it("has no Easier at the lowest band, and no Harder at the highest", () => {
    expect(levelOf("a", BANDS)).toEqual({ band: BANDS[0], harder: BANDS[1] });
    expect(levelOf("c", BANDS)).toEqual({ band: BANDS[2], easier: BANDS[1] });
    expect(levelOf("a", [band("a")])).toEqual({ band: band("a") });
  });

  it("offers the lowest band as Harder while the level stands below it", () => {
    expect(levelOf("", BANDS)).toEqual({ harder: BANDS[0] });
  });

  it("has no level for a manifest with no bands, or one that does not name the band", () => {
    expect(levelOf("", undefined)).toBeUndefined();
    expect(levelOf("a", [])).toBeUndefined();
    expect(levelOf("z", BANDS)).toBeUndefined();
  });
});
