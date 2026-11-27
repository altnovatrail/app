// The grabber of a phone's sheet in the browser: a tap turns the sheet, a drag sets it at the size
// nearer where it is let go and the click its release sends turns nothing, a cancelled drag keeps
// the size, and a press of a second finger or of another pointer than the drag's is no drag.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { useGrabber } from "./grabber.ts";

function Sheet({ full, setFull }: { full: boolean; setFull: (full: boolean) => void }) {
  const grab = useGrabber(".sheet", full, setFull);
  return (
    <div className="sheet" style={{ height: "400px" }}>
      <button type="button" {...grab}>
        Grabber
      </button>
    </div>
  );
}

function sheetOf(full = false) {
  const setFull = vi.fn();
  render(<Sheet full={full} setFull={setFull} />);
  const grabber = screen.getByRole("button", { name: "Grabber" });
  const sheet = grabber.parentElement as HTMLElement;
  return { setFull, grabber, sheet };
}

const at = (y: number, pointerId = 1, isPrimary = true) => ({ clientY: y, pointerId, isPrimary });

beforeEach(() => page.viewport(390, 800));
afterEach(async () => {
  cleanup();
  await page.viewport(414, 896);
});

it("turns the sheet by a tap", () => {
  const { setFull, grabber } = sheetOf();
  fireEvent.pointerDown(grabber, at(400));
  fireEvent.pointerUp(grabber, at(401));
  fireEvent.click(grabber);
  expect(setFull).toHaveBeenCalledExactlyOnceWith(true);
});

it("sets the sheet nearer where a drag lets it go, and the release's click turns nothing", () => {
  const { setFull, grabber, sheet } = sheetOf();
  fireEvent.pointerDown(grabber, at(400));
  fireEvent.pointerMove(grabber, at(100));
  expect(sheet.style.blockSize).not.toBe("");
  fireEvent.pointerUp(grabber, at(100));
  fireEvent.click(grabber);
  expect(setFull).toHaveBeenCalledExactlyOnceWith(true);
  expect(sheet.style.blockSize).toBe("");
});

it("keeps the size of a drag the browser cancels", () => {
  const { setFull, grabber, sheet } = sheetOf(true);
  fireEvent.pointerDown(grabber, at(10));
  fireEvent.pointerMove(grabber, at(500));
  fireEvent.pointerCancel(grabber, at(500));
  expect(setFull).not.toHaveBeenCalled();
  expect(sheet.style.blockSize).toBe("");
});

it("takes no second finger, and no move or release of another pointer than the drag's", () => {
  const { setFull, grabber, sheet } = sheetOf();
  fireEvent.pointerDown(grabber, at(400, 2, false));
  fireEvent.pointerMove(grabber, at(100, 2, false));
  expect(sheet.style.blockSize).toBe("");
  fireEvent.pointerDown(grabber, at(400));
  fireEvent.pointerMove(grabber, at(100, 3));
  fireEvent.pointerUp(grabber, at(100, 3));
  expect(sheet.style.blockSize).toBe("");
  expect(setFull).not.toHaveBeenCalled();
});
