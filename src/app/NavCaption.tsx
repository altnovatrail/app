// What a place of the side menu shows (R79): its icon, filled while it is the page, and its words
// below it — on a phone the tab bar's, the same.
import { Icon } from "./Icon.tsx";
import type { IconValue } from "./icons.ts";

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
