import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../theme/theme.css";
import { inLanguage } from "../test/language.tsx";
import { HomeScreen } from "./MySubjects.tsx";

describe("Home while its subjects are read", () => {
  it("shows the shapes of Next up and of two cards, busy, and says Loading; then the content in their place", async () => {
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

  it("shows a card's kind, counts, squares and foot as shapes while its map comes", async () => {
    const card = { moduleId: "m", digest: "d", title: "M" };
    const { rerender } = render(
      inLanguage(<HomeScreen connected={[{ ...card, counting: true }]} />),
    );
    const article = screen.getByRole("article");
    expect(article.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(article.querySelectorAll(".nt-sk").length).toBe(4);
    expect(article.querySelector(".nt-subject-kind")).toBeNull();
    const counts = {
      mastered: 1,
      "time-to-review": 0,
      "in-progress": 0,
      "ready-to-start": 2,
      locked: 0,
      "feedback-by-criteria": 0,
      "not-assessed": 0,
    };
    rerender(inLanguage(<HomeScreen connected={[{ ...card, skills: counts as never }]} />));
    expect(article.querySelector(".nt-sk")).toBeNull();
    expect(article.querySelectorAll(".nt-dots i").length).toBe(3);
  });
});
