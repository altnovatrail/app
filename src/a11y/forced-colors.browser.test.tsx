// The screens in forced colours (section 3.9 of docs/architecture.md), a mode of the browser's
// context from the start, as canvas has it: the system's colours take the theme's, nothing of app
// turns them off, a button keeps its border and the focus its ring.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import { ProfileSchema } from "@altnovatrail/contracts/novatrail/api/v1/account_pb.js";
import { create } from "@bufbuild/protobuf";
import { ProfilePage } from "../adults/ProfilePage.tsx";
import { ApiProvider } from "../api/ApiContext.tsx";
import type { Api } from "../api/client.ts";
import { Offline } from "../boot/Screens.tsx";
import { LanguageButtons } from "../i18n/LanguageButtons.tsx";
import { axeViolations } from "../test/a11y.ts";
import { inLanguage } from "../test/language.tsx";

describe("forced colours", () => {
  it("are on, and a button keeps its border and the focus its ring", async () => {
    expect(matchMedia("(forced-colors: active)").matches).toBe(true);
    render(inLanguage(<Offline onRetry={() => {}} />));
    const button = page.getByRole("button", { name: "Try again" }).element() as HTMLElement;
    const style = getComputedStyle(button);
    expect(style.borderTopStyle).toBe("solid");
    expect(style.forcedColorAdjust).toBe("auto");
    await userEvent.tab();
    expect(document.activeElement).toBe(button);
    expect(getComputedStyle(button).outlineStyle).toBe("solid");
    expect(await axeViolations()).toEqual([]);
  });

  it("keep the fields and choices of a profile's page in the system's colours", async () => {
    const profile = create(ProfileSchema, { profileId: "p1", owner: true, pseudonym: "Ёжик" });
    render(
      inLanguage(
        <ApiProvider value={{} as Api}>
          <ProfilePage profile={profile} onSaved={() => {}} onFailed={() => {}} />
        </ApiProvider>,
      ),
    );
    const radio = page.getByRole("radio", { name: "Step by step" }).element() as HTMLElement;
    expect(getComputedStyle(radio).forcedColorAdjust).toBe("auto");
    expect(radio).toBeChecked();
    expect(await axeViolations()).toEqual([]);
  });

  it("keep the chosen language told from the others by more than colour", () => {
    render(inLanguage(<LanguageButtons />, "ru"));
    const style = (name: string) =>
      getComputedStyle(page.getByRole("button", { name }).element() as HTMLElement);
    expect(style("Русский").textDecorationLine).toBe("underline");
    expect(style("English").textDecorationLine).toBe("none");
  });
});
