// Without a wish for less motion, a button's colours change in a short transition, and the card of
// a Check gone on to a later model turns its spinner and pulses its ring.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "./theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";
import { readingCloser } from "../test/sheet.tsx";

describe("motion", () => {
  it("is there when nobody asked for less", () => {
    expect(matchMedia("(prefers-reduced-motion: no-preference)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0.15s, 0.15s");
    expect(getComputedStyle(button).transitionTimingFunction).toBe(
      "cubic-bezier(0.2, 0.8, 0.2, 1), cubic-bezier(0.2, 0.8, 0.2, 1)",
    );
  });

  it("turns the reading's spinner and pulses its ring on the sheet's card", () => {
    const { container } = render(inLanguage(readingCloser()));
    const spin = container.querySelector(".nt-spin") as HTMLElement;
    expect(getComputedStyle(spin).animationName).toBe("nt-spin");
    const sign = container.querySelector(".nt-card-sign") as HTMLElement;
    expect(getComputedStyle(sign).animationName).toBe("nt-ring");
    const now = container.querySelector('.nt-track-dot[data-at="now"]') as HTMLElement;
    expect(getComputedStyle(now).animationName).toBe("nt-step-in, nt-ring");
  });
});
