// A screen drawn as the mockup's legal text (R69), for the pages of that kind, which the mockup
// draws as one sheet over the screen they were opened from and app as screens of their own: the
// legal pages, a module's license and the page on the tutor. A white card, the whole screen on a
// phone, whose head is the page's heading at 24 bold with a chip under it — a text's version —, a
// way back before it where the pages have a list to go back to, and the close at its other end, ×
// on a grey circle.
import type { ReactNode } from "react";
import { IconButton } from "./IconButton.tsx";
import { Screen } from "./Screen.tsx";

export interface SheetScreenProps {
  readonly title: string;
  /** What the chip under the heading says: a text's version, or the standard of Accessibility. */
  readonly chip?: string;
  /** The way back before the heading: `IconButton` "back" with its caption. */
  readonly back?: ReactNode;
  /** What the close does; none, and the sheet has no close, as a page drawn alone in its test. */
  readonly onClose?: () => void;
  readonly children?: ReactNode;
}

export function SheetScreen({ title, chip, back, onClose, children }: SheetScreenProps) {
  return (
    <Screen
      title={title}
      layout="sheet"
      head={{
        back,
        close:
          onClose === undefined ? undefined : (
            <IconButton value="close" className="nt-sheet-close" onClick={onClose} />
          ),
        under: chip === undefined ? undefined : <p className="nt-version-chip">{chip}</p>,
      }}
    >
      {children}
    </Screen>
  );
}
