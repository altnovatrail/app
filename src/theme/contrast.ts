// The contrast of two colours by WCAG 2.2's formula (section 3.9 of docs/architecture.md): the
// relative luminance of each, and (lighter + 0.05) / (darker + 0.05). No DOM.

/** The relative luminance of a colour written #rrggbb, by WCAG's definition. */
export function luminance(hex: string): number {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`not a colour #rrggbb: ${hex}`);
  const [r, g, b] = [1, 3, 5].map((at) => {
    const channel = Number.parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast ratio of two colours, from 1 to 21, whichever is lighter. */
export function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

/** The colour tokens of a stylesheet's `:root`: `--nt-name: #rrggbb;`, by their names. */
export function tokens(css: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/--nt-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    found.set(name as string, (value as string).toLowerCase());
  }
  return found;
}
