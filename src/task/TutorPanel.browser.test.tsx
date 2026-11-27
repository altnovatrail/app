// The tutor's panel, the one of every screen: on the task screen and beside an essay, over the
// canvas on a tablet, a sheet over the row and the canvas's bar of tools on a phone, its grabber,
// its ×, the tutor's button and the step's pill that open it, its head with the share of the quota,
// the verdict a line in it, and no field; alone with its field, Enter and Shift+Enter, its growing,
// and its microphone by a fake of the browser's recognition.
import "@altnovatrail/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { flush, reset, snapshot } from "../debug/journal.ts";
import { inLanguage } from "../test/language.tsx";
import {
  FakeRecognition,
  LocalRecognition,
  listening,
  SlowRecognition,
  withRecognition,
} from "../test/recognition.ts";
import { fakeSpeech, voice } from "../test/speech.ts";
import { NO_AUDIO_MS, NO_WORDS_MS } from "../voice/dictation.ts";
import { SpeechProvider } from "../voice/VoicingContext.tsx";
import { NO_VERDICTS, type Verdicts, verdictsOf } from "./attempt.ts";
import { EssayScreen } from "./EssayScreen.tsx";
import { initialState, type Mode, type StepsState } from "./steps.ts";
import { TaskScreen } from "./TaskScreen.tsx";
import { LearnerLine, TutorPanel } from "./TutorPanel.tsx";

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

/** The one panel alone with its field, the kit's microphone as given, and what it sent. */
function Asking({ microphone = true, max = 500 }: { microphone?: boolean; max?: number }) {
  const [sent, setSent] = useState<readonly (readonly [string, boolean])[]>([]);
  return (
    <TutorPanel
      kit={{
        ask: {
          label: "Your question about the task",
          placeholder: "Ask about this task…",
          max,
          ready: (draft) => (draft.trim() === "" ? undefined : draft.trim()),
          off: false,
          microphone,
          language: "en-GB",
          onSend: (text, voice) => setSent((was) => [...was, [text, voice]]),
        },
      }}
      greeting="Ask about this task by text or voice."
      talk={sent.map(([text, voice]) => <LearnerLine key={text} text={text} voice={voice} />)}
    />
  );
}

const field = () => screen.getByRole("textbox", { name: "Your question about the task" });

/**
 * A press of the microphone whose sound never comes, the browser saying the microphone is
 * `state`, read before the press; `then` runs on the page's own timers, faked. `page` keeps what the
 * page learnt of the microphone before, a field gone and come again.
 */
async function deafPress(state: PermissionState, then: () => void, page: "new" | "kept" = "new") {
  if (page === "new") withRecognition(true);
  FakeRecognition.deaf = true;
  const query = vi.spyOn(navigator.permissions, "query").mockResolvedValue({
    state,
    addEventListener() {},
    removeEventListener() {},
  } as never);
  render(inLanguage(<Asking />));
  await waitFor(() => expect(query).toHaveBeenCalled());
  // The answer of the query lands before the press.
  await Promise.resolve();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    then();
  } finally {
    vi.useRealTimers();
    query.mockRestore();
  }
}

describe("the field of the tutor's panel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends by Enter, breaks the line by Shift+Enter, and grows with its lines up to five", async () => {
    withRecognition(false);
    render(inLanguage(<Asking />));
    expect(panel().getByText("Ask about this task by text or voice.")).toBeVisible();
    const one = field().getBoundingClientRect().height;
    await userEvent.type(field(), "Why ten?{Shift>}{Enter}{/Shift}And then?");
    expect(field()).toHaveValue("Why ten?\nAnd then?");
    const two = field().getBoundingClientRect().height;
    expect(two).toBeGreaterThan(one * 1.5);
    await userEvent.type(field(), "{Shift>}{Enter}{Enter}{Enter}{Enter}{Enter}{Enter}{/Shift}");
    // Up to five lines, then it scrolls.
    expect(field().getBoundingClientRect().height).toBeLessThan(one * 5.5);
    expect(field().scrollHeight).toBeGreaterThan(field().clientHeight);
    await userEvent.clear(field());
    await userEvent.type(field(), "Why ten?{Shift>}{Enter}{/Shift}And then?{Enter}");
    expect(field()).toHaveValue("");
    const sent = panel().getByText(/Why ten\?\s+And then\?/);
    expect(sent).toBeVisible();
    // Sent by the keys, not by voice.
    expect(panel().queryByText("By voice")).toBeNull();
    // An empty field sends nothing.
    await userEvent.type(field(), "{Enter}");
    expect(document.querySelectorAll("p.nt-bubble[data-who='learner']")).toHaveLength(1);
  });

  it("puts the voice into the field as it hears it, till Stop, and marks it said by voice", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    await userEvent.type(field(), "Look:");
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    const recognition = listening();
    await waitFor(() => expect(recognition.started).toBe(true));
    expect(recognition.lang).toBe("en-GB");
    // The browser does not say it can recognise on the device: nothing asks it to.
    expect(recognition.processLocally).toBeUndefined();
    expect(recognition.interimResults).toBe(true);
    expect(await panel().findByRole("status")).toHaveTextContent("Listening…");
    expect(panel().queryByRole("button", { name: "Send" })).toBeNull();
    recognition.hear("why is");
    await waitFor(() => expect(field()).toHaveValue("Look: why is"));
    recognition.hear("why is", " the answer ten");
    await waitFor(() => expect(field()).toHaveValue("Look: why is the answer ten"));
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(
      await panel().findByText("From your voice: read it, correct it, then send."),
    ).toBeVisible();
    expect(panel().queryByText("Listening…")).toBeNull();
    await userEvent.click(panel().getByRole("button", { name: "Send" }));
    expect(panel().getByText("Look: why is the answer ten")).toBeVisible();
    expect(panel().getByText("By voice")).toBeVisible();
    // Corrected before Send, it is the learner's own text.
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await waitFor(() => expect(listening().started).toBe(true));
    listening().hear("and then");
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    await userEvent.type(field(), "?");
    expect(panel().queryByText("From your voice: read it, correct it, then send.")).toBeNull();
    await userEvent.type(field(), "{Enter}");
    expect(panel().getByText("and then?")).toBeVisible();
    expect(panel().getAllByText("By voice")).toHaveLength(1);
  });

  it("asks the browser to recognise on the device where it offers that", async () => {
    withRecognition("local");
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await waitFor(() => expect(listening().started).toBe(true));
    expect(listening().processLocally).toBe(true);
    expect(LocalRecognition.asked).toEqual([{ langs: ["en-GB"], processLocally: true }]);
  });

  it("says when it heard nothing, and keeps what the field held", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    await userEvent.type(field(), "Why?");
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    expect(field()).toHaveValue("Why?");
  });

  it("stops the voice, and starts within the press where there is nothing to ask first", async () => {
    withRecognition(true);
    reset();
    const cancel = vi.spyOn(speechSynthesis, "cancel");
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    // No waiting: WebKit has no `available`, and the start is the press's own.
    expect(listening().started).toBe(true);
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
    flush();
    expect(snapshot().some((e) => e.text.startsWith("dictation: started in en-GB,"))).toBe(true);
  });

  it("puts away a listening whose sound never comes, the microphone granted, as one that heard nothing", async () => {
    reset();
    await deafPress("granted", () => {
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(NO_AUDIO_MS - 1);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(1);
    });
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    expect(panel().queryByText("Listening…")).toBeNull();
    expect(panel().getByRole("button", { name: "Dictate" })).toBeVisible();
    flush();
    expect(
      snapshot().some((e) => e.level === "warn" && e.text.startsWith("dictation: no sound")),
    ).toBe(true);
  });

  it("puts away a listening with no sound once the page's microphone gave sound, the field gone and come again", async () => {
    withRecognition(true);
    reset();
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await expect
      .poll(() => {
        flush();
        return snapshot().some((e) => e.text === "dictation: sound began");
      })
      .toBe(true);
    listening().hear("why");
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    cleanup();
    // The browser of an iPad never says the microphone is granted.
    await deafPress(
      "prompt",
      () => {
        vi.advanceTimersByTime(NO_AUDIO_MS);
      },
      "kept",
    );
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    flush();
    const starts = snapshot().filter((e) => e.text.startsWith("dictation: started in en-GB,"));
    expect(starts.map((e) => e.detail.split("\n").slice(-2))).toEqual([
      [expect.stringMatching(/^microphone: [a-z ]+$/), "the first listening of the page"],
      [
        "microphone: prompt, gave sound before",
        expect.stringMatching(/^\d+\.\d s after the last listening$/),
      ],
    ]);
  });

  it("lets a listening wait for its sound while the microphone is not granted yet", async () => {
    await deafPress("prompt", () => {
      // A prompt waits for the learner: no timer cuts it short.
      vi.advanceTimersByTime(NO_AUDIO_MS * 3);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
    });
  });

  it("says why the browser refused, in the journal, and ends as one that heard nothing", async () => {
    withRecognition(true);
    reset();
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    const recognition = listening();
    recognition.onerror?.(Object.assign(new Event("error"), { error: "audio-capture" }));
    recognition.onend?.();
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    flush();
    expect(
      snapshot().some((e) => e.text === "dictation: the browser refused — audio-capture"),
    ).toBe(true);
  });

  it("ends a start the browser refuses at once as one that heard nothing, and says so", async () => {
    withRecognition(true);
    reset();
    FakeRecognition.refuses = true;
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    expect(panel().getByRole("button", { name: "Dictate" })).toBeVisible();
    flush();
    expect(snapshot().some((e) => e.text === "dictation: the browser refused to start")).toBe(true);
  });

  it("ends a Stop before the browser answered about the device, and starts nothing after", async () => {
    withRecognition("slow");
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    expect(await panel().findByRole("status")).toHaveTextContent("Listening…");
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    // The answer comes late: the recognition put away is not started.
    SlowRecognition.answer?.("available");
    await Promise.resolve();
    expect(listening().started).toBe(false);
    // An end the browser still reports of it changes nothing.
    listening().onend?.();
    expect(panel().getByRole("button", { name: "Dictate" })).toBeVisible();
  });

  it("notes the speech, an error with no code, and the voice it stopped", async () => {
    withRecognition(true);
    reset();
    const speaking = vi.spyOn(speechSynthesis, "speaking", "get").mockReturnValue(true);
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    speaking.mockRestore();
    const recognition = listening();
    recognition.onspeechstart?.();
    recognition.onerror?.(new Event("error"));
    recognition.onend?.();
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    flush();
    const lines = snapshot();
    expect(lines.find((e) => e.text.startsWith("dictation: started in en-GB,"))?.detail).toContain(
      "the voice was speaking: stopped first",
    );
    expect(lines.some((e) => e.text === "dictation: speech began")).toBe(true);
    expect(lines.some((e) => e.text === "dictation: the browser refused — no code")).toBe(true);
  });

  it("holds the tutor's voice while it listens, and lets it speak once the listening ends", async () => {
    withRecognition(true);
    reset();
    const { speech, texts } = fakeSpeech([voice("Daniel", "en-GB")]);
    const hello = [{ text: "Hello.", language: "en-GB" }];
    const saying = { rate: 1, chosen: new Map<string, string>() };
    render(
      inLanguage(
        <SpeechProvider value={speech}>
          <Asking />
        </SpeechProvider>,
      ),
    );
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    // A reply that comes, or a speaker pressed, while it listens says nothing on the iPad's sound.
    expect(speech.say(hello, saying)).toBeUndefined();
    speech.prime();
    expect(texts()).toEqual([]);
    listening().hear("why ten");
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(speech.say(hello, saying)).toBeDefined();
    expect(texts()).toEqual(["Hello."]);
    flush();
    expect(
      snapshot().some(
        (e) => e.text === "dictation: the voice kept quiet 2 times while it listened",
      ),
    ).toBe(true);
  });

  it("puts away a listening whose sound came and no word after it, as one that heard nothing", async () => {
    withRecognition(true);
    reset();
    render(inLanguage(<Asking />));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
      // The sound begins at once; a voice over it would take it and leave no word to come.
      await Promise.resolve();
      vi.advanceTimersByTime(NO_WORDS_MS - 1);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    flush();
    expect(
      snapshot().some((e) => e.level === "warn" && e.text.startsWith("dictation: no words in")),
    ).toBe(true);
  });

  it("lets a listening that gives words go on past the watch on its sound", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
      await Promise.resolve();
      listening().hear("why");
      vi.advanceTimersByTime(NO_WORDS_MS * 2);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
    } finally {
      vi.useRealTimers();
    }
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(field()).toHaveValue("why");
  });

  /**
   * A listening the test sends the sound's events to itself, so that each comes where the test puts
   * it: `before` runs on fake timers, then the listening stays the whole of `NO_WORDS_MS` but the
   * last moment and is put away at it. Gives the lines of the journal.
   */
  async function putAwayAfter(before: (recognition: FakeRecognition) => void) {
    withRecognition(true);
    FakeRecognition.deaf = true;
    reset();
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await expect.poll(() => FakeRecognition.made.at(-1)?.started).toBe(true);
    const recognition = listening();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      before(recognition);
      vi.advanceTimersByTime(NO_WORDS_MS - 1);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    flush();
    return snapshot().map((e) => e.text);
  }

  it("gives speech that begins late its own time for words, and puts it away once that is gone", async () => {
    const lines = await putAwayAfter((recognition) => {
      recognition.onaudiostart?.();
      vi.advanceTimersByTime(NO_WORDS_MS - 1);
      recognition.onspeechstart?.();
    });
    expect(lines).toContain(`dictation: no words in ${NO_WORDS_MS} ms of speech — put away`);
  });

  it("keeps the watch on through results with no word, notes them and the sound's end, and puts it away", async () => {
    const lines = await putAwayAfter((recognition) => {
      recognition.onaudiostart?.();
      recognition.hear("");
      recognition.hear(" ");
      recognition.onaudioend?.();
    });
    expect(lines.filter((line) => line === "dictation: a result with no word")).toHaveLength(1);
    expect(lines).toContain("dictation: sound ended");
    expect(lines).toContain(`dictation: no words in ${NO_WORDS_MS} ms of sound — put away`);
  });

  it("counts the results with no word at the end, and says the voice was waiting to speak", async () => {
    withRecognition(true);
    reset();
    const pending = vi.spyOn(speechSynthesis, "pending", "get").mockReturnValue(true);
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    pending.mockRestore();
    const recognition = listening();
    recognition.hear("");
    recognition.hear("why");
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(field()).toHaveValue("why");
    flush();
    const lines = snapshot();
    expect(lines.find((e) => e.text.startsWith("dictation: started in en-GB,"))?.detail).toContain(
      "the voice was waiting to speak: stopped first",
    );
    expect(lines.some((e) => e.text === "dictation: ended, 2 results, 1 with no word, heard")).toBe(
      true,
    );
  });

  it("lets the voice speak at Stop, though the browser has not yet said the listening ended", async () => {
    withRecognition(true);
    reset();
    const { speech, texts } = fakeSpeech([voice("Daniel", "en-GB")]);
    const hello = [{ text: "Hello.", language: "en-GB" }];
    render(
      inLanguage(
        <SpeechProvider value={speech}>
          <Asking />
        </SpeechProvider>,
      ),
    );
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    speech.prime();
    const recognition = listening();
    recognition.hear("why");
    vi.spyOn(recognition, "stop").mockImplementation(() => {});
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    speech.say(hello, { rate: 1, chosen: new Map() });
    expect(texts()).toEqual(["Hello."]);
    flush();
    expect(
      snapshot().some((e) => e.text === "dictation: the voice kept quiet 1 time while it listened"),
    ).toBe(true);
  });

  it("starts where the browser will not say whether it speaks", async () => {
    withRecognition(true);
    const speaking = vi.spyOn(speechSynthesis, "speaking", "get").mockImplementation(() => {
      throw new Error("no synthesis");
    });
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    speaking.mockRestore();
    expect(listening().started).toBe(true);
  });

  it("drops the word that Stop took the question back once the microphone listens", async () => {
    withRecognition(true);
    render(
      inLanguage(
        <TutorPanel
          kit={{
            ask: {
              label: "Your question about the task",
              placeholder: "Ask about this task…",
              max: 500,
              ready: (draft) => (draft.trim() === "" ? undefined : draft.trim()),
              off: false,
              microphone: true,
              language: "en-GB",
              onSend: () => {},
              again: { text: "Why ten?", at: 1, stopped: true },
            },
          }}
          greeting="Ask about this task by text or voice."
          talk={[]}
        />,
      ),
    );
    const said = "Stopped: your question is back in the field — change it and send it again.";
    expect(await panel().findByText(said)).toBeVisible();
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    expect(await panel().findByText("Listening…")).toBeVisible();
    expect(panel().queryByText(said)).toBeNull();
  });

  it("draws no microphone where the browser has no recognition, nor where the kit has none", async () => {
    withRecognition(false);
    const { unmount } = render(inLanguage(<Asking />));
    expect(panel().getByRole("button", { name: "Send" })).toBeVisible();
    expect(panel().queryByRole("button", { name: "Dictate" })).toBeNull();
    unmount();
    withRecognition(true);
    render(inLanguage(<Asking microphone={false} />));
    expect(panel().getByRole("button", { name: "Send" })).toBeVisible();
    expect(panel().queryByRole("button", { name: "Dictate" })).toBeNull();
  });
});

describe("the task screen's panel", () => {
  it("has no field: a task of a module asks the tutor by its buttons alone", () => {
    render(inLanguage(<Drawn />));
    expect(panel().queryByRole("textbox")).toBeNull();
    expect(panel().queryByRole("button", { name: "Dictate" })).toBeNull();
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
  });
});
