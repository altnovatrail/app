// The owner's profile in the browser (R19 and R61 in docs/decisions.md; section 3.10 of
// docs/architecture.md): a pseudonym, a country and, if the owner chooses one, an avatar of the set,
// each choice in a pop-over; "Continue" waits for a pseudonym and a country, a pseudonym too long
// keeps the focus, and a country api does not take brings the focus back to its row with the line.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { OwnerProfileScreen, type OwnerProfileScreenProps } from "./OwnerProfileScreen.tsx";

function owner(onCreate: OwnerProfileScreenProps["onCreate"]) {
  return inLanguage(<OwnerProfileScreen onCreate={onCreate} />);
}

/** The avatar the profile shows, by its code. */
const shown = () => document.querySelector(".nt-avatar-profile")?.getAttribute("data-avatar");

async function choose(row: string, name: string) {
  await userEvent.click(screen.getByRole("button", { name: row }));
  await userEvent.click(screen.getByRole("button", { name }));
}

describe("the owner's profile", () => {
  it("sends no avatar when none is chosen, and shows the set's own meanwhile", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(owner(onCreate));
    const next = screen.getByRole("button", { name: "Continue" });
    expect(shown()).toBe("peak");
    await userEvent.type(screen.getByRole("textbox", { name: "Pseudonym" }), " Sam ");
    expect(next).toBeDisabled();
    await choose("Country Choose a country", "Canada");
    expect(screen.getByRole("button", { name: "Country Canada" })).toBeTruthy();
    await userEvent.click(next);
    expect(onCreate).toHaveBeenCalledWith("Sam", "CA", undefined);
  });

  it("sends the avatar chosen, which the profile and its choice then show", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(owner(onCreate));
    await choose("Choose an avatar", "Wave");
    expect(shown()).toBe("wave");
    await userEvent.click(screen.getByRole("button", { name: "Change the avatar" }));
    expect(screen.getByRole("button", { name: "Wave" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Peak" })).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(screen.getByRole("button", { name: "Sun" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Pseudonym" }), "Sam");
    await choose("Country Choose a country", "Canada");
    await userEvent.click(screen.getByRole("button", { name: "Country Canada" }));
    expect(screen.getByRole("button", { name: "Canada" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onCreate).toHaveBeenCalledWith("Sam", "CA", "sun");
  });

  it("keeps the focus on a pseudonym too long, and sends nothing", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(owner(onCreate));
    const pseudonym = screen.getByRole("textbox", { name: "Pseudonym" });
    await userEvent.type(pseudonym, "x".repeat(31));
    await choose("Country Choose a country", "Canada");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(pseudonym).toHaveAttribute("aria-invalid", "true");
    expect(document.activeElement).toBe(pseudonym);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("brings the focus back to the country api did not take, with the line why", async () => {
    const onCreate = vi.fn(async () => "country-not-accepted" as const);
    render(owner(onCreate));
    await userEvent.type(screen.getByRole("textbox", { name: "Pseudonym" }), "Sam");
    await choose("Country Choose a country", "Germany");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    const country = screen.getByRole("button", { name: "Country Germany" });
    await vi.waitFor(() => expect(document.activeElement).toBe(country));
    expect(country).toHaveAccessibleDescription(
      "NovaTrail doesn't take learners from this country yet",
    );
    // Another country takes the line away.
    await choose("Country Germany", "Canada");
    expect(
      screen.getByRole("button", { name: "Country Canada" }),
    ).not.toHaveAccessibleDescription();
  });
});
