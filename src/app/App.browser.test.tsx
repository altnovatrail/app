import { render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App.tsx";
import { HOME, navigate, routeOf } from "./router.ts";

/** Sets the hash and waits for its hashchange. */
async function setHash(hash: string): Promise<void> {
  const changed = new Promise((resolve) =>
    window.addEventListener("hashchange", resolve, { once: true }),
  );
  window.location.hash = hash;
  await changed;
}

afterEach(async () => {
  vi.restoreAllMocks();
  if (window.location.hash !== "") await setHash("");
});

describe("App", () => {
  it("shows the home screen with its heading", () => {
    render(<App />);
    expect(screen.getByRole("heading", { level: 1, name: "NovaTrail" })).toBeTruthy();
  });

  it("follows the hash, and shows the home screen for one it does not know", async () => {
    const { container } = render(<App />);
    await act(() => setHash("#/nowhere"));
    expect(container.querySelector("[data-screen]")?.getAttribute("data-screen")).toBe("home");
  });

  it("removes its listener of the hash once it is unmounted", () => {
    const added = vi.spyOn(window, "addEventListener");
    const removed = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<App />);
    const listener = added.mock.calls.find(([type]) => type === "hashchange")?.[1];
    expect(listener).toBeTypeOf("function");
    unmount();
    expect(removed).toHaveBeenCalledWith("hashchange", listener);
  });
});

describe("navigate", () => {
  it("adds an entry of the history for a new route, and none for the route already shown", async () => {
    const before = window.history.length;
    navigate(HOME);
    expect(window.location.hash).toBe("");
    expect(window.history.length).toBe(before);
    await setHash("#/h%6Fme");
    const spelt = window.history.length;
    navigate(HOME);
    expect(window.history.length).toBe(spelt);
  });

  it("writes the hash of a route the page does not show", async () => {
    await setHash("#/nowhere/x");
    navigate({ screen: "home", parts: ["a"] });
    expect(window.location.hash).toBe("#/home/a");
  });
});

describe("routeOf", () => {
  it("gives the same object for the same hash, and a new one for another", () => {
    const first = routeOf("#/home/a");
    expect(routeOf("#/home/a")).toBe(first);
    expect(routeOf("#/home/b")).not.toBe(first);
    expect(routeOf("#/home/b")).toEqual({ screen: "home", parts: ["b"] });
  });
});
