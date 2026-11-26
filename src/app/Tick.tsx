// A checkbox drawn as the mockup's round mark: the browser's own input, a target of 44, over a
// ring that fills with the accent and shows its tick once ticked; in forced colours, the
// browser's own box.
import type { ReactNode } from "react";
import { Icon } from "./Icon.tsx";

/** The mark around its checkbox, which stands as its only child. */
export function Tick({ children }: { readonly children: ReactNode }) {
  return (
    <span className="nt-tick">
      {children}
      <span className="nt-tick-mark" aria-hidden="true">
        <Icon value="ticked" />
      </span>
    </span>
  );
}
