// A module's card on Home: its kind, how many are mastered, its map described by its title, a
// square for each skill, and its two ways in — the tile of its lesson, with its step, Continue and
// the row to its lessons, and the tile of its tasks, with Solve and the choice of their skill: the
// tutor's, the skills suggested and each tier's, a locked one shut, and the learner's own, given
// back by the tutor's in the pick. A module with no lessons has the tile of its tasks alone, one on the sheet no choice,
// the tiles are shapes while the map or the lessons come, and a module with no current version has
// no way in.
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { HomeCard, type HomeCardProps } from "./HomeCard.tsx";
import type { LessonTile, ModuleCard, SkillPicks } from "./modules.ts";
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
const M = "novatrail/olympiad-math";
const PICKS: SkillPicks = {
  suggested: [{ skill: `${M}/skill/gaps`, title: "Counting gaps", status: "time-to-review" }],
  tiers: [
    {
      name: "Warm-up",
      skills: [
        { skill: `${M}/skill/gaps`, title: "Counting gaps", status: "time-to-review" },
        { skill: `${M}/skill/pairs`, title: "Pairs", status: "mastered" },
      ],
    },
    { skills: [{ skill: `${M}/skill/towers`, title: "Towers", status: "locked" }] },
  ],
};
const LESSON: LessonTile = {
  lesson: `${M}/lesson/patterns`,
  title: "Patterns that grow",
  step: 2,
  segments: 5,
  open: true,
};
const MATH: ModuleCard = {
  moduleId: M,
  digest: D1,
  title: "Olympiad maths",
  language: "en",
  skills: { ...NONE, mastered: 3, "time-to-review": 2, locked: 5 },
  picks: PICKS,
  lesson: LESSON,
};

function card(value: ModuleCard, props: Partial<Omit<HomeCardProps, "card">> = {}) {
  render(
    inLanguage(
      <ul>
        <HomeCard
          card={value}
          onLesson={() => {}}
          onLessons={() => {}}
          onSolve={() => {}}
          onTaskSkill={() => {}}
          {...props}
        />
      </ul>,
    ),
  );
  return screen.getByRole("article", { name: value.title });
}

afterEach(() => {
  window.location.hash = "";
});

describe("a module's card on Home", () => {
  it("names the module, its skills and its lesson, and goes on by each of its buttons", async () => {
    const onLesson = vi.fn();
    const onLessons = vi.fn();
    const onSolve = vi.fn();
    const article = card(MATH, { onLesson, onLessons, onSolve });
    expect(within(article).getByText("Adaptive")).toBeVisible();
    expect(within(article).getByText("3 of 10 mastered")).toBeVisible();
    expect(within(article).getByRole("img").querySelectorAll("i")).toHaveLength(10);
    const lesson = within(article).getByRole("region", { name: "Lesson" });
    expect(within(lesson).getByText(/^Patterns that grow/)).toHaveAttribute("lang", "en");
    expect(within(lesson).getByText("Step 2 of 5 · in the author's order")).toBeVisible();
    await userEvent.click(
      within(lesson).getByRole("button", { name: "Continue", description: "Patterns that grow" }),
    );
    expect(onLesson).toHaveBeenCalledWith(LESSON);
    await userEvent.click(
      within(lesson).getByRole("button", {
        name: "Lesson Patterns that grow",
        description: "Every lesson of Olympiad maths",
      }),
    );
    expect(onLessons).toHaveBeenCalledOnce();
    const tasks = within(article).getByRole("region", { name: "Tasks" });
    expect(within(tasks).getByText(/^The tutor picks the skill/)).toBeVisible();
    expect(within(tasks).getByText("As the work goes, by your progress")).toBeVisible();
    await userEvent.click(
      within(tasks).getByRole("button", { name: "Solve", description: "Olympiad maths" }),
    );
    expect(onSolve).toHaveBeenCalledOnce();
    const map = within(article).getByRole("button", { name: "Skill map" });
    expect(map).toHaveAccessibleDescription("Olympiad maths");
    await userEvent.click(map);
    expect(window.location.hash).toContain("novatrail");
  });

  it("offers the tutor's choice, the skills suggested and each tier's, a locked one shut", async () => {
    const onTaskSkill = vi.fn();
    card({ ...MATH, sequential: true }, { onTaskSkill });
    expect(screen.getByText("Sequential")).toBeVisible();
    const row = () =>
      screen.getByRole("button", {
        name: "Tasks The tutor picks the skill",
        description: "Choose which tasks to solve",
      });
    await userEvent.click(row());
    const pick = screen.getByRole("dialog", { name: "Which tasks to solve?" });
    expect(within(pick).getByRole("button", { name: /The tutor chooses/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The tutor's choice is told by its tick, with no underline.
    const tutor = within(pick).getByRole("button", { name: /The tutor chooses/ });
    expect(getComputedStyle(tutor).textDecorationLine).toBe("none");
    expect(tutor.querySelector("svg")).not.toBeNull();
    const suggested = within(pick).getByRole("group", { name: "Suggested" });
    expect(within(suggested).getByRole("button", { name: "Counting gaps" })).toBeEnabled();
    expect(within(pick).getByRole("group", { name: "Warm-up" })).toBeVisible();
    // A tier the graph gives no name is named by its number.
    const second = within(pick).getByRole("group", { name: "Tier 2" });
    expect(
      within(second).getByRole("button", { name: "Towers, locked until the skills it builds on" }),
    ).toBeDisabled();
    // The tutor's choice again changes nothing.
    await userEvent.click(within(pick).getByRole("button", { name: /The tutor chooses/ }));
    expect(onTaskSkill).not.toHaveBeenCalled();
    await userEvent.click(row());
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Pairs" }),
    );
    expect(onTaskSkill).toHaveBeenCalledWith(`${M}/skill/pairs`);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the learner's own skill, and gives the choice back to the tutor", async () => {
    const onTaskSkill = vi.fn();
    card({ ...MATH, taskSkill: `${M}/skill/pairs` }, { onTaskSkill });
    const tasks = screen.getByRole("region", { name: "Tasks" });
    expect(within(tasks).getByText("Tasks · your skill")).toBeVisible();
    expect(within(tasks).getByText(/^Pairs/)).toHaveAttribute("lang", "en");
    expect(within(tasks).getByText("Tasks on this skill alone")).toBeVisible();
    await userEvent.click(
      within(tasks).getByRole("button", {
        name: "Tasks · your skill Pairs",
        description: "Choose which tasks to solve",
      }),
    );
    const pick = screen.getByRole("dialog");
    expect(within(pick).getByRole("button", { name: "Pairs" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // The choice is told by its bold words, with no underline.
    const chosen = getComputedStyle(within(pick).getByRole("button", { name: "Pairs" }));
    expect(chosen.textDecorationLine).toBe("none");
    expect(Number(chosen.fontWeight)).toBeGreaterThan(400);
    await userEvent.click(within(pick).getByRole("button", { name: /The tutor chooses/ }));
    expect(onTaskSkill).toHaveBeenCalledExactlyOnceWith("");
    // The tile has no button of its own to give the choice back: the pick holds it.
    expect(within(tasks).getAllByRole("button")).toHaveLength(2);
  });

  it("names a task skill its graph has not by its ID, and with no graph offers no choice", () => {
    const { picks: _, ...bare } = MATH;
    card({ ...bare, taskSkill: `${M}/skill/gone` });
    expect(screen.getByText(/^gone/)).toBeVisible();
    expect(screen.queryByRole("button", { description: "Choose which tasks to solve" })).toBeNull();
  });

  it("has the tile of its tasks alone with no lessons, and no choice on the sheet", () => {
    card({ ...MATH, lesson: null, sheet: true, taskSkill: `${M}/skill/pairs` });
    expect(screen.queryByRole("region", { name: "Lesson" })).toBeNull();
    expect(screen.getByText(/^The tutor picks the skill/)).toBeVisible();
    expect(screen.queryByRole("button", { description: "Choose which tasks to solve" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Solve", description: "Olympiad maths" }),
    ).toBeVisible();
  });

  it("shapes its tiles while its lessons come", () => {
    const { lesson: _, ...coming } = MATH;
    card(coming);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByRole("button", { name: /Solve/ })).toBeNull();
  });

  it("has no way in, nor a map, with no current version", () => {
    const { digest: _, ...unversioned } = MATH;
    const article = card({ ...unversioned, skills: { ...NONE, "feedback-by-criteria": 4 } });
    expect(within(article).getByText("Feedback by criteria")).toBeVisible();
    expect(within(article).getByText(/Not available now/)).toBeVisible();
    expect(within(article).queryByRole("button")).toBeNull();
  });
});
