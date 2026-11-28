// The tutor's panel on the page to pick from, as the mockup's `pick-ask` and
// `pick-asked`: the one panel, with its line of what it takes — which tasks of the page and how they
// split —, each request of the learner's and the program's line of what it came to, Undo while the
// frames before can come back, and the panel's field of a request, with its Send and, for a learner
// of the category adult, its microphone. No word of the AI comes back: its answer is frames. The
// field is off while the finding runs and while AI is shut to the learner; while a request's
// finding runs, Stop stands in place of Send, and a request it took back is in the field again.
import type { Ref } from "react";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { VerdictLine } from "../solving/parts.tsx";
import { LearnerLine, TutorPanel } from "../solving/TutorPanel.tsx";
import type { Said } from "./PaperContext.tsx";
import { MAX_REQUEST, requestOf } from "./page.ts";

export function PageTutor({
  talk,
  busy,
  closed,
  adult,
  onAsk,
  again,
  onStop,
  onUndo,
  onClose,
  headingRef,
}: {
  readonly talk: readonly Said[];
  /** The finding is under way: the field and Undo wait. */
  readonly busy: boolean;
  /** AI is shut to the learner: the field is off. */
  readonly closed: boolean;
  /** The learner is of the category adult: the microphone stands. */
  readonly adult: boolean;
  /** A request, and whether it is the browser's reading of the voice as it came. */
  readonly onAsk: (request: string, voice: boolean) => void;
  /** A request Stop took back, to the field again. */
  readonly again?:
    | { readonly text: string; readonly at: number; readonly stopped?: boolean }
    | undefined;
  /** Stop, while a request's finding runs; none while nothing can be stopped. */
  readonly onStop?: (() => void) | undefined;
  /** Undo, while the frames before the last request can come back; none, and it is not drawn. */
  readonly onUndo?: (() => void) | undefined;
  readonly onClose: () => void;
  readonly headingRef?: Ref<HTMLHeadingElement>;
}) {
  const { language, words } = useLanguage();
  return (
    <TutorPanel
      headingRef={headingRef}
      status={words.text("paper.title")}
      onClose={onClose}
      kit={{
        ask: {
          label: words.text("paper.ask-label"),
          placeholder: words.text("paper.ask-placeholder"),
          max: MAX_REQUEST,
          ready: requestOf,
          off: busy || closed,
          microphone: adult,
          language,
          onSend: onAsk,
          ...(again === undefined ? {} : { again }),
          ...(onStop === undefined ? {} : { onStop }),
        },
      }}
      greeting={words.text("paper.ask-hello")}
      talk={
        <>
          {talk.map((said, i) =>
            said.kind === "request" ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: the conversation only grows.
              <LearnerLine key={i} text={said.text} voice={said.voice === true} />
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
    />
  );
}
