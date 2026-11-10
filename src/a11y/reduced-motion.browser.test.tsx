// The screens for whoever asked for less motion (WCAG 2.3.3; section 3.9 of docs/architecture.md),
// a mode of the browser's context from the start: no transition moves. The blink of Check comes
// with the task screen (T24) and its test here.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "../theme/theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";

describe("reduced motion", () => {
  it("is asked for, and a button has no transition", () => {
    expect(matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0s");
  });
});
