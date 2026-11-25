// The picture of a module's task solved on the sheet: its statement's text, drawn in the screen's
// own sans-serif, dark on white, left-aligned and wrapped, as the tracing paper shows it and the
// Check takes it — the same picture on the screen and for the model, so neither reads another
// text. The open view's statement is the module format's: its parts of text are the statement, in
// their order.

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

/** The statement drawn as a PNG, as tall as its lines. */
export async function statementPicture(text: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  const measure = canvas.getContext("2d");
  if (measure === null) throw new Error("no 2D context to draw the statement");
  measure.font = FONT;
  const lines = wrapped(text, (line) => measure.measureText(line).width <= WIDTH - 2 * PAD);
  canvas.width = WIDTH;
  canvas.height = 2 * PAD + lines.length * LINE;
  // A size set clears the context: the font and the colours again.
  const context = canvas.getContext("2d");
  if (context === null) throw new Error("no 2D context to draw the statement");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = FONT;
  context.fillStyle = INK;
  context.textBaseline = "middle";
  for (const [i, line] of lines.entries()) context.fillText(line, PAD, PAD + (i + 0.5) * LINE);
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
  if (blob === null) throw new Error("the statement was not drawn");
  return blob;
}
