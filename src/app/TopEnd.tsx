// What a segment of a screen puts at the end of the screen's top bar, beside the profile's pill: the
// pill of the task's mode in a lesson, whose bar is the lesson's (R65 in docs/decisions.md). The
// screen gives the place, an element of its bar; the segment draws into it by a portal.
import { createContext, type ReactNode, useContext } from "react";
import { createPortal } from "react-dom";

const TopEndContext = createContext<HTMLElement | null>(null);

/** The place at the end of the top bar, for what the children draw there; none while it is not laid. */
export function TopEndProvider({
  place,
  children,
}: {
  readonly place: HTMLElement | null;
  readonly children: ReactNode;
}) {
  return <TopEndContext value={place}>{children}</TopEndContext>;
}

/** What stands at the end of the screen's top bar, while the screen gives a place for it. */
export function AtTopEnd({ children }: { readonly children: ReactNode }) {
  const place = useContext(TopEndContext);
  return place === null ? null : createPortal(children, place);
}
