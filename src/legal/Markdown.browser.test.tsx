// The body of a legal text in Chromium (R27): each block of CommonMark and GitHub's tables as its
// element, headings below the page's own, and what the legal part refuses — HTML, a link, an
// image — as text, with no element of its own and nothing that leads out.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./Markdown.tsx";

const BODY = [
  "# Title",
  "",
  "## Part &amp; whole",
  "",
  "Plain *em* **strong** ~~del~~ `a &amp; b` and a line  ",
  "break, &copy; as a sign, [words](https://example.org) ![a picture](p.png) <i>tag</i> \\*.",
  "",
  "- one",
  "- two **bold**",
  "",
  "3. third",
  "4. fourth",
  "",
  "1) first",
  "",
  "> quoted",
  "",
  "    indented code",
  "",
  "---",
  "",
  "<div>a block</div>",
  "",
  "| Left | Right |",
  "|:-----|------:|",
  "| a    | b     |",
  "",
].join("\n");

describe("the body of a legal text", () => {
  it("draws each block as its element, below the page's level", () => {
    const { container } = render(<Markdown body={BODY} level={2} />);
    expect(
      [...container.querySelectorAll("h2, h3")].map((h) => [h.tagName, h.textContent]),
    ).toEqual([
      ["H2", "Title"],
      ["H3", "Part & whole"],
    ]);
    const paragraph = container.querySelector("p");
    expect(paragraph?.querySelector("em")?.textContent).toBe("em");
    expect(paragraph?.querySelector("strong")?.textContent).toBe("strong");
    expect(paragraph?.querySelector("del")?.textContent).toBe("del");
    // CommonMark reads no character reference in a code span.
    expect(paragraph?.querySelector("code")?.textContent).toBe("a &amp; b");
    expect(paragraph?.querySelector("br")).not.toBeNull();
    expect(container.querySelector("ul")?.textContent).toBe("onetwo bold");
    const lists = container.querySelectorAll("ol");
    expect(lists[0]?.getAttribute("start")).toBe("3");
    expect(lists[1]?.hasAttribute("start")).toBe(false);
    expect(container.querySelector("blockquote")?.textContent).toBe("quoted");
    expect(container.querySelector("pre code")?.textContent).toBe("indented code");
    expect(container.querySelector("hr")).not.toBeNull();
    expect(container.querySelector("th")?.getAttribute("style")).toBe("text-align: left;");
    expect(container.querySelectorAll("td")[1]?.getAttribute("style")).toBe("text-align: right;");
  });

  it("keeps HTML, a link and an image as text, with nothing that leads out", () => {
    const { container } = render(<Markdown body={BODY} level={2} />);
    expect(container.querySelector("a, img, i, div")).toBeNull();
    expect(container.querySelector("p")?.textContent).toBe(
      "Plain em strong del a &amp; b and a linebreak, © as a sign, words a picture <i>tag</i> *.",
    );
    expect([...container.querySelectorAll("p")].map((p) => p.textContent)).toContain(
      "<div>a block</div>",
    );
  });

  it("goes no deeper than the sixth level", () => {
    const { container } = render(<Markdown body={"# One\n\n###### Six"} level={5} />);
    expect([...container.querySelectorAll("h5, h6")].map((h) => h.tagName)).toEqual(["H5", "H6"]);
  });
});
