// A change of the pen and the eraser for the tests in the browser, told as an element tells it.
import type { CanvasElement, PenSettings } from "@altnovatrail/spec/canvas";

/**
 * The learner's change in the popovers of an element, told as the element tells it: from canvas's
 * settings, the liner in use, red and thinner, and the eraser that takes a part.
 */
export function changePens(element: CanvasElement): PenSettings {
  const now = element.pens;
  const liner = { ...now.styles.liner, color: "#e53935", width: 1.5 };
  const pens: PenSettings = Object.freeze({
    ...now,
    pen: "liner",
    styles: { ...now.styles, liner },
    eraser: "part",
  });
  element.dispatchEvent(
    new CustomEvent("penchange", { detail: pens, bubbles: true, composed: true }),
  );
  return pens;
}
