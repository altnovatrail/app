// The buttons that show an icon alone, in each engine (R60 in docs/decisions.md; section 3.9 of
// docs/architecture.md): only those of the closed list, each named by its caption, 44 × 44 — the
// grabber 88 × 44 —, with a tooltip of the same words on hover and on keyboard focus, which stays
// while the pointer is over it and which Escape dismisses without moving the focus (WCAG 1.4.13).
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import "../theme/theme.css";
import { WORDS } from "../i18n/words.ts";
import { axeViolations, captionlessOffList, smallTargets } from "../test/a11y.ts";
import { inLanguage } from "../test/language.tsx";
import { CAPTIONLESS, type Captionless, IconButton } from "./IconButton.tsx";
import { ICONS, VALUES } from "./icons.ts";
import { PopOver } from "./PopOver.tsx";
import { MARGIN } from "./tip.ts";

const VALUES_OF_LIST = Object.keys(CAPTIONLESS) as Captionless[];

/** The tooltip on the page, once it has come; null while there is none. */
const tooltip = () => document.querySelector<HTMLElement>(".nt-tooltip");

async function tooltipShown(words: string): Promise<HTMLElement> {
  await expect.poll(() => tooltip()?.textContent).toBe(words);
  return tooltip() as HTMLElement;
}

async function noTooltip() {
  await expect.poll(() => tooltip()).toBeNull();
}

afterEach(async () => {
  await userEvent.unhover(document.body);
  await page.viewport(1024, 768);
});

describe("a button of the closed list", () => {
  it.each(["en", "ru"] as const)(
    "is named by its caption in %s, shows no text, and is a target of 44 × 44",
    async (language) => {
      render(
        inLanguage(
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", padding: "1rem" }}>
            {VALUES_OF_LIST.map((value) => (
              <IconButton key={value} value={value} />
            ))}
          </div>,
          language,
        ),
      );
      for (const value of VALUES_OF_LIST) {
        const button = page.getByRole("button", {
          name: WORDS[language].text(CAPTIONLESS[value].word),
        });
        await expect.element(button).toBeVisible();
        const drawn = button.element() as HTMLButtonElement;
        expect(drawn.textContent).toBe("");
        expect(drawn.getAttribute("title")).toBeNull();
        const box = drawn.getBoundingClientRect();
        const grabber = CAPTIONLESS[value].icon === undefined;
        expect([box.width, box.height]).toEqual([grabber ? 88 : 44, 44]);
        expect(
          drawn.querySelector(grabber ? ".nt-grabber-bar" : "svg")?.getAttribute("aria-hidden"),
        ).toBe("true");
      }
      expect(smallTargets()).toEqual([]);
      expect(await axeViolations()).toEqual([]);
    },
  );

  it("takes a caption in place of the list's, where it names where it goes, with the same icon", () => {
    render(inLanguage(<IconButton value="back" caption="lesson.leave" />));
    const button = screen.getByRole("button", { name: "Leave the lesson" });
    expect(button.querySelector("path")?.getAttribute("d")).toBe(
      ICONS[VALUES.back.outline].paths[0],
    );
    expect(captionlessOffList(WORDS.en)).toEqual([]);
  });

  it("takes that caption on its own button alone: on another icon it is off the list", () => {
    render(
      <button type="button" className="nt-icon-only" aria-label="Leave the lesson">
        <svg aria-hidden="true">
          <path d={ICONS[VALUES.close.outline].paths[0]} />
        </svg>
      </button>,
    );
    expect(captionlessOffList(WORDS.en)).toEqual(["Leave the lesson"]);
  });

  it("draws the fill while what it stands for is on, for a value that has one", () => {
    const { container } = render(
      inLanguage(
        <>
          <IconButton value="voicing" chosen aria-pressed />
          <IconButton value="read-aloud" chosen />
        </>,
      ),
    );
    const [voicing, read] = [...container.querySelectorAll("svg")];
    const paths = (svg: SVGSVGElement | undefined) =>
      [...(svg?.querySelectorAll("path") ?? [])].map((path) => path.getAttribute("d"));
    expect(paths(voicing)).toEqual(ICONS[VALUES.voicing.filled].paths);
    expect(VALUES.voicing.filled).not.toBe(VALUES.voicing.outline);
    expect(paths(read)).toEqual(ICONS[VALUES["read-aloud"].outline].paths);
  });
});

describe("its tooltip", () => {
  it("comes on keyboard focus in the words of the name, and Escape dismisses it alone", async () => {
    render(
      inLanguage(
        <>
          <button type="button">Before</button>
          <IconButton value="help" />
        </>,
      ),
    );
    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.tab();
    const help = page.getByRole("button", { name: "Help" }).element();
    expect(document.activeElement).toBe(help);
    const shown = await tooltipShown("Help");
    expect(shown.getAttribute("aria-hidden")).toBe("true");
    expect(help).not.toHaveAttribute("aria-describedby");
    const bubble = getComputedStyle(shown.firstElementChild as HTMLElement);
    expect(bubble.backgroundColor).toBe("rgb(29, 29, 31)");
    expect(bubble.color).toBe("rgb(255, 255, 255)");
    expect(bubble.borderTopLeftRadius).toBe("9px");
    expect(bubble.fontSize).toBe("12.5px");
    // Below the button, its gap the tooltip's own padding, so that no gap parts them.
    expect(Math.round(shown.getBoundingClientRect().top)).toBe(
      Math.round(help.getBoundingClientRect().bottom),
    );
    await userEvent.keyboard("{Escape}");
    await noTooltip();
    expect(document.activeElement).toBe(help);
    // Dismissed, it stays away while the focus stays, and comes back with the next focus.
    await new Promise((done) => setTimeout(done, 400));
    expect(tooltip()).toBeNull();
    await userEvent.tab({ shift: true });
    await userEvent.tab();
    await tooltipShown("Help");
    await userEvent.tab({ shift: true });
    await noTooltip();
  });

  it("comes on hover, stays while the pointer is over it, and goes once the pointer leaves", async () => {
    render(
      inLanguage(
        <div style={{ padding: "2rem" }}>
          <IconButton value="back" />
          <p>Elsewhere</p>
        </div>,
      ),
    );
    await userEvent.hover(page.getByRole("button", { name: "Back" }));
    const shown = await tooltipShown("Back");
    await userEvent.hover(shown);
    await new Promise((done) => setTimeout(done, 400));
    expect(tooltip()?.textContent).toBe("Back");
    await userEvent.hover(page.getByText("Elsewhere"));
    await noTooltip();
  });

  it("lets Escape go on to the focus elsewhere, and comes back with a new focus under the pointer", async () => {
    const keys: string[] = [];
    render(
      inLanguage(
        <div style={{ padding: "2rem" }}>
          <button type="button" onKeyDown={(event) => keys.push(event.key)}>
            Before
          </button>
          <IconButton value="tutor" />
        </div>,
      ),
    );
    page.getByRole("button", { name: "Before" }).element().focus();
    await userEvent.hover(page.getByRole("button", { name: "Tutor" }));
    await tooltipShown("Tutor");
    await userEvent.keyboard("{Escape}");
    await noTooltip();
    expect(keys).toEqual(["Escape"]);
    // The pointer stays on the button: the keyboard's focus brings the tooltip back.
    await userEvent.tab();
    await tooltipShown("Tutor");
  });

  it("stays inside the window at its edge, at 320 px, its words changed too", async () => {
    await page.viewport(320, 640);
    const shown = (language: "en" | "ru") =>
      inLanguage(
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <IconButton value="previous-task" />
        </div>,
        language,
      );
    const { rerender } = render(shown("en"));
    await userEvent.hover(page.getByRole("button", { name: "Previous task" }));
    await tooltipShown("Previous task");
    rerender(shown("ru"));
    const tip = await tooltipShown("Предыдущая задача");
    await expect
      .poll(() => tip.getBoundingClientRect().right)
      .toBeLessThanOrEqual(320 - MARGIN + 0.5);
    const box = tip.getBoundingClientRect();
    expect(box.right).toBeLessThanOrEqual(320 - MARGIN + 0.5);
    expect(document.documentElement.scrollWidth).toBe(document.documentElement.clientWidth);
  });

  it("is dismissed by Escape in a pop-over, which stays open", async () => {
    await page.viewport(390, 844);
    render(
      inLanguage(
        <PopOver label="Solving mode" className="nt-secondary">
          <button type="button">On my own</button>
        </PopOver>,
      ),
    );
    await page.getByRole("button", { name: "Solving mode" }).click();
    await expect.element(page.getByRole("dialog", { name: "Solving mode" })).toBeVisible();
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(page.getByRole("button", { name: "Close" }).element());
    await tooltipShown("Close");
    await userEvent.keyboard("{Escape}");
    await noTooltip();
    await expect.element(page.getByRole("dialog", { name: "Solving mode" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});
