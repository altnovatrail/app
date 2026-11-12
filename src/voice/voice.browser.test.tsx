// Voicing in Chromium (R07 and R36 in docs/decisions.md; section 3.5 of docs/architecture.md): the
// speaker button and its line where a text cannot be said, the section Voicing of the page This
// device with the voices of each language and the adult's leave kept in the registry, and the path
// "no voice" on Chromium's own speechSynthesis, which in the container has no voice at all.
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import type * as open from "@altnovatrail/spec/formatv0/open";
import { create } from "@bufbuild/protobuf";
import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { type Packages, PackagesProvider } from "../packages/PackagesContext.tsx";
import { allowVoicing, chooseVoice, readVoicing } from "../storage/voicing.ts";
import { memoryDevice } from "../test/device.ts";
import { inLanguage } from "../test/language.tsx";
import { fakeSpeech, voice } from "../test/speech.ts";
import { DeviceVoices } from "./DeviceVoices.tsx";
import { ReadAloud } from "./ReadAloud.tsx";
import { type Speech, type SynthLike, speechOf, type UtteranceLike } from "./speech.ts";
import { SpeechProvider, VoicingProvider, voicingChanged } from "./VoicingContext.tsx";
import { platformOf } from "./voices.ts";

const SAMANTHA = voice("Samantha", "en-US", { isDefault: true });
const DANIEL = voice("Daniel", "en-GB");
const PHRASES = [{ text: "8 × □ = 40", language: "en" }];

function withSpeech(speech: Speech, node: ReactNode, language: "en" | "ru" = "en") {
  return render(inLanguage(<SpeechProvider value={speech}>{node}</SpeechProvider>, language));
}

/** Chromium's own synthesis, on a system that needs no leave. */
function chromium(): Speech {
  return speechOf({
    navigator: {
      userAgent: "Mozilla/5.0 (Windows NT 10.0)",
      userAgentData: { platform: "Windows" },
    },
    synth: speechSynthesis as unknown as SynthLike,
    utterance: (text) => new SpeechSynthesisUtterance(text) as unknown as UtteranceLike,
    document,
  });
}

const readAloud = () => screen.getByRole("button", { name: "Read aloud" });

describe("Read aloud", () => {
  it("reads its text with the signs in words, and stops on a second press", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    withSpeech(speech.speech, <ReadAloud phrases={PHRASES} language="en" />);
    expect(readAloud()).toHaveAttribute("aria-disabled", "false");
    expect(readAloud()).not.toHaveAccessibleDescription();
    await userEvent.click(readAloud());
    expect(speech.texts()).toEqual(["8 times box equals 40"]);
    await userEvent.click(readAloud());
    expect(speech.speech.speaking()).toBeUndefined();
    // Once stopped, a press reads it again.
    await userEvent.click(readAloud());
    expect(speech.texts()).toHaveLength(2);
  });

  it("cuts in on another text being read", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    withSpeech(
      speech.speech,
      <>
        <ReadAloud phrases={PHRASES} language="en" />
        <ReadAloud phrases={[{ text: "Count up in eights.", language: "en" }]} language="en" />
      </>,
    );
    const [first, second] = screen.getAllByRole("button", { name: "Read aloud" });
    await userEvent.click(first as HTMLElement);
    await userEvent.click(second as HTMLElement);
    expect(speech.texts()).toEqual(["8 times box equals 40", "Count up in eights."]);
    expect(speech.speech.speaking()).toBeDefined();
  });

  it("is not there with nothing to read", () => {
    const speech = fakeSpeech([SAMANTHA]);
    withSpeech(speech.speech, <ReadAloud phrases={[]} language="en" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says that the device has no voice for the language, in the screen's language", async () => {
    const speech = fakeSpeech([voice("Milena", "ru-RU")]);
    withSpeech(speech.speech, <ReadAloud phrases={PHRASES} language="en" />, "ru");
    const button = screen.getByRole("button", { name: "Озвучить" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAccessibleDescription(
      "На этом устройстве нет голоса для языка: английский",
    );
    await userEvent.click(button, { force: true });
    expect(speech.asked).toEqual([]);
  });

  it("names a language Intl cannot name by its tag", () => {
    const speech = fakeSpeech([SAMANTHA]);
    withSpeech(
      speech.speech,
      <ReadAloud phrases={[{ text: "Hm.", language: "x-1" }]} language="x-1" />,
    );
    expect(readAloud()).toHaveAccessibleDescription("This device has no voice for x-1");
  });

  it("waits on Android for an adult to turn voicing on on this device", () => {
    const speech = fakeSpeech([SAMANTHA], "android");
    withSpeech(speech.speech, <ReadAloud phrases={PHRASES} language="en" />);
    expect(readAloud()).toHaveAccessibleDescription(
      "On this device, an adult turns voicing on first",
    );
  });

  it("says no voice on Chromium's own synthesis, which has none here", async () => {
    // The container's Chromium lists no voice: the path is the one of a device with none.
    expect(speechSynthesis.getVoices()).toEqual([]);
    withSpeech(chromium(), <ReadAloud phrases={PHRASES} language="en" />);
    expect(readAloud()).toHaveAttribute("aria-disabled", "true");
    expect(readAloud()).toHaveAccessibleDescription("This device has no voice for English");
    await userEvent.click(readAloud(), { force: true });
    expect(speechSynthesis.speaking).toBe(false);
  });
});

/** The packages of a device whose cache holds a module explained in German. */
const GERMAN = {
  views: {
    keptManifests: async () =>
      new Map([["sha256:1", { languages: { explanation: "de" } } as open.Manifest]]),
  },
} as unknown as Packages;

const fieldset = (name: string) => within(screen.getByRole("group", { name }));

describe("the section Voicing of This device", () => {
  it("chooses among the voices of each language, keeps the choice, and reads a sample", async () => {
    const speech = fakeSpeech([
      SAMANTHA,
      DANIEL,
      voice("Online", "en-US"),
      voice("Web", "ru-RU", { local: false }),
    ]);
    const { device } = memoryDevice();
    withSpeech(speech.speech, <DeviceVoices device={device} />);
    expect(screen.getByRole("heading", { level: 2, name: "Voicing" })).toBeTruthy();
    expect(screen.queryByText(/the system chooses the voice/)).toBeNull();
    const english = fieldset("English");
    expect(english.getAllByRole("radio").map((radio) => radio.parentElement?.textContent)).toEqual([
      "Samantha",
      "Daniel",
    ]);
    expect(english.getByRole("radio", { name: "Samantha" })).toBeChecked();
    await userEvent.click(english.getByRole("radio", { name: "Daniel" }));
    await expect.poll(async () => (await readVoicing(device)).voices.get("en")).toBe("uri:Daniel");
    expect(english.getByRole("radio", { name: "Daniel" })).toBeChecked();
    await userEvent.click(english.getByRole("button", { name: "Read a sample aloud" }));
    expect(speech.said().at(-1)).toMatchObject({
      text: "This is how the tutor's words will sound.",
      voice: DANIEL,
    });
    // Russian has a network voice alone: no voice, and how to add one, in words.
    const russian = fieldset("Russian");
    expect(russian.queryByRole("radio")).toBeNull();
    expect(
      russian.getByText("This device has no voice for this language. Its texts stay on the screen"),
    ).toBeTruthy();
    expect(russian.getByText(/A voice is added in the system's settings/)).toBeTruthy();
  });

  it("takes the choice kept on this device, and lists the languages of the modules kept", async () => {
    const speech = fakeSpeech([SAMANTHA, DANIEL, voice("Anna", "de-DE")]);
    const { device } = memoryDevice();
    await chooseVoice(device, "en", "uri:Daniel");
    withSpeech(
      speech.speech,
      <PackagesProvider value={GERMAN}>
        <DeviceVoices device={device} />
      </PackagesProvider>,
      "ru",
    );
    await expect
      .poll(() => fieldset("Английский").getByRole("radio", { name: "Daniel" }))
      .toBeChecked();
    const german = await screen.findByRole("group", { name: "Немецкий" });
    expect(within(german).getByRole("radio", { name: "Anna" })).toBeChecked();
    // No sentence of a sample in a language the build does not speak.
    expect(within(german).queryByRole("button")).toBeNull();
  });

  it("gives and takes back the adult's leave on Android, kept in the registry", async () => {
    const speech = fakeSpeech([SAMANTHA], "android");
    const { device } = memoryDevice();
    withSpeech(speech.speech, <DeviceVoices device={device} />);
    expect(screen.getByText(/the system chooses the voice/)).toBeTruthy();
    expect(screen.getByText("Voicing is off on this device")).toBeTruthy();
    // No sample before the leave: the device might send it over the network.
    expect(screen.queryByRole("button", { name: "Read a sample aloud" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Turn voicing on on this device" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Voicing is on on this device");
    expect((await readVoicing(device)).allowed).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "Read a sample aloud" }));
    expect(speech.texts()).toEqual(["This is how the tutor's words will sound."]);
    await userEvent.click(screen.getByRole("button", { name: "Turn voicing off on this device" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Voicing is off on this device now",
    );
    expect((await readVoicing(device)).allowed).toBe(false);
    expect(speech.asked.at(-1)).toEqual({ cancel: true });
  });

  it("says when the choice could not be kept", async () => {
    const speech = fakeSpeech([SAMANTHA, DANIEL], "linux");
    const { device, backend } = memoryDevice();
    await backend.open(
      "novatrail-registry",
      { version: 99, stores: {} },
      { create: true, onLost: () => {} },
    );
    withSpeech(speech.speech, <DeviceVoices device={device} />);
    await userEvent.click(screen.getByRole("button", { name: "Turn voicing on on this device" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The choice wasn't kept on this device. Try again",
    );
    expect(screen.getByText("Voicing is off on this device")).toBeTruthy();
  });

  it("says that a browser with no Web Speech API reads nothing aloud", () => {
    const speech = speechOf({ navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0)" } });
    withSpeech(speech, <DeviceVoices device={memoryDevice().device} />);
    expect(
      screen.getByText("This browser doesn't read text aloud. The text stays on the screen"),
    ).toBeTruthy();
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("says no voice for each language on Chromium's own synthesis, which has none here", () => {
    withSpeech(chromium(), <DeviceVoices device={memoryDevice().device} />);
    for (const name of ["English", "Russian"]) {
      expect(
        fieldset(name).getByText(
          "This device has no voice for this language. Its texts stay on the screen",
        ),
      ).toBeTruthy();
    }
  });

  it("asks for the leave on the browser's own synthesis where it runs on Linux", () => {
    // The browser's one synthesis, as the app makes it: Chromium in the container is on Linux.
    render(inLanguage(<DeviceVoices device={memoryDevice().device} />));
    const leave = platformOf(navigator) === "linux" || platformOf(navigator) === "android";
    expect(screen.queryByText(/the system chooses the voice/) !== null).toBe(leave);
  });
});

/** A learner's screen with this voicing: the profile's, on or off, and the device's record. */
function learnerScreen(
  speech: ReturnType<typeof fakeSpeech>,
  device: ReturnType<typeof memoryDevice>["device"],
  on: boolean,
  node: ReactNode = <ReadAloud phrases={PHRASES} language="en" />,
) {
  return (
    <SpeechProvider value={speech.speech}>
      <VoicingProvider
        profile={create(ProfileSchema, {
          profileId: "p1",
          presentationStyle: { voicing: { enabled: on } },
        })}
        device={device}
        place="task"
        onSaved={() => {}}
        onFailed={() => {}}
      >
        {node}
      </VoicingProvider>
    </SpeechProvider>
  );
}

describe("the voicing of a learner's screens", () => {
  it("stops what is said when the voicing is turned off by another way than its button", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    const { device } = memoryDevice();
    const { rerender } = render(inLanguage(learnerScreen(speech, device, true)));
    await vi.waitFor(() => expect(readAloud()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(readAloud());
    expect(speech.speech.speaking()).toBeDefined();
    rerender(inLanguage(learnerScreen(speech, device, false)));
    expect(speech.speech.speaking()).toBeUndefined();
    expect(speech.asked.at(-1)).toEqual({ cancel: true });
  });

  it("reads the device's record again when another tab changes it", async () => {
    const speech = fakeSpeech([SAMANTHA], "android");
    const { device } = memoryDevice();
    render(inLanguage(learnerScreen(speech, device, true)));
    await vi.waitFor(() =>
      expect(readAloud()).toHaveAccessibleDescription(
        "On this device, an adult turns voicing on first",
      ),
    );
    await allowVoicing(device, true);
    voicingChanged();
    await vi.waitFor(() => expect(readAloud()).toHaveAttribute("aria-disabled", "false"));
    await userEvent.click(readAloud());
    expect(speech.texts()).toEqual(["8 times box equals 40"]);
    // The leave taken back in the other tab stops what is said here.
    await allowVoicing(device, false);
    voicingChanged();
    await vi.waitFor(() => expect(speech.speech.speaking()).toBeUndefined());
  });

  it("is not active, with no line, before the record is read or the language is known", async () => {
    const speech = fakeSpeech([SAMANTHA], "android");
    const { device } = memoryDevice();
    render(
      inLanguage(
        learnerScreen(speech, device, true, <ReadAloud phrases={PHRASES} language={undefined} />),
      ),
    );
    expect(readAloud()).toHaveAttribute("aria-disabled", "true");
    expect(readAloud()).not.toHaveAccessibleDescription();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(readAloud()).not.toHaveAccessibleDescription();
    await userEvent.click(readAloud(), { force: true });
    expect(speech.asked).toEqual([]);
  });

  it("stops a text read aloud when its button goes", async () => {
    const speech = fakeSpeech([SAMANTHA]);
    const { unmount } = withSpeech(speech.speech, <ReadAloud phrases={PHRASES} language="en" />);
    await userEvent.click(readAloud());
    unmount();
    expect(speech.speech.speaking()).toBeUndefined();
  });
});
