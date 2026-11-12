// The bar above the pages of a group of screens — the section for adults, the legal pages (R29 and
// R31 in docs/decisions.md): the group's name, a way back to its first page on any other, and a way
// out of it. Each button is a target of its own with its words on it (section 3.9).
import type { Route } from "./hash.ts";
import { navigate } from "./router.ts";

/** A button of the bar: its words, and where it goes. */
export interface BarButton {
  readonly text: string;
  readonly to: Route;
}

export function PageBar({
  title,
  back,
  close,
}: {
  readonly title: string;
  /** Back to the group's first page: none on that page itself. */
  readonly back?: BarButton;
  readonly close: BarButton;
}) {
  return (
    <header className="nt-bar">
      <p>{title}</p>
      {back === undefined ? null : (
        <button type="button" className="nt-secondary" onClick={() => navigate(back.to)}>
          {back.text}
        </button>
      )}
      <button type="button" className="nt-secondary" onClick={() => navigate(close.to)}>
        {close.text}
      </button>
    </header>
  );
}
