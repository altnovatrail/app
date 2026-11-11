// The body of a legal text as marked reads it (R27 in docs/decisions.md): CommonMark with the tables
// of GitHub's flavour, its title, and the character references it may hold. ./Markdown.tsx draws
// it. No DOM.
import { Lexer, type Token } from "marked";

/**
 * The named character references a text may hold, as CommonMark reads them: the markup's own and
 * the typography of a legal text. marked reads the numeric ones itself, and another name stays as
 * it is written: the texts of spec's legal part are UTF-8 and hold none.
 */
const NAMED: Readonly<Record<string, number>> = {
  amp: 0x26,
  lt: 0x3c,
  gt: 0x3e,
  quot: 0x22,
  apos: 0x27,
  nbsp: 0xa0,
  copy: 0xa9,
  reg: 0xae,
  trade: 0x2122,
  sect: 0xa7,
  para: 0xb6,
  deg: 0xb0,
  times: 0xd7,
  ndash: 0x2013,
  mdash: 0x2014,
  hellip: 0x2026,
  laquo: 0xab,
  raquo: 0xbb,
  lsquo: 0x2018,
  rsquo: 0x2019,
  ldquo: 0x201c,
  rdquo: 0x201d,
  bdquo: 0x201e,
};

/** A text with the named references above read as their characters. */
export function decoded(text: string): string {
  return text.replace(/&([a-z]+);/g, (whole, name: string) => {
    const point = NAMED[name];
    return point === undefined ? whole : String.fromCodePoint(point);
  });
}

/** The tokens of a body, as marked's lexer reads CommonMark with GitHub's tables. */
export function tokensOf(body: string): Token[] {
  return Lexer.lex(body, { gfm: true });
}

/** What tokens say, with no markup: the words of emphasis and of a link, a code span as written. */
export function plainText(tokens: readonly Token[] = []): string {
  return tokens
    .map((token) => {
      if (token.type === "codespan") return token.text;
      if (token.type === "html") return token.raw;
      if ("tokens" in token && token.tokens !== undefined) return plainText(token.tokens);
      return "text" in token && typeof token.text === "string" ? decoded(token.text) : "";
    })
    .join("");
}

/** The text of a heading of the first level that begins a body, the text's title, as words. */
export function titleOf(body: string): string | undefined {
  const first = tokensOf(body).find((token) => token.type !== "space");
  return first?.type === "heading" && first.depth === 1 ? plainText(first.tokens) : undefined;
}
