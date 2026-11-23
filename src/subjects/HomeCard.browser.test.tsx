// A module's card on Home: its kind, how many are mastered, its map and its Continue described
// by its title, a square for each skill; under an adaptive module the tutor's strip with the skills
// due, under a chain the place, the share mastered and the next, past the last no next; none under a
// module of criteria alone, and no buttons for a module with no current version.
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { HomeCard } from "./HomeCard.tsx";
import type { ModuleCard } from "./modules.ts";
import type { SkillCounts } from "./states.ts";

const D1 = `sha256:${"1".repeat(64)}`;
const NONE: SkillCounts = {
  mastered: 0,
  "time-to-review": 0,
  "in-progress": 0,
  "ready-to-start": 0,
  locked: 0,
  "feedback-by-criteria": 0,
  "not-assessed": 0,
};
const MATH: ModuleCard = {
  moduleId: "novatrail/olympiad-math",
  digest: D1,
  title: "Olympiad maths",
  language: "en",
  skills: { ...NONE, mastered: 3, "time-to-review": 2, locked: 5 },
};

function card(value: ModuleCard, onContinue = () => {}) {
  render(
    inLanguage(
      <ul>
        <HomeCard card={value} onContinue={onContinue} />
      </ul>,
    ),
  );
  return screen.getByRole("article", { name: value.title });
}

afterEach(() => {
  window.location.hash = "";
});

describe("a module's card on Home", () => {
  it("names an adaptive module, its skills, and the tutor's choice with the skills due", async () => {
    const onContinue = vi.fn();
    const article = card(MATH, onContinue);
    expect(within(article).getByText("Adaptive")).toBeVisible();
    expect(within(article).getByText("3 of 10 mastered")).toBeVisible();
    expect(within(article).getByRole("img").querySelectorAll("i")).toHaveLength(10);
    expect(within(article).getByText("The tutor chooses")).toBeVisible();
    expect(within(article).getByText("Any module")).toBeVisible();
    // The skills due once, in the strip.
    expect(within(article).getAllByText("2 skills to review")).toHaveLength(1);
    await userEvent.click(within(article).getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledOnce();
    const map = within(article).getByRole("button", { name: "Skill map" });
    expect(map).toHaveAccessibleDescription("Olympiad maths");
    await userEvent.click(map);
    expect(window.location.hash).toContain("novatrail");
  });

  it("puts the place in a chain, the share mastered and the next under a sequential module", () => {
    const article = card({
      ...MATH,
      sequential: true,
      chain: { step: 4, total: 10, mastered: 3, current: "Fractions", next: "Decimals" },
    });
    expect(within(article).getByText("Sequential")).toBeVisible();
    expect(within(article).getByText("Current skill")).toBeVisible();
    expect(within(article).getByText("Fractions")).toHaveAttribute("lang", "en");
    expect(within(article).getByText("30%")).toBeVisible();
    expect(within(article).getByText("Decimals")).toBeVisible();
    expect(within(article).queryByText("The tutor chooses")).toBeNull();
    // Not in the strip, the skills due are beside the title.
    expect(within(article).getByText("2 skills to review")).toBeVisible();
  });

  it("says every skill is mastered past a chain's last, with no next", () => {
    const article = card({
      ...MATH,
      sequential: true,
      skills: { ...NONE, mastered: 10 },
      chain: { step: 10, total: 10, mastered: 10 },
    });
    expect(within(article).getByText("Every skill mastered")).toBeVisible();
    expect(within(article).getByText("100%")).toBeVisible();
    expect(within(article).queryByText("Next")).toBeNull();
  });

  it("has no strip under a module of criteria alone, nor buttons with no current version", () => {
    const { digest: _, ...unversioned } = MATH;
    const article = card({ ...unversioned, skills: { ...NONE, "feedback-by-criteria": 4 } });
    expect(within(article).getByText("Feedback by criteria")).toBeVisible();
    expect(within(article).queryByText("The tutor chooses")).toBeNull();
    expect(within(article).queryByRole("button")).toBeNull();
  });
});
