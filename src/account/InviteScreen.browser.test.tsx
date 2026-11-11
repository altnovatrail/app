// The invite code's screen with its texts in Chromium (R27): an acceptance holds for the versions
// it was given for, and a refusal of a version no longer current is said even with no text shown.
import { LegalTextSchema } from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { inLanguage } from "../test/language.tsx";
import { InviteScreen, type TextsRead } from "./AccountGate.tsx";

function read(policy: number): TextsRead {
  return {
    status: "done",
    value: [
      create(LegalTextSchema, {
        id: "privacy-policy",
        version: policy,
        body: "# Privacy Policy\n\nText.\n",
        summary: "In short.",
        summaryLanguage: "en",
      }),
    ],
    retry: () => {},
  };
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

  it("says that the texts changed when api has some in force the screen did not show", async () => {
    const onCreate = vi.fn(async () => "text-not-current" as const);
    const none: TextsRead = { status: "done", value: [], retry: vi.fn() };
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
