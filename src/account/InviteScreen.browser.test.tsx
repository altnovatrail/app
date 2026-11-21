// The invite code's screen with its texts in the browser (R27; R46; R61): the code in its four
// boxes, whole before it goes on, and "Back" signing out; then the statement and the texts, each
// name a link to its legal page; an acceptance holds for the versions it was given for and names
// the current ones, never a next version, which this screen does not show; a refusal of a version
// no longer current is said even with no text shown, and a code api did not take brings its step
// back.
import {
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { InviteScreen, type InviteScreenProps, type TextsRead } from "./InviteScreen.tsx";

function policy(version: number, inForceSince = "2026-11-11"): LegalText {
  return create(LegalTextSchema, {
    id: "privacy-policy",
    version,
    inForceSince,
    body: "# Privacy Policy\n\nText.\n",
    summary: `In short, version ${version}.`,
    summaryLanguage: "en",
  });
}

function read(version: number, next: LegalText[] = []): TextsRead {
  return { status: "done", value: { texts: [policy(version)], next }, retry: () => {} };
}

function invite(
  texts: TextsRead,
  onCreate: InviteScreenProps["onCreate"],
  {
    draft,
    onLegal = () => {},
    onSignOut = () => {},
  }: Partial<Pick<InviteScreenProps, "draft" | "onLegal" | "onSignOut">> = {},
) {
  return inLanguage(
    <InviteScreen
      texts={texts}
      draft={draft}
      onCreate={onCreate}
      onLegal={onLegal}
      onSignOut={onSignOut}
    />,
  );
}

/** A code of api's form, synthetic: sixteen characters of Crockford's base32 in four groups. */
const CODE = "N7VA-K2QM-9XB4-ZD3H";

/** The code typed and taken on to the statement and the texts. */
async function toAgree(code = CODE) {
  await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), code);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { level: 1, name: "Create your account" });
}

/** What the four boxes show, in their order. */
function boxes(): (string | null)[] {
  return [...document.querySelectorAll(".nt-code-box")].map((box) => box.textContent);
}

const HINT = "Tap the boxes to paste the code from your invitation";
const ACCEPT = { name: "I agree to the Terms of Use and the Privacy Policy" };
const NOTE = "Each text is in English, the one in force, with its gist in your language";

describe("the invite code's screen", () => {
  it("goes on from the whole code alone, and back to it as it was", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(invite(read(2), onCreate));
    expect(screen.getByRole("heading", { level: 1, name: "You're invited" })).toBeTruthy();
    const next = screen.getByRole("button", { name: "Continue" });
    const code = screen.getByRole("textbox", { name: "Invite code" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(code, "   ");
    expect(next).toHaveAttribute("aria-disabled", "true");
    // Pressed while it looks off, it says what is missing, and the field takes the focus.
    await userEvent.click(next, { force: true });
    expect(code).toHaveAccessibleDescription(`${HINT} Enter the invite code`);
    expect(document.activeElement).toBe(code);
    await userEvent.clear(code);
    expect(code).toHaveAttribute("aria-invalid", "false");
    await toAgree();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Invite code" })).toHaveValue(CODE);
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("looks off until the code is whole, and says so when pressed with less", async () => {
    render(invite(read(2), async () => "done"));
    const next = screen.getByRole("button", { name: "Continue" });
    const code = screen.getByRole("textbox", { name: "Invite code" });
    // Fifteen characters and the hyphens: one short of a code api takes.
    await userEvent.type(code, CODE.slice(0, -1));
    expect(next).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(next, { force: true });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription(`${HINT} Enter the invite code`);
    expect(document.activeElement).toBe(code);
    expect(screen.getByRole("heading", { level: 1, name: "You're invited" })).toBeTruthy();
    await userEvent.type(code, CODE.slice(-1));
    expect(code).toHaveAttribute("aria-invalid", "false");
    expect(next).toHaveAttribute("aria-disabled", "false");
  });

  it("shows the code typed in its four boxes, and a paste of a code fills them all", async () => {
    render(invite(read(2), async () => "done"));
    const code = screen.getByRole("textbox", { name: "Invite code" });
    // The boxes are drawn for the eye alone: a screen reader hears the one field.
    expect(document.querySelector(".nt-code-shown")).toHaveAttribute("aria-hidden", "true");
    expect(boxes()).toEqual(["", "", "", ""]);
    expect(document.querySelectorAll(".nt-code-box")[0]).toHaveClass("nt-code-next");
    await userEvent.type(code, "n7va-k2");
    expect(boxes()).toEqual(["N7VA", "K2", "", ""]);
    expect(document.querySelector(".nt-code-next")).toBe(
      document.querySelectorAll(".nt-code-box")[1],
    );
    // A paste, as the field takes it: the whole value at once.
    await userEvent.fill(code, "n7va-k2qm-9xb4-zd3h");
    expect(boxes()).toEqual(["N7VA", "K2QM", "9XB4", "ZD3H"]);
    // Whole, the last box holds the caret.
    expect(document.querySelector(".nt-code-next")).toBe(
      document.querySelectorAll(".nt-code-box")[3],
    );
    expect(screen.getByRole("button", { name: "Continue" })).toHaveAttribute(
      "aria-disabled",
      "false",
    );
  });

  it("signs out by Back on the code's step", async () => {
    const onSignOut = vi.fn();
    const onCreate = vi.fn(async () => "done" as const);
    render(invite(read(2), onCreate, { onSignOut }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("asks for the statement and the texts before it sends, and sends the code trimmed", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(invite(read(2), onCreate));
    await toAgree(`  ${CODE} `);
    const create = screen.getByRole("button", { name: "Create account" });
    const adult = screen.getByRole("checkbox", { name: "I am 18 or older" });
    const accept = screen.getByRole("checkbox", ACCEPT);
    expect(adult).toHaveAccessibleDescription("Only grown-ups hold an account");
    expect(screen.getByText(NOTE)).toBeVisible();
    expect(create).toHaveAttribute("aria-disabled", "true");
    // Each tick missing is said and focused in turn, and nothing is sent.
    await userEvent.click(create, { force: true });
    expect(adult).toHaveAccessibleDescription(
      "Only grown-ups hold an account Only someone 18 or older can create an account",
    );
    expect(document.activeElement).toBe(adult);
    await userEvent.click(adult);
    expect(adult).toHaveAttribute("aria-invalid", "false");
    await userEvent.click(create, { force: true });
    expect(accept).toHaveAccessibleDescription(
      "To create an account, accept the Privacy Policy and the Terms of Use",
    );
    expect(document.activeElement).toBe(accept);
    expect(onCreate).not.toHaveBeenCalled();
    await userEvent.click(accept);
    expect(create).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(create);
    expect(onCreate).toHaveBeenCalledWith(CODE, [{ id: "privacy-policy", version: 2 }]);
  });

  it("keeps what was typed and ticked for when it comes again", async () => {
    const draft = { current: undefined };
    const { unmount } = render(invite(read(2), async () => "done", { draft }));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("checkbox", ACCEPT));
    unmount();
    render(invite(read(2), async () => "done", { draft }));
    expect(screen.getByRole("checkbox", { name: "I am 18 or older" })).toBeChecked();
    expect(screen.getByRole("checkbox", ACCEPT)).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Invite code" })).toHaveValue(CODE);
  });

  it("brings the code back with its line when api does not take it", async () => {
    const onCreate = vi.fn(async () => "code-not-accepted" as const);
    render(invite(read(2), onCreate));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("checkbox", ACCEPT));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    const code = await screen.findByRole("textbox", { name: "Invite code" });
    expect(code).toHaveAttribute("aria-invalid", "true");
    expect(code).toHaveAccessibleDescription(`${HINT} This code isn't valid or has been used`);
    await vi.waitFor(() => expect(document.activeElement).toBe(code));
    await userEvent.type(code, "2");
    expect(code).toHaveAttribute("aria-invalid", "false");
    // Taken on unchanged, the line is gone: nothing new was refused.
    await userEvent.type(code, "{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Invite code" })).toHaveAttribute(
      "aria-invalid",
      "false",
    );
  });

  it("leads from a text's name in the tick's line to its legal page, and shows no text itself", async () => {
    const onLegal = vi.fn();
    render(invite(read(2), async () => "done", { onLegal }));
    await toAgree();
    const terms = screen.getByRole("link", { name: "Terms of Use" });
    const privacy = screen.getByRole("link", { name: "Privacy Policy" });
    expect(terms).toHaveAttribute("href", "#/legal/terms-of-use");
    expect(privacy).toHaveAttribute("href", "#/legal/privacy-policy");
    await userEvent.click(terms);
    expect(onLegal).toHaveBeenLastCalledWith("terms-of-use");
    await userEvent.click(privacy);
    expect(onLegal).toHaveBeenLastCalledWith("privacy-policy");
    // The link does not tick the box whose line holds it.
    expect(screen.getByRole("checkbox", ACCEPT)).not.toBeChecked();
    // No text in place: its page shows it.
    expect(screen.queryByRole("heading", { level: 2 })).toBeNull();
    expect(document.querySelector("details, summary")).toBeNull();
    expect(screen.queryByText("In short, version 2.")).toBeNull();
    // The way at the card's foot opens the list of the legal pages.
    await userEvent.click(screen.getByRole("button", { name: "Privacy and legal information" }));
    expect(onLegal).toHaveBeenLastCalledWith();
  });

  it("takes the acceptance back when other versions are shown", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    const { rerender } = render(invite(read(2), onCreate));
    await toAgree();
    const accept = screen.getByRole("checkbox", ACCEPT);
    await userEvent.click(accept);
    expect(accept).toBeChecked();
    rerender(invite(read(3), onCreate));
    expect(accept).not.toBeChecked();
  });

  it("shows no next version, and the acceptance names the current one", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    const terms = create(LegalTextSchema, {
      id: "terms-of-use",
      version: 1,
      inForceSince: "2026-12-01",
      body: "# Terms of Use\n\nText.\n",
      summary: "The terms.",
      summaryLanguage: "en",
    });
    const { rerender } = render(invite(read(2, [policy(3, "2026-11-27"), terms]), onCreate));
    await toAgree();
    // A next version's page tells of it: here, neither its day nor its gist.
    expect(document.body.textContent).not.toMatch(/applies from|is in force|In short/);
    const accept = screen.getByRole("checkbox", ACCEPT);
    await userEvent.click(accept);
    // Another next version does not take the acceptance back: it is of the current ones.
    rerender(invite(read(2, [policy(4, "2026-12-27")]), onCreate));
    expect(accept).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith(CODE, [{ id: "privacy-policy", version: 2 }]);
  });

  it("has nothing to accept while only next versions are given, none in force", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    const only: TextsRead = {
      status: "done",
      value: { texts: [], next: [policy(1, "2026-11-27")] },
      retry: () => {},
    };
    render(invite(only, onCreate));
    await toAgree();
    expect(screen.queryByRole("checkbox", { name: /I agree/ })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText(NOTE)).toBeNull();
    expect(document.body.textContent).not.toMatch(/applies from|In short/);
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith(CODE, []);
  });

  it("says that the texts changed when api has some in force the screen did not show", async () => {
    const onCreate = vi.fn(async () => "text-not-current" as const);
    const none: TextsRead = { status: "done", value: { texts: [], next: [] }, retry: vi.fn() };
    render(invite(none, onCreate));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith(CODE, []);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The texts have changed. Read them again and accept them",
    );
    expect(none.retry).toHaveBeenCalledOnce();
  });

  it("says that the texts changed below their tick, and unticks it, when api has newer ones", async () => {
    const onCreate = vi.fn(async () => "text-not-current" as const);
    const texts = { ...read(2), retry: vi.fn() };
    render(invite(texts, onCreate));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    const accept = screen.getByRole("checkbox", ACCEPT);
    await userEvent.click(accept);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await vi.waitFor(() => expect(accept).toHaveAttribute("aria-invalid", "true"));
    expect(accept).not.toBeChecked();
    expect(accept).toHaveAccessibleDescription(
      "The texts have changed. Read them again and accept them",
    );
    expect(document.activeElement).toBe(accept);
    expect(texts.retry).toHaveBeenCalledOnce();
  });
});
