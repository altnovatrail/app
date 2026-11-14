// The checks of accessibility every screen's test runs in each engine (section 3.9 of
// docs/architecture.md; R11 in docs/decisions.md): axe-core by the rules of WCAG 2.2 A and AA,
// outside the canvas element, whose own CI checks it; each target at least 44 × 44 CSS px; and a
// page that does not scroll sideways, with no text cut or spilling out of its box.
import axe from "axe-core";

/** The tags of the rules of the standard: WCAG 2.0, 2.1 and 2.2, levels A and AA. */
const STANDARD = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** What axe-core finds against the standard, a line for each rule and the nodes it found. */
export async function axeViolations(root: Element = document.body): Promise<string[]> {
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
