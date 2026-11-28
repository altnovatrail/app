// The tutor's panel, the one of every screen: on the sheet of a task of a module, over the canvas
// on a tablet, a sheet over the canvas's bar of tools on a phone, its grabber, its ×, Ask that
// opens it, and no field; alone with its field, Enter and Shift+Enter, its growing,
// and its microphone by a fake of the browser's recognition.
import "@altnovatrail/canvas";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { Solve } from "../paper/Solve.tsx";
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
import { LearnerLine, TutorPanel } from "./TutorPanel.tsx";

const TASK: open.Task = {
  id: "dots",
  statement: [{ text: "How many dots are there in row 10?" }],
  canvas: { kind: "handwriting_sheet", grid: "squares" },
  givens: ["Row 1 has 2 dots."],
  items: [{ answer_slots: [{ binding: "anywhere" }] }],
};

const FRAME = { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 };

/** The sheet of a task of a module, with an api it never reaches till a press. */
function Drawn() {
  return (
    <ApiProvider value={{} as Api}>
      <Solve
        profileId="p1"
        adult={false}
        tasks={[{ id: "module", frame: FRAME, drawn: false, picked: true }]}
        begun={[
          {
            attemptId: "a1",
            taskId: "module",
            frame: FRAME,
            drawn: false,
            crop: new Blob([], { type: "image/png" }),
            history: [],
          },
        ]}
        onKeep={() => {}}
        onRenew={() => new Promise(() => {})}
        onHome={() => {}}
        module={{
          task: TASK,
          writes: true,
          language: "en",
          catalog: undefined,
          pill: null,
          onSolved: () => {},
          onNext: () => {},
          nexting: false,
        }}
      />
    </ApiProvider>
  );
}

/** The sheet with its panel opened by Ask. */
async function opened() {
  render(inLanguage(<Drawn />));
  await userEvent.click(screen.getByRole("button", { name: "Ask" }));
  return screen.getByRole("complementary", { name: "Tutor" });
}

const panel = () => within(screen.getByRole("complementary", { name: "Tutor" }));
const canvas = () => document.querySelector("novatrail-canvas") as HTMLElement;
const row = () => document.querySelector(".nt-task-row") as HTMLElement;

/** The panel's coming in, ended: its box is read where it stays. */
const settled = () =>
  Promise.all(document.getAnimations().map((each) => each.finished.catch(() => {})));

afterEach(async () => {
  await page.viewport(1194, 834);
});

describe("the tutor's panel on a tablet", () => {
  it("stands over the canvas, which keeps the window's width, the row clear of it", async () => {
    await page.viewport(1194, 834);
    const aside = await opened();
    await settled();
    const box = aside.getBoundingClientRect();
    expect(box.width).toBeCloseTo(400, 0);
    expect(box.right).toBeCloseTo(1194 - 16, 0);
    expect(box.bottom).toBeCloseTo(834 - 16, 0);
    // The canvas moves for no panel, as under the debug window: its right part is under the glass.
    const sheet = canvas().getBoundingClientRect();
    expect(sheet.left).toBeCloseTo(0, 0);
    expect(sheet.right).toBeCloseTo(1194, 0);
    expect(canvas()).not.toHaveAttribute("tools-hidden");
    expect(row()).toBeVisible();
    expect(row().getBoundingClientRect().right).toBeLessThanOrEqual(box.left + 0.5);
    // Its head: the tutor's name, the voicing and ×; no grabber.
    expect(panel().getByRole("heading", { name: "Tutor", level: 2 })).toBeVisible();
    expect(panel().queryByRole("button", { name: "Full screen" })).toBeNull();
    // Open, the panel stands in place of Ask.
    expect(screen.queryByRole("button", { name: "Ask" })).toBeNull();
  });

  it("closes by ×, the focus back on Ask, which opens it again with the focus in it", async () => {
    await opened();
    expect(document.activeElement).toBe(panel().getByRole("heading", { name: "Tutor" }));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("complementary", { name: "Tutor" })).toBeNull();
    const ask = screen.getByRole("button", { name: "Ask" });
    expect(ask).toHaveAttribute("aria-expanded", "false");
    expect(document.activeElement).toBe(ask);
    await userEvent.click(ask);
    expect(screen.getByRole("complementary", { name: "Tutor" })).toBeVisible();
    expect(document.activeElement).toBe(panel().getByRole("heading", { name: "Tutor" }));
  });

  it("has no field on a task of a module: it asks the tutor by its buttons alone", async () => {
    await opened();
    expect(panel().queryByRole("textbox")).toBeNull();
    expect(panel().queryByRole("button", { name: "Dictate" })).toBeNull();
  });
});

describe("the tutor's sheet on a phone", () => {
  it("hides the canvas's bar of tools while it is open, at half the height", async () => {
    await page.viewport(390, 844);
    const aside = await opened();
    await settled();
    const box = aside.getBoundingClientRect();
    expect(box.left).toBe(0);
    expect(box.width).toBe(390);
    expect(box.bottom).toBe(844);
    expect(box.height).toBeCloseTo(844 * 0.51, 0);
    expect(canvas()).toHaveAttribute("tools-hidden");
    // The grabber takes it over the whole screen, to the window's top, and back.
    const grab = panel().getByRole("button", { name: "Full screen" });
    expect(grab).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(grab);
    await settled();
    expect(aside.getBoundingClientRect().top).toBeCloseTo(0, 0);
    const half = panel().getByRole("button", { name: "Half screen" });
    expect(half).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(half);
    expect(aside.getBoundingClientRect().height).toBeCloseTo(844 * 0.51, 0);
    // Closed, the bar of tools comes back, and Ask in the row.
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    expect(canvas()).not.toHaveAttribute("tools-hidden");
    expect(row()).toBeVisible();
    expect(screen.getByRole("button", { name: "Ask" })).toBeVisible();
  });

  it("follows a drag of its grabber, and stands at the nearer of half and the whole screen once let go", async () => {
    await page.viewport(390, 844);
    const aside = await opened();
    await settled();
    const half = aside.getBoundingClientRect().height;
    const grab = panel().getByRole("button", { name: "Full screen" });
    const press = (type: string, y: number) =>
      grab.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 7, isPrimary: true, clientY: y }),
      );
    // Up by 140: the sheet's top goes with the finger.
    press("pointerdown", 440);
    press("pointermove", 300);
    expect(aside.getBoundingClientRect().height).toBeCloseTo(half + 140, 0);
    // Up to near the top and let go: the whole screen.
    press("pointermove", 60);
    press("pointerup", 60);
    await waitFor(() => expect(aside).toHaveAttribute("data-size", "full"));
    expect(aside.getBoundingClientRect().top).toBeCloseTo(0, 0);
    const down = panel().getByRole("button", { name: "Half screen" });
    expect(down).toHaveAttribute("aria-expanded", "true");
    // Down past the middle and let go: half again; no lower than a third while dragged.
    const back = (type: string, y: number) =>
      down.dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId: 8, isPrimary: true, clientY: y }),
      );
    back("pointerdown", 20);
    back("pointermove", 800);
    expect(aside.getBoundingClientRect().height).toBeCloseTo(844 * 0.3, 0);
    back("pointermove", 400);
    back("pointerup", 400);
    await waitFor(() => expect(aside).toHaveAttribute("data-size", "half"));
    expect(aside.getBoundingClientRect().height).toBeCloseTo(half, 0);
  });

  it("opens over the whole screen again at half the height", async () => {
    await page.viewport(390, 844);
    await opened();
    await userEvent.click(panel().getByRole("button", { name: "Full screen" }));
    await userEvent.click(panel().getByRole("button", { name: "Close" }));
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(panel().getByRole("button", { name: "Full screen" })).toBeVisible();
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
 * `state`, read before the press; `then` runs on the page's own timers, faked.
 */
async function deafPress(state: PermissionState, then: () => void) {
  withRecognition(true);
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

  it("stands in one row with Send, and grows with its lines up to five, Send at its foot", async () => {
    withRecognition(false);
    render(inLanguage(<Asking />));
    expect(panel().getByText("Ask about this task by text or voice.")).toBeVisible();
    const send = () => panel().getByRole("button", { name: "Send" }).getBoundingClientRect();
    const box = () => field().getBoundingClientRect();
    expect(send().left).toBeGreaterThanOrEqual(box().right);
    expect(send().top).toBeLessThan(box().top);
    expect(send().bottom).toBeGreaterThan(box().bottom);
    const one = box().height;
    await userEvent.type(field(), "1{Shift>}{Enter}{/Shift}2{Shift>}{Enter}{/Shift}3");
    expect(box().height).toBeGreaterThan(one * 2.5);
    expect(send().bottom).toBeGreaterThanOrEqual(box().bottom);
  });

  it("sends by Enter, breaks the line by Shift+Enter, and grows with its lines up to five", async () => {
    withRecognition(false);
    render(inLanguage(<Asking />));
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

  it("takes away at a new press what the last listening left, and keeps what the learner typed", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    const dictate = async (words: string) => {
      await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
      await waitFor(() => expect(listening().started).toBe(true));
      listening().hear(words);
      await userEvent.click(panel().getByRole("button", { name: "Stop" }));
      await panel().findByRole("button", { name: "Send" });
    };
    await userEvent.type(field(), "Look:");
    await dictate("why ten");
    expect(field()).toHaveValue("Look: why ten");
    await dictate("why nine");
    expect(field()).toHaveValue("Look: why nine");
    // A press that hears nothing has taken it away all the same.
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    await waitFor(() => expect(field()).toHaveValue("Look:"));
    await userEvent.click(panel().getByRole("button", { name: "Stop" }));
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    // Changed by the learner, it is their own text, and a new listening goes after it.
    await dictate("why eight");
    await userEvent.type(field(), "?");
    await dictate("and then");
    expect(field()).toHaveValue("Look: why eight? and then");
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
    const cancel = vi.spyOn(speechSynthesis, "cancel");
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    // No waiting: WebKit has no `available`, and the start is the press's own.
    expect(listening().started).toBe(true);
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });

  it("puts away a listening whose sound never comes, the microphone granted, as one that heard nothing", async () => {
    await deafPress("granted", () => {
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(NO_AUDIO_MS - 1);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(1);
    });
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    expect(panel().queryByText("Listening…")).toBeNull();
    expect(panel().getByRole("button", { name: "Dictate" })).toBeVisible();
  });

  it("lets a listening wait for its sound while the microphone is not granted yet", async () => {
    await deafPress("prompt", () => {
      // A prompt waits for the learner: no timer cuts it short.
      vi.advanceTimersByTime(NO_AUDIO_MS * 3);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
    });
  });

  it("ends a listening the browser refused as one that heard nothing", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    const recognition = listening();
    recognition.onerror?.(Object.assign(new Event("error"), { error: "audio-capture" }));
    recognition.onend?.();
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
  });

  it("ends a start the browser refuses at once as one that heard nothing", async () => {
    withRecognition(true);
    FakeRecognition.refuses = true;
    render(inLanguage(<Asking />));
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
    expect(panel().getByRole("button", { name: "Dictate" })).toBeVisible();
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

  it("puts away a listening whose sound came and no word after it, as one that heard nothing", async () => {
    withRecognition(true);
    render(inLanguage(<Asking />));
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
      await Promise.resolve();
      vi.advanceTimersByTime(NO_WORDS_MS - 1);
      expect(panel().getByRole("status")).toHaveTextContent("Listening…");
      vi.advanceTimersByTime(1);
    } finally {
      vi.useRealTimers();
    }
    expect(await panel().findByText("Nothing was heard. Try again, or type.")).toBeVisible();
  });

  it("lets the tutor's voice speak while it listens, as at any other time", async () => {
    withRecognition(true);
    const { speech, texts } = fakeSpeech([voice("Daniel", "en-GB")]);
    render(
      inLanguage(
        <SpeechProvider value={speech}>
          <Asking />
        </SpeechProvider>,
      ),
    );
    await userEvent.click(panel().getByRole("button", { name: "Dictate" }));
    expect(listening().started).toBe(true);
    // A reply that comes while the microphone listens is said, not kept back.
    const hello = [{ text: "Hello.", language: "en-GB" }];
    expect(speech.say(hello, { rate: 1, chosen: new Map() })).toBeDefined();
    expect(texts()).toEqual(["Hello."]);
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
   * last moment and is put away at it, as one that heard nothing.
   */
  async function putAwayAfter(before: (recognition: FakeRecognition) => void) {
    withRecognition(true);
    FakeRecognition.deaf = true;
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
  }

  it("gives speech that begins late its own time for words, and puts it away once that is gone", async () => {
    await putAwayAfter((recognition) => {
      recognition.onaudiostart?.();
      vi.advanceTimersByTime(NO_WORDS_MS - 1);
      recognition.onspeechstart?.();
    });
  });

  it("keeps the watch on through results with no word, and puts it away", async () => {
    await putAwayAfter((recognition) => {
      recognition.onaudiostart?.();
      recognition.hear("");
      recognition.hear(" ");
    });
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
