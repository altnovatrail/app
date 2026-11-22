// "Back to Home" (R57): home by default, what the screen gives otherwise, and nothing while
// a request of the screen is under way.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { HomeButton, HomeWay } from "./HomeButton.tsx";

const home = () => screen.getByRole("button", { name: "Back to Home" });

afterEach(() => {
  window.location.hash = "";
});

describe("the way back to Home", () => {
  it("goes home", async () => {
    window.location.hash = "#/skill-map";
    render(inLanguage(<HomeWay />));
    expect(home().parentElement).toHaveClass("nt-buttons");
    expect(home()).toHaveClass("nt-secondary");
    expect(home()).not.toHaveAttribute("aria-disabled");
    await userEvent.click(home());
    expect(window.location.hash).toBe("#/home");
  });

  it("does what the screen gives, and nothing while its request is under way", async () => {
    const onPress = vi.fn();
    const { rerender } = render(inLanguage(<HomeButton onPress={onPress} pending />));
    expect(home()).toHaveAttribute("aria-disabled", "true");
    // Playwright waits for a button aria-disabled to open: the press goes to the element itself.
    home().focus();
    home().click();
    expect(onPress).not.toHaveBeenCalled();
    expect(home()).toHaveFocus();
    rerender(inLanguage(<HomeButton onPress={onPress} />));
    await userEvent.click(home());
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("is named in Russian on a Russian screen", () => {
    render(inLanguage(<HomeButton />, "ru"));
    expect(screen.getByRole("button", { name: "На главную" })).toBeVisible();
  });
});
