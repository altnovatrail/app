// The body of a legal text as elements of React (section 3.8 of docs/architecture.md; R27 in
// docs/decisions.md): CommonMark with the tables of GitHub's flavour, as the legal part of spec
// writes it, with no HTML, no image and no link (section 4 of its text). The lexer of marked reads
// it, and each token becomes an element here: no HTML string is made and none is set, so that
// nothing of the text runs or leads out. HTML, a link and an image, which the part refuses, come
// out as their text — the raw tag, the link's words, the image's description — rather than as what
// they would be. A heading keeps its order below the level the page gives it.
import type { Token, Tokens } from "marked";
import { type ReactNode, useMemo } from "react";
import { decoded, tokensOf } from "./body.ts";

/**
 * Each item with where it begins among its kin, by the length of those before it: a key of its
 * own, the same at every reading of the same text, since tokens carry no ID.
 */
function placed<T>(items: readonly T[], length: (item: T) => number): [T, number][] {
  let at = 0;
  return items.map((item) => {
    const begins = at;
    at += length(item) + 1;
    return [item, begins];
  });
}

const raw = (token: Token): number => token.raw.length;

function inline(tokens: readonly Token[] = []): ReactNode[] {
  return placed(tokens, raw).map(([token, at]) => {
    switch (token.type) {
      case "strong":
        return <strong key={at}>{inline(token.tokens)}</strong>;
      case "em":
        return <em key={at}>{inline(token.tokens)}</em>;
      case "del":
        return <del key={at}>{inline(token.tokens)}</del>;
      case "codespan":
        // CommonMark reads no character reference in a code span: it stays as written.
        return <code key={at}>{token.text}</code>;
      case "br":
        return <br key={at} />;
      // The part holds no link and no image: their words are text, and lead nowhere.
      case "link":
        return <span key={at}>{inline(token.tokens)}</span>;
      case "image":
        return decoded(token.text);
      case "html":
        return token.raw;
      // Text within a block: what is inline in it marked has read already.
      case "text":
        return decoded(token.text);
      default:
        return "text" in token && typeof token.text === "string" ? decoded(token.text) : null;
    }
  });
}

function cells(row: readonly Tokens.TableCell[], header: boolean): ReactNode[] {
  return placed(row, (cell) => cell.text.length).map(([cell, at]) => {
    const style = cell.align === null ? undefined : { textAlign: cell.align };
    return header ? (
      <th key={at} scope="col" style={style}>
        {inline(cell.tokens)}
      </th>
    ) : (
      <td key={at} style={style}>
        {inline(cell.tokens)}
      </td>
    );
  });
}

function blocks(tokens: readonly Token[] = [], level = 1): ReactNode[] {
  return placed(tokens, raw).map(([token, at]) => {
    switch (token.type) {
      case "heading": {
        const Heading = `h${Math.min(6, level + token.depth - 1)}` as "h1";
        return <Heading key={at}>{inline(token.tokens)}</Heading>;
      }
      case "paragraph":
        return <p key={at}>{inline(token.tokens)}</p>;
      case "list": {
        const list = token as Tokens.List;
        const items = placed(list.items, (item) => item.raw.length).map(([item, from]) => (
          <li key={from}>{blocks(item.tokens, level)}</li>
        ));
        return list.ordered ? (
          <ol key={at} {...(list.start === "" || list.start === 1 ? {} : { start: list.start })}>
            {items}
          </ol>
        ) : (
          <ul key={at}>{items}</ul>
        );
      }
      case "table": {
        const table = token as Tokens.Table;
        const size = (row: readonly Tokens.TableCell[]) =>
          row.reduce((sum, cell) => sum + cell.text.length + 1, 0);
        return (
          <table key={at}>
            <thead>
              <tr>{cells(table.header, true)}</tr>
            </thead>
            <tbody>
              {placed(table.rows, size).map(([row, from]) => (
                <tr key={from}>{cells(row, false)}</tr>
              ))}
            </tbody>
          </table>
        );
      }
      case "blockquote":
        return <blockquote key={at}>{blocks(token.tokens, level)}</blockquote>;
      case "code":
        return (
          <pre key={at}>
            <code>{token.text}</code>
          </pre>
        );
      case "hr":
        return <hr key={at} />;
      case "html":
        return <p key={at}>{token.raw.trim()}</p>;
      // The text of an item of a tight list, which marked reads inline: no paragraph around it.
      case "text":
        return <span key={at}>{inline(token.tokens)}</span>;
      default:
        // A space between blocks, and a definition of a link, which the part has none of.
        return null;
    }
  });
}

/**
 * A body as elements, its first heading at `level` — the level below the page's own — and the
 * rest in their order beneath it, none deeper than 6.
 */
export function Markdown({ body, level }: { readonly body: string; readonly level: number }) {
  // A body is lexed once, not at each keystroke of the form around it.
  const shown = useMemo(() => blocks(tokensOf(body), level), [body, level]);
  return <>{shown}</>;
}
