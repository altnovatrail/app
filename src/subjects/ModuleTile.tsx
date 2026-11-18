// A module's tile (R62): the first letter of its title on one of the mockup's gradients, by the
// module's ID, so that a module has the same tile on every screen and device — its card in My
// subjects and the end of its lesson (R64).

/** The gradients of the mockup's tiles of modules, one by the module's ID. */
const TONES = 3;

/** The tone of a module's tile: the same for a module on every screen and device. */
function toneOf(moduleId: string): number {
  let hash = 0;
  for (const char of moduleId) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  return hash % TONES;
}

/**
 * A module's tile, the first letter of its title on a gradient: decoration alone, which 1.4.3
 * excepts, its letter drawn by CSS from `data-glyph` and hidden from assistive technology.
 */
export function ModuleTile({
  moduleId,
  title,
  className,
}: {
  readonly moduleId: string;
  readonly title: string;
  /** Its own size beside the card's: the end of a lesson's. */
  readonly className?: string;
}) {
  const glyph = Array.from(title)[0]?.toUpperCase() ?? "";
  return (
    <span
      className={className === undefined ? "nt-module-tile" : `nt-module-tile ${className}`}
      aria-hidden="true"
      data-tone={toneOf(moduleId)}
      data-glyph={glyph}
    />
  );
}
