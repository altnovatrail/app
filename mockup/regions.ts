// What a compared state of the interface mockup is made of (R58 in docs/decisions.md): its regions,
// each a pair of places — one in the mockup, one in app's screen —, the sizes of the mockup and
// the differences the comparison reports. Types and constants alone, which both the screen test in
// the browser and scripts/mockup.ts in Node take.

/** The two sizes of the mockup, in CSS px (its README, "How to open it"). */
export const SIZES = { ipad: [1194, 834], phone: [390, 844] } as const;

export type Device = keyof typeof SIZES;

export const DEVICES = Object.keys(SIZES) as Device[];

/**
 * How a region is found on its side: by its ARIA role and its accessible name, whole; by a part of
 * its text, which a line break does not part; or by CSS.
 */
export type Find =
  | { readonly role: string; readonly name: string }
  | { readonly text: string }
  | { readonly css: string };

/** A property of a region that the comparison reads. */
export type Property =
  | "box"
  | "background"
  | "border"
  | "radius"
  | "colour"
  | "font-size"
  | "font-weight";

/** The properties that hold a colour. */
export type ColourProperty = "background" | "border" | "colour";

/** One region of a compared state: the pair of places, in the mockup and in app, and how to read it. */
export interface Region {
  /** What it is, as the report names it. */
  readonly name: string;
  readonly mockup: Find;
  readonly app: Find;
  /**
   * The width follows the caption: the region is compared by its height, its y and the x of this
   * edge alone.
   */
  readonly followsText?: "start" | "centre" | "end";
  /**
   * A colour of the mockup that app draws otherwise by the README's «Contrast»: the mockup has to
   * show the first and app the second.
   */
  readonly contrast?: readonly {
    readonly property: ColourProperty;
    readonly mockup: string;
    readonly app: string;
  }[];
  /**
   * What app draws otherwise by a row of the README's «Where it differs from the documents» or by
   * a decision, which `by` names: a difference of these properties is reported, not held.
   */
  readonly differs?: { readonly what: readonly (Property | "missing")[]; readonly by: string };
}

/** One difference of a region: what differs, and the two sides' values. */
export interface Difference {
  readonly region: string;
  readonly what: Property | "missing";
  readonly mockup: string;
  readonly app: string;
  /** The row or decision under which app draws it otherwise: a difference reported, not held. */
  readonly by?: string;
}
