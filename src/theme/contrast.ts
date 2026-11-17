// The contrast of two colours by WCAG 2.2's formula (section 3.9 of docs/architecture.md): the
// relative luminance of each, and (lighter + 0.05) / (darker + 0.05); a translucent colour laid over
// what it stands on first, as the mockup's README, «Contrast», reads its pairs. No DOM.

/** A colour written #rrggbb or rgba(r, g, b, a), its channels 0–255 and its alpha 0–1. */
interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

const HEX = /^#[0-9a-f]{6}$/i;
const RGBA = /^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(0|1|0?\.\d+)\s*\)$/;

function parse(colour: string): Rgba {
  if (HEX.test(colour)) {
    const [r, g, b] = [1, 3, 5].map((at) => Number.parseInt(colour.slice(at, at + 2), 16)) as [
      number,
      number,
      number,
    ];
    return { r, g, b, a: 1 };
  }
  const match = RGBA.exec(colour);
  const channels = match?.slice(1, 4).map(Number) ?? [];
  if (match === null || channels.some((channel) => channel > 255)) {
    throw new Error(`not a colour #rrggbb or rgba(r, g, b, a): ${colour}`);
  }
  const [r, g, b] = channels as [number, number, number];
  return { r, g, b, a: Number(match[4]) };
}

function hex({ r, g, b }: Rgba): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * The colour seen where colours lie one over another, the top first and the last opaque: each laid
 * over the one under it by its alpha, as #rrggbb.
 */
export function over(...layers: readonly string[]): string {
  const ground = layers.at(-1);
  if (ground === undefined || parse(ground).a !== 1) {
    throw new Error(`the last of the layers is not opaque: ${layers.join(" over ")}`);
  }
  const seen = layers.slice(0, -1).reduceRight((under, layer) => {
    const top = parse(layer);
    const mix = (a: number, b: number) => Math.round(a * top.a + b * (1 - top.a));
    return { r: mix(top.r, under.r), g: mix(top.g, under.g), b: mix(top.b, under.b), a: 1 };
  }, parse(ground));
  return hex(seen);
}

/** The relative luminance of a colour written #rrggbb, by WCAG's definition. */
export function luminance(colour: string): number {
  if (!HEX.test(colour)) throw new Error(`not a colour #rrggbb: ${colour}`);
  const { r, g, b } = parse(colour);
  const [red, green, blue] = [r, g, b].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** The contrast ratio of two colours, from 1 to 21, whichever is lighter. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * The colour tokens of a stylesheet: `--nt-name: #rrggbb;` or `--nt-name: rgba(r, g, b, a);`, by
 * their names; a token whose value is no colour alone, a size or a shadow, is not one.
 */
export function tokens(css: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of css.matchAll(
    /--nt-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6}|rgba\([\d\s.,]+\))\s*;/g,
  )) {
    parse(value as string);
    found.set(name as string, (value as string).toLowerCase());
  }
  return found;
}
