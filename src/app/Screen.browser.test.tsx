import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { inLanguage } from "../test/language.tsx";
import { Screen } from "./Screen.tsx";

describe("Screen", () => {
  it("titles the document in the screen's language, and leaves the focus of the first screen", () => {
    // Under StrictMode, as main.tsx renders: the effects run twice, the screen is still the first.
    render(<StrictMode>{inLanguage(<Screen title="Нет связи" />, "ru")}</StrictMode>);
    expect(document.title).toBe("Нет связи — NovaTrail");
    expect(screen.getByRole("main").getAttribute("lang")).toBe("ru");
    expect(document.activeElement).toBe(document.body);
  });

  it("puts the focus on the heading of a screen that takes another's place, not while it stays", () => {
    const { rerender } = render(
      inLanguage(
        <Screen key="one" title="One">
          <button type="button">Stay</button>
        </Screen>,
      ),
    );
    rerender(
      inLanguage(
        <Screen key="two" title="Two">
          <button type="button">Stay</button>
        </Screen>,
      ),
    );
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Two" }));
    screen.getByRole("button", { name: "Stay" }).focus();
    rerender(
      inLanguage(
        <Screen key="two" title="Two again">
          <button type="button">Stay</button>
        </Screen>,
      ),
    );
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay" }));
    expect(document.title).toBe("Two again — NovaTrail");
  });

  it("does not repeat the app's name in the title of a screen of that name", () => {
    render(inLanguage(<Screen title="NovaTrail" />));
    expect(document.title).toBe("NovaTrail");
  });
});
