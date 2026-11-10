import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { LanguageButtons } from "./LanguageButtons.tsx";
import type { Language } from "./language.ts";
import { Phrase } from "./Phrase.tsx";

describe("LanguageButtons", () => {
  it("names each language in its own language, presses the chosen one, and chooses on a tap", async () => {
    const choose = vi.fn<(language: Language) => void>();
    render(inLanguage(<LanguageButtons />, "ru", undefined, choose));
    const group = page.getByRole("group", { name: "Язык" });
    await expect.element(group).toBeVisible();
    const english = page.getByRole("button", { name: "English" });
    const russian = page.getByRole("button", { name: "Русский" });
    await expect.element(english).toHaveAttribute("lang", "en");
    await expect.element(english).toHaveAttribute("aria-pressed", "false");
    await expect.element(russian).toHaveAttribute("lang", "ru");
    await expect.element(russian).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(english.element());
    expect(choose).toHaveBeenCalledWith("en");
  });
});

describe("Phrase", () => {
  it("puts elements in the places of a string, with their own language", () => {
    render(
      inLanguage(
        <p data-testid="phrase">
          <Phrase id="app.document-title" values={{ screen: <span lang="ru">Нет связи</span> }} />
        </p>,
      ),
    );
    const phrase = screen.getByTestId("phrase");
    expect(phrase.textContent).toBe("Нет связи — NovaTrail");
    expect(phrase.querySelector("span")?.getAttribute("lang")).toBe("ru");
  });

  it("leaves a place without a value as it is", () => {
    render(
      inLanguage(
        <p data-testid="phrase">
          <Phrase id="app.document-title" values={{} as { screen: string }} />
        </p>,
      ),
    );
    expect(screen.getByTestId("phrase").textContent).toBe("{screen} — NovaTrail");
  });
});
