// The sheet of a legal text in the browser (R69): a long gist makes the whole card scroll, which
// holds what takes the focus, so that Safari scrolls it from the keyboard (О-24); the gist is no box
// that scrolls and no stop of Tab.
import {
  type LegalText,
  LegalTextSchema,
} from "@altnovatrail/contracts/novatrail/api/v1/legal_pb.js";
import { create } from "@bufbuild/protobuf";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { LegalSheet } from "./LegalSheet.tsx";

function policy(summary: string): LegalText {
  return create(LegalTextSchema, {
    id: "privacy-policy",
    version: 2,
    inForceSince: "2026-11-11",
    body: "# Privacy Policy\n\nText.\n",
    summary,
    summaryLanguage: "en",
  });
}

function sheet(summary: string) {
  const versions = {
    status: "done",
    value: { current: policy(summary), next: undefined },
    retry: () => {},
  } as const;
  return render(
    inLanguage(
      <LegalSheet id="privacy-policy" versions={versions} onClose={() => {}} onPage={() => {}} />,
    ),
  );
}

describe("the gist of a legal text's sheet", () => {
  it("makes the whole card scroll when it is long, the focus in the card", async () => {
    sheet(Array.from({ length: 200 }, (_, i) => `Sentence ${i + 1} of the gist.`).join(" "));
    const card = screen.getByRole("dialog", { name: "Privacy Policy" });
    const gist = screen.getByRole("region", { name: "In short" });
    await expect.poll(() => card.scrollHeight > card.clientHeight).toBe(true);
    expect(gist.scrollHeight).toBe(gist.clientHeight);
    expect(gist).not.toHaveAttribute("tabindex");
    expect(card.contains(document.activeElement)).toBe(true);
  });

  it("is the card's whole height when it is short", async () => {
    sheet("In short, version 2.");
    const card = screen.getByRole("dialog", { name: "Privacy Policy" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(card.scrollHeight).toBe(card.clientHeight);
  });
});
