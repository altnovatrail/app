// The lesson's screen (R06, R23, R64 and R06): its top bar — Back that leaves the lesson, the
// lesson's title and the line of the segment shown, which opens the segments in a pop-over hung
// from the bar's pill —, the row with "Continue", enabled at once, in the slot of a worked
// example's canvas when it is given one, and only aria-disabled while "lesson done" is under way,
// so that it keeps the focus and does nothing; and the end of a lesson, a card with the module's
// tile.
import { RunEndReason } from "@altnovatrail/contracts/novatrail/api/v1/cause_pb.js";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import { inLanguage } from "../test/language.tsx";
import { LessonEnd } from "./Lesson.tsx";
import { ContinueButton, LessonScreen } from "./LessonScreen.tsx";

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

/** The lesson of four segments at its second, the first passed, in the language given. */
function lesson(language: "en" | "ru" = "en") {
  const props = {
    onGoTo: vi.fn(),
    onNote: vi.fn(),
    onLeave: vi.fn(),
    onContinue: vi.fn(),
  };
  render(
    inLanguage(
      <LessonScreen
        title="Number patterns"
        language="en"
        module="Olympiad maths 1–6"
        course={{ kinds: ["explanation", "example", "task", "task"], ended: new Set() }}
        place={2}
        shown={2}
        unsaved={false}
        pending={false}
        {...props}
      >
        <p>The example.</p>
      </LessonScreen>,
      language,
    ),
  );
  return props;
}

describe("the lesson's top bar", () => {
  it("leaves the lesson by its Back, which names where it goes", async () => {
    const { onLeave } = lesson();
    const pill = document.querySelector(".nt-top-pill") as HTMLElement;
    await userEvent.click(within(pill).getByRole("button", { name: "Leave the lesson" }));
    expect(onLeave).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { level: 1, name: "Number patterns" })).toBeVisible();
    // The heading's line is the segment shown; its button is the whole heading, 44 high.
    const line = screen.getByRole("button", {
      name: "Worked example · 2 of 4: segments of the lesson",
    });
    expect(line.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    expect(line.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      (pill.querySelector("h1") as HTMLElement).getBoundingClientRect().width,
    );
  });

  it("opens the segments hung below the pill, and goes to one, or says why it does not open", async () => {
    await page.viewport(1194, 834);
    const { onGoTo, onNote, onLeave } = lesson();
    await userEvent.click(screen.getByRole("button", { name: /segments of the lesson$/ }));
    const dialog = screen.getByRole("dialog", { name: "Segments of the lesson" });
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const pill = (document.querySelector(".nt-top-pill") as HTMLElement).getBoundingClientRect();
    expect(Math.round(dialog.getBoundingClientRect().left)).toBe(Math.round(pill.left));
    expect(Math.round(dialog.getBoundingClientRect().top)).toBe(Math.round(pill.bottom + 6));
    // The lesson and its module, in the module's language.
    expect(within(dialog).getByText("Olympiad maths 1–6")).toHaveAttribute("lang", "en");
    const rows = within(dialog).getAllByRole("listitem");
    expect(rows[1]).toHaveAttribute("aria-current", "step");
    expect(within(rows[0] as HTMLElement).getByRole("button")).toHaveAccessibleName(
      "1 Explanation passed",
    );
    await userEvent.click(within(rows[0] as HTMLElement).getByRole("button"));
    expect(onGoTo).toHaveBeenCalledWith(1);
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: /segments of the lesson$/ }));
    const later = within(screen.getByRole("dialog")).getByRole("button", {
      name: "3 Task Not open yet",
    });
    later.click();
    expect(onNote).toHaveBeenCalledWith("3 Task: not open yet");
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    await userEvent.click(screen.getByRole("button", { name: /segments of the lesson$/ }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Leave the lesson" }),
    );
    expect(onLeave).toHaveBeenCalledOnce();
  });

  it("says it in the screen's language", () => {
    lesson("ru");
    expect(screen.getByRole("button", { name: "Выйти из урока" })).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Пример с разбором · 2 из 4: звенья урока" }),
    ).toBeVisible();
  });
});

describe("the end of a lesson", () => {
  it("is a card with the module's tile and title, the lesson's, and Lesson complete after a star", () => {
    render(
      inLanguage(
        <LessonEnd
          reason={RunEndReason.PASSED}
          title="Number patterns"
          language="en"
          module={{ id: "olympiad-math", title: "Olympiad maths 1–6" }}
        />,
      ),
    );
    const card = document.querySelector(".nt-end > .nt-column") as HTMLElement;
    const tile = card.querySelector(".nt-end-tile") as HTMLElement;
    expect(tile).toHaveAttribute("aria-hidden", "true");
    expect(tile).toHaveAttribute("data-glyph", "O");
    expect(within(card).getByText("Olympiad maths 1–6")).toHaveAttribute("lang", "en");
    expect(within(card).getByRole("heading", { level: 1, name: "Number patterns" })).toBeVisible();
    const done = within(card).getByText("Lesson complete");
    expect(done.querySelector("svg")).not.toBeNull();
    expect(within(card).getByRole("button", { name: "Back to Home" })).toBeVisible();
  });

  it("names how it ended with no star, and no tile with no module", () => {
    render(
      inLanguage(
        <LessonEnd reason={RunEndReason.NOT_SUITABLE} title="Number patterns" language="en" />,
      ),
    );
    expect(document.querySelector(".nt-end-tile")).toBeNull();
    const line = screen.getByText("This lesson doesn't suit this profile any more");
    expect(line.querySelector("svg")).toBeNull();
  });
});
