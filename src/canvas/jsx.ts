// The element <novatrail-canvas> in React's JSX, as its contract with app has it (R74 in spec;
// section 3.1 of docs/architecture.md). The types are spec's, of @altnovatrail/spec/canvas at the
// tag of the spec submodule, 0.15.0; canvas's element is typed by its own copy, 0.12.0. The types
// being structural, ElementHoldsContract below fails to compile when the two part ways (R73 in
// spec; R15).
// React 19 sets a property the element has, and listens for an event by the name after `on`, as
// the element sends it: lower case. Neither `null` nor undo() and clear() are part of it.

import type { NovatrailCanvas } from "@altnovatrail/canvas";
import type {
  CanvasElement,
  DemoChangeEvent,
  HistoryChangeEvent,
  ToolChangeEvent,
} from "@altnovatrail/spec/canvas";
import type { Key, Ref } from "react";

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
      "tool" | "task" | "workedExample" | "demoState" | "manifest" | "media" | "history" | "marks"
    >
  > {
  readonly key?: Key;
  readonly ref?: Ref<CanvasElement>;
  /** The language of the element's own buttons. */
  readonly lang?: string;
  readonly className?: string;
  readonly onhistorychange?: (event: HistoryChangeEvent) => void;
  readonly ontoolchange?: (event: ToolChangeEvent) => void;
  readonly ondemochange?: (event: DemoChangeEvent) => void;
}

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "novatrail-canvas": CanvasProps;
    }
  }
}
