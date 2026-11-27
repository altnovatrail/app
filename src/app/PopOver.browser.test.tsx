// The pop-over in each engine: from 600 CSS px it hangs from its button, below 600 it is a
// sheet from the bottom with "Close"; Escape, a tap outside and a choice close it; the focus goes
// into it and comes back to its button; and at 320 px — a zoom of 400 % of 1280 — the page does not
// scroll sideways.
import { render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import { overflows, settledViolations, smallTargets } from "../test/a11y.ts";
import { inLanguage } from "../test/language.tsx";
import { GAP } from "./hang.ts";
import { PopOver } from "./PopOver.tsx";

function Choice({ place = "start" }: { readonly place?: "start" | "end" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: place === "end" ? "flex-end" : "flex-start",
        padding: "1rem",
      }}
    >
      <PopOver label="Solving mode" className="nt-secondary">
        {(close) => (
          <div role="radiogroup" aria-label="Solving mode">
            <button type="button" onClick={close}>
              Step by step
            </button>
            <button type="button" onClick={close}>
              On my own
            </button>
          </div>
        )}
      </PopOver>
    </div>
  );
}

/** Where across its box the pop-over grows from, CSS px from its left. */
const originX = (dialog: HTMLElement) =>
  Number.parseFloat(getComputedStyle(dialog).transformOrigin.split(" ")[0] ?? "");

const opener = () => page.getByRole("button", { name: "Solving mode" });

/** The pop-over once it is open and its motion is over, so that its box is its place. */
async function opened(): Promise<HTMLDialogElement> {
  await opener().click();
  const shown = page.getByRole("dialog", { name: "Solving mode" });
  await expect.element(shown).toBeVisible();
  const dialog = shown.element() as HTMLDialogElement;
  await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
  return dialog;
}

async function closedToButton() {
  await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  expect(document.activeElement).toBe(opener().element());
  await expect.element(opener()).toHaveAttribute("aria-expanded", "false");
}

afterEach(async () => {
  await page.viewport(1024, 768);
});

describe.each([600, 834, 1194])("a pop-over at %i px", (width) => {
  it("hangs from its button, takes the focus, and gives it back on Escape", async () => {
    await page.viewport(width, 834);
    render(inLanguage(<Choice />));
    const dialog = await opened();
    await expect.element(opener()).toHaveAttribute("aria-expanded", "true");
    const from = opener().element().getBoundingClientRect();
    const box = dialog.getBoundingClientRect();
    expect(Math.round(box.top)).toBe(Math.round(from.bottom + GAP));
    expect(Math.round(box.left)).toBe(Math.round(from.left));
    expect(originX(dialog)).toBe(0);
    expect(getComputedStyle(dialog).backgroundColor).toBe("rgba(255, 255, 255, 0.86)");
    expect(document.activeElement).toBe(
      page.getByRole("button", { name: "Step by step" }).element(),
    );
    expect(page.getByRole("button", { name: "Close" }).query()).toBeNull();
    await userEvent.keyboard("{Escape}");
    await closedToButton();
  });

  it("hangs centred below its button's middle, its button showing a caption of its own", async () => {
    await page.viewport(width, 834);
    const ref = createRef<HTMLButtonElement>();
    render(
      inLanguage(
        <div style={{ display: "flex", justifyContent: "center", padding: "1rem" }}>
          <p id="why">Why</p>
          <PopOver
            label="Avatar"
            caption={<span>Choose one</span>}
            buttonRef={ref}
            describedBy="why"
            centred
            popClassName="nt-wide"
          >
            <button type="button">Peak</button>
          </PopOver>
        </div>,
      ),
    );
    const button = page.getByRole("button", { name: "Choose one" });
    await expect.element(button).toHaveAccessibleDescription("Why");
    expect(ref.current).toBe(button.element());
    await button.click();
    const shown = page.getByRole("dialog", { name: "Avatar" });
    await expect.element(shown).toBeVisible();
    const dialog = shown.element() as HTMLDialogElement;
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    expect(dialog.classList).toContain("nt-wide");
    const from = button.element().getBoundingClientRect();
    const box = dialog.getBoundingClientRect();
    expect(Math.round(box.left + box.width / 2)).toBe(Math.round(from.left + from.width / 2));
    expect(originX(dialog)).toBeCloseTo(box.width / 2, 0);
  });

  it("hangs from the ancestor its anchor names, as a lesson's segments from the bar's pill", async () => {
    await page.viewport(width, 834);
    render(
      inLanguage(
        <div
          className="nt-pill"
          style={{ display: "inline-flex", margin: "1rem", padding: "1rem" }}
        >
          <PopOver label="Segments" anchor=".nt-pill" gap={6}>
            <button type="button">One</button>
          </PopOver>
        </div>,
      ),
    );
    await page.getByRole("button", { name: "Segments" }).click();
    const dialog = page.getByRole("dialog", { name: "Segments" }).element() as HTMLDialogElement;
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const from = (document.querySelector(".nt-pill") as HTMLElement).getBoundingClientRect();
    const box = dialog.getBoundingClientRect();
    expect(Math.round(box.left)).toBe(Math.round(from.left));
    expect(Math.round(box.top)).toBe(Math.round(from.bottom + 6));
  });

  it("is as wide as its anchor where it fits it, and opens at its top though it scrolls", async () => {
    await page.viewport(width, 834);
    render(
      inLanguage(
        <div className="nt-way" style={{ margin: "1rem", inlineSize: "24rem" }}>
          <PopOver label="Which tasks" anchor=".nt-way" fitAnchor popClassName="nt-pick">
            {Array.from({ length: 40 }, (_, n) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the rows are only many.
              <button key={n} type="button">
                Skill {n + 1}
              </button>
            ))}
          </PopOver>
        </div>,
      ),
    );
    await page.getByRole("button", { name: "Which tasks" }).click();
    const dialog = page.getByRole("dialog", { name: "Which tasks" }).element() as HTMLDialogElement;
    await Promise.all(dialog.getAnimations().map((animation) => animation.finished));
    const from = (document.querySelector(".nt-way") as HTMLElement).getBoundingClientRect();
    expect(Math.round(dialog.getBoundingClientRect().width)).toBe(Math.round(from.width));
    expect(dialog.scrollHeight).toBeGreaterThan(dialog.clientHeight);
    expect(document.activeElement).toHaveTextContent("Skill 1");
    expect(dialog.scrollTop).toBe(0);
  });

  it("hangs at its button's right edge near the window's right", async () => {
    await page.viewport(width, 834);
    render(inLanguage(<Choice place="end" />));
    const dialog = await opened();
    const from = opener().element().getBoundingClientRect();
    const box = dialog.getBoundingClientRect();
    expect(Math.round(box.right)).toBe(Math.round(from.right));
    expect(originX(dialog)).toBeCloseTo(box.width, 0);
  });

  it("closes on a tap outside it, and on a choice", async () => {
    await page.viewport(width, 834);
    render(inLanguage(<Choice />));
    const dialog = await opened();
    await userEvent.click(dialog, { position: { x: dialog.offsetWidth + 40, y: 20 } });
    await closedToButton();
    await opened();
    await page.getByRole("button", { name: "On my own" }).click();
    await closedToButton();
  });

  it("stays open for a press inside that is released outside it", async () => {
    await page.viewport(width, 834);
    render(inLanguage(<Choice />));
    const dialog = await opened();
    const box = dialog.getBoundingClientRect();
    const away = { bubbles: true, clientX: box.right + 40, clientY: box.top + 10 };
    page
      .getByRole("button", { name: "On my own" })
      .element()
      .dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent("click", away));
    expect(dialog.open).toBe(true);
    dialog.dispatchEvent(new PointerEvent("pointerdown", away));
    dialog.dispatchEvent(new MouseEvent("click", { ...away, clientX: box.left + 10 }));
    expect(dialog.open).toBe(true);
  });
});

describe.each([390, 599, 320])("a pop-over at %i px", (width) => {
  it("is a sheet from the bottom, the whole width, which Close closes", async () => {
    await page.viewport(width, 844);
    render(inLanguage(<Choice />));
    const dialog = await opened();
    const box = dialog.getBoundingClientRect();
    expect(Math.round(box.left)).toBe(0);
    expect(Math.round(box.right)).toBe(document.documentElement.clientWidth);
    expect(Math.round(box.bottom)).toBe(window.innerHeight);
    expect(getComputedStyle(dialog).backgroundColor).toBe("rgb(255, 255, 255)");
    expect(document.activeElement).toBe(
      page.getByRole("button", { name: "Step by step" }).element(),
    );
    expect(await settledViolations()).toEqual([]);
    expect(smallTargets()).toEqual([]);
    expect(overflows()).toEqual([]);
    await page.getByRole("button", { name: "Close" }).click();
    await closedToButton();
  });

  it("closes on a tap above the sheet, on the dimmed page", async () => {
    await page.viewport(width, 844);
    render(inLanguage(<Choice />));
    const dialog = await opened();
    await userEvent.click(dialog, { position: { x: 20, y: -40 } });
    await closedToButton();
  });
});

/** A pop-over that holds while told, and tells when it closes. */
function Held(props: { readonly holds: boolean; readonly onClosed: () => void }) {
  return (
    <PopOver label="Solving mode" holds={props.holds} onClosed={props.onClosed}>
      {(close) => (
        <button type="button" onClick={close}>
          Step by step
        </button>
      )}
    </PopOver>
  );
}

describe("a pop-over that holds", () => {
  it("closes by nothing while it holds, and tells when it closes once it no longer does", async () => {
    await page.viewport(390, 844);
    let closings = 0;
    const closed = () => closings++;
    const { rerender } = render(inLanguage(<Held holds onClosed={closed} />));
    await opened();
    await userEvent.keyboard("{Escape}");
    await page.getByRole("button", { name: "Close" }).click();
    await page.getByRole("button", { name: "Step by step" }).click();
    await expect.element(page.getByRole("dialog", { name: "Solving mode" })).toBeVisible();
    expect(closings).toBe(0);
    rerender(inLanguage(<Held holds={false} onClosed={closed} />));
    await page.getByRole("button", { name: "Close" }).click();
    await closedToButton();
    expect(closings).toBe(1);
  });
});

describe("a pop-over's focus ring", () => {
  const ring = () =>
    getComputedStyle(page.getByRole("button", { name: "Step by step" }).element()).outlineStyle;

  it("is not drawn on what takes the focus when a tap opens it, and is once a key is pressed", async () => {
    render(inLanguage(<Choice />));
    await opened();
    expect(ring()).toBe("none");
    await userEvent.keyboard("{Tab}");
    await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
    expect(ring()).toBe("solid");
  });

  it("is drawn when the keyboard opens it", async () => {
    render(inLanguage(<Choice />));
    opener().element().focus();
    await userEvent.keyboard("{Enter}");
    await expect.element(page.getByRole("dialog", { name: "Solving mode" })).toBeVisible();
    expect(ring()).toBe("solid");
  });
});
