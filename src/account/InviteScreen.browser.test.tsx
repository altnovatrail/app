// The invite code's screen with its texts in the browser (R27; R46): an acceptance holds for the
// versions it was given for, a refusal of a version no longer current is said even with no text
// shown, and a text's next version shows in place below it while the acceptance names the current.
import {
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { InviteScreen, type TextsRead } from "./AccountGate.tsx";

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

describe("the invite code's screen", () => {
  it("takes the acceptance back when other versions are shown", async () => {
    const onCreate = vi.fn(async () => "done" as const);
    const { rerender } = render(inLanguage(<InviteScreen texts={read(2)} onCreate={onCreate} />));
    const accept = screen.getByRole("checkbox", {
      name: "I accept the Privacy Policy and the Terms of Use",
    });
    await userEvent.click(accept);
    expect(accept).toBeChecked();
    rerender(inLanguage(<InviteScreen texts={read(3)} onCreate={onCreate} />));
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
    const { rerender } = render(
      inLanguage(
        <InviteScreen texts={read(2, [policy(3, "2026-11-27"), terms])} onCreate={onCreate} />,
      ),
    );
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
    const accept = screen.getByRole("checkbox", {
      name: "I accept the Privacy Policy and the Terms of Use",
    });
    await userEvent.click(accept);
    // Another next version does not take the acceptance back: it is of the current ones.
    rerender(
      inLanguage(<InviteScreen texts={read(2, [policy(4, "2026-12-27")])} onCreate={onCreate} />),
    );
    expect(accept).toBeChecked();
    await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), "CODE");
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
    render(inLanguage(<InviteScreen texts={only} onCreate={onCreate} />));
    const titles = [...document.querySelectorAll("summary")].map((each) => each.textContent);
    expect(titles).toEqual(["Privacy Policy: version 1, applies from November 27, 2026"]);
    expect(screen.queryByRole("checkbox", { name: /I accept/ })).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), "CODE");
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith("CODE", []);
  });

  it("says that the texts changed when api has some in force the screen did not show", async () => {
    const onCreate = vi.fn(async () => "text-not-current" as const);
    const none: TextsRead = { status: "done", value: { texts: [], next: [] }, retry: vi.fn() };
    render(inLanguage(<InviteScreen texts={none} onCreate={onCreate} />));
    await userEvent.type(screen.getByRole("textbox", { name: "Invite code" }), "CODE");
    await userEvent.click(screen.getByRole("checkbox", { name: "I am 18 or older" }));
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(onCreate).toHaveBeenCalledWith("CODE", []);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The texts have changed. Read them again and accept them",
    );
    expect(none.retry).toHaveBeenCalledOnce();
  });
});
