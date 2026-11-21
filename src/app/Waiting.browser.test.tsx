// The wait (the mockup's `wait` and `wait-home`): its ground at once — the sky with its stars, or
// the page —, never a white page, and the spark with "Loading" for a screen reader once the wait
// passes 0.3 s.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { inLanguage } from "../test/language.tsx";
import "../theme/theme.css";
import { WAIT_MS, Waiting } from "./Waiting.tsx";

describe("the wait", () => {
  it("shows the sky at once, and the spark and its status once the wait passes 0.3 s", async () => {
    render(inLanguage(<Waiting ground="sky" />, "ru"));
    const ground = document.querySelector("main.nt-wait-sky");
    expect(ground).not.toBeNull();
    expect(getComputedStyle(ground as Element).backgroundColor).toBe("rgb(11, 13, 46)");
    expect(document.querySelector(".nt-who-stars")).not.toBeNull();
    expect(document.querySelector(".nt-wait-spark")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("");
    await new Promise((done) => setTimeout(done, WAIT_MS + 50));
    expect(screen.getByRole("status")).toHaveTextContent("Загрузка");
    expect(document.querySelector(".nt-wait-spark svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the page's grey with no stars for the learner's screens", async () => {
    render(inLanguage(<Waiting ground="page" />));
    const ground = document.querySelector("main.nt-wait-page");
    expect(getComputedStyle(ground as Element).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(document.querySelector(".nt-who-stars")).toBeNull();
    await new Promise((done) => setTimeout(done, WAIT_MS + 50));
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
  });
});
