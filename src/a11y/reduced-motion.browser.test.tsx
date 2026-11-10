// The screens for whoever asked for less motion (WCAG 2.3.3; section 3.9 of docs/architecture.md),
// a mode of the browser's context from the start: no transition moves, and Check on a pause is a
// still outline, not a blink (the 2026-11-02 amendment to R05).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";
import { blinkingCheck } from "../test/task.tsx";

describe("reduced motion", () => {
  it("is asked for, and a button has no transition", () => {
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0s");
  });

  it("shows Check on a pause as a still outline, with no animation", () => {
    render(inLanguage(blinkingCheck()));
    const check = page.getByRole("button", { name: "Check" }).element() as HTMLElement;
    expect(check).toHaveClass("nt-blink");
    const style = getComputedStyle(check);
    expect(style.animationName).toBe("none");
    expect(style.outlineStyle).toBe("solid");
  });
});
