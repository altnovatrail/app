// The picture of a module's task solved on the sheet: its statement's text, drawn in the screen's
// own sans-serif, dark on white, left-aligned and wrapped, as the tracing paper shows it and the
// Check takes it — the same picture on the screen and for the model, so neither reads another
// text —, with the module's pictures of the task under the paragraphs they follow. The open view's
// statement is the module format's: its parts of text are the statement, in their order, and an
// engine's task adds its items' text and lines, a box drawn as a blank.

import type { StatementPiece } from "./moduleTask.ts";

/** The picture's width, px, and its padding: a statement of a line or two, read at any scale. */
const WIDTH = 1200;
const PAD = 48;
/** The letters' size and the lines' height, px. */
const SIZE = 44;
const LINE = Math.round(SIZE * 1.4);
const FONT = `${SIZE}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const INK = "#1D1D1F";

/** The text of a task's open view, the JSON of the format: its statement's parts of text, joined. */
export function statementText(json: Uint8Array): string {
  const task: unknown = JSON.parse(new TextDecoder().decode(json));
  const parts =
    typeof task === "object" && task !== null && "statement" in task ? task.statement : [];
  return (Array.isArray(parts) ? parts : [])
    .flatMap((part: unknown) =>
      typeof part === "object" && part !== null && "text" in part && typeof part.text === "string"
        ? [part.text.trim()]
        : [],
    )
    .filter((text) => text !== "")
    .join(" ");
}

/** The lines of text as wide as `fits` lets them be, word by word; a word too wide stands alone. */
export function wrapped(text: string, fits: (line: string) => boolean): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter((w) => w !== "")) {
    const longer = line === "" ? word : `${line} ${word}`;
    if (line !== "" && !fits(longer)) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  if (line !== "") lines.push(line);
  return lines.length === 0 ? [""] : lines;
}

/** How many of the picture's px a CSS px of a module's picture takes, as its text is to the screen's. */
const PX = SIZE / 20;
/** The room above a picture, under the paragraph before it. */
const GAP = Math.round(LINE / 3);

/** The statement drawn as a PNG, as tall as its lines. */
export function statementPicture(text: string): Promise<Blob> {
  return statementPictureOf([{ text }]);
}

/** A picture of the module decoded, or none when it cannot be: the statement goes on without it. */
async function decoded(picture: Blob): Promise<HTMLImageElement | undefined> {
  const image = new Image();
  image.src = URL.createObjectURL(picture);
  try {
    await image.decode();
    return image;
  } catch {
    URL.revokeObjectURL(image.src);
    return undefined;
  }
}

/** A piece laid out: its lines of text, or its picture at the size it is drawn. */
type Laid =
  | { readonly lines: readonly string[] }
  | { readonly image: HTMLImageElement; readonly width: number; readonly height: number };

/** The statement's pieces drawn as one PNG, each under the one before, as tall as they are. */
export async function statementPictureOf(pieces: readonly StatementPiece[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2D context to draw the statement");
  context.font = FONT;
  const room = WIDTH - 2 * PAD;
  const laid = await Promise.all(
    pieces.map(async (piece): Promise<Laid | undefined> => {
      if ("text" in piece)
        return { lines: wrapped(piece.text, (line) => context.measureText(line).width <= room) };
      const image = await decoded(piece.picture);
      if (image === undefined || image.naturalWidth === 0 || image.naturalHeight === 0)
        return undefined;
      const width = Math.min(room, (piece.width ?? image.naturalWidth) * PX);
      return { image, width, height: (width * image.naturalHeight) / image.naturalWidth };
    }),
  );
  const shown = laid.filter((piece) => piece !== undefined);
  const heightOf = (piece: Laid) =>
    "lines" in piece ? piece.lines.length * LINE : GAP + piece.height;
  canvas.width = WIDTH;
  canvas.height = Math.ceil(2 * PAD + shown.reduce((sum, piece) => sum + heightOf(piece), 0));
  // A size set resets the context's state: the font and the colours again.
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = FONT;
  context.fillStyle = INK;
  context.textBaseline = "middle";
  let top = PAD;
  for (const piece of shown) {
    if ("lines" in piece) {
      for (const [i, line] of piece.lines.entries())
        context.fillText(line, PAD, top + (i + 0.5) * LINE);
    } else {
      context.drawImage(piece.image, PAD, top + GAP, piece.width, piece.height);
      URL.revokeObjectURL(piece.image.src);
    }
    top += heightOf(piece);
  }
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (blob === null) throw new Error("the statement was not drawn");
  return blob;
}
