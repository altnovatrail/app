// The tutor's button and its panel, as the mockup's: those of the task screen and
// of an essay, and of the page to pick from, where the learner asks how to find its tasks.
// Closed, it is the button at the window's right edge; open, glass of 400 at the right, from under
// the top bar to 16 above the window's foot, and on a phone a sheet from the bottom, at half the
// height or by its grabber over the whole screen. Its head — the tutor's sign, its name, a line
// under it, the switch of voicing and × —; what stands above the conversation, the step's card by
// steps; the conversation, which scrolls; the buttons at its foot; and under them what the screen
// puts there, the field of a request. The screen of solving a task from paper has them too.
import { Action } from "@altnovatrail/contracts/novatrail/api/v1/attempt_pb.js";
import type { ReactNode, Ref } from "react";
import { useEffect, useRef, useState } from "react";
import { readQuota, shareText } from "../account/quota.ts";
import { useApi } from "../api/ApiContext.tsx";
import { Icon } from "../app/Icon.tsx";
import { IconButton } from "../app/IconButton.tsx";
import { useNarrow } from "../app/narrow.ts";
import { useLanguage } from "../i18n/LanguageContext.tsx";

/**
 * The tutor's button, the mockup's: 56 round, of glass, its sign in the tutor's gradient, at the
 * window's right edge in the middle of its height, and on a phone above the row; it opens the panel
 * (its caption is its name and its tooltip).
 */
export function TutorButton({
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

export function TutorPanel({
  headingRef,
  status,
  voicing,
  onClose,
  above,
  talk,
  acts,
  foot,
}: {
  /** The panel's heading, where the focus goes as it opens. */
  readonly headingRef?: Ref<HTMLHeadingElement>;
  /** The line under its name: the learner's share of the quota. */
  readonly status?: string | undefined;
  /** The switch of voicing in its head. */
  readonly voicing?: ReactNode;
  /** Its ×; none, and it has none. */
  readonly onClose?: (() => void) | undefined;
  /** What stands above the conversation: the step's card. */
  readonly above?: ReactNode;
  /** The conversation after its first line. */
  readonly talk: ReactNode;
  /** The buttons at the conversation's foot. */
  readonly acts?: ReactNode;
  /** What stands under the conversation: the field of a request. */
  readonly foot?: ReactNode;
}) {
  const { words } = useLanguage();
  const narrow = useNarrow();
  // The phone's sheet at half the height, or by its grabber over the whole screen; each opening
  // begins at half.
  const [full, setFull] = useState(false);
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
          onClick={() => setFull((was) => !was)}
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
          {status === undefined ? null : <span className="nt-tutor-status">{status}</span>}
        </div>
        {voicing}
        {onClose === undefined ? null : <IconButton value="close" onClick={onClose} />}
      </div>
      <div className="nt-tutor-body">
        {above}
        {/*
          It scrolls with the buttons at its foot inside, which a keyboard reaches, as the steps'
          card holds its own (2.1.1), and is held at its foot, where the newest words stand.
        */}
        <section className="nt-talk" aria-label={words.text("tutor.conversation")}>
          <div className="nt-talk-end">
            <div className="nt-talk-lines">{talk}</div>
            {acts === undefined || acts === null ? null : (
              <div className="nt-tutor-acts">{acts}</div>
            )}
          </div>
        </section>
        {foot}
      </div>
    </aside>
  );
}
