// The picture of a work, for `StoredWork.picture` (section 15 of the text of the contracts): the
// canvas draws it, as it draws the sheet and the crop, by `exportPicture()` of an element that
// holds the work's history and stands on no page — the strokes alone, black on white, whatever its
// task (R83 in canvas; row 5.14 of COORDINATION.md in spec). So a work closed, whose screen has gone,
// and one that the storage switched on sends from the device, are drawn the same way.
import "@altnovatrail/canvas";
import type { Draw } from "./stored.ts";

export const drawPicture: Draw = async (history) => {
  const element = document.createElement("novatrail-canvas");
  element.history = history;
  return element.exportPicture();
};
