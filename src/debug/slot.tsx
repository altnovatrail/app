// The debug button of a local run (R72), where the screens of a task from paper put it. Under
// import.meta.env.DEV alone, which a release's build replaces with false, so that the branch and
// the modules it loads drop out of it, as signin/local.ts does.
import { lazy, Suspense } from "react";

const Debug = import.meta.env.DEV ? lazy(() => import("./DebugButton.tsx")) : undefined;

/** The debug button: above the tutor's place on the screen of solving, at it on the page. */
export function DebugSlot({ above = false }: { readonly above?: boolean }) {
  if (Debug === undefined) return null;
  return (
    <Suspense fallback={null}>
      <Debug above={above} />
    </Suspense>
  );
}
