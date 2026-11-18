// A module's level on the scale of its bands, as the skill map gives it (R157 spec; R99 spec; R56):
// the band of the level, `level_band`, among the bands of the manifest of the module's current
// version, in their order from the easiest, and the bands next to it, which the adult's "Easier"
// and "Harder" name to `SetModuleLevel`. An empty `level_band` is a level below the lowest band:
// "Harder" names the lowest, and there is no "Easier". No DOM.
import type * as open from "@altnovatrail/spec/formatv0/open";

/** A module's level and the bands next to it. */
export interface Level {
  /** The band of the level; none while the level stands below the lowest band. */
  readonly band?: open.Band;
  /** The band before it, one easier; none at the lowest band and below it. */
  readonly easier?: open.Band;
  /** The band after it, one harder; none at the highest band. */
  readonly harder?: open.Band;
}

/**
 * The level of a module by the band the skill map names and the bands of its manifest: none when
 * the manifest has no bands, or does not name the band — which a band's ID kept in every version of
 * a module rules out, and a correction could only be refused.
 */
export function levelOf(
  levelBand: string,
  bands: readonly open.Band[] | undefined,
): Level | undefined {
  if (bands === undefined || bands.length === 0) return undefined;
  if (levelBand === "") {
    const lowest = bands[0];
    return lowest === undefined ? undefined : { harder: lowest };
  }
  const at = bands.findIndex((band) => band.id === levelBand);
  if (at < 0) return undefined;
  const easier = bands[at - 1];
  const harder = bands[at + 1];
  return {
    band: bands[at] as open.Band,
    ...(easier === undefined ? {} : { easier }),
    ...(harder === undefined ? {} : { harder }),
  };
}
