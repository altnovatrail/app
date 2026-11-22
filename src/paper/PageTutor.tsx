// The tutor's panel on the page to pick from (R74; R165 spec), as the mockup's `pick-ask` and
// `pick-asked`: the line of what it takes — which tasks of the page and how they split —, each
// request of the learner's and the program's line of what it came to, Undo while the frames before
// can come back, and the field of a request, with no reminder of names above it, its Send and its
// microphone, off until voice comes (R165 spec). No word of the AI comes back: its answer is
// frames. The field is off while the finding runs and while AI is shut to the learner.
import { type Ref, useLayoutEffect, useRef, useState } from "react";
import { IconButton } from "../app/IconButton.tsx";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { VerdictLine } from "../task/TaskLayout.tsx";
import { TutorPanel } from "../task/TutorPanel.tsx";
import type { Said } from "./PaperContext.tsx";
import { MAX_REQUEST, requestOf } from "./page.ts";

export function PageTutor({
  talk,
  busy,
  closed,
  onAsk,
  onUndo,
  onClose,
  headingRef,
}: {
  readonly talk: readonly Said[];
  /** The finding is under way: the field and Undo wait. */
  readonly busy: boolean;
  /** AI is shut to the learner: the field is off. */
  readonly closed: boolean;
  readonly onAsk: (request: string) => void;
  /** Undo, while the frames before the last request can come back; none, and it is not drawn. */
  readonly onUndo?: (() => void) | undefined;
  readonly onClose: () => void;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { words } = useLanguage();
  const [draft, setDraft] = useState("");
  const request = requestOf(draft);
  const off = busy || closed;
  // The field grows down with its lines, up to the height CSS gives it, and then scrolls.
  const field = useRef<HTMLTextAreaElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the height follows the draft.
  useLayoutEffect(() => {
    const area = field.current;
    if (area === null) return;
    area.style.blockSize = "auto";
    area.style.blockSize = `${area.scrollHeight}px`;
  }, [draft]);
  const send = () => {
    if (off || request === undefined) return;
    setDraft("");
    onAsk(request);
  };
  return (
    <TutorPanel
      headingRef={headingRef}
      status={words.text("paper.title")}
      onClose={onClose}
      talk={
        <>
          <p className="nt-bubble">{words.text("paper.ask-hello")}</p>
          {talk.map((said, i) =>
            said.kind === "request" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
              <p key={i} className="nt-bubble" data-who="learner">
                {said.text}
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
              <div key={i} role="status">
                <VerdictLine
                  kind="write"
                  title={
                    said.kind === "found"
                      ? words.text("paper.asked-found", { count: said.count })
                      : said.kind === "none"
                        ? words.text("paper.asked-none")
                        : words.text("paper.undone")
                  }
                  line={
                    said.kind === "found"
                      ? words.text("paper.asked-found-line")
                      : said.kind === "none"
                        ? words.text("paper.asked-none-line")
                        : undefined
                  }
                />
              </div>
            ),
          )}
          {busy && talk.at(-1)?.kind === "request" ? (
            <p className="nt-typing" role="status">
              {words.text("paper.finding")}
            </p>
          ) : null}
        </>
      }
      acts={
        onUndo === undefined ? undefined : (
          <button
            type="button"
            className="nt-act"
            {...(busy ? { "aria-disabled": true } : {})}
            onClick={() => {
              if (!busy) onUndo();
            }}
          >
            {words.text("paper.undo")}
          </button>
        )
      }
      foot={
        <form
          className="nt-ask"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <textarea
            ref={field}
            className="nt-ask-input"
            rows={1}
            aria-label={words.text("paper.ask-label")}
            placeholder={words.text("paper.ask-placeholder")}
            maxLength={MAX_REQUEST}
            enterKeyHint="send"
            disabled={off}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, as the field's one line did; Shift+Enter breaks the line.
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <div className="nt-ask-buttons">
            <IconButton value="ask-voice" className="nt-ask-voice" disabled />
            <IconButton
              value="ask-send"
              className="nt-ask-send"
              disabled={off || request === undefined}
              onClick={send}
            />
          </div>
        </form>
      }
    />
  );
}
