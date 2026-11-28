// The screens for whoever asked for less motion (WCAG 2.3.3), a mode of the browser's context
// from the start: no transition moves, and the card of a Check gone on to a later model on the
// sheet stands still — no spinner turns, no ring pulses, the track steps in at once.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";
import { readingCloser } from "../test/sheet.tsx";

describe("reduced motion", () => {
  it("is asked for, and a button has no transition", () => {
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0s");
  });

  it("keeps the sheet's card of a closer reading still, with no animation", () => {
    const { container } = render(inLanguage(readingCloser()));
    for (const selector of [".nt-spin", ".nt-card-sign", ".nt-track > *"]) {
      for (const element of container.querySelectorAll<HTMLElement>(selector)) {
        expect(getComputedStyle(element).animationName).toBe("none");
      }
    }
    expect(container.querySelectorAll(".nt-track > *").length).toBe(5);
  });
});
