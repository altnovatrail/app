// Without a wish for less motion, a button's colours change in a short transition, and Check on a
// pause blinks once: three flashes of a second, shorter than 5 s (section 3.9).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "./theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";
import { blinkingCheck } from "../test/task.tsx";

describe("motion", () => {
  it("is there when nobody asked for less", () => {
    expect(matchMedia("(prefers-reduced-motion: no-preference)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0.15s, 0.15s");
  });

  it("blinks Check once on a pause, three times a second at most", () => {
    render(inLanguage(blinkingCheck()));
    const check = page.getByRole("button", { name: "Check" }).element() as HTMLElement;
    const style = getComputedStyle(check);
    expect(style.animationName).toBe("nt-blink");
    expect(style.animationDuration).toBe("1s");
    expect(style.animationIterationCount).toBe("3");
  });
});
