// A screen that shows the app's log while the console speaks as it draws: the log tells it of the
// line a moment later, and the same line again is a repeat with no news, so the screen draws a few
// times and stops instead of drawing itself without end.
import { render, screen } from "@testing-library/react";
import { StrictMode, useSyncExternalStore } from "react";
import { afterEach, expect, it } from "vitest";
import * as journal from "./journal.ts";

afterEach(journal.reset);

let draws = 0;

/** Shows the log, and warns each time it draws. */
function Loud() {
  const lines = useSyncExternalStore(journal.subscribe, journal.snapshot);
  draws++;
  console.warn("drawn again");
  return <output>{lines.map((l) => `${l.text} ×${l.repeats + 1}`).join("; ")}</output>;
}

it("lets a screen that speaks as it draws show the log, and stops", async () => {
  journal.install(window);
  draws = 0;
  render(
    <StrictMode>
      <Loud />
    </StrictMode>,
  );
  await new Promise((later) => setTimeout(later, 10 * journal.NEWS_MS));
  expect(draws).toBeLessThan(10);
  journal.note("info", "app", "news");
  expect(await screen.findByText(/^drawn again ×\d+; news ×1$/)).toBeVisible();
});
