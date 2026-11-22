// What a test sees of a part of a screen being read (R168 spec): the part busy, with the shapes of
// what is to come and the one status that says "Loading"; and once it came, neither.
import { expect } from "vitest";

/** A read held until the test lets it go. */
export function held(): { readonly given: Promise<void>; readonly give: () => void } {
  let give = () => {};
  const given = new Promise<void>((resolve) => {
    give = resolve;
  });
  return { given, give };
}

/** `within` is busy, holds `shapes` at least, and one status of it says "Loading". */
export function expectLoading(within: ParentNode, shapes = 1) {
  const busy = [...within.querySelectorAll('[aria-busy="true"]')];
  expect(busy.length).toBeGreaterThan(0);
  expect(busy.flatMap((part) => [...part.querySelectorAll(".nt-sk")]).length).toBeGreaterThan(
    shapes - 1,
  );
  const said = busy.flatMap((part) => [...part.querySelectorAll('[role="status"]')]);
  expect(said.map((status) => status.textContent)).toContain("Loading");
}

/** Nothing in `within` is busy, and no shape is left. */
export function expectLoaded(within: ParentNode) {
  expect(within.querySelector("[aria-busy], .nt-sk")).toBeNull();
}
