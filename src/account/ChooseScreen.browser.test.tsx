// The choice of the learner in the browser: each profile by its avatar — the one
// of its code, or the set's own for none and for a code this build does not know — and its
// pseudonym, whose profile it is its description; "Add a learner" shown, disabled, with the line
// why.
import {
  type Profile,
  ProfileSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { ChooseScreen } from "./ChooseScreen.tsx";

const PROFILES: readonly Profile[] = [
  create(ProfileSchema, { profileId: "p1", owner: true, pseudonym: "Sam", avatar: "moon" }),
  create(ProfileSchema, { profileId: "p2", pseudonym: "Kit" }),
  create(ProfileSchema, { profileId: "p3", pseudonym: "Ash", avatar: "comet" }),
];

describe("the choice of the learner", () => {
  it("shows each profile by its avatar and pseudonym, and Add a learner closed with why", async () => {
    const onChoose = vi.fn();
    render(
      inLanguage(
        <ChooseScreen profiles={PROFILES} first={false} onChoose={onChoose} onSignOut={() => {}} />,
      ),
    );
    const shown = [...document.querySelectorAll(".nt-learners .nt-avatar")].map((avatar) =>
      avatar.getAttribute("data-avatar"),
    );
    expect(shown).toEqual(["moon", "peak", "peak", null]);
    const sam = screen.getByRole("button", { name: "Sam" });
    expect(sam).toHaveAccessibleDescription("You · grown-up");
    expect(screen.getByRole("button", { name: "Kit" })).toHaveAccessibleDescription("Learner");
    const add = screen.getByRole("button", { name: "Add a learner" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription(
      "Comes later: a child's profile waits for a parent's consent",
    );
    // The line why is read, not dimmed with the button: white at 0.9 on the card's glass.
    const why = getComputedStyle(document.querySelector(".nt-learner-add p") as Element);
    expect([why.opacity, why.color]).toEqual(["1", "rgba(255, 255, 255, 0.9)"]);
    // "Start" is the card's look, not a button of its own.
    expect(screen.queryByRole("button", { name: "Start" })).toBeNull();
    expect(document.querySelectorAll(".nt-learner-start")).toHaveLength(3);
    await userEvent.click(sam);
    expect(onChoose).toHaveBeenCalledWith(PROFILES[0]);
  });
});
