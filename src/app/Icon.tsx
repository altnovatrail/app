// An icon of a button, from the module scripts/icons.ts writes (R15 in docs/decisions.md; R78 in
// spec): hidden from assistive technology, since the button's label beside it is its name, without
// a <title>, and in the colour of the text, so that forced colours give it the button's own.
import "./Icon.css";
import { ICONS, type IconValue, VALUES } from "./icons.ts";

export interface IconProps {
  /** The value the button stands for. */
  readonly value: IconValue;
  /** Whether the button's value is chosen: then the icon is the fill, where the value has one. */
  readonly chosen?: boolean;
}

/** The icon of a value, 1em square; mirrored in a line that runs right to left, if the value is. */
export function Icon({ value, chosen = false }: IconProps) {
  const { outline, filled, mirrored } = VALUES[value];
  const { viewBox, paths } = ICONS[chosen ? filled : outline];
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox={viewBox}
      width="1em"
      height="1em"
      fill="currentColor"
      data-mirrored={mirrored ? "" : undefined}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
