// A sheet, the mockup's legal text, and a failure screen's card in the browser: from 600 the
// sheet a white card of 560, radius 28, its top where the mockup's centred card of 580 has it, its
// head the heading at 24 bold with the chip under it, the way back before it where given and the
// close × on the page's grey at its other end; below 600 the whole screen, its heading 52 from the
// top; a failure screen a card of 460 in the window's middle, its button of the card's width.
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import { inLanguage } from "../test/language.tsx";
import { IconButton } from "./IconButton.tsx";
import { Screen } from "./Screen.tsx";
import { SheetScreen } from "./SheetScreen.tsx";

const box = (element: Element) => element.getBoundingClientRect();

const column = () => {
  const found = document.querySelector("main > .nt-column");
  if (found === null) throw new Error("no column");
  return found;
};

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe("a sheet", () => {
  it("is a card of 560 from 600, its head the heading, the chip, the way back and the close", async () => {
    await page.viewport(1194, 834);
    const closed = vi.fn();
    render(
      inLanguage(
        <SheetScreen
          title="Privacy Policy"
          chip="Version 2, in force since 11 November 2026"
          back={<IconButton value="back" caption="legal.back" onClick={() => {}} />}
          onClose={closed}
        >
          <p>The gist.</p>
        </SheetScreen>,
      ),
    );
    const card = box(column());
    expect([card.x, card.y, card.width]).toEqual([317, 127, 560]);
    expect(getComputedStyle(column()).borderRadius).toBe("28px");
    expect(getComputedStyle(column()).backgroundColor).toBe("rgb(255, 255, 255)");
    const heading = screen.getByRole("heading", { level: 1, name: "Privacy Policy" });
    expect(getComputedStyle(heading).fontSize).toBe("24px");
    expect(getComputedStyle(heading).fontWeight).toBe("700");
    const back = screen.getByRole("button", { name: "Back to the list" });
    const close = screen.getByRole("button", { name: "Close" });
    // The way back before the heading, the close at the card's other end, 28 inside it.
    expect(box(back).right).toBeLessThan(box(heading).left);
    expect(Math.round(box(close).right)).toBe(877 - 28);
    expect(getComputedStyle(close).backgroundColor).toBe("rgb(242, 242, 247)");
    const chip = screen.getByText("Version 2, in force since 11 November 2026");
    expect(box(chip).top).toBeGreaterThan(box(heading).bottom);
    expect(box(chip).height).toBe(24);
    expect(getComputedStyle(chip).color).toBe("rgb(30, 122, 53)");
    await userEvent.click(close);
    expect(closed).toHaveBeenCalledOnce();
  });

  it("is the whole screen below 600, its heading 52 from the top", async () => {
    await page.viewport(390, 844);
    render(
      inLanguage(
        <SheetScreen title="Terms of Use" chip="Version 1" onClose={() => {}}>
          <p>The gist.</p>
        </SheetScreen>,
      ),
    );
    const card = box(column());
    expect([card.x, card.y, card.width]).toEqual([0, 0, 390]);
    expect(card.height).toBeGreaterThanOrEqual(844);
    expect(getComputedStyle(column()).borderRadius).toBe("0px");
    const heading = box(screen.getByRole("heading", { level: 1, name: "Terms of Use" }));
    expect([heading.x, heading.y]).toEqual([20, 52]);
    expect(box(screen.getByText("Version 1")).height).toBe(30);
    expect(Math.round(box(screen.getByRole("button", { name: "Close" })).right)).toBe(370);
  });

  it("has neither the way back nor the close where none is given", () => {
    render(inLanguage(<SheetScreen title="Accessibility" />));
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector(".nt-version-chip")).toBeNull();
  });
});

describe("a failure screen", () => {
  it.each([
    [1194, 834, 460],
    [390, 844, 358],
  ])("at %i × %i is a card of %i in the window's middle", async (width, height, wide) => {
    await page.viewport(width, height);
    render(
      inLanguage(
        <Screen title="No connection" layout="failure">
          <div className="nt-buttons">
            <button type="button" className="nt-main">
              Try again
            </button>
          </div>
        </Screen>,
      ),
    );
    const card = box(column());
    expect(card.width).toBe(wide);
    expect(Math.round(card.x + card.width / 2)).toBe(width / 2);
    expect(Math.abs(card.y + card.height / 2 - height / 2)).toBeLessThanOrEqual(1);
    const button = box(screen.getByRole("button", { name: "Try again" }));
    expect(button.width).toBe(wide - 56);
    expect(button.height).toBe(52);
    expect(getComputedStyle(screen.getByRole("heading", { level: 1 })).fontSize).toBe("22px");
  });

  it("stands right under a bar above its screen, not in the middle of the whole window", async () => {
    await page.viewport(1194, 834);
    render(
      inLanguage(
        <>
          <header className="nt-bar">
            <p>Learning now</p>
          </header>
          <div data-screen="home">
            <Screen title="No connection" layout="failure" />
          </div>
        </>,
      ),
    );
    const bar = box(document.querySelector("header") as Element);
    const card = box(column());
    expect(card.y).toBe(bar.bottom + 16);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(834);
  });
});
