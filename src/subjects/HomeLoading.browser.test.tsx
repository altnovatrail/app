import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../theme/theme.css";
import { inLanguage } from "../test/language.tsx";
import { HomeScreen } from "./MySubjects.tsx";

describe("Home while its subjects are read", () => {
  it("shows the shapes of Next up and of two cards, busy, and says Loading; then the content in their place (R168 spec)", async () => {
    const { rerender } = render(inLanguage(<HomeScreen connected={undefined} />));
    const busy = document.querySelectorAll('[aria-busy="true"]');
    expect(busy.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Loading")).toBe(true);
    expect(document.querySelectorAll(".nt-sk").length).toBeGreaterThan(10);
    // The screen's own words stand as they will.
    expect(screen.getByRole("heading", { name: "Next up" })).toBeVisible();
    rerender(inLanguage(<HomeScreen connected={[]} />));
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(document.querySelector(".nt-sk")).toBeNull();
  });
});
