// The pseudo-language of the tests (section 3.8 of docs/architecture.md): English with accents and
// half as long again, its places as they are, so that a screen shows where a longer language would
// wrap, overflow or be cut. It never ships.
import { en } from "../i18n/en.ts";
import type { Entry } from "../i18n/types.ts";
import { pieces, type Strings } from "../i18n/words.ts";

const ACCENTS: Readonly<Record<string, string>> = {
  a: "á",
  e: "é",
  i: "í",
  o: "ő",
  u: "ű",
  c: "ç",
  n: "ñ",
  s: "š",
  y: "ý",
  z: "ž",
  A: "Á",
  E: "É",
  I: "Í",
  O: "Ő",
  U: "Ű",
  C: "Ç",
  N: "Ñ",
  S: "Š",
  Y: "Ý",
  Z: "Ž",
};

/** A string in the pseudo-language: accented outside its places, then padded to half as long again. */
export function pseudoString(text: string): string {
  const accented = pieces(text)
    .map((piece) =>
      "text" in piece
        ? piece.text.replace(/[a-zA-Z]/g, (c) => ACCENTS[c] ?? c)
        : `{${piece.place}}`,
    )
    .join("");
  const extra = Math.ceil(text.length / 2);
  const filler = Array.from({ length: extra }, (_, i) => (i % 6 === 5 ? " " : "ļ")).join("");
  return `${accented} ${filler}`.trimEnd();
}

function pseudoEntry(entry: Entry): Entry {
  if (typeof entry === "string") return pseudoString(entry);
  return {
    plural: Object.fromEntries(Object.entries(entry.plural).map(([k, v]) => [k, pseudoString(v)])),
  };
}

/** The English dictionary in the pseudo-language. */
export const PSEUDO = Object.fromEntries(
  Object.entries(en).map(([key, entry]) => [key, pseudoEntry(entry)]),
) as unknown as Strings;
