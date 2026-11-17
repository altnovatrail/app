// The checks of accessibility every screen's test runs in each engine (section 3.9 of
// docs/architecture.md; R11 in docs/decisions.md): axe-core by the rules of WCAG 2.2 A and AA,
// outside the canvas element, whose own CI checks it; each target at least 44 × 44 CSS px; and a
// page that does not scroll sideways, with no text cut or spilling out of its box; and a button
// that shows no caption only from the closed list, named by its caption (R60).
import axe from "axe-core";
import { CAPTIONLESS } from "../app/IconButton.tsx";
import type { Words } from "../i18n/words.ts";

/** The tags of the rules of the standard: WCAG 2.0, 2.1 and 2.2, levels A and AA. */
const STANDARD = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** What axe-core finds against the standard, a line for each rule and the nodes it found. */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
  // A colour in its transition, a button just enabled, is read as it ends, not halfway through.
  await Promise.all(
    document
      .getAnimations()
      .filter((animation) => "transitionProperty" in animation)
      .map((animation) => animation.finished.catch(() => {})),
  );
  const result = await axe.run(
    { include: [root], exclude: [["novatrail-canvas"]] },
    { runOnly: { type: "tag", values: STANDARD }, resultTypes: ["violations"] },
  );
  return result.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
}

const TARGETS = "button, a[href], input, select, textarea, [role='button'], [tabindex='0']";
/** The least a target is across and down, CSS px (2.5.5 Target Size (Enhanced)). */
export const TARGET_PX = 44;

/** The targets smaller than 44 × 44 CSS px, by their text and size. */
export function smallTargets(root: ParentNode = document): string[] {
  return [...root.querySelectorAll<HTMLElement>(TARGETS)]
    .filter((target) => target.closest("novatrail-canvas") === null)
    .map((target) => ({ target, box: target.getBoundingClientRect() }))
    .filter(({ box }) => box.width < TARGET_PX || box.height < TARGET_PX)
    .map(({ target, box }) => `${target.textContent ?? ""} ${box.width}×${box.height}`);
}

/**
 * What does not fit the width: the page scrolling sideways, and every box whose content is wider
 * than it — text cut or spilling out (1.4.10 Reflow).
 */
export function overflows(root: Element = document.body): string[] {
  const found: string[] = [];
  const page = document.documentElement;
  if (page.scrollWidth > page.clientWidth) {
    found.push(`the page scrolls sideways: ${page.scrollWidth} > ${page.clientWidth}`);
  }
  for (const element of root.querySelectorAll<HTMLElement>("*")) {
    if (element.closest("novatrail-canvas") !== null || element.clientWidth === 0) continue;
    if (element.scrollWidth > element.clientWidth + 1) {
      found.push(
        `${element.tagName.toLowerCase()} "${element.textContent ?? ""}": ${element.scrollWidth} > ${element.clientWidth}`,
      );
    }
  }
  return found;
}

/**
 * The buttons that show no text but are not of the closed list (R60), by their names: a button of
 * the list is an IconButton, named by its caption in the screen's words, and every other button
 * shows its caption.
 */
export function captionlessOffList(words: Words, root: ParentNode = document): string[] {
  const listed = new Set(Object.values(CAPTIONLESS).map(({ word }) => words.text(word)));
  return [...root.querySelectorAll("button")]
    .filter((button) => button.closest("novatrail-canvas") === null)
    .filter((button) => (button.textContent ?? "").trim() === "")
    .filter(
      (button) =>
        !button.classList.contains("nt-icon-only") ||
        !listed.has(button.getAttribute("aria-label") ?? ""),
    )
    .map((button) => button.getAttribute("aria-label") ?? "");
}
