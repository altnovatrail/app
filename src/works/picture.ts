// The picture of a stored work, `StoredWork.picture`: the canvas draws it, as it draws the sheet and
// the crop, by exportPicture() of an element that holds the work's history and stands on no page —
// the strokes alone, black on white, whatever its task. So a work closed, whose screen
// has gone, and one sent from the device once its storage is switched on are drawn the same way.
import "@altnovatrail/canvas";
import type { CanvasElement } from "@altnovatrail/spec/canvas";
import type { Draw } from "./stored.ts";

export const drawPicture: Draw = async (history) => {
  const element: CanvasElement = document.createElement("novatrail-canvas");
  element.history = history;
  return element.exportPicture();
};
