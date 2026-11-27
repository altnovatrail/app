// The tutor's panel, the one panel of the tutor on every screen, as the mockup's: on the task
// screen, beside an essay, on the page to pick from and on the screen of solving a task from paper.
// A screen gives it what it talks about and turns its parts on or off by its kit. Closed, it is the
// button at the window's right edge, where a screen has it; open, glass of 400 at the right, from
// under the top bar to 16 above the window's foot, and on a phone a sheet from the bottom, at half
// the height or by its grabber over the whole screen. Its head — the tutor's sign, its name, a line
// under it, on a task from paper grown-up mode's key, the switch of voicing and × —; while grown-up
// mode is on its band; what stands above the conversation, the step's card by steps; the
// conversation, which scrolls, from the tutor's greeting; the buttons at its foot; and under them
// the field, with its microphone and Send.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ReactNode, Ref } from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { readQuota, shareText } from "../account/quota.ts";
import { useApi } from "../api/ApiContext.tsx";
import { useGrabber } from "../app/grabber.ts";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useNarrow } from "../app/narrow.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";
import { useDictation } from "../voice/dictation.ts";
import { VoicingToggle } from "../voice/VoicingToggle.tsx";
import { GrownBand, PinDialog } from "./GrownUp.tsx";

/**
 * The tutor's button, the mockup's: 56 round, of glass, its sign in the tutor's gradient, at the
 * window's right edge in the middle of its height, and on a phone above the row; it opens the panel
 * (its caption is its name and its tooltip).
 */
function TutorButton({
  onOpen,
  buttonRef,
}: {
  readonly onOpen: () => void;
  readonly buttonRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className="nt-tutor-call">
      <IconButton
        ref={buttonRef}
        value="tutor"
        className="nt-tutor-button"
        aria-expanded={false}
        onClick={onOpen}
      />
    </div>
  );
}

/**
 * Where the focus goes as the panel opens and closes: the button pressed — the tutor's, ×, or a
 * button of the row the phone's sheet hides — goes with the press, so the focus goes to the panel's
 * heading, or back to the tutor's button, not to the page (2.4.3). A press that leaves the focus on
 * something still in sight keeps it there. `heading` goes to the panel, `call` to the button.
 */
export function usePanelFocus(shown: boolean) {
  const heading = useRef<HTMLHeadingElement>(null);
  const call = useRef<HTMLButtonElement>(null);
  const was = useRef(shown);
  useEffect(() => {
    if (was.current === shown) return;
    was.current = shown;
    const active = document.activeElement;
    if (active !== null && active !== document.body && active.getClientRects().length > 0) return;
    (shown ? heading.current : call.current)?.focus();
  }, [shown]);
  return { heading, call };
}

/**
 * The line of the panel's head: the learner's share of the quota, read anew at each opening and,
 * while it is open, at each change of `spent` — a token the screen makes anew with each answer that
 * spends the quota. None while closed, from an api that has no share, nor from one that failed.
 */
export function useQuotaLine(profileId: string, open: boolean, spent: unknown): string | undefined {
  const api = useApi();
  const { words } = useLanguage();
  const [quota, setQuota] = useState<string | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: what was spent reads the share again.
  useEffect(() => {
    if (!open) return;
    let current = true;
    readQuota(api, profileId, Action.LEARNING).then(
      (share) => {
        if (current) setQuota(shareText(share, words));
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [open, spent, api, profileId, words]);
  return quota;
}

/** The field of the panel, as a screen gives it; none, and the panel has no field. */
export interface AskKit {
  /** The field's name, and the line it shows while empty. */
  readonly label: string;
  readonly placeholder: string;
  /** The longest text, in code points: the contract's. */
  readonly max: number;
  /** The text as it goes, or none while nothing of it would: trimmed, as the contract takes it. */
  readonly ready: (draft: string) => string | undefined;
  /** The field waits: an answer is under way, AI is shut to the learner, or the task is over. */
  readonly off: boolean;
  /**
   * The microphone may stand: for a learner of the category adult. A browser without its
   * recognition of speech draws none all the same.
   */
  readonly microphone: boolean;
  /** The language the browser recognises speech in: that of the screens. */
  readonly language: string;
  /** Send, with the text, and whether it is the browser's reading of the voice as it came. */
  readonly onSend: (text: string, voice: boolean) => void;
  /**
   * A text that went and came back unanswered, put in the field again, so that Send sends it
   * again: each new `at` puts it there once; `stopped` when Stop took it back, which the field
   * says under it till the text changes.
   */
  readonly again?: { readonly text: string; readonly at: number; readonly stopped?: boolean };
  /**
   * Stop, while the answer to the text sent is awaited and may still be called off: it stands in
   * place of the microphone and Send. None, and there is nothing to stop.
   */
  readonly onStop?: (() => void) | undefined;
}

/**
 * What a screen turns on of the panel. Each part is one of the panel's, the same on every screen:
 * a screen gives what it has, and leaves out what it has not.
 */
export interface TutorKit {
  /** The switch of voicing in the head, in the language the words are voiced in. */
  readonly voicing?: { readonly language: string | undefined };
  /** The field, with its microphone. */
  readonly ask?: AskKit;
  /**
   * Grown-up mode's key in the head, before the switch of voicing, on a task from paper: pressed
   * while it is off, it asks the grown-ups' PIN, and the right one turns the mode on; pressed
   * while it is on, or Turn off of the band under the head, turns it off.
   */
  readonly grown?: { readonly on: boolean; readonly onChange: (on: boolean) => void };
  /** The button at the window's right edge that opens the panel while it is closed. */
  readonly side?: { readonly onOpen: () => void; readonly buttonRef?: Ref<HTMLButtonElement> };
}

/** A line of the learner's in the conversation: a bubble at the right, marked when said by voice. */
export function LearnerLine({ text, voice }: { readonly text: string; readonly voice?: boolean }) {
  const { words } = useLanguage();
  return (
    <div className="nt-said" data-who="learner">
      <p className="nt-bubble" data-who="learner">
        {text}
      </p>
      {voice === true ? (
        <span className="nt-said-voice">
          <Icon value="microphone" />
          {words.text("tutor.by-voice")}
        </span>
      ) : null}
    </div>
  );
}

/**
 * The tutor's panel, the one on every screen: what it talks about is the screen's — the greeting,
 * the lines of the conversation, the buttons at its foot —, and which of its parts stand is the
 * kit's: the switch of voicing, the field with its microphone, the button at the side. Closed, it
 * is that button, or nothing.
 */
export function TutorPanel({
  open = true,
  kit = {},
  headingRef,
  status,
  acting = false,
  onClose,
  above,
  greeting,
  talk,
  acts,
}: {
  /** The panel is open; closed, the button at the side stands, if the kit has it. */
  readonly open?: boolean;
  readonly kit?: TutorKit;
  /** The panel's heading, where the focus goes as it opens. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** The line under its name: the learner's share of the quota, or what it does here. */
  readonly status?: string | undefined;
  /** The line says what the tutor does right now, as "Writing on the sheet…": in the accent. */
  readonly acting?: boolean;
  /** Its ×; none, and it has none. */
  readonly onClose?: (() => void) | undefined;
  /** What stands above the conversation: the step's card. */
  readonly above?: ReactNode;
  /** The conversation's first line, the tutor's: what it does on this screen. */
  readonly greeting?: string | undefined;
  /** The conversation after its first line. */
  readonly talk: ReactNode;
  /** The buttons at the conversation's foot. */
  readonly acts?: ReactNode;
}) {
  const { words } = useLanguage();
  const narrow = useNarrow();
  // The phone's sheet at half the height, or by its grabber, tapped or dragged, over the whole
  // screen; each opening begins at half.
  const [full, setFull] = useState(false);
  const grab = useGrabber(".nt-tutor-panel", full, setFull);
  // The dialog of the grown-ups' PIN, which grown-up mode's key opens.
  const [pad, setPad] = useState(false);
  useEffect(() => {
    if (!open) {
      setFull(false);
      setPad(false);
    }
  }, [open]);
  const grown = kit.grown;
  if (!open) {
    return kit.side === undefined ? null : (
      <TutorButton onOpen={kit.side.onOpen} {...buttonRefOf(kit.side.buttonRef)} />
    );
  }
  return (
    <aside
      className="nt-tutor-panel nt-glass nt-glass-panel"
      data-size={full ? "full" : "half"}
      aria-label={words.text("task.tutor")}
    >
      {narrow ? (
        <IconButton
          value={full ? "half-screen" : "full-screen"}
          className="nt-tutor-grab"
          aria-expanded={full}
          {...grab}
        />
      ) : null}
      <div className="nt-tutor-head">
        <span className="nt-tutor-sign" aria-hidden="true">
          <Icon value="tutor" />
        </span>
        <div className="nt-tutor-names">
          <h2 ref={headingRef} tabIndex={-1}>
            {words.text("task.tutor")}
          </h2>
          {status === undefined ? null : (
            <span className="nt-tutor-status" data-acting={acting}>
              {status}
            </span>
          )}
        </div>
        {grown === undefined ? null : (
          <IconButton
            value="grown-up"
            className="nt-grown-key"
            chosen={grown.on}
            aria-pressed={grown.on}
            onClick={() => (grown.on ? grown.onChange(false) : setPad(true))}
          />
        )}
        {kit.voicing === undefined ? null : <VoicingToggle language={kit.voicing.language} />}
        {onClose === undefined ? null : <IconButton value="close" onClick={onClose} />}
      </div>
      <div className="nt-tutor-body">
        {grown?.on === true ? <GrownBand onOff={() => grown.onChange(false)} /> : null}
        {above}
        {/*
          It scrolls with the buttons at its foot inside, which a keyboard reaches, as the steps'
          card holds its own (2.1.1), and is held at its foot, where the newest words stand.
        */}
        <section className="nt-talk" aria-label={words.text("tutor.conversation")}>
          <div className="nt-talk-end">
            <div className="nt-talk-lines">
              {greeting === undefined ? null : <p className="nt-bubble">{greeting}</p>}
              {talk}
            </div>
            {acts === undefined || acts === null || acts === false ? null : (
              <div className="nt-tutor-acts">{acts}</div>
            )}
          </div>
        </section>
        {kit.ask === undefined ? null : <AskField ask={kit.ask} />}
      </div>
      {pad && grown !== undefined ? (
        <PinDialog
          onRight={() => {
            setPad(false);
            grown.onChange(true);
          }}
          onCancel={() => setPad(false)}
        />
      ) : null}
    </aside>
  );
}

function buttonRefOf(ref: Ref<HTMLButtonElement> | undefined) {
  return ref === undefined ? {} : { buttonRef: ref };
}

/** The text of the field with what the microphone heard after it, cut to `max` code points. */
export function withHeard(before: string, heard: string, max: number): string {
  const joined = before.trim() === "" ? heard : `${before.trimEnd()} ${heard}`;
  return [...joined].slice(0, max).join("");
}

/**
 * The field of the panel: one line at first, the microphone and Send at its right, that grows
 * with its lines up to five and then scrolls, Enter sends and Shift+Enter breaks the line — but
 * while an input method composes —; the microphone, where the kit and the browser allow it, which
 * listens till Stop and puts what it hears into the field as it hears it, in place of what it left
 * there before and the field still holds as it came; and Send. What came by voice waits in the field to be read and corrected:
 * nothing goes by itself. While an answer is awaited that may be called off, Stop stands in place
 * of the microphone and Send.
 */
function AskField({ ask }: { readonly ask: AskKit }) {
  const { words } = useLanguage();
  const [draft, setDraft] = useState("");
  // The text the microphone left in the field, while the field still holds it as it came.
  const [dictated, setDictated] = useState<string | undefined>(undefined);
  const [unheard, setUnheard] = useState(false);
  const [stopped, setStopped] = useState(false);
  // The field before the microphone began, and what it holds with what was heard after it.
  const before = useRef("");
  const latest = useRef("");
  const text = ask.ready(draft);
  const again = ask.again;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each new return puts the text once.
  useEffect(() => {
    if (again === undefined) return;
    setDraft(again.text);
    setDictated(undefined);
    setStopped(again.stopped === true);
  }, [again?.at]);
  const dictation = useDictation({
    language: ask.language,
    off: ask.off,
    onText: (heard) => {
      latest.current = withHeard(before.current, heard, ask.max);
      setDraft(latest.current);
    },
    onEnd: (heard) => {
      setUnheard(!heard);
      if (heard) setDictated(latest.current);
    },
  });
  const { listening } = dictation;
  const microphone = ask.microphone && dictation.available;
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
    if (ask.off || listening || text === undefined) return;
    const voice = dictated !== undefined && draft === dictated;
    setDraft("");
    setDictated(undefined);
    setUnheard(false);
    setStopped(false);
    ask.onSend(text, voice);
  };
  return (
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
        aria-label={ask.label}
        placeholder={ask.placeholder}
        maxLength={ask.max}
        enterKeyHint="send"
        disabled={ask.off}
        readOnly={listening}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setUnheard(false);
          setStopped(false);
        }}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter breaks the line, and so does Enter while a word is composed.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            send();
          }
        }}
      />
      <div className="nt-ask-buttons">
        {listening ? (
          <>
            <span className="nt-ask-listening" role="status">
              <span className="nt-ask-dot" aria-hidden="true" />
              {words.text("tutor.listening")}
            </span>
            <button type="button" className="nt-ask-stop" onClick={dictation.stop}>
              <Icon value="stop" />
              {words.text("tutor.stop")}
            </button>
          </>
        ) : ask.onStop !== undefined ? (
          <IconButton value="ask-stop" className="nt-ask-stop-asking" onClick={ask.onStop} />
        ) : (
          <>
            {microphone ? (
              <IconButton
                value="ask-voice"
                className="nt-ask-voice"
                disabled={ask.off}
                onClick={() => {
                  // A new listening takes away what the last one left, unless the learner changed it.
                  const kept =
                    dictated !== undefined && draft === dictated ? before.current : draft;
                  before.current = kept;
                  latest.current = kept;
                  setDraft(kept);
                  setUnheard(false);
                  setDictated(undefined);
                  setStopped(false);
                  dictation.start();
                }}
              />
            ) : null}
            <IconButton
              value="ask-send"
              className="nt-ask-send"
              disabled={ask.off || text === undefined}
              onClick={send}
            />
          </>
        )}
      </div>
      {!listening && dictated !== undefined && draft === dictated ? (
        <p className="nt-ask-said">{words.text("tutor.dictated")}</p>
      ) : unheard ? (
        <p className="nt-ask-said">{words.text("tutor.unheard")}</p>
      ) : stopped && ask.onStop === undefined ? (
        <p className="nt-ask-said" role="status">
          {words.text("tutor.stopped")}
        </p>
      ) : null}
    </form>
  );
}
