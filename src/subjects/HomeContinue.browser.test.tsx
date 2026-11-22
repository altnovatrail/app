import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import "../theme/theme.css";
import { inLanguage } from "../test/language.tsx";
import { HomeScreen } from "./MySubjects.tsx";

const card = { moduleId: "a/m", digest: "d", title: "M", skill: "a/m/skill/s" };

describe("a module's Continue on Home", () => {
  it("goes on with the module's lesson begun from its card", async () => {
    const onLesson = vi.fn();
    render(
      inLanguage(
        <HomeScreen
          connected={[{ moduleId: "a/m", digest: "d", title: "M" }]}
          runs={[{ lessonRunId: "r1", module: "M", moduleId: "a/m" }]}
          onLesson={onLesson}
        />,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onLesson).toHaveBeenCalledWith("r1");
  });

  it("goes on with the module's task open", async () => {
    const onContinue = vi.fn();
    const onPractise = vi.fn();
    render(
      inLanguage(
        <HomeScreen
          connected={[card]}
          openTask={{ kind: "module", moduleId: "a/m" }}
          onContinue={onContinue}
          onPractise={onPractise}
        />,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    expect(onContinue).toHaveBeenCalled();
    expect(onPractise).not.toHaveBeenCalled();
  });

  it("works on the skill the card names when the module has no lesson begun nor task open", async () => {
    const onPractise = vi.fn();
    render(
      inLanguage(
        <HomeScreen
          connected={[card]}
          openTask={{ kind: "module", moduleId: "b/other" }}
          onContinue={() => {}}
          onPractise={onPractise}
        />,
      ),
    );
    await userEvent.click(screen.getByRole("button", { name: /^Continue$/ }));
    expect(onPractise).toHaveBeenCalledWith("a/m/skill/s", "a/m");
  });
});
