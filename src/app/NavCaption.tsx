// What a place of the row of places shows (R79): its icon, filled while it is the page, and its
// words below it — on a phone the tab bar's, the same.
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";

/**
 * Whether a place shows its icon alone, its words hidden to the eye, as from 600 CSS px to 72em:
 * then a tooltip of the words names it (R90 spec).
 */
export function captionHidden(place: HTMLElement): boolean {
  const label = place.querySelector(".nt-nav-label");
  return label !== null && label.getBoundingClientRect().width <= 1;
}

export function NavCaption({
  icon,
  text,
  chosen = false,
}: {
  readonly icon: IconValue;
  readonly text: string;
  readonly chosen?: boolean;
}) {
  return (
    <>
      <span className="nt-nav-icon">
        <Icon value={icon} chosen={chosen} />
      </span>
      <span className="nt-nav-label">{text}</span>
    </>
  );
}
