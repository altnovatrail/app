// The settings of the pen and the eraser across the elements of one tab: each new element of the
// learner takes what the learner chose on the one before, another learner's starts with canvas's,
// and nothing of them is stored.
import "@altnovatrail/canvas";
import type { CanvasElement } from "@altnovatrail/spec/canvas";
import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { type Learner, LearnerProvider } from "../account/AccountGate.tsx";
import { changePens } from "../test/pens.ts";
import { forgetPens, usePens } from "./pens.ts";

function Sheet({ sheet }: { readonly sheet: React.Ref<CanvasElement> }) {
  return <novatrail-canvas ref={sheet} lang="en" {...usePens()} />;
}

/** The element of a learner, or of none, alone on the page. */
function renderSheet(profileId?: string): CanvasElement {
  cleanup();
  const sheet = createRef<CanvasElement>();
  const element = <Sheet sheet={sheet} />;
  const learner = { learner: { profileId } } as Learner;
  render(
    profileId === undefined ? (
      element
    ) : (
      <LearnerProvider value={learner}>{element}</LearnerProvider>
    ),
  );
  if (sheet.current === null) throw new Error("no sheet");
  return sheet.current;
}

/** The learner's change on an element, and the screen rendered after it. */
function change(element: CanvasElement) {
  let pens: ReturnType<typeof changePens> | undefined;
  act(() => {
    pens = changePens(element);
  });
  if (pens === undefined) throw new Error("no change");
  return pens;
}

describe("the pens", () => {
  it("go from an element to the learner's next one, which takes them as its own", () => {
    const first = renderSheet("p1");
    const canvas = first.pens;
    const chosen = change(first);
    // The element that told them is given them back, and keeps them.
    expect(first.pens).toEqual(chosen);
    const next = renderSheet("p1");
    expect(next).not.toBe(first);
    expect(next.pens).toEqual(chosen);
    expect(next.pens).not.toEqual(canvas);
  });

  it("are canvas's for another learner, and for the first again once forgotten", () => {
    const first = renderSheet("p1");
    const canvas = first.pens;
    change(first);
    expect(renderSheet("p2").pens).toEqual(canvas);
    act(() => forgetPens());
    expect(renderSheet("p1").pens).toEqual(canvas);
  });

  it("go between the elements of a screen with no learner, as in a screen's own test", () => {
    const chosen = change(renderSheet());
    expect(renderSheet().pens).toEqual(chosen);
  });

  it("are stored nowhere: neither the tab's storage nor the device's knows them", async () => {
    change(renderSheet("p1"));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    expect(await indexedDB.databases()).toEqual([]);
  });
});
