// The tutor's panel of the task screen and of an essay (R67): over the canvas on a tablet, a
// sheet over the row and the canvas's bar of tools on a phone, its grabber, its ×, the tutor's
// button and the step's pill that open it, its head with the share of the quota, and the verdict a
// line in it.
import "@altnovatrail/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { NO_VERDICTS, type Verdicts, verdictsOf } from "./attempt.ts";
import { EssayScreen } from "./EssayScreen.tsx";
import { initialState, type Mode, type StepsState } from "./steps.ts";
import { TaskScreen } from "./TaskScreen.tsx";

const TASK: open.Task = {
  id: "dots",
  statement: [{ text: "How many dots are there in row 10?" }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  givens: ["Row 1 has 2 dots."],
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

const STEPS: readonly open.Step[] = [
  { title: "Understand the task", gives: ["givens"], exit_condition: "givens_ticked" },
  { title: "Solve it", exit_condition: "none" },
];

const ESSAY: open.Task = {
  id: "umbrella",
  statement: [{ text: "Write three first sentences." }],
  canvas: { kind: "handwriting_sheet", grid: "lines" },
  items: [{ answer_slots: [{ binding: "sheet" }] }],
};

const noMedia = () => Promise.reject(new Error("no file in this test"));

const NOT_YET: Verdicts = verdictsOf(
  [
    {
      verdict: "not_yet",
      answerSlots: [{ answerSlot: { item: 1, slot: 1 }, verdict: "not_yet", value: "32" }],
    },
  ] as unknown as Parameters<typeof verdictsOf>[0],
  TASK,
);

/** The task screen with its panel's state its own, as Task.tsx holds it. */
function Drawn({
  mode: from = "steps",
  open: opened = true,
  verdicts = NO_VERDICTS,
  words,
  onDone = () => {},
}: {
  readonly mode?: Mode;
  readonly open?: boolean;
  readonly verdicts?: Verdicts;
  readonly words?: string;
  readonly onDone?: () => void;
}) {
  const [mode, setMode] = useState(from);
  const [open, setOpen] = useState(opened);
  const [state, setState] = useState<StepsState>(initialState(from));
  return (
    <TaskScreen
      task={TASK}
      manifest={undefined}
      steps={STEPS}
      catalog={undefined}
      state={{ ...state, mode, wrongAnswers: words === undefined ? 0 : 1 }}
      mode={mode}
      verdicts={verdicts}
      filled={[[true]]}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={false}
      blink={false}
      panelOpen={open}
      onPanel={() => setOpen((was) => !was)}
      quota="Tutor time today: 20% used"
      {...(words === undefined ? {} : { tutorWords: words, onExplain: () => {} })}
      onHistoryChange={() => {}}
      onMode={setMode}
      onGoTo={() => {}}
      onTick={(chip) =>
        setState((now) => ({
          ...now,
          ticked: { ...now.ticked, givens: chip === "unknown" ? now.ticked.givens : [chip] },
        }))
      }
      onDone={onDone}
      onChoose={() => {}}
      onCheck={() => {}}
      onHint={() => setOpen(true)}
      onAgain={() => {}}
      onHome={() => {}}
    />
  );
}

const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const canvas = () => document.querySelector("novatrail-canvas") as HTMLElement;
const row = () => document.querySelector(".nt-task-row") as HTMLElement;
const lines = () => document.querySelector(".nt-task-lines") as HTMLElement;

/** The panel's coming in, ended: its box is read where it stays. */
const settled = () =>
  Promise.all(document.getAnimations().map((each) => each.finished.catch(() => {})));

afterEach(async () => {
  await page.viewport(1194, 834);
});

describe("the tutor's panel on a tablet", () => {
  it("stands over the canvas, which keeps the window's width, the lines and the row clear of it", async () => {
    await page.viewport(1194, 834);
    render(inLanguage(<Drawn />));
    const aside = screen.getByRole("complementary", { name: "Tutor" });
    await settled();
    const box = aside.getBoundingClientRect();
    expect(box.width).toBeCloseTo(400, 0);
    expect(box.right).toBeCloseTo(1194 - 16, 0);
    expect(box.top).toBeCloseTo(74, 0);
    expect(box.bottom).toBeCloseTo(834 - 16, 0);
    // The canvas moves for no panel, as under the debug window: its right part is under the glass.
    const sheet = canvas().getBoundingClientRect();
    expect(sheet.left).toBeCloseTo(0, 0);
    expect(sheet.right).toBeCloseTo(1194, 0);
    expect(canvas()).not.toHaveAttribute("tools-hidden");
    expect(lines().getBoundingClientRect().right).toBeLessThanOrEqual(box.left + 0.5);
    expect(row()).toBeVisible();
    expect(row().getBoundingClientRect().right).toBeLessThanOrEqual(box.left + 0.5);
    // Its head: the tutor's name, the learner's share of the quota, the voicing and ×; no grabber.
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
    expect(panel().getByText("Tutor time today: 20% used")).toBeVisible();
    expect(panel().queryByRole("button", { name: "Full screen" })).toBeNull();
    // Open, the panel stands in place of the tutor's button and of the step's pill.
    expect(screen.queryByRole("button", { name: "Tutor" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Open the tutor/ })).toBeNull();
  });

  it("closes by ×, gives the step's pill and the tutor's button, either of which opens it", async () => {
    const done = vi.fn();
    render(inLanguage(<Drawn onDone={done} />));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    const pill = screen.getByRole("button", {
      name: "Step 1 of 2: Understand the task. Open the tutor",
    });
    // The pill's Step done is the step's: closed till the givens are ticked, and said why.
    const stepDone = screen.getByRole("button", { name: "Step done" });
    expect(stepDone).toHaveAttribute("aria-disabled", "true");
    expect(stepDone).toHaveAccessibleDescription("Mark what we know and what to find");
    stepDone.click();
    expect(done).not.toHaveBeenCalled();
    await userEvent.click(pill);
    expect(screen.getByRole("complementary", { name: "Tutor" })).toBeVisible();
    // The focus goes with neither press to the page: into the panel, and back to the tutor's button.
    expect(document.activeElement).toBe(panel().getByRole("heading", { name: "Tutor" }));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    const tutor = screen.getByRole("button", { name: "Tutor" });
    expect(tutor).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(tutor);
    await userEvent.click(tutor);
    expect(screen.getByRole("complementary", { name: "Tutor" })).toBeVisible();
    expect(document.activeElement).toBe(panel().getByRole("heading", { name: "Tutor" }));
  });

  it("opens the list of the steps from the step's line, and folds it again", async () => {
    render(inLanguage(<Drawn />));
    const line = panel().getByRole("button", { name: "Step 1 of 2" });
    expect(line).toHaveAttribute("aria-expanded", "false");
    expect(panel().queryByRole("list", { name: "Steps" })).toBeNull();
    await userEvent.click(line);
    expect(line).toHaveAttribute("aria-expanded", "true");
    const steps = panel().getByRole("list", { name: "Steps" });
    expect(within(steps).getAllByRole("listitem")[0]).toHaveTextContent(
      "1. Understand the task (now)",
    );
    await userEvent.click(line);
    expect(panel().queryByRole("list", { name: "Steps" })).toBeNull();
  });

  it("gives the verdict a line in the open panel, and a card over the row once it is closed", async () => {
    render(inLanguage(<Drawn mode="self" verdicts={NOT_YET} words="Count the steps again." />));
    const talk = within(panel().getByRole("region", { name: "Conversation" }));
    expect(talk.getByText("Not yet")).toBeVisible();
    expect(talk.getByText("Read: 32")).toBeVisible();
    expect(talk.getByText("Count the steps again.")).toBeVisible();
    // The words of a rung are a hint, as the mockup marks them; Explain differently at the foot.
    expect(talk.getByText("Hint", { selector: ".nt-bubble-label" })).toBeVisible();
    expect(panel().getByRole("button", { name: "Explain differently" })).toBeVisible();
    expect(document.querySelector(".nt-card-verdict")).toBeNull();
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    const card = document.querySelector(".nt-card-verdict") as HTMLElement;
    expect(within(card).getByText("Not yet")).toBeVisible();
    expect(within(card).getByRole("button", { name: "Try again" })).toBeVisible();
  });
});

describe("the tutor's sheet on a phone", () => {
  it("hides the row and the canvas's bar of tools while it is open, at half the height", async () => {
    await page.viewport(390, 844);
    render(inLanguage(<Drawn />));
    const aside = screen.getByRole("complementary", { name: "Tutor" });
    await settled();
    const box = aside.getBoundingClientRect();
    expect(box.left).toBe(0);
    expect(box.width).toBe(390);
    expect(box.bottom).toBe(844);
    expect(box.height).toBeCloseTo(844 * 0.51, 0);
    expect(canvas()).toHaveAttribute("tools-hidden");
    expect(row()).not.toBeVisible();
    // The grabber takes it over the whole screen, 70 below the top, and back.
    const grab = panel().getByRole("button", { name: "Full screen" });
    expect(grab).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(grab);
    await settled();
    expect(aside.getBoundingClientRect().top).toBeCloseTo(70, 0);
    const half = panel().getByRole("button", { name: "Half screen" });
    expect(half).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(half);
    expect(aside.getBoundingClientRect().height).toBeCloseTo(844 * 0.51, 0);
    // Closed, the row and the bar come back, the tutor's button above them.
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    expect(canvas()).not.toHaveAttribute("tools-hidden");
    expect(row()).toBeVisible();
    const tutor = screen.getByRole("button", { name: "Tutor" }).getBoundingClientRect();
    expect(tutor.bottom).toBeLessThanOrEqual(844 - 172 + 0.5);
    expect(tutor.right).toBeCloseTo(390 - 16, 0);
  });

  it("opens over the whole screen again at half the height", async () => {
    await page.viewport(390, 844);
    render(inLanguage(<Drawn />));
    await userEvent.click(panel().getByRole("button", { name: "Full screen" }));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: /Open the tutor/ }));
    expect(panel().getByRole("button", { name: "Full screen" })).toBeVisible();
  });
});

/** The screen of an essay on my own, its feedback given by the test. */
function EssayDrawn({ feedback }: { readonly feedback?: string }) {
  return (
    <EssayScreen
      task={ESSAY}
      manifest={undefined}
      steps={[]}
      catalog={undefined}
      state={initialState("self")}
      mode="self"
      filled={[[true]]}
      history={[]}
      media={noMedia}
      notSaved={false}
      pending={false}
      checking={false}
      blink={false}
      came={false}
      mayFinish
      {...(feedback === undefined ? {} : { feedback })}
      onHint={() => {}}
      onHistoryChange={() => {}}
      onMode={() => {}}
      onGoTo={() => {}}
      onTick={() => {}}
      onDone={() => {}}
      onAgain={() => {}}
      onHome={() => {}}
      onCheck={() => {}}
      onFinish={() => {}}
    />
  );
}

describe("the tutor's panel of an essay", () => {
  it("opens by the tutor's button, closes by ×, and stays closed as feedback comes", async () => {
    const { rerender } = render(inLanguage(<EssayDrawn />));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    rerender(inLanguage(<EssayDrawn feedback="The second sentence works." />));
    // The card says where the feedback is; the panel opens only when called.
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    expect(
      screen.getByText("The feedback is in the tutor's panel. Write again, or press Done."),
    ).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Tutor" }));
    expect(panel().getByText("The second sentence works.")).toBeVisible();
    rerender(inLanguage(<EssayDrawn feedback="The first sentence works too." />));
    expect(panel().getByText("The first sentence works too.")).toBeVisible();
  });
});
