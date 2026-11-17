// The invite code's screen with its texts in the browser (R27; R46; R61): the code, then the
// statement and the texts; an acceptance holds for the versions it was given for, a refusal of a
// version no longer current is said even with no text shown, a text's next version shows in place
// below it while the acceptance names the current, and a code api did not take brings its step back.
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
  draft?: InviteScreenProps["draft"],
) {
  return inLanguage(
    <InviteScreen texts={texts} draft={draft} onCreate={onCreate} onLegal={() => {}} />,
  );
}

/** The code typed and taken on to the statement and the texts. */
async function toAgree(code = "CODE") {
  await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), code);
  await userEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { level: 1, name: "Create your account" });
}

const ACCEPT = { name: "I accept the Privacy Policy and the Terms of Use" };

describe("the invite code's screen", () => {
  it("goes on from the code alone, and back to it as it was", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(invite(read(2), onCreate));
    const next = screen.getByRole("button", { name: "Continue" });
    const code = screen.getByRole("textbox", { name: "Invite code" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    await userEvent.type(code, "   ");
    expect(next).toHaveAttribute("aria-disabled", "true");
    // Pressed while it looks off, it says what is missing, and the field takes the focus.
    await userEvent.click(next, { force: true });
    expect(code).toHaveAccessibleDescription("The code from your invitation Enter the invite code");
    expect(document.activeElement).toBe(code);
    await userEvent.clear(code);
    expect(code).toHaveAttribute("aria-invalid", "false");
    await toAgree();
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Invite code" })).toHaveValue("CODE");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("asks for the statement and the texts before it sends, and sends the code trimmed", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    render(invite(read(2), onCreate));
    await toAgree("  CODE ");
    const create = screen.getByRole("button", { name: "Create account" });
    const adult = screen.getByRole("checkbox", { name: "I am 18 or older" });
    const accept = screen.getByRole("checkbox", ACCEPT);
    expect(adult).toHaveAccessibleDescription("Only grown-ups hold an account");
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
    expect(onCreate).toHaveBeenCalledWith("CODE", [{ id: "privacy-policy", version: 2 }]);
  });

  it("keeps what was typed and ticked for when it comes again", async () => {
    const draft = { current: undefined };
    const { unmount } = render(invite(read(2), async () => "done", draft));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("checkbox", ACCEPT));
    unmount();
    render(invite(read(2), async () => "done", draft));
    expect(screen.getByRole("checkbox", { name: "I am 18 or older" })).toBeChecked();
    expect(screen.getByRole("checkbox", ACCEPT)).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Invite code" })).toHaveValue("CODE");
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
    expect(code).toHaveAccessibleDescription(
      "The code from your invitation This code isn't valid or has been used",
    );
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

  it("leads from a text's name in the tick's line down to the text", async () => {
    render(invite(read(2), async () => "done"));
    await toAgree();
    await userEvent.click(screen.getByRole("link", { name: "Privacy Policy" }));
    expect(document.activeElement?.textContent).toContain("Privacy Policy");
    // The link does not tick the box whose line holds it.
    expect(screen.getByRole("checkbox", ACCEPT)).not.toBeChecked();
    await userEvent.click(screen.getByRole("link", { name: "Terms of Use" }));
    expect(document.activeElement?.tagName).toBe("DIV");
    expect(document.activeElement?.id).toBe(
      screen.getByRole("link", { name: "Terms of Use" }).getAttribute("href")?.slice(1),
    );
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

  it("shows a text's next version in place below it, and the acceptance names the current one", async () => {
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
    const titles = [...document.querySelectorAll("summary")].map((each) => each.textContent);
    expect(titles).toEqual([
      "Privacy Policy",
      "Privacy Policy: version 3, applies from November 27, 2026",
      "Terms of Use: version 1, applies from December 1, 2026",
    ]);
    await userEvent.click(document.querySelectorAll("summary")[1] as HTMLElement);
    expect(screen.getByText("Until then, version 2 is in force")).toBeVisible();
    expect(screen.getByText("In short, version 3.")).toBeVisible();
    // A text with no current version has nothing in force until then.
    expect(document.body.textContent?.match(/is in force/g)).toHaveLength(1);
    const accept = screen.getByRole("checkbox", ACCEPT);
    await userEvent.click(accept);
    // Another next version does not take the acceptance back: it is of the current ones.
    rerender(invite(read(2, [policy(4, "2026-12-27")]), onCreate));
    expect(accept).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith("CODE", [{ id: "privacy-policy", version: 2 }]);
  });

  it("shows next versions before any is in force, with nothing to accept", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    const only: TextsRead = {
      status: "done",
      value: { texts: [], next: [policy(1, "2026-11-27")] },
      retry: () => {},
    };
    render(invite(only, onCreate));
    await toAgree();
    const titles = [...document.querySelectorAll("summary")].map((each) => each.textContent);
    expect(titles).toEqual(["Privacy Policy: version 1, applies from November 27, 2026"]);
    expect(screen.queryByRole("checkbox", { name: /I accept/ })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith("CODE", []);
  });

  it("says that the texts changed when api has some in force the screen did not show", async () => {
    const onCreate = vi.fn(async () => "text-not-current" as const);
    const none: TextsRead = { status: "done", value: { texts: [], next: [] }, retry: vi.fn() };
    render(invite(none, onCreate));
    await toAgree();
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith("CODE", []);
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
