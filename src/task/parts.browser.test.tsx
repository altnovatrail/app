// The parts of the task screen on their edges, in Chromium: a solution without pictures' sizes, a
// picture whose file does not come, a module without a language, a step without a description, a
// task with only the unknown, a technique the catalog does not name, the last step, an item without
// text and with two slots, and a workbook, whose lines the canvas shows.
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { inLanguage } from "../test/language.tsx";
import { NO_VERDICTS, verdictsOf } from "./attempt.ts";
import { Items } from "./Items.tsx";
import { Solution } from "./Solution.tsx";
import { StepsPanel } from "./StepsPanel.tsx";
import { initialState } from "./steps.ts";

const TASK: open.Task = {
  id: "find",
  statement: [{ text: "Find it." }],
  canvas: { kind: "handwriting_sheet" },
  unknown: "The number",
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

describe("the solution", () => {
  it("shows a picture without its sizes, and the alt of one whose file does not come", async () => {
    const picture = new Blob([new Uint8Array([1])], { type: "image/png" });
    const media = vi.fn(async (ref: string) => {
      if (ref === "gone.png") throw new Error("no file");
      return picture;
    });
    render(
      inLanguage(
        <Solution
          parts={[
            { picture: "dots.png" },
            { picture: "gone.png", alt: "Gone" },
            { picture: "plain.png" },
          ]}
          language={undefined}
          media={media}
        />,
      ),
    );
    const region = screen.getByRole("region", { name: "Solution" });
    await vi.waitFor(() => expect(region.querySelectorAll("img").length).toBe(2));
    const image = region.querySelector("img") as HTMLImageElement;
    expect(image.hasAttribute("width")).toBe(false);
    expect(image.getAttribute("alt")).toBe("");
    expect(within(region).getByText("Gone")).toBeVisible();
    expect(region.querySelector("[lang]")).toBeNull();
  });

  it("is nothing for a task without one, and asks no file once it has gone", async () => {
    let answer: (blob: Blob) => void = () => {};
    const media = () => new Promise<Blob>((resolve) => (answer = resolve));
    const { container, unmount } = render(
      inLanguage(<Solution parts={[]} language="en" media={media} />),
    );
    expect(container.textContent).toBe("");
    unmount();
    const shown = render(
      inLanguage(<Solution parts={[{ picture: "late.png" }]} language="en" media={media} />),
    );
    shown.unmount();
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    answer(new Blob([new Uint8Array([1])]));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe("the panel of steps", () => {
  const steps: readonly open.Step[] = [
    { title: "Understand", gives: ["givens"], exit_condition: "givens_ticked" },
    { title: "Plan", gives: ["techniques"], exit_condition: "none" },
    { title: "Check", exit_condition: "none" },
  ];
  const panel = (state: ReturnType<typeof initialState>, catalog?: open.Techniques) =>
    render(
      inLanguage(
        <StepsPanel
          task={TASK}
          steps={steps}
          catalog={catalog}
          state={state}
          filled={null}
          language={undefined}
          onGoTo={() => {}}
          onTick={() => {}}
          onDone={() => {}}
        />,
      ),
    );

  it("shows the unknown alone when the task gives no givens", () => {
    panel(initialState("steps"));
    expect(screen.getByRole("group", { name: "What to find" })).toBeVisible();
    expect(screen.queryByRole("group", { name: "What we know" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Understand" })).not.toHaveAttribute("lang");
  });

  it("shows only the techniques the catalog names, and a technique without a description", () => {
    const state = {
      ...initialState("steps"),
      place: 2,
      reached: 2,
      techniques: { 2: ["draw", "lost"] },
    };
    panel(state, { techniques: { draw: { title: "Draw it" } } });
    const list = screen.getByRole("list", { name: "Techniques" });
    expect(within(list).getAllByRole("listitem").length).toBe(1);
    expect(within(list).getByText("Draw it")).toBeVisible();
    // A step whose condition is none has no line of what opens it.
    expect(screen.getByRole("button", { name: "Step done" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });

  it("shows no techniques without a catalog, and none at all when api gave none", () => {
    const state = { ...initialState("steps"), place: 2, reached: 2, techniques: { 2: ["draw"] } };
    const shown = panel(state);
    expect(screen.queryByRole("list", { name: "Techniques" })).toBeNull();
    shown.unmount();
    const none = { ...state, techniques: { 2: [] } };
    panel(none, { techniques: { draw: { title: "Draw it" } } });
    expect(screen.queryByRole("list", { name: "Techniques" })).toBeNull();
  });

  it("has no Step done at the last step, which ends with Check", () => {
    panel({ ...initialState("steps"), place: 3, reached: 3 });
    expect(screen.queryByRole("button", { name: "Step done" })).toBeNull();
    expect(screen.getByRole("button", { name: /Plan/ })).toBeVisible();
  });

  it("shows nothing at a place past the steps", () => {
    const { container } = panel({ ...initialState("steps"), place: 4, reached: 4 });
    expect(container.textContent).toBe("");
  });
});

describe("the items", () => {
  it("names an item without text by its place, and each of its two slots", () => {
    const task: open.Task = {
      ...TASK,
      items: [
        { text: "Draw it.", answer_slots: [{ binding: "anywhere" }] },
        { answer_slots: [{ binding: "anywhere" }] },
        {
          answer_slots: [
            { binding: "choice", options: ["a", "b"] },
            { binding: "choice", options: ["c", "d"] },
          ],
        },
      ],
    };
    const verdicts = verdictsOf([], task);
    render(
      inLanguage(
        <Items
          task={task}
          choices={{}}
          verdicts={verdicts}
          language={undefined}
          locked={false}
          onChoose={() => {}}
        />,
      ),
    );
    expect(screen.getByText("Draw it.")).toBeVisible();
    expect(screen.queryByText("Item 2")).toBeNull();
    const third = screen.getByRole("group", { name: "Item 3" });
    expect(within(third).getByRole("group", { name: "Answer 2" })).toBeVisible();
    expect(within(third).getByRole("radio", { name: "c" })).toBeVisible();
  });

  it("shows nothing for a workbook, whose lines the canvas shows", () => {
    const { container } = render(
      inLanguage(
        <Items
          task={{ ...TASK, canvas: { kind: "workbook" }, items: [{ line: [{ binding: "box" }] }] }}
          choices={{}}
          verdicts={NO_VERDICTS}
          language="en"
          locked={false}
          onChoose={() => {}}
        />,
      ),
    );
    expect(container.textContent).toBe("");
  });
});
