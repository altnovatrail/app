// "Continue" of a lesson (R06 and its second 2026-11-17 amendment): enabled at once, in the slot of
// a worked example's canvas when it is given one, and only aria-disabled while "lesson done" is
// under way, so that it keeps the focus and does nothing.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { ContinueButton } from "./LessonScreen.tsx";

describe("Continue", () => {
  it("continues on a press, and stands in the slot it is given", async () => {
    const onContinue = vi.fn();
    render(inLanguage(<ContinueButton slot="actions" pending={false} onContinue={onContinue} />));
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).toHaveAttribute("slot", "actions");
    await userEvent.click(button);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("does nothing while lesson done is under way, and keeps the focus", async () => {
    const onContinue = vi.fn();
    render(inLanguage(<ContinueButton pending onContinue={onContinue} />));
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button).not.toHaveAttribute("slot");
    expect(button).toHaveAttribute("aria-disabled", "true");
    // Playwright presses no aria-disabled button: the press is the page's own.
    button.focus();
    button.click();
    expect(onContinue).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
  });
});
