// Without a wish for less motion, a button's colours change in a short transition (section 3.9).
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import "./theme.css";
import { Offline } from "../boot/Screens.tsx";
import { inLanguage } from "../test/language.tsx";

describe("motion", () => {
  it("is there when nobody asked for less", () => {
    expect(matchMedia("(prefers-reduced-motion: no-preference)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    expect(getComputedStyle(button).transitionDuration).toBe("0.15s, 0.15s");
  });
});
