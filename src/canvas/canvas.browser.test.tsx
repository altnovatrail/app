// The probe of the element in JSX: the package registers it on import, before the first render
// (R42 in canvas), React gives it its properties and listens for its events, and the types of its
// contract are spec's (section 3.1 of docs/architecture.md).
import "@altnovatrail/canvas";
import type { CanvasElement, HistoryChangeEvent, Media } from "@altnovatrail/spec/canvas";
import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";

describe("<novatrail-canvas> in JSX", () => {
  it("is the registered element, and takes its language as an attribute and media as a property", () => {
    const media: Media = () => Promise.reject(new Error("no file in this test"));
    const ref = createRef<CanvasElement>();
    render(<novatrail-canvas ref={ref} lang="ru" tool="pen" media={media} />);
    const element = ref.current;
    expect(element).toBeInstanceOf(
      customElements.get("novatrail-canvas") as CustomElementConstructor,
    );
    expect(element?.getAttribute("lang")).toBe("ru");
    expect(element?.media).toBe(media);
    expect(element?.tool).toBe("pen");
    expect(element?.hasAttribute("media")).toBe(false);
  });

  it("hands the element's events to the listener named in lower case", () => {
    const changed = vi.fn<(event: HistoryChangeEvent) => void>();
    const ref = createRef<CanvasElement>();
    render(<novatrail-canvas ref={ref} onhistorychange={changed} />);
    const detail = { events: [], from: 0 };
    ref.current?.dispatchEvent(new CustomEvent("historychange", { detail }));
    expect(changed).toHaveBeenCalledOnce();
    expect(changed.mock.calls[0]?.[0].detail).toEqual(detail);
  });

  it("holds the contract's types: a tool the contract does not name does not compile", () => {
    // Never rendered: tsc checks it, and an unused directive would fail ci-lint.
    const wrong = () => (
      // @ts-expect-error -- "brush" is no Tool of the contract.
      <novatrail-canvas tool="brush" />
    );
    expect(typeof wrong).toBe("function");
  });
});
