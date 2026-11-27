// The Log's choice of how the microphone listens: shown on its chip, picked in its pop-over, kept on
// the device.
import { render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { listeningMode, setListeningMode } from "../voice/listening.ts";
import { ListeningChip } from "./ListeningChip.tsx";

afterEach(() => setListeningMode("stop"));

it("listens till Stop at first, and keeps till a pause once picked, and Stop again", async () => {
  render(<ListeningChip />);
  const chip = screen.getByRole("button", { name: "Dictation: till stop" });
  await userEvent.click(chip);
  const menu = within(screen.getByRole("menu", { name: "Dictation" }));
  expect(menu.getByRole("menuitemradio", { name: "Till Stop" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await userEvent.click(menu.getByRole("menuitemradio", { name: "Till a pause" }));
  expect(screen.queryByRole("menu")).toBeNull();
  expect(listeningMode()).toBe("pause");
  expect(chip).toHaveTextContent("Dictation: till a pause");
  await userEvent.click(chip);
  await userEvent.click(screen.getByRole("menuitemradio", { name: "Till Stop" }));
  expect(listeningMode()).toBe("stop");
});

it("listens till Stop where the device keeps nothing", () => {
  const storage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("no storage");
    },
  });
  try {
    setListeningMode("pause");
    expect(listeningMode()).toBe("stop");
  } finally {
    if (storage !== undefined) Object.defineProperty(globalThis, "localStorage", storage);
  }
});
