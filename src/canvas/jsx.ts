// The element <novatrail-canvas> in React's JSX, by the contract's types of app's own copy of
// @altnovatrail/spec. canvas types its element by a copy of its own, and the types being
// structural, ElementHoldsContract below fails to compile when the two part ways: in a .d.ts file
// skipLibCheck would silence it.
// React 19 sets a property the element has, and listens for an event by the name after `on`, as
// the element sends it: lower case. Neither `null` nor undo() and clear() are part of it. `lang` is
// no option, and one of the build's languages, which canvas's table of labels has: without it the
// element's scroll container would say its name in the page's language, against WCAG 3.1.2,
// and with a tag the table has not, its buttons would be English on a screen in another language.

import type { NovatrailCanvas } from "@altnovatrail/canvas";
import type {
  CanvasElement,
  DemoChangeEvent,
  GridChangeEvent,
  HistoryChangeEvent,
  ToolChangeEvent,
  TracingChangeEvent,
  TracingReadEvent,
} from "@altnovatrail/spec/canvas";
import type { Key, ReactNode, Ref } from "react";
import type { Language } from "../i18n/language.ts";

/** True when each type is assignable to the other. */
type Mutual<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Holds<T extends true> = T;

/**
 * The element canvas registers holds the contract of app's copy of spec, member by member, both
 * ways: a member whose type drifted in either copy is a type error here, in ci-lint.
 */
export type ElementHoldsContract = Holds<
  Mutual<Pick<NovatrailCanvas, keyof CanvasElement>, CanvasElement>
>;

/** What app gives the element in JSX. */
export interface CanvasProps
  extends Partial<
    Pick<
      CanvasElement,
      | "tool"
      | "task"
      | "workedExample"
      | "demoState"
      | "manifest"
      | "media"
      | "paper"
      | "tracing"
      | "reading"
      | "grid"
      | "history"
      | "marks"
    >
  > {
  readonly key?: Key;
  readonly ref?: Ref<CanvasElement>;
  /** The language of the element's own buttons: the screen's. */
  readonly lang: Language;
  readonly className?: string;
  /** A worked example's buttons of app, each `slot="actions"`, in the element's row. */
  readonly children?: ReactNode;
  readonly onhistorychange?: (event: HistoryChangeEvent) => void;
  readonly ontoolchange?: (event: ToolChangeEvent) => void;
  readonly ondemochange?: (event: DemoChangeEvent) => void;
  readonly ontracingchange?: (event: TracingChangeEvent) => void;
  readonly ontracingread?: (event: TracingReadEvent) => void;
  readonly ongridchange?: (event: GridChangeEvent) => void;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "novatrail-canvas": CanvasProps;
    }
  }
}
