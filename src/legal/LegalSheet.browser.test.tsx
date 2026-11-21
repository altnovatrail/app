// The sheet of a legal text in the browser (R69): its gist is a stop of Tab only while it scrolls,
// which in Safari takes the focus (О-24), and no stop when the whole of it shows.
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
  it("takes the focus while it scrolls", async () => {
    sheet(Array.from({ length: 200 }, (_, i) => `Sentence ${i + 1} of the gist.`).join(" "));
    const gist = screen.getByRole("region", { name: "In short" });
    await expect.poll(() => gist.getAttribute("tabindex")).toBe("0");
  });

  it("is no stop of Tab when the whole of it shows", async () => {
    sheet("In short, version 2.");
    const gist = screen.getByRole("region", { name: "In short" });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(gist).not.toHaveAttribute("tabindex");
  });
});
